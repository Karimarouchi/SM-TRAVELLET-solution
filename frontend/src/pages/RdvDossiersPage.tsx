import {
  acceptVisa,
  fetchApplicationVisaDocuments,
  fetchMyRdvApplications,
  getSession,
  rejectVisa,
  reviewApplicationVisaDocument,
  scheduleVisaEmbassyAppointment,
  scheduleVisaPrepMeeting,
  submitVisaFile,
  type RdvMyApplication,
  type VisaDocumentChecklistItem
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AlertTriangle, Calendar, CheckCircle2, Clock, FileText, GraduationCap, Landmark, Send, ThumbsDown, ThumbsUp, Video, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import MyCommissionsCard from "@/components/MyCommissionsCard";

function docStatusMeta(t: (fr: string, en: string) => string): Record<VisaDocumentChecklistItem["status"], { label: string; color: string; icon: typeof Clock }> {
  return {
    PENDING: { label: t("À déposer", "To upload"), color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
    SUBMITTED: { label: t("Envoyé · à valider", "Sent · to review"), color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    VALIDATED: { label: t("Validé", "Approved"), color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    REJECTED: { label: t("Refusé", "Rejected"), color: "bg-red-50 text-red-600 border-red-200", icon: XCircle }
  };
}

function VisaDocumentReviewRow({
  applicationId,
  doc,
  onReviewed
}: {
  applicationId: string;
  doc: VisaDocumentChecklistItem;
  onReviewed: (d: VisaDocumentChecklistItem) => void;
}) {
  const { t } = useLanguage();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = docStatusMeta(t)[doc.status];
  const StatusIcon = meta.icon;
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const canReview = doc.status === "SUBMITTED" || doc.status === "REJECTED";

  const handleValidate = async () => {
    setBusy(true);
    setError("");
    try {
      onReviewed(await reviewApplicationVisaDocument(applicationId, doc.requirementId, "VALIDATED"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erreur.", "Error."));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setError("");
    try {
      onReviewed(await reviewApplicationVisaDocument(applicationId, doc.requirementId, "REJECTED", reason.trim()));
      setRejecting(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erreur.", "Error."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <div>
            <p className="text-xs font-bold text-dark">
              {doc.name}
              {doc.required && <span className="ml-1 text-red-500">*</span>}
            </p>
            {doc.fileUrl && (
              <a href={`${apiUrl}${doc.fileUrl}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-[11px] text-brand underline">
                {doc.originalFilename || t("Voir le fichier", "View file")}
              </a>
            )}
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", meta.color)}>
          <StatusIcon className="h-2.5 w-2.5" /> {meta.label}
        </span>
      </div>

      {doc.status === "REJECTED" && doc.rejectionReason && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {doc.rejectionReason}
        </div>
      )}

      {canReview && (
        <div className="mt-2">
          {rejecting ? (
            <div className="space-y-1.5">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("Motif du refus (obligatoire)", "Rejection reason (required)")}
                rows={2}
                className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px]"
              />
              <div className="flex gap-1.5">
                <button type="button" disabled={busy} onClick={handleReject} className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60">
                  {t("Confirmer le refus", "Confirm rejection")}
                </button>
                <button type="button" onClick={() => { setRejecting(false); setReason(""); }} className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-bold text-muted">
                  {t("Annuler", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button type="button" disabled={busy} onClick={handleValidate} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60">
                <ThumbsUp className="h-3 w-3" /> {t("Valider", "Approve")}
              </button>
              <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60">
                <ThumbsDown className="h-3 w-3" /> {t("Refuser", "Reject")}
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

const VISA_STEP_META: Record<string, { label: string; color: string }> = {
  PREPARATION: { label: "Préparation", color: "bg-amber-50 text-amber-700 border-amber-200" },
  SUBMITTED: { label: "Dossier déposé", color: "bg-blue-50 text-blue-700 border-blue-200" },
  ACCEPTED: { label: "Visa accepté", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Visa refusé", color: "bg-red-50 text-red-600 border-red-200" }
};

function RejectModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason.trim()) {
      setError("Un motif est obligatoire.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-bold text-dark">Refuser le visa</h3>
        <p className="mt-1 text-xs text-muted">Cette décision est définitive. L'étudiant pourra ouvrir une nouvelle candidature s'il le souhaite.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif du refus (obligatoire)"
          rows={3}
          className="mt-3 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Confirmer le refus</button>
        </div>
      </div>
    </div>
  );
}

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PrepMeetingModal({
  app,
  onClose,
  onConfirm
}: {
  app: RdvMyApplication;
  onClose: () => void;
  onConfirm: (payload: { date: string; type: "ONLINE" | "IN_PERSON"; location: string; instructions?: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(toDatetimeLocalValue(app.visaPrepMeetingAt));
  const [type, setType] = useState<"ONLINE" | "IN_PERSON">(app.visaPrepMeetingType || "ONLINE");
  const [location, setLocation] = useState(app.visaPrepMeetingLocation || "");
  const [instructions, setInstructions] = useState(app.visaPrepMeetingInstructions || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!date) { setError("La date et l'heure sont obligatoires."); return; }
    if (!location.trim()) { setError(type === "ONLINE" ? "Le lien de la réunion (Meet) est obligatoire." : "L'adresse est obligatoire."); return; }
    setSaving(true);
    setError("");
    try {
      await onConfirm({ date: new Date(date).toISOString(), type, location: location.trim(), instructions: instructions.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-bold text-dark">Réunion de préparation à l'entretien visa</h3>
        <p className="mt-1 text-xs text-muted">L'étudiant sera notifié par email de la date choisie.</p>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setType("ONLINE")} className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-bold", type === "ONLINE" ? "border-brand bg-brand/10 text-brand" : "border-line text-muted")}>
            <Video className="mx-auto mb-1 h-4 w-4" /> Meet (en ligne)
          </button>
          <button type="button" onClick={() => setType("IN_PERSON")} className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-bold", type === "IN_PERSON" ? "border-brand bg-brand/10 text-brand" : "border-line text-muted")}>
            <Landmark className="mx-auto mb-1 h-4 w-4" /> Présentiel
          </button>
        </div>

        <label className="mt-3 block text-[11px] font-bold uppercase text-muted">Date et heure</label>
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />

        <label className="mt-3 block text-[11px] font-bold uppercase text-muted">{type === "ONLINE" ? "Lien de la réunion (Meet)" : "Adresse"}</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={type === "ONLINE" ? "https://meet.google.com/..." : "Adresse du rendez-vous"}
          className="mt-1 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
        />

        <label className="mt-3 block text-[11px] font-bold uppercase text-muted">Instructions (optionnel)</label>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function EmbassyAppointmentModal({
  app,
  onClose,
  onConfirm
}: {
  app: RdvMyApplication;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void>;
}) {
  const [date, setDate] = useState(toDatetimeLocalValue(app.visaEmbassyAppointmentAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!date) { setError("La date et l'heure sont obligatoires."); return; }
    setSaving(true);
    setError("");
    try {
      await onConfirm(new Date(date).toISOString());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-bold text-dark">Rendez-vous à l'ambassade</h3>
        <p className="mt-1 text-xs text-muted">Date obtenue auprès de l'ambassade/du consulat pour l'entretien visa. L'étudiant sera notifié par email.</p>

        <label className="mt-3 block text-[11px] font-bold uppercase text-muted">Date et heure</label>
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export default function RdvDossiersPage() {
  const { t } = useLanguage();
  const session = getSession();
  const [applications, setApplications] = useState<RdvMyApplication[]>([]);
  const [error, setError] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [prepMeetingTarget, setPrepMeetingTarget] = useState<RdvMyApplication | null>(null);
  const [embassyTarget, setEmbassyTarget] = useState<RdvMyApplication | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [docsByApp, setDocsByApp] = useState<Record<string, VisaDocumentChecklistItem[]>>({});

  const loadDocs = (apps: RdvMyApplication[]) => {
    apps
      .filter((app) => app.visaStatus === "PREPARATION")
      .forEach((app) => {
        fetchApplicationVisaDocuments(app.id)
          .then((docs) => setDocsByApp((prev) => ({ ...prev, [app.id]: docs })))
          .catch(() => undefined);
      });
  };

  const load = () => {
    fetchMyRdvApplications()
      .then((apps) => {
        setApplications(apps);
        loadDocs(apps);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les dossiers."));
  };

  useEffect(() => { load(); }, []);

  if (!session?.user) return null;

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError("");
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">{t("Espace RDV", "Visa officer area")}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">{t("Bonjour", "Hello")}, {session.user.prenom}</h1>
        <p className="mt-3 text-sm text-white/85">
          {applications.length} {t(`dossier${applications.length > 1 ? "s" : ""} visa qui vous sont attribués.`, `visa file${applications.length > 1 ? "s" : ""} assigned to you.`)}
        </p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <MyCommissionsCard />

      {!applications.length ? (
        <p className="mt-6 rounded-[20px] border border-dashed border-line bg-white p-8 text-sm text-muted">
          {t("Aucun dossier visa ne vous est attribué pour l'instant.", "No visa file is assigned to you yet.")}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {applications.map((app) => {
            const meta = VISA_STEP_META[app.visaStatus || "PREPARATION"];
            const busy = busyId === app.id;
            const docs = docsByApp[app.id] || [];
            const requiredDocs = docs.filter((d) => d.required);
            const allRequiredValidated = requiredDocs.every((d) => d.status === "VALIDATED");
            return (
              <article key={app.id} className="rounded-[20px] border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-dark">{app.studentName}</h3>
                    <p className="text-xs text-muted">{app.studentEmail}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-mid">
                      <GraduationCap className="h-3.5 w-3.5 text-brand" /> {app.universityName} · {app.countryName}
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase", meta.color)}>{meta.label}</span>
                </div>

                {app.visaStatus === "REJECTED" && app.visaDecisionReason && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    {t("Motif du refus", "Rejection reason")} : {app.visaDecisionReason}
                  </p>
                )}

                {(app.visaPrepMeetingAt || app.visaEmbassyAppointmentAt) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {app.visaPrepMeetingAt && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700">
                        {app.visaPrepMeetingType === "ONLINE" ? <Video className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                        {t("Préparation", "Prep")} : {new Date(app.visaPrepMeetingAt).toLocaleString("fr-FR")}
                      </span>
                    )}
                    {app.visaEmbassyAppointmentAt && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
                        <Landmark className="h-3 w-3" /> {t("Ambassade", "Embassy")} : {new Date(app.visaEmbassyAppointmentAt).toLocaleString("fr-FR")}
                      </span>
                    )}
                  </div>
                )}

                {app.visaStatus === "PREPARATION" && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("Documents visa", "Visa documents")}</p>
                    {docs.length === 0 ? (
                      <p className="mt-1.5 text-xs text-muted">{t("Aucun document visa requis pour ce pays pour l'instant.", "No visa document required for this country yet.")}</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {docs.map((doc) => (
                          <VisaDocumentReviewRow
                            key={doc.requirementId}
                            applicationId={app.id}
                            doc={doc}
                            onReviewed={(updated) =>
                              setDocsByApp((prev) => ({
                                ...prev,
                                [app.id]: (prev[app.id] || []).map((d) => (d.requirementId === updated.requirementId ? updated : d))
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {app.visaStatus === "PREPARATION" && (
                    <>
                      <button
                        type="button"
                        disabled={busy || !allRequiredValidated}
                        onClick={() => run(app.id, () => submitVisaFile(app.id))}
                        title={!allRequiredValidated ? t("Tous les documents visa obligatoires doivent être validés d'abord.", "All required visa documents must be approved first.") : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" /> {t("Marquer comme déposé", "Mark as submitted")}
                      </button>
                      {!allRequiredValidated && requiredDocs.length > 0 && (
                        <span className="text-[11px] text-muted">{t("Validez tous les documents obligatoires avant de déposer le dossier.", "Approve all required documents before submitting the file.")}</span>
                      )}
                    </>
                  )}
                  {app.visaStatus === "SUBMITTED" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(app.id, () => acceptVisa(app.id))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {t("Accepter le visa", "Accept visa")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRejectTarget(app.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> {t("Refuser le visa", "Reject visa")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPrepMeetingTarget(app)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-dark hover:border-brand hover:text-brand disabled:opacity-60"
                      >
                        <Calendar className="h-3.5 w-3.5" /> {app.visaPrepMeetingAt ? t("Modifier la réunion", "Edit meeting") : t("Planifier une réunion", "Schedule meeting")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEmbassyTarget(app)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-dark hover:border-brand hover:text-brand disabled:opacity-60"
                      >
                        <Landmark className="h-3.5 w-3.5" /> {app.visaEmbassyAppointmentAt ? t("Modifier le RDV ambassade", "Edit embassy appointment") : t("RDV ambassade", "Embassy appointment")}
                      </button>
                    </>
                  )}
                  {app.visaStatus === "ACCEPTED" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> {t("Dossier complet", "File complete")}</span>
                  )}
                  {app.visaStatus === "REJECTED" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500"><XCircle className="h-3.5 w-3.5" /> {t("Dossier clôturé", "File closed")}</span>
                  )}
                  {!app.visaStatus && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" /> {t("En attente de préparation", "Awaiting preparation")}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => run(rejectTarget, () => rejectVisa(rejectTarget, reason))}
        />
      )}

      {prepMeetingTarget && (
        <PrepMeetingModal
          app={prepMeetingTarget}
          onClose={() => setPrepMeetingTarget(null)}
          onConfirm={(payload) => run(prepMeetingTarget.id, () => scheduleVisaPrepMeeting(prepMeetingTarget.id, payload))}
        />
      )}

      {embassyTarget && (
        <EmbassyAppointmentModal
          app={embassyTarget}
          onClose={() => setEmbassyTarget(null)}
          onConfirm={(date) => run(embassyTarget.id, () => scheduleVisaEmbassyAppointment(embassyTarget.id, date))}
        />
      )}
    </main>
  );
}
