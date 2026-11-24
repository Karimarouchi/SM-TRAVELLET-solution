const appRepo = require("../repositories/universityApplicationRepository");
const interviewRepo = require("../repositories/studentInterviewRepository");
const { canAccessStudent, authRoles } = require("./rbac");

// Lecture du dossier d'un étudiant : le conseiller assigné et l'admin (accès complet),
// ou un Responsable Dossier auquel une candidature ou un entretien d'orientation de cet étudiant est affecté (lecture seule).
async function canViewStudent(auth, studentId, assignedSalesId) {
  if (canAccessStudent(auth, studentId, assignedSalesId)) return true;
  if (!authRoles(auth).includes("RDV")) return false;
  return (await appRepo.rdvHasStudent(auth.sub, studentId)) || (await interviewRepo.rdvHasStudent(auth.sub, studentId));
}

module.exports = { canViewStudent };
