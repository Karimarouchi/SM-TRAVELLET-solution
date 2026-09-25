import { fetchBackupStatus, runBackupNow, type BackupStatus } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CheckCircle2, CloudUpload, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function BackupPanel() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = () => { fetchBackupStatus().then(setStatus).catch(() => undefined); };
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

  const ageLabel = status?.at
    ? new Date(status.at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="rounded-[24px] border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <CloudUpload className="h-5 w-5 text-brand" /> Sauvegarde de secours (Supabase)
          </h2>
          <p className="mt-1 text-xs text-muted">
            Copie à sens unique de la base de production, en plus de la copie automatique toutes les 12h.
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
    </section>
  );
}
