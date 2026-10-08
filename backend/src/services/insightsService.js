const { query } = require("../../db");

// Indicateurs de pilotage de l'admin (hors graphiques du dashboard) : refus
// reportés, taux d'acceptation et de visa, délais, finances, commissions,
// nouveaux étudiants et dossiers sans RDV. Tout est calculé sur les données
// réelles ; les montants sont renvoyés par devise (TND / EUR), jamais mélangés.

const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);

async function postponed() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE retry_on <= CURRENT_DATE + 30)::int AS due30,
            COUNT(*) FILTER (WHERE postponed_kind = 'VISA')::int AS visa,
            COUNT(*) FILTER (WHERE postponed_kind IS DISTINCT FROM 'VISA')::int AS application
     FROM university_applications WHERE status = 'POSTPONED'`
  );
  return rows[0];
}

async function universityAcceptance() {
  // Accepté = a atteint l'étape visa ou est « Accepté » ; refusé = refus sans visa
  // (y compris refus reporté ou clôturé ensuite).
  const { rows } = await query(
    `SELECT c.name AS country,
            COUNT(*) FILTER (WHERE ua.status = 'ACCEPTED' OR ua.visa_status IS NOT NULL)::int AS accepted,
            COUNT(*) FILTER (
              WHERE ua.visa_status IS NULL AND (
                ua.status = 'REJECTED'
                OR (ua.status IN ('POSTPONED', 'CLOSED') AND ua.decision_at IS NOT NULL)
              )
            )::int AS rejected
     FROM university_applications ua
     JOIN countries c ON c.id = ua.country_id
     GROUP BY c.name`
  );
  const byCountry = rows
    .map((r) => ({ country: r.country, accepted: r.accepted, rejected: r.rejected, decided: r.accepted + r.rejected, rate: pct(r.accepted, r.accepted + r.rejected) }))
    .filter((r) => r.decided > 0)
    .sort((a, b) => b.decided - a.decided);
  const accepted = byCountry.reduce((s, r) => s + r.accepted, 0);
  const rejected = byCountry.reduce((s, r) => s + r.rejected, 0);
  return { accepted, rejected, decided: accepted + rejected, rate: pct(accepted, accepted + rejected), byCountry: byCountry.slice(0, 5) };
}

async function visaOutcome() {
  // Les refus viennent de l'historique : un visa refusé puis redéposé reste compté.
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM university_applications WHERE visa_status = 'ACCEPTED') AS obtained,
       (SELECT COUNT(*)::int FROM application_history WHERE new_status = 'VISA_REJECTED') AS rejected,
       (SELECT COUNT(*)::int FROM university_applications WHERE visa_status = 'SUBMITTED') AS pending`
  );
  const { obtained, rejected, pending } = rows[0];
  return { obtained, rejected, pending, rate: pct(obtained, obtained + rejected) };
}

async function averageDelays() {
  const { rows } = await query(
    `SELECT
       AVG(EXTRACT(EPOCH FROM (decision_at - applied_at)) / 86400)
         FILTER (WHERE decision_at IS NOT NULL AND applied_at IS NOT NULL AND decision_at >= applied_at) AS university_days,
       AVG(EXTRACT(EPOCH FROM (visa_decision_at - visa_submitted_at)) / 86400)
         FILTER (WHERE visa_decision_at IS NOT NULL AND visa_submitted_at IS NOT NULL AND visa_decision_at >= visa_submitted_at) AS visa_days
     FROM university_applications`
  );
  return {
    universityDays: rows[0].university_days === null ? null : round1(rows[0].university_days),
    visaDays: rows[0].visa_days === null ? null : round1(rows[0].visa_days)
  };
}

async function finances() {
  const [month, outstanding, blocked] = await Promise.all([
    query(
      `SELECT currency,
              COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('month', CURRENT_DATE)), 0)::float AS this_month,
              COALESCE(SUM(amount) FILTER (
                WHERE paid_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                  AND paid_at < date_trunc('month', CURRENT_DATE)
              ), 0)::float AS last_month
       FROM student_payments WHERE status = 'ACTIVE' GROUP BY currency`
    ),
    query(
      `SELECT pl.currency,
              COALESCE(SUM(GREATEST(pl.tranche1_due - COALESCE(pp.p1, 0), 0) + GREATEST(pl.tranche2_due - COALESCE(pp.p2, 0), 0)), 0)::float AS outstanding
       FROM payment_plans pl
       LEFT JOIN LATERAL (
         SELECT SUM(amount) FILTER (WHERE tranche = 1) AS p1, SUM(amount) FILTER (WHERE tranche = 2) AS p2
         FROM student_payments WHERE plan_id = pl.id AND status = 'ACTIVE'
       ) pp ON TRUE
       GROUP BY pl.currency`
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM university_applications ua
       JOIN payment_plans pl ON pl.student_id = ua.student_id AND pl.country_id = ua.country_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(amount), 0) AS p2 FROM student_payments
         WHERE plan_id = pl.id AND tranche = 2 AND status = 'ACTIVE'
       ) pp ON TRUE
       WHERE ua.visa_status = 'PREPARATION' AND pl.tranche2_due > pp.p2`
    )
  ]);
  const currencies = new Set([...month.rows.map((r) => r.currency), ...outstanding.rows.map((r) => r.currency)]);
  const perCurrency = [...currencies].sort().map((currency) => {
    const m = month.rows.find((r) => r.currency === currency);
    const o = outstanding.rows.find((r) => r.currency === currency);
    return { currency, thisMonth: m?.this_month || 0, lastMonth: m?.last_month || 0, outstanding: o?.outstanding || 0 };
  });
  return { perCurrency, visaBlocked: blocked.rows[0].count };
}

async function commissions() {
  const due = await query("SELECT COALESCE(SUM(amount_dinar), 0)::float AS total FROM commission_earnings WHERE payout_id IS NULL");
  const { rows } = await query(
    `SELECT role,
            COALESCE(SUM(amount_dinar) FILTER (WHERE earned_at >= date_trunc('month', CURRENT_DATE)), 0)::float AS this_month,
            COALESCE(SUM(amount_dinar) FILTER (
              WHERE earned_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                AND earned_at < date_trunc('month', CURRENT_DATE)
            ), 0)::float AS last_month
     FROM commission_earnings GROUP BY role`
  );
  const pick = (role, key) => rows.find((r) => r.role === role)?.[key] || 0;
  return {
    salesThisMonth: pick("SALES", "this_month"),
    rdvThisMonth: pick("RDV", "this_month"),
    totalThisMonth: pick("SALES", "this_month") + pick("RDV", "this_month"),
    totalLastMonth: pick("SALES", "last_month") + pick("RDV", "last_month"),
    dueTotal: due.rows[0].total
  };
}

async function newStudents() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE))::int AS this_week,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' AND created_at < date_trunc('week', CURRENT_DATE))::int AS last_week,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS this_month,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' AND created_at < date_trunc('month', CURRENT_DATE))::int AS last_month
     FROM users WHERE role = 'STUDENT'`
  );
  const r = rows[0];
  return { thisWeek: r.this_week, lastWeek: r.last_week, thisMonth: r.this_month, lastMonth: r.last_month };
}

async function withoutRdv() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM university_applications WHERE status = 'ACCEPTED' AND assigned_rdv_id IS NULL`
  );
  return rows[0].count;
}

async function getInsights() {
  const [post, acceptance, visa, delays, fin, comm, students, noRdv] = await Promise.all([
    postponed(),
    universityAcceptance(),
    visaOutcome(),
    averageDelays(),
    finances(),
    commissions(),
    newStudents(),
    withoutRdv()
  ]);
  return { postponed: post, acceptance, visa, delays, finances: fin, commissions: comm, newStudents: students, withoutRdv: noRdv };
}

module.exports = { getInsights };
