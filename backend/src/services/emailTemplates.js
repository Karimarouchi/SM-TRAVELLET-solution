const env = require("../config/env");

// Gabarit commun de tous les e-mails SM Travel : en-tête violet, pastille de
// statut, titre, contenu structuré (code, lignes d'information, encadré),
// bouton d'action et pied de page. Construit en tableaux avec styles en ligne
// (le seul HTML/CSS que Gmail, Outlook et Apple Mail rendent partout).

const FONT = "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

const TONES = {
  info: { accent: "#6d28d9", soft: "#f5f3ff", border: "#ddd6fe", symbol: "i" },
  success: { accent: "#059669", soft: "#ecfdf5", border: "#a7f3d0", symbol: "&#10003;" },
  warning: { accent: "#d97706", soft: "#fffbeb", border: "#fde68a", symbol: "!" },
  danger: { accent: "#dc2626", soft: "#fef2f2", border: "#fecaca", symbol: "!" }
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Retours à la ligne d'un texte brut → <br>, après échappement.
function escLines(value) {
  return esc(value).replace(/\r?\n/g, "<br/>");
}

function appUrl(hash = "") {
  return `${env.appPublicUrl}/app/#${hash}`;
}

function badge(label, tone) {
  const t = TONES[tone] || TONES.info;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="background:${t.soft};border:1px solid ${t.border};border-radius:999px;padding:5px 14px 5px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="20" height="20" align="center" style="width:20px;height:20px;border-radius:10px;background:${t.accent};color:#ffffff;font:700 12px/20px ${FONT};">${t.symbol}</td>
            <td style="padding-left:8px;font:700 11px/1 ${FONT};letter-spacing:.6px;text-transform:uppercase;color:${t.accent};">${esc(label)}</td>
          </tr></table>
        </td>
      </tr>
    </table>`;
}

// Grand encadré pour une valeur à recopier : code de vérification, n° de reçu…
function highlightBlock({ label, value, tone = "info", spaced = false }) {
  const t = TONES[tone] || TONES.info;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">
      <tr>
        <td align="center" style="background:${t.soft};border:1px solid ${t.border};border-radius:18px;padding:20px 16px;">
          ${label ? `<div style="font:700 11px/1 ${FONT};letter-spacing:.8px;text-transform:uppercase;color:${t.accent};margin-bottom:10px;">${esc(label)}</div>` : ""}
          <div style="font:800 ${spaced ? "34px" : "30px"}/1.1 ${FONT};letter-spacing:${spaced ? "9px" : "1px"};color:#1e1b4b;">${esc(value)}</div>
        </td>
      </tr>
    </table>`;
}

// Lignes « libellé — valeur ».
function rowsBlock(rows, { accent = "#6d28d9" } = {}) {
  const items = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]) !== "");
  if (!items.length) return "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid #e8e8f2;border-radius:16px;border-collapse:separate;overflow:hidden;">
      ${items
        .map(
          ([label, value, options = {}], index) => `
        <tr>
          <td style="padding:12px 16px;${index ? "border-top:1px solid #eef0f6;" : ""}font:500 13px/1.4 ${FONT};color:#64748b;" width="42%" valign="top">${esc(label)}</td>
          <td style="padding:12px 16px;${index ? "border-top:1px solid #eef0f6;" : ""}font:700 14px/1.4 ${FONT};color:${options.strong ? accent : "#0f172a"};" align="right" valign="top">${esc(value)}</td>
        </tr>`
        )
        .join("")}
    </table>`;
}

function calloutBlock({ tone = "info", title, html }) {
  const t = TONES[tone] || TONES.info;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      <tr>
        <td style="background:${t.soft};border:1px solid ${t.border};border-left:4px solid ${t.accent};border-radius:14px;padding:14px 18px;font:400 14px/1.6 ${FONT};color:#334155;">
          ${title ? `<div style="font:700 14px/1.4 ${FONT};color:${t.accent};margin-bottom:4px;">${esc(title)}</div>` : ""}
          ${html}
        </td>
      </tr>
    </table>`;
}

function buttonBlock({ label, url, tone = "info" }) {
  const t = TONES[tone] || TONES.info;
  const fill = tone === "info" ? "#6d28d9" : t.accent;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 26px;">
      <tr>
        <td align="center" bgcolor="${fill}" style="border-radius:14px;background:${fill};">
          <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 30px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:14px;">${esc(label)} &rarr;</a>
        </td>
      </tr>
    </table>`;
}

// options : preheader, headerLabel, badge {label, tone}, title, introHtml,
// blocks (HTML déjà construit avec les helpers ci-dessus), cta {label, url,
// tone}, noteHtml, audience ("student" | "staff").
function renderEmail({ preheader = "", headerLabel = "", badge: badgeOptions, title, introHtml = "", blocks = [], cta, noteHtml = "", audience = "student" }) {
  const logo = `${env.appPublicUrl}/app/images/logo-blanc.png`;
  const footerLine =
    audience === "staff"
      ? "Notification automatique de la plateforme SM Travel."
      : "Une question ? Écrivez à votre conseiller depuis votre espace SM Travel.";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${esc(title)}</title>
  <style>
    @media only screen and (max-width:620px){
      .sm-card{border-radius:0 !important}
      .sm-pad{padding-left:22px !important;padding-right:22px !important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef0f8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef0f8;">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="sm-card" style="width:100%;max-width:600px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(76,29,149,.16);">
          <tr>
            <td align="center" bgcolor="#5b21b6" style="background:#5b21b6;background-image:linear-gradient(135deg,#3b0f8c 0%,#6d28d9 55%,#8b5cf6 100%);padding:34px 28px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td>
                  <img src="${esc(logo)}" alt="SM Travel" height="36" style="display:block;height:36px;width:auto;border:0;font:800 22px/36px ${FONT};color:#ffffff;"/>
                </td>
              </tr></table>
              ${headerLabel ? `<div style="margin-top:16px;font:600 13px/1 ${FONT};letter-spacing:.5px;color:rgba(255,255,255,.88);">${esc(headerLabel)}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td class="sm-pad" style="padding:34px 38px 8px;">
              ${badgeOptions ? badge(badgeOptions.label, badgeOptions.tone) : ""}
              <h1 style="margin:0 0 12px;font:800 24px/1.25 ${FONT};color:#0f172a;">${esc(title)}</h1>
              ${introHtml ? `<p style="margin:0 0 24px;font:400 15px/1.65 ${FONT};color:#475569;">${introHtml}</p>` : ""}
              ${blocks.join("")}
              ${cta ? buttonBlock(cta) : ""}
              ${noteHtml ? `<p style="margin:0 0 26px;font:400 13px/1.6 ${FONT};color:#94a3b8;">${noteHtml}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td class="sm-pad" style="padding:22px 38px 26px;background:#f8f9fd;border-top:1px solid #eceef6;" align="center">
              <p style="margin:0 0 8px;font:700 13px/1.4 ${FONT};color:#4c1d95;">SM Travel</p>
              <p style="margin:0 0 10px;font:400 12px/1.5 ${FONT};color:#94a3b8;">Accompagnement études &amp; visas à l'étranger</p>
              <p style="margin:0 0 12px;font:400 12px/1.5 ${FONT};color:#94a3b8;">${footerLine}</p>
              <p style="margin:0;font:400 12px/1.5 ${FONT};">
                <a href="${esc(env.appPublicUrl)}" style="color:#6d28d9;text-decoration:none;font-weight:600;">Site web</a>
                <span style="color:#cbd5e1;">&nbsp;·&nbsp;</span>
                <a href="${esc(appUrl("/espace"))}" style="color:#6d28d9;text-decoration:none;font-weight:600;">Mon espace</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmail, highlightBlock, rowsBlock, calloutBlock, buttonBlock, esc, escLines, appUrl };
