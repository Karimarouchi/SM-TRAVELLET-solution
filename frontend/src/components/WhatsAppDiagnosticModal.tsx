import { fetchWhatsAppDiagnostic, type WhatsAppDiagnostic } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const frTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function Row({ label, children, ok }: { label: string; children: ReactNode; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-2 text-xs last:border-0">
      <span className="text-muted">{label}</span>
      <span className={cn("max-w-[65%] text-right font-semibold", ok === false ? "text-red-600" : ok ? "text-emerald-700" : "text-dark")}>{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// Diagnostic WhatsApp (admin) : pourquoi les réponses n'arrivent pas chez le client ?
export default function WhatsAppDiagnosticModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<WhatsAppDiagnostic | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");
    fetchWhatsAppDiagnostic()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Diagnostic indisponible."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl" role="dialog" aria-label="Diagnostic WhatsApp">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-dark">Diagnostic WhatsApp</h2>
            <p className="text-xs text-muted">Pourquoi une réponse n'arrive pas chez le client ?</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={load} disabled={loading} aria-label="Actualiser" className="rounded-full p-2 text-muted transition hover:bg-slate-100 disabled:opacity-50"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
            <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 text-muted transition hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          {!data && !error && <p className="py-8 text-center text-sm text-muted">Vérification auprès de Meta…</p>}
          {data && (
            <>
              {data.warnings.length === 0 ? (
                <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Aucun problème détecté dans la configuration.</p>
              ) : (
                <div className="space-y-2">
                  {data.warnings.map((warning) => (
                    <p key={warning} className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {warning}</p>
                  ))}
                </div>
              )}

              <Section title="Numéro d'envoi (configuré sur le serveur)">
                <Row label="Jeton WHATSAPP_TOKEN" ok={data.config.tokenSet}>{data.config.tokenSet ? "renseigné" : "VIDE"}</Row>
                <Row label="WHATSAPP_PHONE_NUMBER_ID">{data.config.phoneNumberId || "VIDE"}</Row>
                {data.sender && !data.sender.error && (
                  <>
                    <Row label="Numéro correspondant">{data.sender.displayPhone || "—"}</Row>
                    <Row label="Nom vérifié">{data.sender.verifiedName || "—"}</Row>
                    <Row label="Qualité du numéro">{data.sender.quality || "—"}</Row>
                  </>
                )}
                {data.sender?.error && <Row label="Réponse de Meta" ok={false}>{data.sender.error}</Row>}
                <Row label="Secret et jeton de vérification du webhook" ok={data.config.appSecretSet && data.config.verifyTokenSet}>{data.config.appSecretSet && data.config.verifyTokenSet ? "renseignés" : "incomplets"}</Row>
              </Section>

              <Section title="Numéros auxquels vos clients écrivent">
                {data.receiving.length === 0 ? (
                  <p className="text-xs text-muted">Aucun message reçu depuis la dernière mise à jour. Demandez à un client d'écrire, puis actualisez.</p>
                ) : (
                  data.receiving.map((r) => (
                    <Row key={r.phoneNumberId} label={r.displayPhone || r.phoneNumberId} ok={r.phoneNumberId === data.config.phoneNumberId ? true : undefined}>
                      {r.contacts} contact{r.contacts > 1 ? "s" : ""} · dernier message {frTime(r.lastInboundAt)}{r.phoneNumberId === data.config.phoneNumberId ? " · = numéro d'envoi" : " · ≠ numéro d'envoi"}
                    </Row>
                  ))
                )}
              </Section>

              <Section title="Messages envoyés depuis l'application · dernières 24 h">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([["Envoyés", data.outbound24h.sent, ""], ["Livrés", data.outbound24h.delivered, "text-emerald-700"], ["Lus", data.outbound24h.read, "text-sky-700"], ["Échecs", data.outbound24h.failed, "text-red-600"]] as const).map(([label, value, tone]) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-2.5">
                      <p className={cn("font-display text-xl font-extrabold", tone || "text-dark")}>{value}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">« Envoyés » seul = Meta a accepté le message mais n'a pas confirmé la livraison. « Livrés » = il est arrivé sur le téléphone.</p>
                {data.recentFailures.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.recentFailures.map((failure, i) => (
                      <li key={i} className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700"><strong>{frTime(failure.at)} · {failure.to}</strong> : {failure.error || "erreur inconnue"}</li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Dernières traces du serveur (depuis son démarrage)">
                <Row label="Dernier message reçu">{data.last.inbound ? `${frTime(data.last.inbound.at)} · sur ${data.last.inbound.displayPhone || data.last.inbound.phoneNumberId || "?"}` : "aucun"}</Row>
                <Row label="Dernier envoi" ok={data.last.send ? data.last.send.ok : undefined}>
                  {data.last.send ? `${frTime(data.last.send.at)} · ${data.last.send.ok ? "accepté par Meta" : `refusé (${data.last.send.code || "?"}) ${data.last.send.error || ""}`}` : "aucun"}
                </Row>
                <Row label="Dernier accusé de livraison">{data.last.status ? `${frTime(data.last.status.at)} · ${data.last.status.status}${data.last.status.error ? ` (${data.last.status.error})` : ""}` : "aucun reçu"}</Row>
              </Section>

              <p className="rounded-xl bg-white px-4 py-3 text-[11px] leading-relaxed text-muted">
                Journal du serveur : <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-dark">docker compose logs --tail=200 backend | grep -i whatsapp</code>
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
