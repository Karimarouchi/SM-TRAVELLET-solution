const fs = require("fs");
const path = require("path");
const { query } = require("../../db");
const logger = require("../logger");
const settingsRepo = require("../repositories/settingsRepository");

const DOC_DIR = path.join(__dirname, "../../uploads/documents");

/**
 * Exécute la purge des documents des étudiants archivés depuis au moins `days` jours.
 * Si `days` est nul, purge tous les dossiers archivés (utile pour la purge manuelle globale).
 */
async function runPurge(days = 0) {
  logger.info(`[ARCHIVE PURGE] Démarrage de la purge des documents (délai: ${days} jours)...`);

  try {
    // 1. Trouver les étudiants éligibles à la purge.
    // Un dossier est "archivé" si : 
    // - sp.dossier_stage = 'COMPLETED' (complété jusqu'au bout, visa inclus)
    // - OU ua.status IN ('CLOSED', 'REJECTED')
    // Et la date de décision (ou updated_at) est > days.
    
    // Pour simplifier et être exhaustif, on recherche les candidatures qui remplissent ces conditions,
    // puis on récupère les student_ids associés.
    const eligibleStudentsQuery = `
      SELECT DISTINCT ua.student_id
      FROM university_applications ua
      LEFT JOIN student_profiles sp ON sp.user_id = ua.student_id
      WHERE (sp.dossier_stage = 'COMPLETED' OR ua.status IN ('CLOSED', 'REJECTED'))
        AND COALESCE(ua.decision_at, ua.updated_at) <= NOW() - INTERVAL '${days} days'
    `;
    
    const { rows: eligibleStudents } = await query(eligibleStudentsQuery);
    if (eligibleStudents.length === 0) {
      logger.info("[ARCHIVE PURGE] Aucun étudiant éligible trouvé.");
      return { purgedStudents: 0, purgedFiles: 0 };
    }

    const studentIds = eligibleStudents.map(r => r.student_id);

    // 2. Trouver tous les documents de ces étudiants.
    // Les documents visas sont aussi stockés dans student_documents (via category = 'VISA' dans document_requirements)
    const { rows: documentsToPurge } = await query(
      `SELECT id, stored_filename 
       FROM student_documents 
       WHERE student_id = ANY($1::uuid[]) AND stored_filename IS NOT NULL`,
      [studentIds]
    );

    let deletedFilesCount = 0;

    // 3. Supprimer les fichiers physiques du disque.
    for (const doc of documentsToPurge) {
      if (doc.stored_filename) {
        const filePath = path.join(DOC_DIR, path.basename(doc.stored_filename));
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          }
        } catch (err) {
          logger.error(`[ARCHIVE PURGE] Échec de la suppression du fichier ${filePath}:`, err);
        }
      }
    }

    // 4. Supprimer les entrées en base de données.
    if (documentsToPurge.length > 0) {
      const docIds = documentsToPurge.map(d => d.id);
      await query(`DELETE FROM student_documents WHERE id = ANY($1::uuid[])`, [docIds]);
    }

    // 5. Réinitialiser file_url pour les rows où on aurait pu ne pas avoir de stored_filename mais un file_url 
    // (Même si en principe on supprime toute la ligne pour libérer la DB)
    // Comme on a supprimé les lignes ci-dessus, il n'y a rien de plus à faire.
    // L'étudiant devra re-déposer des documents s'il est désarchivé un jour, ce qui est logique.

    logger.info(`[ARCHIVE PURGE] Terminé. ${studentIds.length} étudiant(s) traité(s), ${deletedFilesCount} fichier(s) supprimé(s).`);
    return { purgedStudents: studentIds.length, purgedFiles: deletedFilesCount };
  } catch (error) {
    logger.error("[ARCHIVE PURGE] Erreur critique lors de la purge:", error);
    throw error;
  }
}

/**
 * Vérifie si la purge auto est activée, et si oui, la lance.
 * Destinée à être appelée par un cron (ex: toutes les nuits).
 */
async function autoPurgeJob() {
  try {
    const config = await settingsRepo.getArchivePurgeConfig();
    if (!config.enabled) {
      return;
    }
    await runPurge(config.days);
  } catch (error) {
    logger.error("[ARCHIVE PURGE JOB] Échec du job:", error);
  }
}

module.exports = {
  runPurge,
  autoPurgeJob
};
