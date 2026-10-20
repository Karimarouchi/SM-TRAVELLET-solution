const crypto = require("crypto");
const { query } = require("../../db");
const logger = require("../logger");

// Remplacements en cours aujourd'hui (heure de Tunis), gardés en mémoire pour que les contrôles d'accès
// restent synchrones. Rechargés toutes les 30 s, et tout de suite après chaque modification par l'admin.
// Même règle que la fonction SQL leave_handler (migration 067) : les deux doivent rester identiques.

const TTL_MS = 30 * 1000;
let state = { day: null, loadedAt: 0, byOwner: new Map() };
let pending = null;

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date());
}

// Tranche 0..99 d'un élément : identique à leave_bucket() en SQL.
function bucketOf(itemId) {
  const hex = crypto.createHash("md5").update(String(itemId).toLowerCase()).digest("hex");
  return parseInt(hex.slice(0, 7), 16) % 100;
}

const ownerKey = (ownerId, scope) => `${ownerId}:${scope}`;
const fullName = (prenom, nom) => `${prenom || ""} ${nom || ""}`.trim();

async function load() {
  const day = todayIso();
  const covers = await query(
    `SELECT c.leave_id, c.owner_id, c.scope, c.substitute_id, c.percent, c.bucket_from, c.bucket_to, c.start_on::text AS start_on, c.end_on::text AS end_on,
            s.is_active AS substitute_active, s.prenom AS substitute_prenom, s.nom AS substitute_nom,
            o.prenom AS owner_prenom, o.nom AS owner_nom
     FROM hr_leave_covers c
     JOIN users s ON s.id = c.substitute_id
     JOIN users o ON o.id = c.owner_id
     WHERE $1::date BETWEEN c.start_on AND c.end_on
     ORDER BY c.bucket_from`,
    [day]
  );
  const leaveIds = [...new Set(covers.rows.map((row) => row.leave_id))];
  const overrides = leaveIds.length
    ? (await query("SELECT leave_id, scope, item_id, substitute_id FROM hr_leave_cover_overrides WHERE leave_id = ANY($1::uuid[])", [leaveIds])).rows
    : [];

  const byOwner = new Map();
  for (const row of covers.rows) {
    const key = ownerKey(row.owner_id, row.scope);
    if (!byOwner.has(key)) {
      byOwner.set(key, {
        leaveId: row.leave_id,
        ownerId: row.owner_id,
        ownerName: fullName(row.owner_prenom, row.owner_nom),
        scope: row.scope,
        startOn: row.start_on,
        endOn: row.end_on,
        substitutes: [],
        overrides: new Map()
      });
    }
    byOwner.get(key).substitutes.push({
      id: row.substitute_id,
      name: fullName(row.substitute_prenom, row.substitute_nom),
      percent: row.percent,
      from: row.bucket_from,
      to: row.bucket_to,
      active: row.substitute_active !== false
    });
  }
  for (const row of overrides) {
    for (const entry of byOwner.values()) {
      if (entry.leaveId === row.leave_id && entry.scope === row.scope) entry.overrides.set(String(row.item_id), row.substitute_id);
    }
  }
  state = { day, loadedAt: Date.now(), byOwner };
}

// À appeler avant tout contrôle synchrone (fait par requireAuth pour chaque requête authentifiée).
async function ready() {
  if (state.day === todayIso() && Date.now() - state.loadedAt < TTL_MS) return;
  if (!pending) {
    pending = load()
      .catch((error) => logger.error("Remplacements de congé : chargement impossible", { message: error.message }))
      .finally(() => { pending = null; });
  }
  await pending;
}

async function refresh() {
  state.loadedAt = 0;
  await ready();
}

function coverOf(ownerId, scope) {
  if (!ownerId) return null;
  return state.byOwner.get(ownerKey(ownerId, scope)) || null;
}

// Qui traite aujourd'hui l'élément itemId (étudiant, ou contact WhatsApp sans compte) du portefeuille de ownerId.
function handlerFor(ownerId, itemId, scope) {
  const cover = coverOf(ownerId, scope);
  if (!cover) return ownerId || null;
  const active = cover.substitutes.filter((sub) => sub.active);
  if (!active.length) return ownerId;
  if (itemId) {
    const forced = cover.overrides.get(String(itemId));
    if (forced && active.some((sub) => sub.id === forced)) return forced;
    const bucket = bucketOf(itemId);
    const inRange = active.find((sub) => bucket >= sub.from && bucket < sub.to);
    if (inRange) return inRange.id;
  }
  return active[0].id;
}

function rolesOf(auth) {
  return Array.isArray(auth?.roles) && auth.roles.length ? auth.roles : [auth?.role].filter(Boolean);
}

// Vrai si l'utilisateur connecté remplace aujourd'hui le propriétaire pour cet élément.
function covers(auth, ownerId, itemId, scope) {
  if (!auth?.sub || !ownerId || ownerId === auth.sub) return false;
  if (!rolesOf(auth).includes(scope)) return false;
  return handlerFor(ownerId, itemId, scope) === auth.sub;
}

// Propriétaire OU remplaçant du jour.
function handles(auth, ownerId, itemId, scope) {
  return Boolean(auth?.sub && ownerId && (ownerId === auth.sub || covers(auth, ownerId, itemId, scope)));
}

// Congé avec remplaçants en cours pour cet utilisateur (toutes portées confondues).
function absenceOf(userId) {
  const entries = ["SALES", "RDV"].map((scope) => coverOf(userId, scope)).filter(Boolean);
  if (!entries.length) return null;
  return {
    leaveId: entries[0].leaveId,
    startOn: entries[0].startOn,
    endOn: entries.reduce((max, entry) => (entry.endOn > max ? entry.endOn : max), entries[0].endOn),
    substitutes: entries.flatMap((entry) => entry.substitutes.filter((sub) => sub.active).map((sub) => ({ id: sub.id, name: sub.name, percent: sub.percent, scope: entry.scope })))
  };
}

// Absents que cet utilisateur remplace aujourd'hui.
function coveredBy(userId) {
  const list = [];
  for (const entry of state.byOwner.values()) {
    const mine = entry.substitutes.find((sub) => sub.id === userId && sub.active);
    if (mine) list.push({ leaveId: entry.leaveId, ownerId: entry.ownerId, ownerName: entry.ownerName, scope: entry.scope, endOn: entry.endOn, percent: mine.percent });
  }
  return list;
}

function ownerName(ownerId) {
  for (const entry of state.byOwner.values()) if (entry.ownerId === ownerId) return entry.ownerName;
  return null;
}

module.exports = { ready, refresh, bucketOf, handlerFor, covers, handles, absenceOf, coveredBy, ownerName, todayIso };
