const { query, transaction } = require("../../db");
const logger = require("../logger");
const userRepo = require("../repositories/userRepository");
const userRoleRepo = require("../repositories/userRoleRepository");
const notificationService = require("./notificationService");
const leaveCover = require("./leaveCover");

// Remplaçants d'un congé accepté (voir migration 067 et leaveCover.js).
// L'admin choisit, à la validation, un ou plusieurs remplaçants par portée (conseiller / Responsable
// Dossier) avec un pourcentage ; il peut ensuite confier un étudiant précis à un remplaçant précis.

const SCOPES = ["SALES", "RDV"];
const SCOPE_LABELS = { SALES: "Conseiller", RDV: "Responsable Dossier" };

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const fullName = (prenom, nom) => `${prenom || ""} ${nom || ""}`.trim();
const frDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" });
const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

// Portées concernées par le congé de cet employé (ses rôles commerciaux).
async function scopesOf(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw fail("Employé introuvable.", 404);
  const roles = await userRoleRepo.getEffectiveRoles(user);
  return { user, scopes: SCOPES.filter((scope) => roles.includes(scope)) };
}

// Portefeuille actuel : étudiants (et, pour un conseiller, contacts WhatsApp sans compte).
async function portfolio(userId, scope) {
  if (scope === "SALES") {
    const students = await query(
      `SELECT u.id, u.prenom, u.nom FROM student_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.assigned_sales_id = $1 AND u.role = 'STUDENT' AND u.is_active IS NOT FALSE
       ORDER BY u.prenom, u.nom`,
      [userId]
    );
    const contacts = await query(
      `SELECT id, phone, profile_name FROM whatsapp_contacts
       WHERE assigned_sales_id = $1 AND student_id IS NULL AND blocked_at IS NULL
       ORDER BY last_message_at DESC NULLS LAST`,
      [userId]
    );
    return [
      ...students.rows.map((row) => ({ id: row.id, kind: "student", name: fullName(row.prenom, row.nom) })),
      ...contacts.rows.map((row) => ({ id: row.id, kind: "contact", name: row.profile_name ? `${row.profile_name} (WhatsApp)` : `+${row.phone} (WhatsApp)` }))
    ];
  }
  const students = await query(
    `SELECT DISTINCT u.id, u.prenom, u.nom FROM university_applications ua JOIN users u ON u.id = ua.student_id
     WHERE ua.assigned_rdv_id = $1 AND ua.status NOT IN ('CLOSED', 'REJECTED')
     ORDER BY u.prenom, u.nom`,
    [userId]
  );
  return students.rows.map((row) => ({ id: row.id, kind: "student", name: fullName(row.prenom, row.nom) }));
}

// Un remplaçant ne peut pas être lui-même en congé, ni déjà remplacé, sur ces dates.
async function unavailability(candidateId, startOn, endOn, exceptLeaveId) {
  const leave = await query(
    `SELECT start_on::text AS start_on, end_on::text AS end_on FROM hr_leave_requests
     WHERE user_id = $1 AND status = 'APPROVED' AND start_on <= $3 AND end_on >= $2 AND ($4::uuid IS NULL OR id <> $4)
     LIMIT 1`,
    [candidateId, startOn, endOn, exceptLeaveId || null]
  );
  if (leave.rowCount) return `En congé du ${frDay(leave.rows[0].start_on)} au ${frDay(leave.rows[0].end_on)}`;
  return null;
}

async function candidates(absentId, scope, startOn, endOn, exceptLeaveId) {
  const rows = (await userRoleRepo.listUsersWithRole(scope)).filter((row) => row.id !== absentId && row.is_active !== false);
  const list = [];
  for (const row of rows) {
    list.push({ id: row.id, name: fullName(row.prenom, row.nom), unavailable: await unavailability(row.id, startOn, endOn, exceptLeaveId) });
  }
  return list;
}

async function currentPlan(leaveId) {
  if (!leaveId) return {};
  const covers = await query(
    `SELECT c.scope, c.substitute_id, c.percent, u.prenom, u.nom FROM hr_leave_covers c JOIN users u ON u.id = c.substitute_id
     WHERE c.leave_id = $1 ORDER BY c.bucket_from`,
    [leaveId]
  );
  const overrides = await query("SELECT scope, item_id, substitute_id FROM hr_leave_cover_overrides WHERE leave_id = $1", [leaveId]);
  const plan = {};
  for (const row of covers.rows) {
    plan[row.scope] = plan[row.scope] || { substitutes: [], overrides: {} };
    plan[row.scope].substitutes.push({ id: row.substitute_id, name: fullName(row.prenom, row.nom), percent: row.percent });
  }
  for (const row of overrides.rows) {
    if (plan[row.scope]) plan[row.scope].overrides[row.item_id] = row.substitute_id;
  }
  return plan;
}

// Écran de l'admin : qui peut remplacer, et quel portefeuille est concerné.
async function options({ userId, startOn, endOn, leaveId }) {
  if (!userId || !startOn || !endOn) throw fail("Employé ou dates manquants.");
  const { scopes } = await scopesOf(userId);
  const today = leaveCover.todayIso();
  const plan = await currentPlan(leaveId);
  const result = [];
  for (const scope of scopes) {
    result.push({
      scope,
      label: SCOPE_LABELS[scope],
      candidates: await candidates(userId, scope, startOn, endOn, leaveId),
      items: (await portfolio(userId, scope)).map((item) => ({ ...item, bucket: leaveCover.bucketOf(item.id) })),
      current: plan[scope] || null
    });
  }
  return { needed: endOn >= today && result.length > 0, scopes: result };
}

// Vérifie et normalise le choix de l'admin. Renvoie null si aucun remplacement n'est nécessaire.
async function preparePlan({ userId, startOn, endOn, leaveId, cover }) {
  const { scopes } = await scopesOf(userId);
  if (!scopes.length || endOn < leaveCover.todayIso()) return null;
  const given = cover && typeof cover === "object" ? cover : {};
  const plan = {};
  for (const scope of scopes) {
    const label = SCOPE_LABELS[scope];
    const list = await candidates(userId, scope, startOn, endOn, leaveId);
    const available = list.filter((row) => !row.unavailable);
    const wanted = Array.isArray(given[scope]?.substitutes) ? given[scope].substitutes : [];
    if (!wanted.length) {
      // Personne d'autre ne peut prendre le relais : le congé est accepté sans remplaçant.
      if (!available.length) continue;
      throw fail(`Choisissez au moins un remplaçant (${label}) pour la durée du congé.`);
    }
    const seen = new Set();
    const substitutes = wanted.map((row) => {
      const id = String(row?.id || "");
      const percent = Number(row?.percent);
      const candidate = list.find((item) => item.id === id);
      if (!candidate) throw fail(`Remplaçant (${label}) introuvable ou inactif.`);
      if (candidate.unavailable) throw fail(`${candidate.name} ne peut pas remplacer : ${candidate.unavailable.toLowerCase()}.`);
      if (seen.has(id)) throw fail(`${candidate.name} est choisi deux fois.`);
      seen.add(id);
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) throw fail(`Pourcentage invalide pour ${candidate.name} (un nombre entier de 1 à 100).`);
      return { id, percent, name: candidate.name };
    });
    const total = substitutes.reduce((sum, row) => sum + row.percent, 0);
    if (total !== 100) throw fail(`Les pourcentages des remplaçants (${label}) doivent faire 100 % (actuellement ${total} %).`);
    const overrides = {};
    for (const [itemId, substituteId] of Object.entries(given[scope]?.overrides || {})) {
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) continue;
      if (!seen.has(String(substituteId))) throw fail(`Un étudiant est confié à quelqu'un qui n'est pas remplaçant (${label}).`);
      overrides[itemId] = String(substituteId);
    }
    plan[scope] = { substitutes, overrides };
  }
  return Object.keys(plan).length ? plan : null;
}

// L'employé qui part en congé remplace peut-être déjà un collègue sur ces dates.
async function assertNotCovering(userId, startOn, endOn) {
  const result = await query(
    `SELECT o.prenom, o.nom, c.start_on::text AS start_on, c.end_on::text AS end_on
     FROM hr_leave_covers c JOIN users o ON o.id = c.owner_id
     WHERE c.substitute_id = $1 AND c.start_on <= $3 AND c.end_on >= $2 LIMIT 1`,
    [userId, startOn, endOn]
  );
  if (result.rowCount) {
    const row = result.rows[0];
    throw fail(`Cet employé remplace ${fullName(row.prenom, row.nom)} du ${frDay(row.start_on)} au ${frDay(row.end_on)} : changez d'abord les remplaçants de ce congé.`);
  }
}

async function writePlan(client, { leaveId, userId, startOn, endOn, plan, by }) {
  await client.query("DELETE FROM hr_leave_cover_overrides WHERE leave_id = $1", [leaveId]);
  await client.query("DELETE FROM hr_leave_covers WHERE leave_id = $1", [leaveId]);
  for (const [scope, entry] of Object.entries(plan || {})) {
    let from = 0;
    entry.substitutes.forEach((row, index) => {
      row.from = from;
      row.to = index === entry.substitutes.length - 1 ? 100 : from + row.percent;
      from = row.to;
    });
    for (const row of entry.substitutes) {
      await client.query(
        `INSERT INTO hr_leave_covers (leave_id, owner_id, scope, substitute_id, percent, bucket_from, bucket_to, start_on, end_on, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [leaveId, userId, scope, row.id, row.percent, row.from, row.to, startOn, endOn, by]
      );
    }
    for (const [itemId, substituteId] of Object.entries(entry.overrides)) {
      await client.query(
        "INSERT INTO hr_leave_cover_overrides (leave_id, scope, item_id, substitute_id) VALUES ($1, $2, $3, $4)",
        [leaveId, scope, itemId, substituteId]
      );
    }
  }
}

// Combien d'éléments du portefeuille chaque remplaçant reçoit (même règle que leave_handler).
function shareCounts(items, entry) {
  const counts = new Map(entry.substitutes.map((row) => [row.id, 0]));
  for (const item of items) {
    const forced = entry.overrides[item.id];
    const bucket = leaveCover.bucketOf(item.id);
    const target = forced || (entry.substitutes.find((row) => bucket >= row.from && bucket < row.to) || entry.substitutes[0]).id;
    counts.set(target, (counts.get(target) || 0) + 1);
  }
  return counts;
}

async function notifySubstitutes({ userId, startOn, endOn, plan, changed }) {
  const absent = await userRepo.findById(userId);
  const absentName = absent ? fullName(absent.prenom, absent.nom) : "un collègue";
  for (const [scope, entry] of Object.entries(plan || {})) {
    const items = await portfolio(userId, scope);
    const counts = shareCounts(items, entry);
    for (const row of entry.substitutes) {
      const n = counts.get(row.id) || 0;
      const what = scope === "SALES" ? plural(n, "étudiant ou contact WhatsApp", "étudiants ou contacts WhatsApp") : plural(n, "dossier étudiant", "dossiers étudiants");
      await notificationService.notify(row.id, {
        type: "LEAVE_COVER",
        title: changed ? `Remplacement modifié : ${absentName}` : `Vous remplacez ${absentName}`,
        body: `Du ${frDay(startOn)} au ${frDay(endOn)} (${SCOPE_LABELS[scope].toLowerCase()}) : ${row.percent} % du portefeuille, soit ${what} aujourd'hui, et ses nouveaux leads sur cette part. Ils apparaissent avec la mention « Remplacement de ${absentName} ».`,
        link: scope === "RDV" ? "/rdv" : "/conseiller"
      });
    }
  }
}

// Enregistre le remplacement d'un congé qui vient d'être accepté.
async function saveForApprovedLeave({ leaveId, userId, startOn, endOn, plan, by }) {
  if (!plan) return;
  await transaction((client) => writePlan(client, { leaveId, userId, startOn, endOn, plan, by }));
  await leaveCover.refresh();
  await notifySubstitutes({ userId, startOn, endOn, plan, changed: false });
}

// L'admin change les remplaçants (ou les étudiants confiés) d'un congé accepté pas encore terminé.
async function update(auth, leaveId, body) {
  const leave = await query(
    "SELECT id, user_id, start_on::text AS start_on, end_on::text AS end_on, status FROM hr_leave_requests WHERE id = $1",
    [leaveId]
  );
  const request = leave.rows[0];
  if (!request) throw fail("Congé introuvable.", 404);
  if (request.status !== "APPROVED") throw fail("Seul un congé accepté a des remplaçants.");
  if (request.end_on < leaveCover.todayIso()) throw fail("Ce congé est terminé : les remplaçants ne peuvent plus changer.");
  const plan = await preparePlan({ userId: request.user_id, startOn: request.start_on, endOn: request.end_on, leaveId, cover: body?.cover });
  await transaction((client) => writePlan(client, { leaveId, userId: request.user_id, startOn: request.start_on, endOn: request.end_on, plan, by: auth.sub }));
  await leaveCover.refresh();
  await notifySubstitutes({ userId: request.user_id, startOn: request.start_on, endOn: request.end_on, plan, changed: true });
  return summaryFor([leaveId]).then((map) => map.get(leaveId) || []);
}

// Remplaçants de plusieurs congés, pour l'affichage (liste des demandes de l'admin).
async function summaryFor(leaveIds) {
  const map = new Map();
  if (!leaveIds.length) return map;
  const result = await query(
    `SELECT c.leave_id, c.scope, c.substitute_id, c.percent, u.prenom, u.nom FROM hr_leave_covers c JOIN users u ON u.id = c.substitute_id
     WHERE c.leave_id = ANY($1::uuid[]) ORDER BY c.scope, c.bucket_from`,
    [leaveIds]
  );
  for (const row of result.rows) {
    const list = map.get(row.leave_id) || [];
    list.push({ scope: row.scope, id: row.substitute_id, name: fullName(row.prenom, row.nom), percent: row.percent });
    map.set(row.leave_id, list);
  }
  return map;
}

// Bandeaux de l'application : mon congé en cours (lecture seule) et les collègues que je remplace.
async function mine(auth) {
  await leaveCover.ready();
  return { absence: leaveCover.absenceOf(auth.sub), covering: leaveCover.coveredBy(auth.sub) };
}

// Le lendemain de la fin du congé : résumé à l'absent (ce qui s'est passé pendant son absence) et fin
// du remplacement pour ses remplaçants. Une seule fois par congé.
async function sendReturnSummaries() {
  const today = leaveCover.todayIso();
  const due = await query(
    `SELECT DISTINCT r.id, r.user_id, r.start_on::text AS start_on, r.end_on::text AS end_on
     FROM hr_leave_requests r JOIN hr_leave_covers c ON c.leave_id = r.id
     WHERE r.status = 'APPROVED' AND r.end_on < $1::date AND r.cover_summary_sent_at IS NULL`,
    [today]
  );
  for (const leave of due.rows) {
    try {
      const claimed = await query("UPDATE hr_leave_requests SET cover_summary_sent_at = NOW() WHERE id = $1 AND cover_summary_sent_at IS NULL", [leave.id]);
      if (!claimed.rowCount) continue;
      const range = [leave.user_id, leave.start_on, leave.end_on];
      const [students, contacts, answered, steps, subs] = await Promise.all([
        query(
          `SELECT COUNT(*)::int AS n FROM student_profiles sp JOIN users u ON u.id = sp.user_id
           WHERE sp.assigned_sales_id = $1 AND (u.created_at AT TIME ZONE 'Africa/Tunis')::date BETWEEN $2 AND $3`,
          range
        ),
        query(
          `SELECT COUNT(*)::int AS n FROM whatsapp_contacts
           WHERE assigned_sales_id = $1 AND student_id IS NULL AND (created_at AT TIME ZONE 'Africa/Tunis')::date BETWEEN $2 AND $3`,
          range
        ),
        query("SELECT COUNT(DISTINCT contact_id)::int AS conversations, COUNT(*)::int AS messages FROM whatsapp_messages WHERE cover_leave_id = $1", [leave.id]),
        query(
          `SELECT COUNT(*)::int AS n FROM application_history h
           JOIN hr_leave_covers c ON c.leave_id = $1 AND c.substitute_id = h.changed_by
           LEFT JOIN student_profiles sp ON sp.user_id = h.student_id
           LEFT JOIN university_applications ua ON ua.id = h.application_id
           WHERE (h.changed_at AT TIME ZONE 'Africa/Tunis')::date BETWEEN $2 AND $3
             AND ((c.scope = 'SALES' AND sp.assigned_sales_id = c.owner_id) OR (c.scope = 'RDV' AND ua.assigned_rdv_id = c.owner_id))`,
          [leave.id, leave.start_on, leave.end_on]
        ),
        query("SELECT DISTINCT substitute_id, scope FROM hr_leave_covers WHERE leave_id = $1", [leave.id])
      ]);
      const lines = [
        students.rows[0].n && plural(students.rows[0].n, "nouvel étudiant inscrit", "nouveaux étudiants inscrits"),
        contacts.rows[0].n && plural(contacts.rows[0].n, "nouveau contact WhatsApp", "nouveaux contacts WhatsApp"),
        answered.rows[0].conversations && `${plural(answered.rows[0].conversations, "conversation WhatsApp suivie", "conversations WhatsApp suivies")} (${plural(answered.rows[0].messages, "message envoyé", "messages envoyés")})`,
        steps.rows[0].n && plural(steps.rows[0].n, "étape de dossier avancée", "étapes de dossier avancées")
      ].filter(Boolean);
      const done = lines.length ? `vos remplaçants ont géré : ${lines.join(", ")}` : "aucune activité particulière n'a été enregistrée";
      const homeOf = (scope) => (scope === "RDV" ? "/rdv" : "/conseiller");
      await notificationService.notify(leave.user_id, {
        type: "LEAVE_COVER_SUMMARY",
        title: "Bon retour ! Vos dossiers vous reviennent",
        body: `Pendant votre congé (du ${frDay(leave.start_on)} au ${frDay(leave.end_on)}), ${done}. Tout est de nouveau dans votre espace.`,
        link: homeOf(subs.rows.some((row) => row.scope === "SALES") ? "SALES" : "RDV")
      });
      const absent = await userRepo.findById(leave.user_id);
      for (const row of subs.rows) {
        await notificationService.notify(row.substitute_id, {
          type: "LEAVE_COVER_END",
          title: `Fin du remplacement de ${absent ? fullName(absent.prenom, absent.nom) : "votre collègue"}`,
          body: row.scope === "RDV" ? "Son congé est terminé : ses dossiers lui sont revenus." : "Son congé est terminé : ses étudiants et ses conversations WhatsApp lui sont revenus.",
          link: homeOf(row.scope)
        });
      }
    } catch (error) {
      logger.error("Remplacement de congé : résumé de retour impossible", { leaveId: leave.id, message: error.message });
    }
  }
}

module.exports = { options, preparePlan, assertNotCovering, saveForApprovedLeave, update, summaryFor, mine, sendReturnSummaries };
