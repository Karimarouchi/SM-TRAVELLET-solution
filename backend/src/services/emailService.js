const nodemailer = require("nodemailer");
const env = require("../config/env");
const settingsRepository = require("../repositories/settingsRepository");

// Expéditeur des emails (nom, adresse, mot de passe d'application SMTP) —
// réglable par l'admin depuis Paramètres, pas codé en dur : changer
// l'adresse d'envoi ne sert à rien sans le mot de passe d'application du
// nouveau compte, donc les deux vivent ensemble ici. On reconstruit le
// transporteur à chaque envoi (pas de cache) pour qu'un changement de
// réglage soit pris en compte immédiatement, sans redémarrer le serveur. À
// défaut de valeur en base, on retombe sur le .env (compte de secours de
// l'infrastructure).
async function resolveSender() {
  const secrets = await settingsRepository.getEmailSenderSecrets();
  const user = secrets.fromAddress || env.smtp.user;
  const pass = secrets.appPassword || env.smtp.pass;
  const fromName = secrets.fromName || env.smtp.fromName;

  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user, pass }
  });

  return {
    transporter,
    from: (nameSuffix = "") => `"${fromName}${nameSuffix}" <${user}>`
  };
}

function verificationEmailHtml(prenom, code) {
  return `
  <div style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(76,29,149,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#4c1d95 0%,#6d28d9 55%,#8b5cf6 100%);padding:32px 32px 28px;text-align:center;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">SM Travel</div>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Espace client</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Bonjour ${prenom},</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
                  Merci de vous être inscrit·e sur SM Travel. Pour activer votre compte, saisissez le code de vérification ci-dessous dans l'application.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;text-align:center;">
                <div style="display:inline-block;padding:16px 28px;border-radius:16px;background-color:#ede9fe;border:1px solid #ddd6fe;">
                  <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#4c1d95;font-family:Arial,Helvetica,sans-serif;">${code}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  Ce code est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">SM Travel · Accompagnement études &amp; visas à l'étranger</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendVerificationEmail(to, prenom, code) {
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(),
    to,
    subject: "Votre code de vérification SM Travel",
    html: verificationEmailHtml(prenom, code),
    text: `Bonjour ${prenom}, votre code de vérification SM Travel est : ${code} (valable 15 minutes).`
  });
}

function interviewEmailHtml(prenom, { universityName, countryName, dateLabel, type, link, instructions }) {
  return `
  <div style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(76,29,149,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#4c1d95 0%,#6d28d9 55%,#8b5cf6 100%);padding:32px 32px 28px;text-align:center;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">SM Travel</div>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Entretien avec l'université</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Bonjour ${prenom},</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
                  Un entretien a été planifié dans le cadre de votre candidature pour <strong>${universityName}</strong> (${countryName}). Merci de bien noter la date ci-dessous.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;">
                <div style="border-radius:16px;background-color:#ede9fe;border:1px solid #ddd6fe;padding:18px 20px;">
                  <p style="margin:0 0 6px;font-size:13px;color:#4c1d95;font-weight:700;">${dateLabel}</p>
                  <p style="margin:0;font-size:13px;color:#4c1d95;">${type === "ONLINE" ? "Entretien en ligne" : "Entretien en présentiel"}</p>
                  ${link ? `<p style="margin:10px 0 0;font-size:13px;"><a href="${link}" style="color:#6d28d9;font-weight:700;">Lien de l'entretien</a></p>` : ""}
                  ${instructions ? `<p style="margin:10px 0 0;font-size:13px;color:#475569;">${instructions}</p>` : ""}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  Retrouvez le détail de votre dossier et échangez avec votre conseiller directement depuis votre espace SM Travel.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">SM Travel · Accompagnement études &amp; visas à l'étranger</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendInterviewEmail(to, prenom, details) {
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(),
    to,
    subject: `Entretien planifié — ${details.universityName}`,
    html: interviewEmailHtml(prenom, details),
    text: `Bonjour ${prenom}, un entretien a été planifié pour votre candidature à ${details.universityName} (${details.countryName}) : ${details.dateLabel}.${details.link ? ` Lien : ${details.link}.` : ""}`
  });
}

function visaMeetingEmailHtml(prenom, { headerLabel, introText, dateLabel, type, link, location, instructions }) {
  return `
  <div style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(76,29,149,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#4c1d95 0%,#6d28d9 55%,#8b5cf6 100%);padding:32px 32px 28px;text-align:center;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">SM Travel</div>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${headerLabel}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Bonjour ${prenom},</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">${introText}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;">
                <div style="border-radius:16px;background-color:#ede9fe;border:1px solid #ddd6fe;padding:18px 20px;">
                  <p style="margin:0 0 6px;font-size:13px;color:#4c1d95;font-weight:700;">${dateLabel}</p>
                  ${type ? `<p style="margin:0;font-size:13px;color:#4c1d95;">${type === "ONLINE" ? "Réunion en ligne" : "Réunion en présentiel"}</p>` : ""}
                  ${link ? `<p style="margin:10px 0 0;font-size:13px;"><a href="${link}" style="color:#6d28d9;font-weight:700;">Lien de la réunion</a></p>` : ""}
                  ${location && !link ? `<p style="margin:10px 0 0;font-size:13px;color:#475569;">${location}</p>` : ""}
                  ${instructions ? `<p style="margin:10px 0 0;font-size:13px;color:#475569;">${instructions}</p>` : ""}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  Retrouvez le détail de votre dossier visa directement depuis votre espace SM Travel.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">SM Travel · Accompagnement études &amp; visas à l'étranger</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendVisaPrepMeetingEmail(to, prenom, { dateLabel, type, location, instructions }) {
  const isOnline = type === "ONLINE";
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(),
    to,
    subject: "Réunion de préparation à votre entretien visa",
    html: visaMeetingEmailHtml(prenom, {
      headerLabel: "Préparation à l'entretien visa",
      introText: "Votre responsable dossier visa a planifié une réunion pour vous préparer à votre entretien visa. Merci de bien noter la date ci-dessous.",
      dateLabel,
      type,
      link: isOnline ? location : null,
      location: !isOnline ? location : null,
      instructions
    }),
    text: `Bonjour ${prenom}, une réunion de préparation à votre entretien visa a été planifiée : ${dateLabel} (${isOnline ? "en ligne" : "en présentiel"}). ${location ? `${isOnline ? "Lien" : "Adresse"} : ${location}.` : ""}`
  });
}

async function sendVisaEmbassyAppointmentEmail(to, prenom, { dateLabel }) {
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(),
    to,
    subject: "Votre rendez-vous à l'ambassade pour l'entretien visa",
    html: visaMeetingEmailHtml(prenom, {
      headerLabel: "Rendez-vous ambassade",
      introText: "Le rendez-vous pour votre entretien visa auprès de l'ambassade/du consulat a été enregistré. Merci de bien noter la date ci-dessous.",
      dateLabel
    }),
    text: `Bonjour ${prenom}, votre rendez-vous à l'ambassade pour l'entretien visa est fixé le : ${dateLabel}.`
  });
}

// Alerte technique générique (ex: sauvegarde en échec/en retard) — sobre,
// pas de gabarit marketing, destinée à un admin/opérateur, pas à un client.
async function sendAlertEmail(to, subject, message) {
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(" — Alertes"),
    to,
    subject: `[ALERTE] ${subject}`,
    text: message,
    html: `<div style="font-family:monospace;white-space:pre-wrap;padding:16px;border:1px solid #e2e8f0;border-radius:8px;color:#0f172a;">${message.replace(/\n/g, "<br/>")}</div>`
  });
}

module.exports = { sendVerificationEmail, sendInterviewEmail, sendAlertEmail, sendVisaPrepMeetingEmail, sendVisaEmbassyAppointmentEmail };
