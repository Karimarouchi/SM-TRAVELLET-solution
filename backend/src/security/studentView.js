const appRepo = require("../repositories/universityApplicationRepository");
const { canAccessStudent, authRoles } = require("./rbac");

// Lecture du dossier d'un étudiant : le conseiller assigné et l'admin (accès complet),
// ou un Responsable Dossier auquel une candidature de cet étudiant est affectée (lecture seule).
async function canViewStudent(auth, studentId, assignedSalesId) {
  if (canAccessStudent(auth, studentId, assignedSalesId)) return true;
  return authRoles(auth).includes("RDV") && (await appRepo.rdvHasStudent(auth.sub, studentId));
}

module.exports = { canViewStudent };
