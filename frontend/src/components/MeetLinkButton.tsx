import { getSession } from "@/lib/auth";
import { createMeetLink, fetchGoogleStatus, type GoogleStatus, type MeetKind } from "@/lib/google";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const DURATIONS = [30, 45, 60, 90];

// Bouton « Créer le lien Meet automatiquement » à placer sous le champ du lien
// dans les formulaires de rendez-vous. Le lien reste modifiable à la main :
// si Google n'est pas connecté, le formulaire fonctionne exactement comme avant.
export function MeetLinkButton({
  applicationId,
  kind,
  date,
  onCreated
}: {
  applicationId: string;
  kind: MeetKind;
  /** Valeur d'un champ datetime-local ("2026-10-12T09:30") ou vide. */
  date: string;
  onCreated: (link: string) => void;
}) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [duration, setDuration] = useState(60);
  const isAdmin = getSession()?.user.role === "ADMIN";

  useEffect(() => {
    fetchGoogleStatus().then(setStatus).catch(() => setStatus({ configured: false, connected: false }));
  }, []);

  // Changer l'heure après coup : le lien déjà créé correspond à l'ancienne heure.
  useEffect(() => {
    setCreated(false);
  }, [date, duration]);

  if (!status) return null;

  if (!status.configured || !status.connected) {
    return (
      <p className="mt-1.5 text-[11px] text-muted">
        Création automatique indisponible : Google Calendar n'est pas connecté.{" "}
        {isAdmin ? (
          <Link to="/admin/settings" className="font-semibold text-brand underline">Le connecter dans Paramètres</Link>
        ) : (
          "Collez un lien Meet à la main, ou demandez à l'administrateur de le connecter."
        )}
      </p>
    );
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await createMeetLink(applicationId, { kind, date: new Date(date).toISOString(), durationMinutes: duration });
      onCreated(result.link);
      setCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le lien.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={create}
          disabled={busy || !date}
          title={date ? "Crée un événement Google Calendar avec un lien Meet" : "Choisissez d'abord la date et l'heure"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
            created ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-brand/30 bg-brand/5 text-brand hover:bg-brand hover:text-white"
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : created ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
          {busy ? "Création..." : created ? "Lien créé" : "Créer le lien Meet automatiquement"}
        </button>
        <label className="inline-flex items-center gap-1 text-[11px] text-muted">
          Durée
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-md border border-line bg-white px-1.5 py-1 text-[11px] font-semibold text-dark"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </label>
      </div>
      {!date && <p className="mt-1 text-[11px] text-muted">Choisissez d'abord la date et l'heure.</p>}
      {created && <p className="mt-1 text-[11px] text-emerald-700">Invitation Google Calendar envoyée à l'étudiant et à vous. Pensez à enregistrer le rendez-vous.</p>}
      {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
