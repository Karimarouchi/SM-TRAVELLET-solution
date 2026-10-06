import {
  acceptVisa,
  fetchApplicationVisaDocuments,
  fetchMyRdvApplications,
  formatMoney,
  getSession,
  rejectVisa,
  reviewApplicationVisaDocument,
  scheduleVisaEmbassyAppointment,
  scheduleVisaPrepMeeting,
  submitVisaFile,
  type RdvMyApplication,
  type VisaDocumentChecklistItem
} from "@/lib/auth";
import { openProtectedFile } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MeetLinkButton } from "@/components/MeetLinkButton";
import { AlertTriangle, ArrowRight, Banknote, Calendar, CalendarClock, CheckCircle2, ClipboardList, Clock, FileText, GraduationCap, Landmark, Plane, Send, Sparkles, ThumbsDown, ThumbsUp, Video, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import ApplicationTimeline from "@/components/admin/ApplicationTimeline";
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
  onReviewed,
  allowReview = true
}: {
  applicationId: string;
  doc: VisaDocumentChecklistItem;
  onReviewed: (d: VisaDocumentChecklistItem) => void;
  allowReview?: boolean;
}) {
  const { t } = useLanguage();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = docStatusMeta(t)[doc.status];
  const StatusIcon = meta.icon;
  const canReview = allowReview && (doc.status === "SUBMITTED" || doc.status === "REJECTED");

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
              <button
                type="button"
                onClick={() => openProtectedFile(doc.fileUrl!).catch((err) => setError(err instanceof Error ? err.message : t("Impossible d'ouvrir ce document.", "Unable to open this document.")))}
                className="mt-0.5 inline-block text-left text-[11px] text-brand underline"
              >
                {doc.originalFilename || t("Voir le fichier", "View file")}
              </button>
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
        {type === "ONLINE" && <MeetLinkButton applicationId={app.id} kind="visaPrep" date={date} onCreated={setLocation} />}

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

type VisaFilter = "all" | "preparation" | "submitted" | "done";
type TaskTone = "danger" | "warning" | "info" | "success";
type Task = { key: string; tone: TaskTone; icon: typeof Clock; title: string; text: string; weight: number; target: string; cta: string; href?: string };

const TASK_STYLES: Record<TaskTone, { box: string; icon: string }> = {
  danger: { box: "border-red-200 bg-red-50/60", icon: "bg-red-100 text-red-600" },
  warning: { box: "border-amber-200 bg-amber-50/60", icon: "bg-amber-100 text-amber-700" },
  info: { box: "border-violet-200 bg-violet-50/60", icon: "bg-violet-100 text-brand" },
  success: { box: "border-emerald-200 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-600" }
};

function KpiTile({ icon: Icon, label, value, hint, tone, onClick }: { icon: typeof Clock; label: string; value: ReactNode; hint: string; tone: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold leading-none text-dark">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </button>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const DAY = 24 * 3600 * 1000;

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
  const [visaFilter, setVisaFilter] = useState<VisaFilter>("all");

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

  const board = useMemo(() => {
    const toApply = applications.filter((a) => a.status === "READY_TO_APPLY");
    const waiting = applications.filter((a) => ["WAITING_UNIVERSITY_RESPONSE", "INTERVIEW_REQUIRED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(a.status));
    const interviews = applications
      .filter((a) => a.status === "INTERVIEW_SCHEDULED" && a.interviewDate && new Date(a.interviewDate).getTime() > Date.now() - 2 * 3600 * 1000)
      .sort((a, b) => new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime());
    const visaPrep = applications.filter((a) => a.status === "ACCEPTED" && a.visaStatus === "PREPARATION");
    const visaSubmitted = applications.filter((a) => a.status === "ACCEPTED" && a.visaStatus === "SUBMITTED");
    const visaDone = applications.filter((a) => a.status === "ACCEPTED" && (a.visaStatus === "ACCEPTED" || a.visaStatus === "REJECTED"));
    const blocked = visaPrep.filter((a) => a.visaPaymentDue);
    const readyToFile = visaPrep.filter((a) => {
      const docs = docsByApp[a.id];
      return !a.visaPaymentDue && docs && docs.filter((d) => d.required).every((d) => d.status === "VALIDATED");
    });

    const tasks: Task[] = [];
    for (const a of blocked) {
      tasks.push({ key: `pay-${a.id}`, tone: "danger", icon: Banknote, weight: 100, title: t("Paiement visa non réglé", "Visa payment not settled"), text: `${a.studentName} · ${t("reste", "left")} ${formatMoney(a.visaPaymentDue!.remaining, a.visaPaymentDue!.currency)} · ${t("dépôt bloqué, prévenez le conseiller", "filing blocked, notify the advisor")}`, target: `app-${a.id}`, cta: t("Voir", "View") });
    }
    for (const a of applications.filter((x) => x.visaEmbassyAppointmentAt && new Date(x.visaEmbassyAppointmentAt).getTime() > Date.now() - 2 * 3600 * 1000)) {
      tasks.push({ key: `emb-${a.id}`, tone: "warning", icon: Landmark, weight: 88, title: t("Rendez-vous ambassade", "Embassy appointment"), text: `${a.studentName} · ${new Date(a.visaEmbassyAppointmentAt!).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, target: `app-${a.id}`, cta: t("Voir", "View") });
    }
    for (const a of readyToFile) {
      tasks.push({ key: `file-${a.id}`, tone: "success", icon: Send, weight: 85, title: t("Prêt à déposer le visa", "Ready to file the visa"), text: `${a.studentName} · ${t("documents validés et paiement réglé", "documents approved and payment settled")}`, target: `app-${a.id}`, cta: t("Déposer", "File") });
    }
    for (const a of toApply) {
      tasks.push({ key: `apply-${a.id}`, tone: "warning", icon: GraduationCap, weight: 80, title: t("Déposer la candidature", "Submit the application"), text: `${a.studentName} · ${a.universityName}${a.fieldOfStudy ? ` · ${a.fieldOfStudy}` : ""}`, target: "candidatures", cta: t("Ouvrir", "Open") });
    }
    for (const a of interviews) {
      const when = new Date(a.interviewDate!);
      const soon = when.getTime() - Date.now() < 2 * DAY;
      tasks.push({ key: `int-${a.id}`, tone: soon ? "warning" : "info", icon: CalendarClock, weight: soon ? 82 : 55, title: t("Entretien université", "University interview"), text: `${a.studentName} · ${a.universityName} · ${when.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, target: "candidatures", cta: a.interviewLink ? t("Rejoindre", "Join") : t("Voir", "View"), href: a.interviewLink || undefined });
    }
    for (const a of waiting.filter((x) => x.status === "WAITING_UNIVERSITY_RESPONSE" && x.appliedAt && Date.now() - new Date(x.appliedAt).getTime() > 10 * DAY)) {
      const days = Math.floor((Date.now() - new Date(a.appliedAt!).getTime()) / DAY);
      tasks.push({ key: `wait-${a.id}`, tone: "info", icon: Clock, weight: 40, title: t("Relancer l'université", "Chase the university"), text: `${a.studentName} · ${a.universityName} · ${t(`sans réponse depuis ${days} jours`, `no answer for ${days} days`)}`, target: "candidatures", cta: t("Voir", "View") });
    }
    for (const a of visaSubmitted) {
      tasks.push({ key: `dec-${a.id}`, tone: "info", icon: Plane, weight: 50, title: t("Décision du visa attendue", "Visa decision pending"), text: a.studentName, target: `app-${a.id}`, cta: t("Voir", "View") });
    }
    tasks.sort((x, y) => y.weight - x.weight);
    return { toApply, waiting, interviews, visaPrep, visaSubmitted, visaDone, blocked, readyToFile, tasks };
  }, [applications, docsByApp, t]);

  if (!session?.user) return null;

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError("");
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      // Le message (ex. paiement de l'étudiant non réglé) est affiché en haut de page.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusyId(null);
    }
  };

  const visaCards = applications
    .filter((app) => app.visaStatus)
    .filter((app) => {
      if (visaFilter === "preparation") return app.visaStatus === "PREPARATION";
      if (visaFilter === "submitted") return app.visaStatus === "SUBMITTED";
      if (visaFilter === "done") return app.visaStatus === "ACCEPTED" || app.visaStatus === "REJECTED";
      return true;
    });
  const VISA_FILTERS: Array<{ id: VisaFilter; label: string; count: number }> = [
    { id: "all", label: t("Tous", "All"), count: applications.filter((a) => a.visaStatus).length },
    { id: "preparation", label: t("En préparation", "In preparation"), count: board.visaPrep.length },
    { id: "submitted", label: t("Déposés", "Filed"), count: board.visaSubmitted.length },
    { id: "done", label: t("Terminés", "Closed"), count: board.visaDone.length }
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <p className="text-sm text-white/75">{t("Espace RDV", "Visa officer area")}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{t("Bonjour", "Hello")}, {session.user.prenom}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/85">
          {applications.length === 0
            ? t("Aucun dossier ne vous est attribué pour l'instant.", "No file is assigned to you yet.")
            : board.tasks.length
              ? t(`${applications.length} dossier${applications.length > 1 ? "s" : ""} · ${board.tasks.length} action${board.tasks.length > 1 ? "s" : ""} à mener aujourd'hui.`, `${applications.length} file(s) · ${board.tasks.length} action(s) to take today.`)
              : t(`${applications.length} dossier${applications.length > 1 ? "s" : ""} · tout est à jour.`, `${applications.length} file(s) · all up to date.`)}
        </p>
      </section>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
        </div>
      )}

      {/* ── Indicateurs ──────────────────────────────────────────── */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={t("Indicateurs", "Indicators")}>
        <KpiTile icon={GraduationCap} label={t("À déposer", "To submit")} value={board.toApply.length} hint={t("candidatures prêtes", "applications ready")} tone="bg-amber-100 text-amber-600" onClick={() => scrollToId("candidatures")} />
        <KpiTile icon={CalendarClock} label={t("Entretiens", "Interviews")} value={board.interviews.length} hint={t("à venir", "upcoming")} tone="bg-violet-100 text-brand" onClick={() => scrollToId("candidatures")} />
        <KpiTile icon={Clock} label={t("Réponses", "Replies")} value={board.waiting.length} hint={t("en attente des universités", "awaiting universities")} tone="bg-sky-100 text-sky-600" onClick={() => scrollToId("candidatures")} />
        <KpiTile icon={Plane} label={t("Visas", "Visas")} value={board.visaPrep.length + board.visaSubmitted.length} hint={t(`${board.readyToFile.length} prêt${board.readyToFile.length > 1 ? "s" : ""} à déposer`, `${board.readyToFile.length} ready to file`)} tone="bg-emerald-100 text-emerald-600" onClick={() => scrollToId("visas")} />
        <KpiTile icon={Banknote} label={t("Bloqués", "Blocked")} value={board.blocked.length} hint={t("paiement visa non réglé", "visa payment due")} tone="bg-red-100 text-red-600" onClick={() => { setVisaFilter("preparation"); scrollToId("visas"); }} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="todo-title" className="min-w-0">
          <h2 id="todo-title" className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-dark">
            <Sparkles className="h-5 w-5 text-brand" aria-hidden /> {t("À faire aujourd'hui", "To do today")}
          </h2>
          {board.tasks.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" aria-hidden /></span>
              <div>
                <p className="text-sm font-bold text-emerald-800">{t("Rien d'urgent", "Nothing urgent")}</p>
                <p className="text-xs text-emerald-700">{t("Aucune action à mener pour l'instant.", "No action needed right now.")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {board.tasks.slice(0, 8).map((task) => {
                const st = TASK_STYLES[task.tone];
                const Icon = task.icon;
                const className = "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand-hover";
                return (
                  <div key={task.key} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3.5 sm:flex-nowrap", st.box)}>
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", st.icon)}><Icon className="h-5 w-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-dark">{task.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-mid">{task.text}</p>
                    </div>
                    {task.href ? (
                      <a href={task.href} target="_blank" rel="noreferrer" className={className}>{task.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></a>
                    ) : (
                      <button type="button" onClick={() => scrollToId(task.target)} className={className}>{task.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></button>
                    )}
                  </div>
                );
              })}
              {board.tasks.length > 8 && <p className="text-xs text-muted">{t(`+ ${board.tasks.length - 8} autre(s) action(s) plus bas.`, `+ ${board.tasks.length - 8} more action(s) below.`)}</p>}
            </div>
          )}
        </section>
        <aside className="min-w-0"><MyCommissionsCard /></aside>
      </div>

      {!applications.length ? (
        <p className="mt-8 rounded-[20px] border border-dashed border-line bg-white p-8 text-sm text-muted">
          {t("Aucun dossier ne vous est attribué pour l'instant.", "No file is assigned to you yet.")}
        </p>
      ) : (
        <>
          {applications.some((a) => a.status !== "ACCEPTED" && a.status !== "CLOSED") && (
            <section id="candidatures" className="mt-8 scroll-mt-24">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-dark">
                <ClipboardList className="h-5 w-5 text-brand" aria-hidden /> {t("Candidatures universitaires", "University applications")}
              </h2>
              <ApplicationTimeline
                applications={applications.filter((a) => a.status !== "ACCEPTED" && a.status !== "CLOSED")}
                canAct
                onChanged={load}
              />
            </section>
          )}
          {applications.some((a) => a.status === "ACCEPTED" && !a.visaStatus) && (
            <section className="mt-6 rounded-[20px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              {t("Dossiers en attente des documents visa chez le conseiller. Ils vous reviendront automatiquement (même RDV, ou le moins chargé s'il n'est plus actif).", "Files waiting for visa documents with the advisor. They will return to you automatically (same officer, or the least loaded if they are inactive).")}
            </section>
          )}

          {applications.some((a) => a.visaStatus) && (
            <section id="visas" className="mt-8 scroll-mt-24">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
                  <Plane className="h-5 w-5 text-brand" aria-hidden /> {t("Dossiers visa", "Visa files")}
                </h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("Filtrer les dossiers visa", "Filter visa files")}>
                  {VISA_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setVisaFilter(f.id)}
                      aria-pressed={visaFilter === f.id}
                      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition", visaFilter === f.id ? "border-brand bg-brand text-white" : "border-line bg-white text-mid hover:border-brand/40")}
                    >
                      {f.label}
                      <span className={cn("rounded-full px-1.5 text-[10px]", visaFilter === f.id ? "bg-white/25" : "bg-slate-100 text-muted")}>{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {visaCards.map((app) => {
                  const meta = VISA_STEP_META[app.visaStatus || "PREPARATION"];
                  const busy = busyId === app.id;
                  const docs = docsByApp[app.id] || [];
                  const requiredDocs = docs.filter((d) => d.required);
                  const allRequiredValidated = requiredDocs.every((d) => d.status === "VALIDATED");
                  const paymentDue = app.visaPaymentDue;
                  const validated = requiredDocs.filter((d) => d.status === "VALIDATED").length;
                  return (
                    <article id={`app-${app.id}`} key={app.id} className={cn("scroll-mt-24 rounded-[20px] border bg-white p-5 shadow-sm", paymentDue ? "border-red-200" : "border-line")}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-base font-bold text-dark">{app.studentName}</h3>
                          <p className="truncate text-xs text-muted">{app.studentEmail}</p>
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-mid">
                            <GraduationCap className="h-3.5 w-3.5 shrink-0 text-brand" /> <span className="truncate">{app.universityName}{app.fieldOfStudy ? ` · ${app.fieldOfStudy}` : ""} · {app.countryName}</span>
                          </p>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase", meta.color)}>{meta.label}</span>
                      </div>

                      {paymentDue && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                          <Banknote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>
                            <strong>{t("Paiement visa non réglé", "Visa payment not settled")}</strong> · {t("reste", "left")} {formatMoney(paymentDue.remaining, paymentDue.currency)}. {t("Le dépôt est bloqué : prévenez le conseiller.", "Filing is blocked: notify the advisor.")}
                          </span>
                        </div>
                      )}

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
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("Documents visa", "Visa documents")}</p>
                            {requiredDocs.length > 0 && <p className="text-[11px] font-semibold text-mid">{validated} / {requiredDocs.length} {t("validés", "approved")}</p>}
                          </div>
                          {requiredDocs.length > 0 && (
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(validated / requiredDocs.length) * 100}%` }} />
                            </div>
                          )}
                          {docs.length === 0 ? (
                            <p className="mt-1.5 text-xs text-muted">{t("Aucun document visa requis pour ce pays pour l'instant.", "No visa document required for this country yet.")}</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {docs.map((doc) => (
                                <VisaDocumentReviewRow
                                  key={doc.requirementId}
                                  applicationId={app.id}
                                  doc={doc}
                                  allowReview={false}
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
                              disabled={busy || !allRequiredValidated || Boolean(paymentDue)}
                              onClick={() => run(app.id, () => submitVisaFile(app.id))}
                              title={paymentDue ? t("Paiement visa non réglé.", "Visa payment not settled.") : !allRequiredValidated ? t("Tous les documents visa obligatoires doivent être validés d'abord.", "All required visa documents must be approved first.") : undefined}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" /> {t("Marquer comme déposé", "Mark as submitted")}
                            </button>
                            {!paymentDue && !allRequiredValidated && requiredDocs.length > 0 && (
                              <span className="text-[11px] text-muted">{t("Validez tous les documents obligatoires avant de déposer le dossier.", "Approve all required documents before submitting the file.")}</span>
                            )}
                          </>
                        )}
                        {app.visaStatus === "SUBMITTED" && (
                          <>
                            <button type="button" disabled={busy} onClick={() => run(app.id, () => acceptVisa(app.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
                              <ThumbsUp className="h-3.5 w-3.5" /> {t("Accepter le visa", "Accept visa")}
                            </button>
                            <button type="button" disabled={busy} onClick={() => setRejectTarget(app.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
                              <ThumbsDown className="h-3.5 w-3.5" /> {t("Refuser le visa", "Reject visa")}
                            </button>
                            <button type="button" disabled={busy} onClick={() => setPrepMeetingTarget(app)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-dark hover:border-brand hover:text-brand disabled:opacity-60">
                              <Calendar className="h-3.5 w-3.5" /> {app.visaPrepMeetingAt ? t("Modifier la réunion", "Edit meeting") : t("Planifier une réunion", "Schedule meeting")}
                            </button>
                            <button type="button" disabled={busy} onClick={() => setEmbassyTarget(app)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-dark hover:border-brand hover:text-brand disabled:opacity-60">
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
                      </div>
                    </article>
                  );
                })}
                {visaCards.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted xl:col-span-2">{t("Aucun dossier visa dans cette catégorie.", "No visa file in this category.")}</p>}
              </div>
            </section>
          )}
        </>
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
