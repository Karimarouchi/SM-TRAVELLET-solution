const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const logger = require("./logger");
const { requireAuth, requireRoles, requirePermission, requireAnyPermission, requireRolesOrPermissions } = require("./security/rbac");
const authController = require("./controllers/authController");
const studentController = require("./controllers/studentController");
const salesController = require("./controllers/salesController");
const adminController = require("./controllers/adminController");
const messageController = require("./controllers/messageController");
const whatsappWebhookController = require("./controllers/whatsappWebhookController");
const programmeController = require("./controllers/programmeController");
const avisController = require("./controllers/avisController");
const countryController = require("./controllers/countryController");
const documentRequirementController = require("./controllers/documentRequirementController");
const studentDocumentController = require("./controllers/studentDocumentController");
const salesCodeController = require("./controllers/salesCodeController");
const countryUniversityController = require("./controllers/countryUniversityController");
const universityApplicationController = require("./controllers/universityApplicationController");
const backupController = require("./controllers/backupController");
const commissionController = require("./controllers/commissionController");
const archiveController = require("./controllers/archiveController");
const archiveService = require("./services/archiveService");
const stalledAlertService = require("./services/stalledAlertService");
const { query } = require("../db");

const app = express();
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "5mb" }));
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

app.get("/api/whatsapp/webhook", whatsappWebhookController.verifyWebhook);
app.post("/api/whatsapp/webhook", whatsappWebhookController.receiveWebhook);

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
app.get("/api/students/:id", requireAuth, requireRoles("SALES", "ADMIN"), studentController.detail);
app.patch("/api/students/:id/assign", requireAuth, requireRoles("ADMIN"), studentController.assign);
app.post("/api/students/avis", requireAuth, requireRoles("STUDENT"), avisController.createStudentAvis);
app.get("/api/students/me/documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.list);
app.post("/api/students/me/documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.upload);
app.get("/api/students/:id/documents", requireAuth, requireRoles("SALES", "ADMIN"), studentDocumentController.listForStudent);
app.patch("/api/students/:id/documents/review", requireAuth, requireRoles("SALES", "ADMIN"), studentDocumentController.review);
app.get("/api/students/me/visa-documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.myVisaChecklist);
app.post("/api/students/me/visa-documents", requireAuth, requireRoles("STUDENT"), studentDocumentController.uploadVisa);
app.get("/api/applications/:id/visa-documents", requireAuth, requireRoles("RDV", "ADMIN"), studentDocumentController.visaChecklistForApplication);
app.patch("/api/applications/:id/visa-documents/review", requireAuth, requireRoles("RDV", "ADMIN"), studentDocumentController.reviewVisa);

app.get("/api/students/me/applications", requireAuth, requireRoles("STUDENT"), universityApplicationController.listMine);
app.get("/api/students/:id/applications", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.listForStudent);
app.get("/api/students/:id/applications/history", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.historyForStudent);
app.patch("/api/applications/:id/apply", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.markApplied);
app.patch("/api/applications/:id/interview", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.scheduleInterview);
app.patch("/api/applications/:id/interview-completed", requireAuth, requireRoles("SALES", "ADMIN", "STUDENT"), universityApplicationController.completeInterview);
app.patch("/api/applications/:id/accept", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.markAccepted);
app.patch("/api/applications/:id/reject", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.markRejected);
app.patch("/api/applications/:id/close", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.closeApplication);
app.post("/api/applications/:id/reapply", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.reapply);
app.get("/api/applications/:id/rdv-suggestion", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.suggestRdv);
app.patch("/api/applications/:id/assign-rdv", requireAuth, requireRoles("SALES", "ADMIN"), universityApplicationController.assignRdv);
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
app.get("/api/sales/me/codes", requireAuth, requireRoles("SALES"), salesCodeController.list);
app.post("/api/sales/me/codes", requireAuth, requireRoles("SALES"), salesCodeController.create);

app.get("/api/admin/backup/status", requireAuth, requireRoles("ADMIN"), backupController.status);
app.post("/api/admin/backup/run", requireAuth, requireRoles("ADMIN"), backupController.run);
app.get("/api/admin/backup/restore-status", requireAuth, requireRoles("ADMIN"), backupController.restoreStatus);
app.post("/api/admin/backup/restore", requireAuth, requireRoles("ADMIN"), backupController.restore);

// Commissions Sales/RDV — configuration des taux et registre des gains
app.get("/api/admin/commission-rules", requireAuth, requireRoles("ADMIN"), commissionController.listRules);
app.post("/api/admin/commission-rules", requireAuth, requireRoles("ADMIN"), commissionController.upsertRule);
app.patch("/api/admin/commission-rules/:id/active", requireAuth, requireRoles("ADMIN"), commissionController.setRuleActive);
app.delete("/api/admin/commission-rules/:id", requireAuth, requireRoles("ADMIN"), commissionController.removeRule);
app.get("/api/admin/commission-earnings", requireAuth, requireRoles("ADMIN"), commissionController.listAllEarnings);
app.get("/api/me/commissions", requireAuth, requireRoles("SALES", "RDV"), commissionController.myEarnings);
app.get("/api/admin/dashboard", requireAuth, requireRoles("ADMIN"), adminController.dashboard);
app.get("/api/admin/board", requireAuth, requireRoles("ADMIN"), adminController.board);
app.get("/api/admin/students-overview", requireAuth, requireRoles("ADMIN"), adminController.studentsOverview);
app.patch("/api/admin/students/:id/active", requireAuth, requireRoles("ADMIN"), adminController.setStudentActive);
app.get("/api/admin/settings", requireAuth, requireRoles("ADMIN"), adminController.getSettings);
app.put("/api/admin/settings", requireAuth, requireRoles("ADMIN"), adminController.updateSettings);
app.patch("/api/admin/auto-assign", requireAuth, requireRoles("ADMIN"), adminController.autoAssign);
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

app.get("/api/messages/conversations", requireAuth, messageController.list);
app.get("/api/messages/unread-count", requireAuth, messageController.unread);
app.get("/api/messages/conversations/:id", requireAuth, messageController.getOne);
app.post("/api/messages/conversations/:id/messages", requireAuth, messageController.send);
app.post("/api/messages/with-student/:studentId", requireAuth, messageController.openWithStudent);

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

module.exports = app;
