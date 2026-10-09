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
const countryUniversityController = require("./controllers/countryUniversityController");
const universityApplicationController = require("./controllers/universityApplicationController");
const universityChoiceController = require("./controllers/universityChoiceController");
const paymentController = require("./controllers/paymentController");
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
app.get("/api/whatsapp/diagnostic", requireAuth, requireRoles("ADMIN"), whatsappController.diagnostic);
app.get("/api/whatsapp/unread-count", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.unreadCount);
app.get("/api/whatsapp/conversations/:contactId/messages", requireAuth, requireRoles("SALES", "ADMIN"), whatsappController.getMessages);
app.post("/api/whatsapp/conversations/:contactId/messages", requireAuth, requireRoles("SALES"), whatsappController.sendMessage);
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
app.post("/api/auth/logout", authController.logout);
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
app.get("/api/students/:id", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), studentController.detail);
app.patch("/api/students/:id/assign", requireAuth, requireRoles("ADMIN"), studentController.assign);
app.post("/api/students/avis", requireAuth, requireRoles("STUDENT"), avisController.createStudentAvis);
app.get("/api/documents/files/:filename", requireAuth, studentDocumentController.file);
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
app.patch("/api/students/:id/documents/review", requireAuth, requireRoles("SALES", "ADMIN"), studentDocumentController.review);
app.get("/api/students/me/visa-documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.myVisaChecklist);
app.post("/api/students/me/visa-documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.uploadVisa);
app.get("/api/applications/:id/visa-documents", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), studentDocumentController.visaChecklistForApplication);
app.patch("/api/applications/:id/visa-documents/review", requireAuth, requireRoles("SALES", "RDV", "ADMIN"), studentDocumentController.reviewVisa);

app.get("/api/students/me/applications", requireAuth, requireRoles("STUDENT"), universityApplicationController.listMine);
app.get("/api/students/:id/applications", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), universityApplicationController.listForStudent);
app.get("/api/students/:id/applications/history", requireAuth, requireRoles("SALES", "ADMIN", "RDV"), universityApplicationController.historyForStudent);
app.patch("/api/applications/:id/apply", requireAuth, requireRoles("RDV", "ADMIN"), universityApplicationController.markApplied);
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
setTimeout(retryReminders, 120 * 1000);

// Sauvegarde automatique vers Supabase (production uniquement) : vérifiée
// toutes les 30 min, lancée dès que la dernière date de plus de 12 h
// (1 h après un échec). Admins prévenus par notification + email si échec.
function scheduledBackup() {
  backupService.runScheduledBackup().catch((error) => logger.error("Échec de la sauvegarde planifiée", { message: error.message }));
}
setInterval(scheduledBackup, 30 * 60 * 1000);
setTimeout(scheduledBackup, 2 * 60 * 1000);

module.exports = app;
