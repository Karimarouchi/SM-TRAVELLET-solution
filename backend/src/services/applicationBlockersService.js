const studentDocumentService = require("./studentDocumentService");
const choiceRepo = require("../repositories/universityChoiceRepository");
const logger = require("../logger");

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

// Pourquoi un étudiant dont l'onboarding est terminé n'a pas encore de candidature ? Une candidature naît
// quand un vœu d'université existe ET que tous les documents obligatoires (du pays et de l'université) sont validés.
async function reasonsFor(studentId) {
  const [checklist, choices] = await Promise.all([
    studentDocumentService.getChecklist(studentId),
    choiceRepo.listActiveForStudent(studentId)
  ]);
  const required = checklist.filter((d) => d.required);
  const label = (d) => (d.universityName ? `${d.name} (${d.universityName})` : d.name);
  const missing = required.filter((d) => d.status === "PENDING");
  const toReview = required.filter((d) => d.status === "SUBMITTED");
  const rejected = required.filter((d) => d.status === "REJECTED");
  const validated = required.filter((d) => d.status === "VALIDATED").length;

  const reasons = [];
  if (!choices.length) {
    reasons.push({ key: "no-choice", tone: "warning", text: "Aucune université choisie : il faut au moins un vœu (université et filière) pour créer la candidature." });
  }
  if (!required.length) {
    reasons.push({ key: "no-requirements", tone: "info", text: "Aucun document obligatoire n'est configuré pour ses pays : la candidature ne se crée pas automatiquement." });
  }
  if (missing.length) {
    reasons.push({ key: "docs-missing", tone: "danger", text: `${missing.length} ${missing.length > 1 ? "documents manquants" : "document manquant"} : l'étudiant ne ${missing.length > 1 ? "les a" : "l'a"} pas encore déposé${missing.length > 1 ? "s" : ""}.`, items: missing.map(label) });
  }
  if (toReview.length) {
    reasons.push({ key: "docs-review", tone: "warning", text: `${plural(toReview.length, "document")} à valider par le conseiller.`, items: toReview.map(label) });
  }
  if (rejected.length) {
    reasons.push({
      key: "docs-rejected",
      tone: "danger",
      text: `${rejected.length} ${rejected.length > 1 ? "documents refusés" : "document refusé"} : en attente d'un nouveau fichier.`,
      items: rejected.map((d) => (d.rejectionReason ? `${label(d)} — ${d.rejectionReason}` : label(d)))
    });
  }
  if (!reasons.length) {
    reasons.push({ key: "all-ok", tone: "info", text: "Tous les documents obligatoires sont validés et un vœu existe : la candidature devrait se créer. Vérifiez le vœu de l'étudiant." });
  }
  return { reasons, documents: { required: required.length, validated } };
}

// Plusieurs étudiants : une erreur sur l'un ne bloque jamais la liste.
async function reasonsForMany(studentIds) {
  const map = new Map();
  await Promise.all(
    studentIds.map(async (id) => {
      try {
        map.set(id, await reasonsFor(id));
      } catch (error) {
        logger.error("Raisons « sans candidature » indisponibles", { studentId: id, message: error.message });
      }
    })
  );
  return map;
}

module.exports = { reasonsFor, reasonsForMany };
