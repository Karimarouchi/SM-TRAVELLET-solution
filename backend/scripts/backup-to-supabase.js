// Sauvegarde à SENS UNIQUE : prod PostgreSQL → Supabase (voir
// backend/scripts/README.md). Wrapper CLI autour de backupService — le même
// code est utilisé par le bouton "Lancer maintenant" de l'admin.
//
// Nécessite pg_dump / pg_restore installés sur la machine qui exécute ce
// script (déjà présents dans l'image Docker backend).
//
// Usage : node backend/scripts/backup-to-supabase.js
// Prévu pour être lancé par une tâche planifiée toutes les 12h.

const backupService = require("../src/services/backupService");

backupService.runBackup("cron")
  .then((status) => {
    console.log("Sauvegarde terminée avec succès.", status);
  })
  .catch((error) => {
    console.error("Échec de la sauvegarde :", error.message);
    process.exitCode = 1;
  });
