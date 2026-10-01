const { query, transaction } = require("../../db");

// Répartition automatique par pourcentage.
//
// Mode « balanced » (par défaut) : le prochain arrivant va au conseiller le
// moins chargé (comportement historique, fourni par l'appelant).
// Mode « percentage » : chaque conseiller a une part (ex. 40 / 40 / 20). On
// compte les NOUVEAUX arrivants depuis le dernier réglage, par flux (contacts
// WhatsApp, étudiants sans conseiller), et le suivant va à celui dont le
// retard sur sa part est le plus grand : sur 10 arrivants, 4 / 4 / 2.

const SCOPES = ["students", "whatsapp"];
const ADVISORY_LOCK_KEY = 7301;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getMode() {
  const result = await query("SELECT value FROM app_settings WHERE key = $1", ["auto_assign_mode"]);
  return result.rows[0]?.value === "percentage" ? "percentage" : "balanced";
}

// Choisit le prochain conseiller selon les pourcentages et compte l'arrivant.
// Renvoie null si le mode n'est pas « percentage » ou si aucun conseiller actif
// n'a de part : l'appelant retombe alors sur la répartition par charge.
async function pickSalesId(scope) {
  if (!SCOPES.includes(scope)) throw new Error(`Flux inconnu : ${scope}`);
  if ((await getMode()) !== "percentage") return null;

  return transaction(async (client) => {
    // Un seul choix à la fois : sans ce verrou, deux arrivées simultanées
    // verraient les mêmes compteurs et choisiraient le même conseiller.
    await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
    const { rows } = await client.query(
      `SELECT s.sales_id, s.percent, u.created_at, COALESCE(c.assigned_count, 0) AS count
       FROM auto_assign_shares s
       JOIN users u ON u.id = s.sales_id AND u.role = 'SALES' AND u.is_active = TRUE
       LEFT JOIN auto_assign_counts c ON c.sales_id = s.sales_id AND c.scope = $1
       WHERE s.percent > 0`,
      [scope]
    );
    if (!rows.length) return null;

    // Si un conseiller est bloqué, les parts restantes sont recalées sur 100 %.
    const totalPercent = rows.reduce((sum, r) => sum + r.percent, 0);
    const arrived = rows.reduce((sum, r) => sum + r.count, 0);
    const best = rows
      .map((r) => ({ ...r, lag: (r.percent / totalPercent) * (arrived + 1) - r.count }))
      .sort((a, b) => b.lag - a.lag || b.percent - a.percent || new Date(a.created_at) - new Date(b.created_at) || String(a.sales_id).localeCompare(String(b.sales_id)))[0];

    await client.query(
      `INSERT INTO auto_assign_counts (sales_id, scope, assigned_count) VALUES ($1, $2, 1)
       ON CONFLICT (sales_id, scope) DO UPDATE SET assigned_count = auto_assign_counts.assigned_count + 1`,
      [best.sales_id, scope]
    );
    return best.sales_id;
  });
}

// Choix du conseiller pour un flux : pourcentages si activés, sinon la
// répartition par charge fournie par l'appelant (renvoie un id ou null).
async function pickOrFallback(scope, fallback) {
  const byShare = await pickSalesId(scope);
  if (byShare) return byShare;
  const least = await fallback();
  return least ? least.id : null;
}

// ── Administration ─────────────────────────────────────────────────────────
async function getSettings() {
  const [mode, sales] = await Promise.all([
    getMode(),
    query(
      `SELECT u.id, u.prenom, u.nom, u.email, u.is_active, COALESCE(s.percent, 0) AS percent,
              COALESCE((SELECT assigned_count FROM auto_assign_counts WHERE sales_id = u.id AND scope = 'students'), 0) AS students,
              COALESCE((SELECT assigned_count FROM auto_assign_counts WHERE sales_id = u.id AND scope = 'whatsapp'), 0) AS whatsapp
       FROM users u
       LEFT JOIN auto_assign_shares s ON s.sales_id = u.id
       WHERE u.role = 'SALES'
       ORDER BY u.is_active DESC, u.created_at ASC`
    )
  ]);
  const shares = sales.rows.map((r) => ({
    salesId: r.id,
    prenom: r.prenom,
    nom: r.nom,
    email: r.email,
    isActive: r.is_active !== false,
    percent: r.percent,
    receivedStudents: r.students,
    receivedWhatsapp: r.whatsapp
  }));
  return { mode, shares, totalPercent: shares.filter((s) => s.isActive).reduce((sum, s) => sum + s.percent, 0) };
}

async function saveSettings(body) {
  const mode = body?.mode === "percentage" ? "percentage" : body?.mode === "balanced" ? "balanced" : null;
  if (!mode) throw fail("Mode de répartition invalide.", 400);

  const entries = Array.isArray(body.shares) ? body.shares : [];
  if (mode === "percentage") {
    const active = (await query("SELECT id FROM users WHERE role = 'SALES' AND is_active = TRUE")).rows.map((r) => r.id);
    if (!active.length) throw fail("Aucun conseiller actif : impossible de répartir par pourcentage.", 400);

    const percentById = new Map();
    for (const entry of entries) {
      const percent = Number(entry?.percent);
      if (!active.includes(entry?.salesId)) continue; // comptes bloqués ou inconnus : ignorés
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
        throw fail("Chaque pourcentage doit être un nombre entier entre 0 et 100.", 400);
      }
      percentById.set(entry.salesId, percent);
    }
    const total = [...percentById.values()].reduce((sum, p) => sum + p, 0);
    if (total !== 100) {
      throw fail(`Le total des pourcentages doit faire exactement 100 % (actuellement ${total} %).`, 400);
    }

    await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
      // Un conseiller actif absent de la liste reçoit 0 %.
      for (const salesId of active) {
        await client.query(
          `INSERT INTO auto_assign_shares (sales_id, percent, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (sales_id) DO UPDATE SET percent = EXCLUDED.percent, updated_at = NOW()`,
          [salesId, percentById.get(salesId) || 0]
        );
      }
      // Nouveaux pourcentages = nouveau départ des compteurs.
      await client.query("DELETE FROM auto_assign_counts");
      await client.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('auto_assign_mode', 'percentage', NOW())
         ON CONFLICT (key) DO UPDATE SET value = 'percentage', updated_at = NOW()`
      );
    });
  } else {
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('auto_assign_mode', 'balanced', NOW())
       ON CONFLICT (key) DO UPDATE SET value = 'balanced', updated_at = NOW()`
    );
  }
  return getSettings();
}

module.exports = { getMode, pickSalesId, pickOrFallback, getSettings, saveSettings };
