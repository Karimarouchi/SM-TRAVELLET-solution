// Étapes du pipeline d'un étudiant, partagées par l'admin et l'espace conseiller.

const PIPELINE_STAGES = [
  { key: "onboarding", label: "Onboarding en cours" },
  { key: "ready_to_apply", label: "Prêt à postuler" },
  { key: "applied", label: "Candidature déposée" },
  { key: "waiting_response", label: "En attente de l'université" },
  { key: "interview", label: "Entretien" },
  { key: "accepted", label: "Accepté par l'université" },
  { key: "visa_preparation", label: "Visa en préparation" },
  { key: "visa_submitted", label: "Visa déposé" },
  { key: "completed", label: "Visa obtenu · Dossier terminé" },
  { key: "rejected", label: "Candidature refusée" },
  { key: "visa_rejected", label: "Visa refusé" },
  { key: "no_application", label: "Onboarding terminé, sans candidature" }
];

function computeStage(student, latestApp) {
  if (!student.onboardingCompleted) return "onboarding";
  if (!latestApp) return "no_application";
  if (latestApp.status === "REJECTED") return "rejected";
  if (latestApp.status === "ACCEPTED") {
    if (latestApp.visa_status === "ACCEPTED") return "completed";
    if (latestApp.visa_status === "REJECTED") return "visa_rejected";
    if (latestApp.visa_status === "SUBMITTED") return "visa_submitted";
    if (latestApp.visa_status === "PREPARATION") return "visa_preparation";
    return "accepted";
  }
  if (["INTERVIEW_REQUIRED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(latestApp.status)) return "interview";
  if (latestApp.status === "WAITING_UNIVERSITY_RESPONSE") return "waiting_response";
  if (latestApp.status === "APPLIED") return "applied";
  return "ready_to_apply";
}

module.exports = { PIPELINE_STAGES, computeStage };
