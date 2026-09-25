import { fetchBackupStatus, fetchRestoreStatus, runBackupNow, runRestoreNow, type BackupStatus } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, CloudDownload, CloudUpload, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

function formatAt(at: string | null | undefined) {
  return at
    ? new Date(at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
}

export default function BackupPanel() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<BackupStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [restoreError, setRestoreError] = useState("");

  const load = () => {
    fetchBackupStatus().then(setStatus).catch(() => undefined);
    fetchRestoreStatus().then(setRestoreStatus).catch(() => undefined);
  };
  useEffect(() => { load(); }, []);

  const handleRun = async () => {
    setRunning(true);
    setError("");
    try {
      const result = await runBackupNow();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la sauvegarde.");
      load();
    } finally {
      setRunning(false);
    }
  };

  const handleRestore = async () => {
    const confirmed = window.confirm(
      "Cette action va ÉCRASER les données actuelles du site avec la dernière copie de secours. Cette action est irréversible. Continuer ?"
    );
    if (!confirmed) return;
    setRestoring(true);
    setRestoreError("");
    try {
      const result = await runRestoreNow();
      setRestoreStatus(result);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Échec de la restauration.");
      load();
    } finally {
      setRestoring(false);
    }
  };

  const ageLabel = formatAt(status?.at);
  const restoreAgeLabel = formatAt(restoreStatus?.at);

  return (
    <section className="rounded-[24px] border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <CloudUpload className="h-5 w-5 text-brand" /> Sauvegarde de secours
          </h2>
          <p className="mt-1 text-xs text-muted">
            Copie à sens unique des données du site vers un serveur de secours, en plus de la copie automatique toutes les 12h.
          </p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={handleRun}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
          {running ? "Sauvegarde en cours..." : "Lancer maintenant"}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-slate-50 px-4 py-3">
        {status?.at ? (
          <div className="flex items-start gap-2">
            {status.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            )}
            <div>
              <p className="text-sm font-semibold text-dark">
                {status.success ? "Dernière sauvegarde réussie" : "La dernière sauvegarde a échoué"} — {ageLabel}
              </p>
              {!status.success && status.error && (
                <p className="mt-1 text-xs text-red-600">{status.error}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Aucune sauvegarde n'a encore été effectuée sur ce serveur.</p>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {/* ── Restauration ─────────────────────────────────────────────── */}
      <div className="mt-6 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <CloudDownload className="h-5 w-5 text-brand" /> Restaurer depuis la sauvegarde
            </h3>
            <p className="mt-1 text-xs text-muted">
              Récupère la dernière copie de secours et remplace les données actuelles du site. À utiliser uniquement en cas de perte de données.
            </p>
          </div>
          <button
            type="button"
            disabled={restoring}
            onClick={handleRestore}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-red-500 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            <CloudDownload className={cn("h-4 w-4", restoring && "animate-pulse")} />
            {restoring ? "Restauration en cours..." : "Restaurer maintenant"}
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-amber-800">
            Cette action écrase toutes les données actuelles du site (étudiants, dossiers, candidatures...) avec celles de la dernière sauvegarde. Irréversible.
          </p>
        </div>

        <div className="mt-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
          {restoreStatus?.at ? (
            <div className="flex items-start gap-2">
              {restoreStatus.success ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <div>
                <p className="text-sm font-semibold text-dark">
                  {restoreStatus.success ? "Dernière restauration réussie" : "La dernière restauration a échoué"} — {restoreAgeLabel}
                </p>
                {!restoreStatus.success && restoreStatus.error && (
                  <p className="mt-1 text-xs text-red-600">{restoreStatus.error}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Aucune restauration n'a encore été effectuée sur ce serveur.</p>
          )}
        </div>

        {restoreError && <p className="mt-2 text-xs text-red-500">{restoreError}</p>}
      </div>
    </section>
  );
}
