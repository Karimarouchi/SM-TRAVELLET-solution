import { disconnectGoogle, fetchGoogleConnectUrl, fetchGoogleStatus, type GoogleStatus } from "@/lib/google";
import { AlertTriangle, CalendarClock, CheckCircle2, Copy, Link2Off, Loader2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Paramètres → connexion du compte Google qui héberge les liens Meet.
export default function GoogleCalendarCard() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [params, setParams] = useSearchParams();

  const load = () => fetchGoogleStatus().then(setStatus).catch(() => setStatus({ configured: false, connected: false }));

  useEffect(() => {
    load();
  }, []);

  // Retour de Google (…/settings?google=connected|error) : on affiche le
  // résultat puis on nettoie l'adresse.
  useEffect(() => {
    const result = params.get("google");
    if (!result) return;
    setNotice(
      result === "connected"
        ? { kind: "ok", text: "Google Calendar est connecté. Les liens Meet peuvent maintenant être créés automatiquement." }
        : { kind: "error", text: params.get("reason") || "La connexion à Google a échoué." }
    );
    const next = new URLSearchParams(params);
    next.delete("google");
    next.delete("reason");
    setParams(next, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy(true);
    setNotice(null);
    try {
      window.location.href = await fetchGoogleConnectUrl();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Impossible de lancer la connexion." });
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectGoogle();
      setConfirmingDisconnect(false);
      setNotice({ kind: "ok", text: "Google Calendar est déconnecté." });
      await load();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Déconnexion impossible." });
    } finally {
      setBusy(false);
    }
  }

  function copyRedirect() {
    if (!status?.redirectUri) return;
    navigator.clipboard?.writeText(status.redirectUri).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <section className="mt-4 rounded-[24px] border border-line bg-white p-6">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-dark">
        <CalendarClock className="h-5 w-5 text-brand" /> Google Calendar · liens Meet
      </h2>
      <p className="mt-1 text-xs text-muted">
        Connectez un compte Google : un bouton « Créer le lien Meet automatiquement » apparaît alors dans les formulaires d'entretien
        et de réunion. Chaque lien est un événement de l'agenda de ce compte, avec invitation envoyée à l'étudiant.
      </p>

      {notice && (
        <p
          role="status"
          className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
        >
          {notice.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </p>
      )}

      {!status ? (
        <p className="mt-4 text-sm text-muted">Chargement...</p>
      ) : !status.configured ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Google n'est pas configuré sur ce serveur : ajoutez <strong>GOOGLE_CLIENT_ID</strong> et <strong>GOOGLE_CLIENT_SECRET</strong> dans le
          fichier .env du serveur, puis redémarrez. Sans cela, les liens Meet se collent à la main comme avant.
        </p>
      ) : status.connected ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Connecté
          </p>
          <p className="mt-1 text-sm text-dark">
            Compte : <strong>{status.email || "compte Google"}</strong>
          </p>
          {status.connectedAt && <p className="text-[11px] text-muted">Depuis le {new Date(status.connectedAt).toLocaleString("fr-FR")}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!confirmingDisconnect ? (
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-mid transition hover:border-red-300 hover:text-red-600"
              >
                <Link2Off className="h-3.5 w-3.5" /> Déconnecter
              </button>
            ) : (
              <>
                <span className="text-xs text-mid">Les liens déjà créés continueront de fonctionner. Déconnecter ?</span>
                <button type="button" disabled={busy} onClick={disconnect} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {busy ? "..." : "Oui, déconnecter"}
                </button>
                <button type="button" onClick={() => setConfirmingDisconnect(false)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted">
                  Annuler
                </button>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={connect}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-white px-3 py-2 text-xs font-bold text-brand transition hover:bg-brand hover:text-white disabled:opacity-60"
            >
              Changer de compte
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={connect}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Connecter Google
          </button>
          <p className="mt-2 text-[11px] text-muted">
            Vous serez envoyé sur Google pour autoriser l'accès, puis ramené ici. Seul le droit de créer des événements est demandé.
          </p>
        </div>
      )}

      {status?.configured && status.redirectUri && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Adresse de retour à déclarer dans Google Cloud</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs text-dark">{status.redirectUri}</code>
            <button type="button" onClick={copyRedirect} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-semibold text-mid">
              <Copy className="h-3 w-3" /> {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Dans Google Cloud → Clients → votre client OAuth → « URI de redirection autorisés » : cette adresse doit y figurer exactement. Passez aussi
            l'application en <strong>« En production »</strong> (écran de consentement) : en mode « Test », l'accès expire au bout de 7 jours.
          </p>
        </div>
      )}
    </section>
  );
}
