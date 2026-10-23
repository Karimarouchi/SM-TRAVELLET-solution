const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const logger = require("./logger");
const { authRoles, requireAuth, requireRoles, requirePermission, requireAnyPermission, requireRolesOrPermissions } = require("./security/rbac");
const authController = require("./controllers/authController");
const studentController = require("./controllers/studentController");
const salesController = require("./controllers/salesController");
const adminController = require("./controllers/adminController");
const notificationController = require("./controllers/notificationController");
const whatsappWebhookController = require("./controllers/whatsappWebhookController");
const whatsappController = require("./controllers/whatsappController");
const googleController = require("./controllers/googleController");
const programmeController = require("./controllers/programmeController");
const avisController = require("./controllers/avisController");
const countryController = require("./controllers/countryController");
const documentRequirementController = require("./controllers/documentRequirementController");
const studentDocumentController = require("./controllers/studentDocumentController");
const salesCodeController = require("./controllers/salesCodeController");
const mailController = require("./controllers/mailController");
const studentNoteController = require("./controllers/studentNoteController");
const studentMailController = require("./controllers/studentMailController");
const translationController = require("./controllers/translationController");
const countryUniversityController = require("./controllers/countryUniversityController");
const universityApplicationController = require("./controllers/universityApplicationController");
const universityChoiceController = require("./controllers/universityChoiceController");
const paymentController = require("./controllers/paymentController");
const financeChargeController = require("./controllers/financeChargeController");
const hrController = require("./controllers/hrController");
const salesDashboardController = require("./controllers/salesDashboardController");
const backupController = require("./controllers/backupController");
const commissionController = require("./controllers/commissionController");
const commissionPayoutController = require("./controllers/commissionPayoutController");
const archiveController = require("./controllers/archiveController");
const archiveService = require("./services/archiveService");
const stalledAlertService = require("./services/stalledAlertService");
const invoiceController = require("./controllers/invoiceController");
const backupService = require("./services/backupService");
const { query } = require("../db");

const app = express();
// Le site est derrière nginx (un seul relais) : on lit la vraie adresse du visiteur
// dans X-Forwarded-For. Sans cela, tous les visiteurs partageraient l'adresse du
// relais pour la limitation de débit (connexion, codes…).
app.set("trust proxy", 1);
app.use(cors({ origin: env.corsOrigin }));
// Identifiants du compte créé sur la plateforme de l'université : réservés à l'équipe SM
// (admin, conseiller, responsable dossier). Jamais renvoyés à un étudiant, quelle que soit la route.
const PORTAL_KEYS = new Set(["portalLogin", "portalPassword", "portalUrl"]);
app.use((req, res, next) => {
  const send = res.json.bind(res);
  res.json = (body) => {
    const staff = authRoles(req.auth).some((r) => ["ADMIN", "SALES", "RDV"].includes(r));
    if (staff || body === null || typeof body !== "object") return send(body);
    return send(JSON.parse(JSON.stringify(body, (key, value) => (PORTAL_KEYS.has(key) ? undefined : value))));
  };
  next();
});
// Documents de l'étudiant (5 Mo max) : un fichier de 5 Mo pèse environ 6,7 Mo une fois encodé en base64,
// donc la limite JSON de 5 Mo refusait déjà les fichiers de plus de 3,7 Mo avec une erreur 500.
app.use(["/api/students/me/documents", "/api/students/me/visa-documents", "/api/students/:id/documents", "/api/applications/:id/visa-documents", "/api/students/me/translations", "/api/translations"], express.json({ limit: "9mb" }));
// Envoi d'un fichier WhatsApp (16 Mo max, soit environ 22 Mo en base64) : limite dédiée à cette route.
app.use("/api/whatsapp/conversations/:contactId/media", express.json({ limit: "25mb" }));
// Envoi de mail avec pièces jointes (10 Mo, soit environ 14 Mo en base64) : limite dédiée à cette seule route.
app.use("/api/mail/send", express.json({ limit: "15mb" }));
app.use("/api/admin/hr/payroll/import", express.json({ limit: "12mb" }));
app.use(express.json({
  limit: "5mb",
  // Corps brut conservé pour le webhook WhatsApp uniquement : la signature
  // X-Hub-Signature-256 de Meta se vérifie sur les octets exacts reçus.
  verify: (req, _res, buf) => {
    if (req.originalUrl.startsWith("/api/whatsapp/webhook")) req.rawBody = buf;
  }
}));
// Documents des étudiants (passeports, diplômes...) : jamais en accès libre,
// uniquement via /api/documents/files/:filename, qui vérifie les droits.
app.use("/uploads/documents", (_req, res) => res.status(404).json({ error: "Introuvable." }));
app.use("/uploads/hr", (_req, res) => res.status(404).json({ error: "Introuvable." }));
// Fichiers envoyés sur WhatsApp : jamais en accès libre, uniquement via la route authentifiée de la conversation.
app.use("/uploads/whatsapp", (_req, res) => res.status(404).json({ error: "Introuvable." }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", async (_req, res) => {
  await query("SELECT 1");
  res.json({ ok: true, service: "sm-travel-backend", db: "postgres", phase: 1 });
});

// Public programmes route for site vitrine
app.get("/api/public/programmes", programmeController.listPublic);

// Public avis route for site vitrine
app.get("/api/public/avis", avisController.getPublicAvis);

// Public countries route for site vitrine / formulaires
app.get("/api/public/countries", countryController.listPublic);
app.get("/api/public/universities", countryUniversityController.listPublic);

// Google Calendar (liens Meet automatiques) : le retour OAuth est public
// (c'est le navigateur de l'admin qui revient de Google), protégé par le
// « state » signé.
app.get("/api/google/callback", googleController.callback);
app.get("/api/google/status", requireAuth, requireRoles("ADMIN", "RDV"), googleController.status);
app.get("/api/admin/google/connect", requireAuth, requireRoles("ADMIN"), googleController.connect);
app.delete("/api/admin/google", requireAuth, requireRoles("ADMIN"), googleController.disconnect);
app.get("/api/whatsapp/webhook", whatsappWebhookController.verifyWebhook);
app.post("/api/whatsapp/webhook", whatsappWebhookController.receiveWebhook);

app.get("/api/whatsapp/conversations", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.listConversations);
// Remarques internes sur un étudiant : équipe SM seulement (jamais visibles par l'étudiant).
app.get("/api/students/:id/notes", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), studentNoteController.list);
app.post("/api/students/:id/notes", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), studentNoteController.create);
app.delete("/api/student-notes/:noteId", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), studentNoteController.remove);

// Boîte mail commune de l'agence : toute l'équipe SM (admin, conseillers, responsables dossier).
const mailSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.auth?.sub || "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de mails envoyés en peu de temps. Réessayez dans quelques minutes." }
});
// Traductions de documents : demandées par le conseiller (ou l'admin), déposées par l'étudiant ou le conseiller.
app.post("/api/students/:id/translations", requireAuth, requireRoles("SALES", "ADMIN"), translationController.request);
app.delete("/api/translations/:translationId", requireAuth, requireRoles("SALES", "ADMIN"), translationController.remove);
app.post("/api/students/me/translations/:translationId/file", requireAuth, requireRoles("STUDENT"), translationController.uploadByStudent);
app.post("/api/translations/:translationId/file", requireAuth, requireRoles("SALES", "ADMIN"), translationController.uploadByStaff);
app.patch("/api/translations/:translationId/review", requireAuth, requireRoles("SALES", "ADMIN"), translationController.review);
// Mails reçus par l'étudiant (envoyés depuis la page Mail) : son espace, sa preuve de réception.
app.get("/api/students/me/mails", requireAuth, requireRoles("STUDENT"), studentMailController.listMine);
app.get("/api/students/me/mails/unread-count", requireAuth, requireRoles("STUDENT"), studentMailController.unreadMine);
app.patch("/api/students/me/mails/:mailId/read", requireAuth, requireRoles("STUDENT"), studentMailController.markRead);
app.get("/api/students/:id/mails", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), studentMailController.listForStaff);
app.get("/api/mail/recipients", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), mailController.recipients);
app.get("/api/mail/status", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), mailController.status);
app.get("/api/mail/unread-count", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), mailController.unreadCount);
app.get("/api/mail/messages", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), mailController.list);
app.get("/api/mail/messages/:folder/:uid", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), mailController.read);
app.get("/api/mail/messages/:folder/:uid/attachments/:index", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), mailController.attachment);
app.post("/api/mail/send", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), mailSendLimiter, mailController.send);
app.get("/api/whatsapp/diagnostic", requireAuth, requireRoles("ADMIN"), whatsappController.diagnostic);
app.post("/api/whatsapp/diagnostic/reset", requireAuth, requireRoles("ADMIN"), whatsappController.resetDiagnostic);
app.get("/api/whatsapp/unread-count", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.unreadCount);
app.get("/api/whatsapp/conversations/:contactId/messages", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.getMessages);
app.post("/api/whatsapp/conversations/:contactId/messages", requireAuth, requireRoles("SALES"), whatsappController.sendMessage);
app.post("/api/whatsapp/conversations/:contactId/media", requireAuth, requireRoles("SALES"), whatsappController.sendMedia);
app.get("/api/whatsapp/conversations/:contactId/messages/:messageId/media", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.getMedia);
app.post("/api/whatsapp/conversations/:contactId/messages/:messageId/hide", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.hideMessage);
app.patch("/api/whatsapp/conversations/:contactId/mute", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.setMuted);
app.patch("/api/whatsapp/conversations/:contactId/block", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.setBlocked);
app.patch("/api/whatsapp/conversations/:contactId/student", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.linkStudent);
app.patch("/api/whatsapp/conversations/:contactId/owner", requireAuth, requireRoles("ADMIN"), whatsappController.assignOwner);

// Désactivé hors production (tests/dev) pour ne pas bloquer les allers-retours
// de test ; s'active automatiquement dès que NODE_ENV=production est défini
// (déploiement réel).
const authBruteForceLimiter = process.env.NODE_ENV === "production"
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Trop de tentatives. Réessayez dans quelques minutes." }
    })
  : (_req, _res, next) => next();

app.post("/api/auth/register", authController.register);
app.post("/api/auth/login", authBruteForceLimiter, authController.login);
app.post("/api/auth/logout", requireAuth, authController.logout);
app.post("/api/auth/forgot-password", authBruteForceLimiter, authController.forgotPassword);
app.post("/api/auth/verify-reset-code", authBruteForceLimiter, authController.verifyResetCode);
app.post("/api/auth/reset-password", authBruteForceLimiter, authController.resetPassword);
app.get("/api/auth/me", requireAuth, authController.me);
app.post("/api/auth/change-password", requireAuth, authController.changePassword);
app.post("/api/auth/verify-email", requireAuth, authController.verifyEmail);
app.post("/api/auth/resend-verification", requireAuth, authBruteForceLimiter, authController.resendVerification);

app.get("/api/students/me", requireAuth, requireRoles("STUDENT"), studentController.me);
app.put("/api/students/me/onboarding", requireAuth, requireRoles("STUDENT"), studentController.onboarding);
app.patch("/api/students/me/identity", requireAuth, requireRoles("STUDENT"), studentController.identity);
app.post("/api/students/me/avatar", requireAuth, requireRoles("STUDENT"), studentController.avatar);
app.get("/api/students", requireAuth, requireRoles("SALES", "ADMIN"), studentController.list);
app.get("/api/students/:id/application-blockers", requireAuth, requireRoles("SALES", "ADMIN"), studentController.blockers);
app.get("/api/students/:id", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), studentController.detail);
app.patch("/api/students/:id/assign", requireAuth, requireRoles("ADMIN"), studentController.assign);
app.post("/api/students/avis", requireAuth, requireRoles("STUDENT"), avisController.createStudentAvis);
app.get("/api/documents/files/:filename", requireAuth, studentDocumentController.file);
app.get("/api/documents/files/:filename/link", requireAuth, studentDocumentController.fileLink);
// Ouverture par lien signé de 5 min (créé ci-dessus) : l'adresse porte le nom d'origine du fichier.
app.get("/api/documents/open/:token/:name", studentDocumentController.openWithLink);
app.get("/api/students/me/documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.list);
app.post("/api/students/me/documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.upload);
app.get("/api/students/me/university-choices", requireAuth, requireRoles("STUDENT"), universityChoiceController.listMine);
app.post("/api/students/me/university-choices", requireAuth, requireRoles("STUDENT"), universityChoiceController.addMine);
app.get("/api/students/:id/university-choices", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), universityChoiceController.listForStudent);
app.post("/api/students/:id/university-choices", requireAuth, requireRoles("SALES", "ADMIN"), universityChoiceController.addForStudent);
app.delete("/api/university-choices/:id", requireAuth, requireRoles("STUDENT", "SALES", "ADMIN"), universityChoiceController.remove);
app.get("/api/countries/:countryId/university-picker", requireAuth, requireRoles("STUDENT", "SALES", "ADMIN"), universityChoiceController.picker);
// Documents propres à une université (admin : toutes ; conseiller : universités hors conventions de ses étudiants).
app.get("/api/universities/:id/documents", requireAuth, requireRolesOrPermissions(["SALES", "ADMIN"], ["MANAGE_COUNTRIES"]), documentRequirementController.listByUniversity);
app.post("/api/universities/:id/documents", requireAuth, requireRolesOrPermissions(["SALES", "ADMIN"], ["MANAGE_COUNTRIES"]), documentRequirementController.createForUniversity);
app.put("/api/university-documents/:id", requireAuth, requireRolesOrPermissions(["SALES", "ADMIN"], ["MANAGE_COUNTRIES"]), documentRequirementController.update);
app.patch("/api/university-documents/:id/active", requireAuth, requireRolesOrPermissions(["SALES", "ADMIN"], ["MANAGE_COUNTRIES"]), documentRequirementController.setActive);
app.delete("/api/university-documents/:id", requireAuth, requireRolesOrPermissions(["SALES", "ADMIN"], ["MANAGE_COUNTRIES"]), documentRequirementController.remove);
app.get("/api/students/:id/documents", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), studentDocumentController.listForStudent);
app.post("/api/students/:id/documents", requireAuth, requireRoles("SALES", "ADMIN"), studentDocumentController.uploadForStudent);
app.patch("/api/students/:id/documents/rdv-reject", requireAuth, requireRoles("RDV"), studentDocumentController.rdvReject);
app.patch("/api/students/:id/documents/review", requireAuth, requireRoles("SALES", "ADMIN"), studentDocumentController.review);
app.get("/api/students/me/visa-documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.myVisaChecklist);
app.post("/api/students/me/visa-documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.uploadVisa);
app.get("/api/applications/:id/visa-documents", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), studentDocumentController.visaChecklistForApplication);
app.get("/api/applications/:id/study-documents", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), studentDocumentController.studyDocumentsForApplication);
app.post("/api/applications/:id/visa-documents/reuse", requireAuth, requireRoles("SALES", "ADMIN"), studentDocumentController.reuseStudyDocument);
app.post("/api/applications/:id/visa-documents", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), studentDocumentController.uploadVisaForStudent);
app.patch("/api/applications/:id/visa-documents/review", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), studentDocumentController.reviewVisa);

app.get("/api/students/me/applications", requireAuth, requireRoles("STUDENT"), universityApplicationController.listMine);
app.get("/api/students/:id/applications", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), universityApplicationController.listForStudent);
app.get("/api/students/:id/applications/history", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), universityApplicationController.historyForStudent);
app.patch("/api/applications/:id/translation-done", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.markTranslationDone);
app.get("/api/applications/:id/deposit-recap", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), universityApplicationController.depositRecap);
app.patch("/api/applications/:id/apply", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.markApplied);
// Compte créé sur la plateforme de l'université : corrigeable après le dépôt (Responsable Dossier ou admin).
app.patch("/api/applications/:id/portal-account", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.updatePortalAccount);
// Correction silencieuse d'une candidature déjà déposée : ni e-mail, ni notification.
app.patch("/api/applications/:id/university", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.correctUniversity);
app.delete("/api/applications/:id", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.removeDeposited);
app.patch("/api/applications/:id/interview", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.scheduleInterview);
app.patch("/api/applications/:id/interview-completed", requireAuth, requireRoles("RDV", "ADMIN", "STUDENT"), universityApplicationController.completeInterview);
app.patch("/api/applications/:id/accept", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.markAccepted);
app.patch("/api/applications/:id/reject", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.markRejected);
app.patch("/api/applications/:id/close", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.closeApplication);
app.post("/api/applications/:id/visa-docs-confirm", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.confirmVisaDocs);
app.patch("/api/applications/:id/postpone", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.postpone);
app.post("/api/applications/:id/retry", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.retryPostponed);
app.post("/api/applications/:id/reapply", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.reapply);
app.post("/api/applications/:id/meet-link", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.createMeetLink);
app.patch("/api/applications/:id/staff-meet", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.scheduleStaffMeet);
app.get("/api/applications/:id/rdv-suggestion", requireAuth, requireRoles("ADMIN"), universityApplicationController.suggestRdv);
app.patch("/api/applications/:id/assign-rdv", requireAuth, requireRoles("ADMIN"), universityApplicationController.assignRdv);
app.patch("/api/applications/:id/visa-submit", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.markVisaSubmitted);
app.patch("/api/applications/:id/visa-accept", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.markVisaAccepted);
app.patch("/api/applications/:id/visa-reject", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.markVisaRejected);
app.patch("/api/applications/:id/visa-prep-meeting", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.scheduleVisaPrepMeeting);
app.post("/api/applications/:id/visa-explain-meet", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.launchVisaExplainMeet);
app.patch("/api/applications/:id/visa-embassy-appointment", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.scheduleVisaEmbassyAppointment);
app.get("/api/rdv/me/applications", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.listMineForRdv);

// Archive des dossiers — Sales voit les siens, RDV voit les siens, Admin voit tout
app.get("/api/archive", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), archiveController.listArchive);
app.get("/api/archive/settings", requireAuth, requireRoles("ADMIN"), archiveController.getSettings);
app.put("/api/archive/settings", requireAuth, requireRoles("ADMIN"), archiveController.updateSettings);
app.post("/api/archive/purge", requireAuth, requireRoles("ADMIN"), archiveController.purge);

app.get("/api/sales/me", requireAuth, requireRoles("SALES", "ADMIN"), salesController.me);
app.get("/api/sales", requireAuth, requireRoles("SALES", "ADMIN"), salesController.list);
app.get("/api/sales/me/overview", requireAuth, requireRoles("SALES"), salesDashboardController.overview);
app.get("/api/sales/me/codes", requireAuth, requireRoles("SALES"), salesCodeController.list);
app.post("/api/sales/me/codes", requireAuth, requireRoles("SALES"), salesCodeController.create);

app.get("/api/admin/backup/status", requireAuth, requireRoles("ADMIN"), backupController.status);
app.post("/api/admin/backup/run", requireAuth, requireRoles("ADMIN"), backupController.run);
app.get("/api/admin/backup/restore-status", requireAuth, requireRoles("ADMIN"), backupController.restoreStatus);
app.post("/api/admin/backup/restore", requireAuth, requireRoles("ADMIN"), backupController.restore);

// Commissions Sales/RDV — configuration des taux et registre des gains
// Finance : tarifs par pays, tableau de bord et liste des plans (admin) ;
// paiements d'un étudiant (admin ou conseiller de l'étudiant).
app.get("/api/admin/finance/overview", requireAuth, requireRoles("ADMIN"), paymentController.overview);
app.get("/api/admin/finance/exercise", requireAuth, requireRoles("ADMIN"), financeChargeController.exercise);
app.get("/api/admin/finance/charges", requireAuth, requireRoles("ADMIN"), financeChargeController.exercise);
app.post("/api/admin/finance/charges", requireAuth, requireRoles("ADMIN"), financeChargeController.create);
app.delete("/api/admin/finance/charges/:id", requireAuth, requireRoles("ADMIN"), financeChargeController.remove);
app.get("/api/admin/finance/invoicing", requireAuth, requireRoles("ADMIN"), invoiceController.listStudents);
app.post("/api/admin/finance/invoices", requireAuth, requireRoles("ADMIN"), invoiceController.create);
app.get("/api/admin/finance/invoices/:id/pdf", requireAuth, requireRoles("ADMIN"), invoiceController.pdf);
app.get("/api/admin/finance/stats", requireAuth, requireRoles("ADMIN"), paymentController.stats);
app.get("/api/admin/finance/plans", requireAuth, requireRoles("ADMIN"), paymentController.listPlans);
app.get("/api/admin/finance/payments", requireAuth, requireRoles("ADMIN"), paymentController.listJournal);
app.get("/api/admin/finance/pricing", requireAuth, requireRoles("ADMIN"), paymentController.listPricing);
app.put("/api/admin/finance/pricing/:countryId", requireAuth, requireRoles("ADMIN"), paymentController.setPricing);
app.delete("/api/admin/finance/pricing/:countryId", requireAuth, requireRoles("ADMIN"), paymentController.removePricing);
app.get("/api/finance/pricing/:countryId", requireAuth, requireRoles("SALES", "ADMIN"), paymentController.getPricing);
app.get("/api/students/me/payments", requireAuth, requireRoles("STUDENT"), paymentController.mySummary);
app.get("/api/students/:id/payments", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), paymentController.studentSummary);
app.post("/api/students/:id/payments", requireAuth, requireRoles("SALES", "ADMIN"), paymentController.record);
app.patch("/api/payments/:id/date", requireAuth, requireRoles("ADMIN"), paymentController.updateDate);
app.patch("/api/payments/:id/cancel", requireAuth, requireRoles("ADMIN"), paymentController.cancel);
app.get("/api/admin/commission-rules", requireAuth, requireRoles("ADMIN"), commissionController.listRules);
app.post("/api/admin/commission-rules", requireAuth, requireRoles("ADMIN"), commissionController.upsertRule);
app.patch("/api/admin/commission-rules/:id/active", requireAuth, requireRoles("ADMIN"), commissionController.setRuleActive);
app.delete("/api/admin/commission-rules/:id", requireAuth, requireRoles("ADMIN"), commissionController.removeRule);
app.get("/api/admin/commission-earnings", requireAuth, requireRoles("ADMIN"), commissionController.listAllEarnings);
app.get("/api/admin/commission-payouts/due", requireAuth, requireRoles("ADMIN"), commissionPayoutController.listDue);
app.get("/api/admin/commission-payouts", requireAuth, requireRoles("ADMIN"), commissionPayoutController.listPayouts);
app.get("/api/admin/commission-payouts/users/:userId", requireAuth, requireRoles("ADMIN"), commissionPayoutController.userCommissions);
app.post("/api/admin/commission-payouts/users/:userId/pay", requireAuth, requireRoles("ADMIN"), commissionPayoutController.payUser);
app.post("/api/admin/commission-payouts/pay-all", requireAuth, requireRoles("ADMIN"), commissionPayoutController.payAll);
app.get("/api/me/commissions", requireAuth, requireRoles("SALES", "RDV"), commissionController.myEarnings);
app.get("/api/admin/hr/inbox", requireAuth, requireRoles("ADMIN"), hrController.inbox);
app.get("/api/admin/hr/employees", requireAuth, requireRoles("ADMIN"), hrController.employees);
app.patch("/api/admin/hr/employees/:id", requireAuth, requireRoles("ADMIN"), hrController.updateEmployee);
app.get("/api/admin/hr/settings", requireAuth, requireRoles("ADMIN"), hrController.settings);
app.put("/api/admin/hr/settings", requireAuth, requireRoles("ADMIN"), hrController.updateSettings);
app.get("/api/admin/hr/holidays", requireAuth, requireRoles("ADMIN"), hrController.holidays);
app.post("/api/admin/hr/holidays", requireAuth, requireRoles("ADMIN"), hrController.addHoliday);
app.patch("/api/admin/hr/holidays/:id", requireAuth, requireRoles("ADMIN"), hrController.setHolidayPaid);
app.delete("/api/admin/hr/holidays/:id", requireAuth, requireRoles("ADMIN"), hrController.removeHoliday);
app.get("/api/admin/hr/leave", requireAuth, requireRoles("ADMIN"), hrController.leaveOverview);
app.post("/api/admin/hr/leave", requireAuth, requireRoles("ADMIN"), hrController.createLeave);
app.get("/api/admin/hr/leave/cover-options", requireAuth, requireRoles("ADMIN"), hrController.leaveCoverOptions);
app.patch("/api/admin/hr/leave/:id", requireAuth, requireRoles("ADMIN"), hrController.decideLeave);
app.put("/api/admin/hr/leave/:id/cover", requireAuth, requireRoles("ADMIN"), hrController.updateLeaveCover);
app.post("/api/admin/hr/leave/settle", requireAuth, requireRoles("ADMIN"), hrController.settleLeave);
app.post("/api/admin/hr/leave/balance", requireAuth, requireRoles("ADMIN"), hrController.setLeaveBalance);
app.get("/api/admin/hr/leave/absences", requireAuth, requireRoles("ADMIN"), hrController.leaveAbsences);
app.post("/api/admin/hr/leave/absences", requireAuth, requireRoles("ADMIN"), hrController.coverLeaveAbsences);
app.get("/api/hr/me", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myLeave);
// Congé en cours (lecture seule) et collègues remplacés : bandeaux de l'application.
app.get("/api/hr/me/leave-cover", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myLeaveCover);
app.get("/api/hr/me/holidays", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myHolidays);
app.post("/api/hr/me/leave/preview", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.previewMyLeave);
app.post("/api/hr/me/leave", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.requestMyLeave);
app.get("/api/admin/hr/attendance", requireAuth, requireRoles("ADMIN"), hrController.attendanceMonth);
app.put("/api/admin/hr/attendance/day", requireAuth, requireRoles("ADMIN"), hrController.saveAttendanceDay);
app.put("/api/admin/hr/attendance/month", requireAuth, requireRoles("ADMIN"), hrController.saveAttendanceAmount);
app.post("/api/admin/hr/attendance/absences", requireAuth, requireRoles("ADMIN"), hrController.confirmAttendanceAbsences);
app.post("/api/admin/hr/attendance/lateness", requireAuth, requireRoles("ADMIN"), hrController.confirmAttendanceLateness);
app.get("/api/admin/hr/payroll", requireAuth, requireRoles("ADMIN"), hrController.payrollMonth);
app.put("/api/admin/hr/payroll/adjustment", requireAuth, requireRoles("ADMIN"), hrController.savePayrollAdjustment);
app.put("/api/admin/hr/payroll/commissions", requireAuth, requireRoles("ADMIN"), hrController.setPayrollCommission);
app.post("/api/admin/hr/payroll/entries", requireAuth, requireRoles("ADMIN"), hrController.addPayrollEntry);
app.delete("/api/admin/hr/payroll/entries/:id", requireAuth, requireRoles("ADMIN"), hrController.removePayrollEntry);
app.post("/api/admin/hr/payroll/import", requireAuth, requireRoles("ADMIN"), hrController.importPayslipPreview);
app.post("/api/admin/hr/payroll/import/confirm", requireAuth, requireRoles("ADMIN"), hrController.confirmPayslipImport);
app.delete("/api/admin/hr/payroll/bulletin", requireAuth, requireRoles("ADMIN"), hrController.removeOfficialPayslip);
app.get("/api/admin/hr/payroll/:userId/bulletin", requireAuth, requireRoles("ADMIN"), hrController.officialPayslipPdf);
app.get("/api/admin/hr/payroll/:userId/accountant", requireAuth, requireRoles("ADMIN"), hrController.accountantPdf);
app.get("/api/admin/hr/payroll/:userId/fiches", requireAuth, requireRoles("ADMIN"), hrController.fichesPdf);
app.post("/api/admin/hr/payroll/payments", requireAuth, requireRoles("ADMIN"), hrController.paySalary);
app.delete("/api/admin/hr/payroll/payments/:id", requireAuth, requireRoles("ADMIN"), hrController.cancelSalaryPayment);
app.post("/api/admin/hr/payroll/issue", requireAuth, requireRoles("ADMIN"), hrController.issuePayslip);
app.delete("/api/admin/hr/payroll/issue", requireAuth, requireRoles("ADMIN"), hrController.reopenPayslip);
app.get("/api/admin/hr/payroll/:userId/pdf", requireAuth, requireRoles("ADMIN"), hrController.payslipPdf);
app.get("/api/admin/hr/attestations/:userId/pdf", requireAuth, requireRoles("ADMIN"), hrController.attestationPdf);
app.get("/api/admin/hr/branding", requireAuth, requireRoles("ADMIN"), hrController.payrollBranding);
app.put("/api/admin/hr/branding/:kind", requireAuth, requireRoles("ADMIN"), hrController.savePayrollBrand);
app.get("/api/admin/hr/branding/:kind/file", requireAuth, requireRoles("ADMIN"), hrController.payrollBrandFile);
app.get("/api/admin/hr/employees/:id/dossier", requireAuth, requireRoles("ADMIN"), hrController.employeeDossier);
app.post("/api/admin/hr/employees/:id/documents", requireAuth, requireRoles("ADMIN"), hrController.addEmployeeDocument);
app.get("/api/admin/hr/documents/:id/file", requireAuth, requireRoles("ADMIN"), hrController.employeeDocumentFile);
app.delete("/api/admin/hr/documents/:id", requireAuth, requireRoles("ADMIN"), hrController.removeEmployeeDocument);
app.get("/api/admin/hr/document-requests", requireAuth, requireRoles("ADMIN"), hrController.documentRequests);
app.patch("/api/admin/hr/document-requests/:id", requireAuth, requireRoles("ADMIN"), hrController.decideDocumentRequest);
app.get("/api/hr/me/payslips", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myPayslips);
app.get("/api/hr/me/document-requests", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myDocumentRequests);
app.post("/api/hr/me/document-requests", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.requestDocument);
app.get("/api/hr/me/payslips/pdf", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myPayslipPdf);
app.get("/api/hr/me/attestations/pdf", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myAttestationPdf);
app.get("/api/hr/me/documents", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myDocuments);
app.get("/api/hr/me/documents/:id/file", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myDocumentFile);
app.get("/api/admin/hr/absences", requireAuth, requireRoles("ADMIN"), hrController.absenceMonth);
app.post("/api/admin/hr/absences", requireAuth, requireRoles("ADMIN"), hrController.submitAbsenceCertificate);
app.post("/api/admin/hr/absences/accept", requireAuth, requireRoles("ADMIN"), hrController.acceptAbsenceCertificate);
app.get("/api/admin/hr/absences/file", requireAuth, requireRoles("ADMIN"), hrController.absenceCertificateFile);
app.get("/api/hr/me/absences", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myAbsences);
app.post("/api/hr/me/absences", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.submitMyAbsenceCertificate);
app.get("/api/hr/me/absences/file", requireAuth, requireRoles("ADMIN", "SALES", "RDV"), hrController.myAbsenceCertificateFile);

app.get("/api/admin/insights", requireAuth, requireRoles("ADMIN"), adminController.insights);
app.get("/api/admin/dashboard", requireAuth, requireRoles("ADMIN"), adminController.dashboard);
app.get("/api/admin/board", requireAuth, requireRoles("ADMIN"), adminController.board);
app.get("/api/admin/students-overview", requireAuth, requireRoles("ADMIN"), adminController.studentsOverview);
app.patch("/api/admin/students/:id/active", requireAuth, requireRoles("ADMIN"), adminController.setStudentActive);
app.get("/api/admin/settings", requireAuth, requireRoles("ADMIN"), adminController.getSettings);
app.put("/api/admin/settings", requireAuth, requireRoles("ADMIN"), adminController.updateSettings);
app.get("/api/admin/students/:id/deletion-preview", requireAuth, requireRoles("ADMIN"), adminController.studentDeletionPreview);
app.delete("/api/admin/students/:id", requireAuth, requireRoles("ADMIN"), adminController.deleteStudent);
app.get("/api/admin/auto-assign-shares", requireAuth, requireRoles("ADMIN"), adminController.autoAssignShares);
app.put("/api/admin/auto-assign-shares", requireAuth, requireRoles("ADMIN"), adminController.saveAutoAssignShares);
app.get("/api/admin/performance", requireAuth, requireRoles("ADMIN"), adminController.teamPerformance);
app.get("/api/admin/performance/users/:id", requireAuth, requireRoles("ADMIN"), adminController.userPerformance);
app.post("/api/admin/sales", requireAuth, requireRoles("ADMIN"), adminController.createSales);
app.patch("/api/admin/sales/:id/active", requireAuth, requireRoles("ADMIN"), adminController.setSalesActive);
app.post("/api/admin/sales/:id/transfer", requireAuth, requireRoles("ADMIN"), adminController.transferSales);
app.delete("/api/admin/sales/:id", requireAuth, requireRoles("ADMIN"), adminController.deleteSales);
app.get("/api/admin/users/:id/access", requireAuth, requireRoles("ADMIN"), adminController.getUserAccess);
app.patch("/api/admin/users/:id/roles", requireAuth, requireRoles("ADMIN"), adminController.setUserRoles);
app.patch("/api/admin/users/:id/permissions", requireAuth, requireRoles("ADMIN"), adminController.setUserPermissions);
app.post("/api/admin/rdv", requireAuth, requireRoles("ADMIN"), adminController.createRdv);
// Lecture ouverte au Sales aussi : nécessaire pour choisir manuellement un
// RDV lors du transfert d'un dossier accepté.
app.get("/api/admin/rdv", requireAuth, requireRoles("ADMIN", "SALES"), adminController.listRdv);
app.get("/api/admin/rdv-assignments", requireAuth, requireRoles("ADMIN"), adminController.listRdvAssignments);
app.put("/api/admin/rdv-assignments/:id", requireAuth, requireRoles("ADMIN"), adminController.setRdvCountries);
app.get("/api/admin/rdv/:id/students", requireAuth, requireRoles("ADMIN"), adminController.listRdvStudents);
app.get("/api/admin/rdv-unassigned-applications", requireAuth, requireRoles("ADMIN"), adminController.listUnassignedVisaApplications);

// Admin programmes management routes — ADMIN ou permission MANAGE_PROGRAMMES
app.get("/api/admin/programmes", requireAuth, requirePermission("MANAGE_PROGRAMMES"), programmeController.listAdmin);
app.post("/api/admin/programmes", requireAuth, requirePermission("MANAGE_PROGRAMMES"), programmeController.create);
app.put("/api/admin/programmes/:id", requireAuth, requirePermission("MANAGE_PROGRAMMES"), programmeController.update);
app.delete("/api/admin/programmes/:id", requireAuth, requirePermission("MANAGE_PROGRAMMES"), programmeController.remove);
app.post("/api/admin/programmes/upload-image", requireAuth, requirePermission("MANAGE_PROGRAMMES"), programmeController.uploadImage);

// Admin countries management routes — ADMIN ou permission MANAGE_COUNTRIES
// Lecture ouverte à MANAGE_VISA_DOCUMENTS et aux RDV aussi : il faut la liste
// des pays pour savoir pour lesquels configurer des documents visa.
app.get("/api/admin/countries", requireAuth, requireRolesOrPermissions(["RDV"], ["MANAGE_COUNTRIES", "MANAGE_VISA_DOCUMENTS"]), countryController.listAdmin);
app.post("/api/admin/countries", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryController.create);
app.put("/api/admin/countries/:id", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryController.update);
app.patch("/api/admin/countries/:id/active", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryController.setActive);

// Admin universities management routes (nested under country)
app.get("/api/admin/countries/:countryId/universities", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryUniversityController.listByCountry);
app.post("/api/admin/countries/:countryId/universities", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryUniversityController.create);
app.put("/api/admin/universities/:id", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryUniversityController.update);
app.patch("/api/admin/universities/:id/partner", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryUniversityController.setPartner);
app.patch("/api/admin/universities/:id/active", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryUniversityController.setActive);
app.delete("/api/admin/universities/:id", requireAuth, requirePermission("MANAGE_COUNTRIES"), countryUniversityController.remove);

// Admin document requirements management routes (nested under country) —
// ADMIN, ou MANAGE_COUNTRIES (dossier + visa), ou MANAGE_VISA_DOCUMENTS
// (tous pays), ou un RDV (uniquement ses pays — vérification fine côté
// service, requireRolesOrPermissions ne fait que laisser passer la requête).
app.get("/api/admin/countries/:countryId/documents", requireAuth, requireRolesOrPermissions(["RDV"], ["MANAGE_COUNTRIES", "MANAGE_VISA_DOCUMENTS"]), documentRequirementController.listByCountry);
app.post("/api/admin/countries/:countryId/documents", requireAuth, requireRolesOrPermissions(["RDV"], ["MANAGE_COUNTRIES", "MANAGE_VISA_DOCUMENTS"]), documentRequirementController.create);
app.put("/api/admin/documents/:id", requireAuth, requireRolesOrPermissions(["RDV"], ["MANAGE_COUNTRIES", "MANAGE_VISA_DOCUMENTS"]), documentRequirementController.update);
app.patch("/api/admin/documents/:id/active", requireAuth, requireRolesOrPermissions(["RDV"], ["MANAGE_COUNTRIES", "MANAGE_VISA_DOCUMENTS"]), documentRequirementController.setActive);
app.delete("/api/admin/documents/:id", requireAuth, requireRolesOrPermissions(["RDV"], ["MANAGE_COUNTRIES", "MANAGE_VISA_DOCUMENTS"]), documentRequirementController.remove);

// Admin avis management routes — ADMIN ou permission MANAGE_AVIS
app.get("/api/admin/avis", requireAuth, requirePermission("MANAGE_AVIS"), avisController.getAdminAvis);
app.post("/api/admin/avis", requireAuth, requirePermission("MANAGE_AVIS"), avisController.createManualAvis);
app.put("/api/admin/avis/:id", requireAuth, requirePermission("MANAGE_AVIS"), avisController.updateAvis);
app.patch("/api/admin/avis/:id/status", requireAuth, requirePermission("MANAGE_AVIS"), avisController.updateAvisStatus);
app.delete("/api/admin/avis/:id", requireAuth, requirePermission("MANAGE_AVIS"), avisController.deleteAvis);

app.get("/api/notifications", requireAuth, notificationController.list);
app.get("/api/notifications/unread-count", requireAuth, notificationController.unreadCount);
app.post("/api/notifications/read-all", requireAuth, notificationController.markAllRead);
app.patch("/api/notifications/:id/read", requireAuth, notificationController.markRead);

app.use((_req, res) => {
  res.status(404).json({ error: "Route introuvable." });
});

app.use((error, req, res, _next) => {
  // Erreurs de lecture de la requête (trop volumineuse, JSON invalide) : une réponse claire, jamais une erreur 500.
  if (error.type === "entity.too.large") {
    logger.warn("Requête trop volumineuse refusée", { method: req.method, path: req.originalUrl, length: error.length, limit: error.limit });
    return res.status(413).json({ error: "Le fichier est trop volumineux. Taille maximale : 5 Mo pour un document." });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Requête invalide." });
  }
  logger.error("Erreur non gérée sur une requête", {
    message: error.message,
    stack: error.stack,
    method: req.method,
    path: req.originalUrl
  });
  res.status(500).json({ error: "Erreur serveur." });
});

// Lancement du cron de purge des archives toutes les 24h
setInterval(() => {
  archiveService.autoPurgeJob();
}, 24 * 60 * 60 * 1000);

// Au démarrage, on peut le lancer 1 minute après pour ne pas ralentir le démarrage
setTimeout(() => {
  archiveService.autoPurgeJob();
}, 60 * 1000);

// Alerte "dossier bloqué" (étudiants sans candidature depuis trop longtemps) :
// vérifiée une fois par jour, seuil/fréquence/email réglables dans Paramètres.
setInterval(() => {
  stalledAlertService.runCheck().catch((error) => logger.error("Échec de la vérification des dossiers bloqués", { message: error.message }));
}, 24 * 60 * 60 * 1000);

setTimeout(() => {
  stalledAlertService.runCheck().catch((error) => logger.error("Échec de la vérification des dossiers bloqués", { message: error.message }));
}, 90 * 1000);

// Rappel des dossiers reportés dont la nouvelle tentative approche (une fois par jour).
const universityApplicationService = require("./services/universityApplicationService");
function retryReminders() {
  universityApplicationService.sendRetryReminders().catch((error) => logger.error("Échec des rappels de nouvelle tentative", { message: error.message }));
}
setInterval(retryReminders, 24 * 60 * 60 * 1000);

function visaDocumentReminders() {
  universityApplicationService.sendVisaDocumentReminders().catch((error) => logger.error("Échec des rappels de documents visa", { message: error.message }));
}
setInterval(visaDocumentReminders, 24 * 60 * 60 * 1000);
setTimeout(visaDocumentReminders, 2 * 60 * 1000);
setTimeout(retryReminders, 120 * 1000);

// Sauvegarde automatique vers Supabase (production uniquement) : vérifiée
// toutes les 30 min, lancée dès que la dernière date de plus de 12 h
// (1 h après un échec). Admins prévenus par notification + email si échec.
function scheduledBackup() {
  backupService.runScheduledBackup().catch((error) => logger.error("Échec de la sauvegarde planifiée", { message: error.message }));
}
setInterval(scheduledBackup, 30 * 60 * 1000);
setTimeout(scheduledBackup, 2 * 60 * 1000);

function holidayAutoReplies() {
  require("./services/whatsappService").sendHolidayMorningReplies().catch((error) => logger.error("Échec de la réponse automatique des jours fériés", { message: error.message }));
}
setInterval(holidayAutoReplies, 15 * 60 * 1000);
setTimeout(holidayAutoReplies, 2 * 60 * 1000);

function certificateReminders() {
  require("./services/hrAbsenceService").remind().catch((error) => logger.error("Échec du rappel de certificat", { message: error.message }));
}
setInterval(certificateReminders, 60 * 60 * 1000);
setTimeout(certificateReminders, 150 * 1000);

function payslipDueReminders() {
  require("./services/hrPayrollService").remindDuePayslips().catch((error) => logger.error("Échec du rappel de fiche de paie", { message: error.message }));
}
setInterval(payslipDueReminders, 60 * 60 * 1000);
setTimeout(payslipDueReminders, 170 * 1000);

function contractReminders() {
  const hr = require("./services/hrService");
  hr.promoteCivp().catch((error) => logger.error("Échec du passage CIVP vers CDI", { message: error.message }));
  hr.remindEndingContracts().catch((error) => logger.error("Échec du rappel de fin de CDD", { message: error.message }));
}
setInterval(contractReminders, 60 * 60 * 1000);
setTimeout(contractReminders, 160 * 1000);

// Fin d'un congé avec remplaçants : résumé envoyé à l'absent et fin du remplacement (une fois par congé).
function leaveCoverSummaries() {
  require("./services/hrLeaveCoverService").sendReturnSummaries().catch((error) => logger.error("Échec du résumé de fin de remplacement", { message: error.message }));
}
setInterval(leaveCoverSummaries, 60 * 60 * 1000);
setTimeout(leaveCoverSummaries, 180 * 1000);

module.exports = app;
