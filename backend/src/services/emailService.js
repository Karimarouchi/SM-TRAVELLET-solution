const nodemailer = require("nodemailer");
const env = require("../config/env");
const settingsRepository = require("../repositories/settingsRepository");
const { renderEmail, highlightBlock, rowsBlock, calloutBlock, esc, escLines, appUrl } = require("./emailTemplates");

// Expéditeur des emails (nom, adresse, mot de passe d'application SMTP) —
// réglable par l'admin depuis Paramètres, pas codé en dur : changer
// l'adresse d'envoi ne sert à rien sans le mot de passe d'application du
// nouveau compte, donc les deux vivent ensemble ici. On reconstruit le
// transporteur à chaque envoi (pas de cache) pour qu'un changement de
// réglage soit pris en compte immédiatement, sans redémarrer le serveur. À
// défaut de valeur en base, on retombe sur le .env (compte de secours de
// l'infrastructure).
function guessSmtpHost(address) {
  const domain = String(address || "").split("@")[1]?.toLowerCase();
  if (domain === "gmail.com" || domain === "googlemail.com") return "smtp.gmail.com";
  return "";
}

// Teste la connexion SMTP (serveur + identifiants) SANS envoyer d'email.
// Renvoie un message d'erreur lisible, ou null si tout est bon.
async function verifySmtp({ host, port, user, pass }) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
  });
  try {
    await transporter.verify();
    return null;
  } catch (error) {
    const detail = String(error.response || error.message || "");
    if (error.code === "EAUTH" || /535|auth/i.test(detail)) {
      return `${host} refuse cette adresse ou ce mot de passe. Vérifiez qu'ils correspondent bien au serveur choisi (Gmail : mot de passe d'application ; Hostinger : mot de passe de la boîte mail).`;
    }
    if (/ENOTFOUND|EAI_AGAIN/.test(detail)) return `Serveur d'envoi introuvable : ${host}.`;
    if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|timeout/i.test(detail)) {
      return `Impossible de joindre ${host}:${port} (délai dépassé ou connexion refusée). Vérifiez le serveur et le port.`;
    }
    return `Connexion à ${host} impossible : ${detail.slice(0, 160)}`;
  } finally {
    transporter.close();
  }
}

async function resolveSender() {
  const secrets = await settingsRepository.getEmailSenderSecrets();
  const user = secrets.fromAddress || env.smtp.user;
  const pass = secrets.appPassword || env.smtp.pass;
  const fromName = secrets.fromName || env.smtp.fromName;

  // Le serveur d'envoi doit correspondre à l'adresse : Gmail refuse un compte
  // Hostinger et inversement. Réglé dans Paramètres ; à défaut, déduit de
  // l'adresse (gmail.com → Gmail), sinon le .env.
  const host = secrets.smtpHost || guessSmtpHost(user) || env.smtp.host;
  const port = secrets.smtpPort || env.smtp.port;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return {
    transporter,
    from: (nameSuffix = "") => `"${fromName}${nameSuffix}" <${user}>`
  };
}

// ── Gabarits des e-mails (mise en page commune : emailTemplates.js) ──

const SIGNATURE_NOTE = "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.";

function verificationEmailHtml(prenom, code) {
  return renderEmail({
    preheader: `Votre code de vérification SM Travel : ${code}`,
    headerLabel: "Espace client",
    badge: { label: "Vérification", tone: "info" },
    title: `Bienvenue ${prenom} !`,
    introHtml: "Merci de vous être inscrit·e sur SM Travel. Pour activer votre compte, saisissez le code ci-dessous dans l'application.",
    blocks: [highlightBlock({ label: "Votre code", value: code, spaced: true })],
    noteHtml: `Ce code est valable <strong>15 minutes</strong>. ${esc(SIGNATURE_NOTE)}`
  });
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

function passwordResetEmailHtml(prenom, code) {
  return renderEmail({
    preheader: `Votre code de réinitialisation : ${code}`,
    headerLabel: "Sécurité du compte",
    badge: { label: "Mot de passe oublié", tone: "warning" },
    title: `Bonjour ${prenom}`,
    introHtml: "Vous avez demandé à réinitialiser votre mot de passe. Saisissez le code ci-dessous dans l'application pour en choisir un nouveau.",
    blocks: [
      highlightBlock({ label: "Code de réinitialisation", value: code, spaced: true, tone: "warning" }),
      calloutBlock({
        tone: "warning",
        title: "Ne partagez jamais ce code",
        html: "SM Travel ne vous le demandera jamais, ni par téléphone ni par message."
      })
    ],
    noteHtml: `Ce code est valable <strong>15 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.`
  });
}

async function sendPasswordResetEmail(to, prenom, code) {
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(),
    to,
    subject: "Votre code de réinitialisation SM Travel",
    html: passwordResetEmailHtml(prenom, code),
    text: `Bonjour ${prenom}, votre code pour réinitialiser votre mot de passe SM Travel est : ${code} (valable 15 minutes). Ne le communiquez à personne. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`
  });
}

function interviewEmailHtml(prenom, { universityName, countryName, dateLabel, type, link, instructions }) {
  const online = type === "ONLINE";
  return renderEmail({
    preheader: `Entretien ${universityName} : ${dateLabel}`,
    headerLabel: "Candidature universitaire",
    badge: { label: "Entretien planifié", tone: "info" },
    title: `Bonjour ${prenom}, votre entretien est planifié`,
    introHtml: `Un entretien a été planifié dans le cadre de votre candidature pour <strong>${esc(universityName)}</strong>${countryName ? ` (${esc(countryName)})` : ""}. Notez bien la date ci-dessous.`,
    blocks: [
      rowsBlock([
        ["Université", universityName],
        ["Pays", countryName],
        ["Date et heure", dateLabel, { strong: true }],
        ["Format", online ? "En ligne" : "En présentiel"]
      ]),
      instructions ? calloutBlock({ tone: "info", title: "Consignes", html: escLines(instructions) }) : ""
    ],
    cta: online && link ? { label: "Rejoindre l'entretien", url: link } : undefined
  });
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
  const online = type === "ONLINE";
  return renderEmail({
    preheader: `${headerLabel} : ${dateLabel}`,
    headerLabel: "Dossier visa",
    badge: { label: headerLabel, tone: "info" },
    title: `Bonjour ${prenom}`,
    introHtml: esc(introText),
    blocks: [
      rowsBlock([
        ["Date et heure", dateLabel, { strong: true }],
        type ? ["Format", online ? "Réunion en ligne" : "Réunion en présentiel"] : null,
        location && !link ? ["Lieu", location] : null
      ].filter(Boolean)),
      instructions ? calloutBlock({ tone: "info", title: "Consignes", html: escLines(instructions) }) : ""
    ],
    cta: link ? { label: "Rejoindre la réunion", url: link } : undefined,
    noteHtml: "Retrouvez le détail de votre dossier visa directement depuis votre espace SM Travel."
  });
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

// Alerte destinée à l'équipe (dossier bloqué, sauvegarde en échec…).
// options : title, tone ("warning" | "danger"), rows [[libellé, valeur]],
// actionText, link (adresse dans l'application), linkLabel.
function alertEmailHtml(subject, message, options = {}) {
  const tone = options.tone || "danger";
  const rows = options.rows || [];
  return renderEmail({
    preheader: options.title || subject,
    headerLabel: "Alerte plateforme",
    audience: "staff",
    badge: { label: tone === "danger" ? "Alerte" : "À traiter", tone },
    title: options.title || subject,
    introHtml: options.intro ? esc(options.intro) : "",
    blocks: [
      rows.length ? rowsBlock(rows) : "",
      message || options.actionText
        ? calloutBlock({
            tone,
            title: options.actionText ? "Action requise" : undefined,
            html: options.actionText ? esc(options.actionText) : `<span style="font-family:Consolas,'Courier New',monospace;font-size:13px;">${escLines(message)}</span>`
          })
        : ""
    ],
    cta: options.link ? { label: options.linkLabel || "Ouvrir dans SM Travel", url: appUrl(options.link), tone } : undefined
  });
}

// Alerte technique générique (ex. sauvegarde en échec/en retard) et alertes
// métier structurées (dossier bloqué) : même gabarit.
async function sendAlertEmail(to, subject, message, options = {}) {
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(" — Alertes"),
    to,
    subject: `[ALERTE] ${subject}`,
    text: message,
    html: alertEmailHtml(subject, message, options)
  });
}

// Décision d'une université (acceptation ou refus) pour une filière précise.
function applicationDecisionEmailHtml(prenom, { accepted, universityName, fieldOfStudy, countryName, reason }) {
  return renderEmail({
    preheader: accepted ? `Candidature acceptée : ${universityName}` : `Réponse à votre candidature : ${universityName}`,
    headerLabel: "Candidature universitaire",
    badge: { label: accepted ? "Candidature acceptée" : "Candidature refusée", tone: accepted ? "success" : "danger" },
    title: accepted ? `Félicitations ${prenom} !` : `Bonjour ${prenom}`,
    introHtml: accepted
      ? `Bonne nouvelle : votre candidature à <strong>${esc(universityName)}</strong> a été <strong>acceptée</strong>. Votre conseiller va maintenant vous accompagner pour préparer votre dossier visa.`
      : `Nous avons le regret de vous informer que votre candidature à <strong>${esc(universityName)}</strong> a été <strong>refusée</strong> par l'université. Votre conseiller reste à votre disposition pour étudier avec vous une autre option.`,
    blocks: [
      rowsBlock([
        ["Université", universityName],
        ["Filière", fieldOfStudy],
        ["Pays", countryName],
        ["Décision", accepted ? "Acceptée" : "Refusée", { strong: true }]
      ], { accent: accepted ? "#059669" : "#dc2626" }),
      !accepted && reason ? calloutBlock({ tone: "danger", title: "Motif communiqué", html: escLines(reason) }) : ""
    ],
    cta: { label: accepted ? "Préparer mon visa" : "Voir mes candidatures", url: appUrl("/espace"), tone: accepted ? "success" : "info" }
  });
}

async function sendApplicationDecisionEmail(to, prenom, details) {
  const { accepted, universityName, fieldOfStudy, countryName, reason } = details;
  const target = fieldOfStudy ? `${universityName} (${fieldOfStudy})` : universityName;
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(),
    to,
    subject: accepted ? `Félicitations — candidature acceptée : ${target}` : `Candidature refusée : ${target}`,
    html: applicationDecisionEmailHtml(prenom, details),
    text: `Bonjour ${prenom}, votre candidature à ${target}${countryName ? ` (${countryName})` : ""} a été ${accepted ? "acceptée" : "refusée"}.${!accepted && reason ? ` Motif : ${reason}.` : ""}`
  });
}

// Reçu de paiement : envoyé à l'étudiant à chaque paiement enregistré.
function paymentReceiptEmailHtml(prenom, d) {
  const settled = /soldé/i.test(d.remainingLabel || "");
  return renderEmail({
    preheader: `Reçu n° ${d.receiptNumber} : ${d.amountLabel}`,
    headerLabel: "Reçu de paiement",
    badge: { label: "Paiement reçu", tone: "success" },
    title: `Merci ${prenom}`,
    introHtml: "Nous avons bien enregistré votre paiement. Conservez ce reçu : son numéro permet de le retrouver à tout moment.",
    blocks: [
      highlightBlock({ label: "Reçu n°", value: d.receiptNumber, tone: "success" }),
      rowsBlock([
        ["Montant payé", d.amountLabel, { strong: true }],
        ["Pour", d.trancheLabel],
        ["Destination", d.countryName],
        ["Date", d.dateLabel],
        ["Mode de paiement", d.methodLabel],
        d.reference ? [d.referenceLabel || "Référence", d.reference] : null
      ].filter(Boolean)),
      rowsBlock([
        ["Prix total", d.totalLabel],
        ["Déjà payé", d.paidLabel],
        ["Reste à payer", d.remainingLabel, { strong: !settled }]
      ]),
      settled ? calloutBlock({ tone: "success", title: "Paiement soldé", html: "Merci, vous n'avez plus rien à régler pour ce dossier." }) : ""
    ]
  });
}

async function sendPaymentReceiptEmail(to, prenom, details) {
  const sender = await resolveSender();
  await sender.transporter.sendMail({
    from: sender.from(),
    to,
    subject: `Reçu de paiement n° ${details.receiptNumber} — SM Travel`,
    html: paymentReceiptEmailHtml(prenom, details),
    text: `Bonjour ${prenom}, nous avons bien enregistré votre paiement de ${details.amountLabel} (${details.trancheLabel}, ${details.countryName}) le ${details.dateLabel}. Reçu n° ${details.receiptNumber}. Mode : ${details.methodLabel}${details.reference ? ` (${details.referenceLabel || "réf."} ${details.reference})` : ""}. Reste à payer : ${details.remainingLabel}.`
  });
}

// Aperçus (pages HTML de test) : utilisé par les scripts de vérification visuelle.
const templates = {
  verification: verificationEmailHtml,
  passwordReset: passwordResetEmailHtml,
  interview: interviewEmailHtml,
  visaMeeting: visaMeetingEmailHtml,
  alert: alertEmailHtml,
  applicationDecision: applicationDecisionEmailHtml,
  paymentReceipt: paymentReceiptEmailHtml
};

module.exports = {
  templates,
  sendPaymentReceiptEmail,
  sendApplicationDecisionEmail,
  verifySmtp,
  guessSmtpHost,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendInterviewEmail,
  sendAlertEmail,
  sendVisaPrepMeetingEmail,
  sendVisaEmbassyAppointmentEmail
};
