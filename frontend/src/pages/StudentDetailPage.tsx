import {
  fetchStudentApplications,
  fetchStudentApplicationHistory,
  fetchStudentDetail,
  fetchStudentDocuments,
  openChatWithStudent,
  reviewStudentDocument,
  type ApplicationHistoryEntry,
  type AuthUser,
  type ChatMessage,
  type StudentDocumentChecklistItem,
  type StudentProfile,
  type UniversityApplication
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import ApplicationTimeline from "@/components/admin/ApplicationTimeline";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Globe2,
  History,
  LayoutGrid,
  Mail,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function statusMeta(t: (fr: string, en: string) => string): Record<StudentDocumentChecklistItem["status"], { label: string; color: string; icon: typeof Clock }> {
  return {
    PENDING: { label: t("À déposer", "To upload"), color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
    SUBMITTED: { label: t("En attente de vérification", "Awaiting review"), color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    VALIDATED: { label: t("Validé", "Approved"), color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    REJECTED: { label: t("Refusé", "Rejected"), color: "bg-red-50 text-red-600 border-red-200", icon: XCircle }
  };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-dark">{value || "—"}</p>
    </div>
  );
}

export default function StudentDetailPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<StudentDocumentChecklistItem[]>([]);
  const [applications, setApplications] = useState<UniversityApplication[]>([]);
  const [history, setHistory] = useState<ApplicationHistoryEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  const loadApplications = () => {
    if (!id) return;
    fetchStudentApplications(id).then(setApplications).catch(() => undefined);
    fetchStudentApplicationHistory(id).then(setHistory).catch(() => undefined);
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchStudentDetail(id), fetchStudentDocuments(id), fetchStudentApplications(id), fetchStudentApplicationHistory(id)])
      .then(([detail, docs, apps, hist]) => {
        setUser(detail.user);
        setProfile(detail.profile);
        setDocuments(docs);
        setHistory(hist);
        setApplications(apps);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger le dossier.", "Unable to load this file.")))
      .finally(() => setLoading(false));
    // Discussion étudiant ↔ conseiller, incluse dans l'historique complet.
    openChatWithStudent(id).then((data) => setMessages(data.messages)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleReviewed = (updated: StudentDocumentChecklistItem) => {
    setDocuments((prev) => prev.map((d) => (d.name === updated.name ? updated : d)));
  };

  // reviewStudentDocument nécessite l'id étudiant : on le fournit via une closure locale
  const reviewFor = (name: string, status: "VALIDATED" | "REJECTED", reason?: string) =>
    id ? reviewStudentDocument(id, name, status, reason) : Promise.reject(new Error(t("Étudiant inconnu.", "Unknown student.")));

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
      </main>
    );
  }

  if (error || !user || !profile) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error || t("Dossier introuvable.", "File not found.")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 pb-16">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-muted shadow-sm hover:text-brand transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("Retour", "Back")}
      </button>

      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-xl font-bold">
              {user.prenom[0]}{user.nom[0]}
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold">{user.prenom} {user.nom}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85"><Mail className="h-3.5 w-3.5" /> {user.email}</p>
            </div>
          </div>
        </div>

        {/* Bascule : Vue d'ensemble / Historique complet */}
        <div className="relative mt-5 inline-flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition",
              activeTab === "overview" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> {t("Vue d'ensemble", "Overview")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition",
              activeTab === "history" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
            )}
          >
            <History className="h-3.5 w-3.5" /> {t("Historique complet", "Full history")}
          </button>
        </div>
      </section>

      {activeTab === "overview" ? (
        <>
          {/* Profil */}
          <section className="mt-6 rounded-[24px] border border-line bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
              <UserRound className="h-5 w-5 text-brand" /> {t("Profil", "Profile")}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <InfoRow label={t("Téléphone", "Phone")} value={profile.phone} />
              <InfoRow label={t("Nationalité", "Nationality")} value={profile.nationality} />
              <InfoRow label={t("Pays de résidence", "Country of residence")} value={profile.residenceCountry} />
              <InfoRow label={t("Ville", "City")} value={profile.city} />
              <InfoRow label={t("Niveau actuel", "Current level")} value={profile.currentStudyLevel} />
              <InfoRow label={t("Dernier diplôme", "Last diploma")} value={profile.lastDiploma} />
              <InfoRow label={t("Pays préférés", "Preferred countries")} value={profile.preferredCountries.join(", ")} />
              <InfoRow label={t("Niveau recherché", "Target level")} value={profile.targetLevel} />
              <InfoRow label={t("Formation souhaitée", "Desired program")} value={profile.targetField} />
              <InfoRow label={t("Budget annuel", "Annual budget")} value={profile.annualBudget ? `${profile.annualBudget} €` : ""} />
              <InfoRow label={t("Niveau français", "French level")} value={profile.languageLevelFrench} />
              <InfoRow label={t("Niveau anglais", "English level")} value={profile.languageLevelEnglish} />
            </div>
          </section>

          {/* Documents */}
          <section className="mt-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
              <FileText className="h-5 w-5 text-brand" /> {t("Documents", "Documents")} ({documents.length})
            </h2>
            <div className="mt-3 space-y-3">
              {documents.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
                  {t("Aucun document requis pour l'instant (l'étudiant n'a pas encore choisi de pays).", "No documents required yet (the student hasn't chosen a country yet).")}
                </p>
              ) : (
                documents.map((doc) => (
                  <DocumentReviewRow key={doc.name} doc={doc} reviewFor={reviewFor} onReviewed={handleReviewed} />
                ))
              )}
            </div>
          </section>

          {/* Candidatures universitaires */}
          <section className="mt-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
              <GraduationCap className="h-5 w-5 text-brand" /> {t("Candidatures universitaires", "University applications")} ({applications.length})
            </h2>
            <div className="mt-3">
              <ApplicationTimeline applications={applications} canAct onChanged={loadApplications} />
            </div>
          </section>
        </>
      ) : (
        <FullHistoryTimeline history={history} messages={messages} />
      )}
    </main>
  );
}

type TimelineEntry =
  | { type: "history"; at: string; data: ApplicationHistoryEntry }
  | { type: "message"; at: string; data: ChatMessage };

// Chronologie unique fusionnant l'audit du dossier (documents, candidature,
// visa, transferts) et les messages échangés — tout, réellement tout, pour
// que l'Admin/Sales voie d'un coup d'œil ce qui s'est passé sur ce dossier.
function FullHistoryTimeline({ history, messages }: { history: ApplicationHistoryEntry[]; messages: ChatMessage[] }) {
  const { t } = useLanguage();
  const entries: TimelineEntry[] = [
    ...history.map((h) => ({ type: "history" as const, at: h.changed_at, data: h })),
    ...messages.map((m) => ({ type: "message" as const, at: m.createdAt, data: m }))
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const fmt = (value: string) =>
    new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
        <History className="h-5 w-5 text-brand" /> {t("Historique complet", "Full history")} ({entries.length})
      </h2>
      <div className="mt-3 space-y-2">
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
            {t("Aucun événement pour l'instant.", "No event yet.")}
          </p>
        ) : (
          entries.map((entry) =>
            entry.type === "history" ? (
              <div key={`h-${entry.data.id}`} className="rounded-xl border border-line bg-white px-4 py-2.5 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-dark">
                    <History className="h-3.5 w-3.5 shrink-0 text-brand" />
                    {entry.data.old_status ? `${entry.data.old_status} → ${entry.data.new_status}` : entry.data.new_status}
                  </p>
                  <p className="shrink-0 text-muted">{fmt(entry.at)}</p>
                </div>
                {entry.data.comment && <p className="mt-1 text-mid">{entry.data.comment}</p>}
                <p className="mt-1 text-[11px] text-muted">
                  {t("Par", "By")} {entry.data.changed_by_prenom ? `${entry.data.changed_by_prenom} ${entry.data.changed_by_nom}` : t("le système", "the system")}
                </p>
              </div>
            ) : (
              <div key={`m-${entry.data.id}`} className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2.5 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-violet-800">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" /> {entry.data.senderName}
                  </p>
                  <p className="shrink-0 text-muted">{fmt(entry.at)}</p>
                </div>
                <p className="mt-1 text-mid">{entry.data.body}</p>
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}

function DocumentReviewRow({
  doc,
  reviewFor,
  onReviewed
}: {
  doc: StudentDocumentChecklistItem;
  reviewFor: (name: string, status: "VALIDATED" | "REJECTED", reason?: string) => Promise<StudentDocumentChecklistItem>;
  onReviewed: (d: StudentDocumentChecklistItem) => void;
}) {
  const { t } = useLanguage();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = statusMeta(t)[doc.status];
  const StatusIcon = meta.icon;
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const handleValidate = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await reviewFor(doc.name, "VALIDATED");
      onReviewed(updated);
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
      const updated = await reviewFor(doc.name, "REJECTED", reason.trim());
      onReviewed(updated);
      setRejecting(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erreur.", "Error."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-bold text-dark">
              {doc.name}
              {doc.required && <span className="ml-1.5 text-red-500">*</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {doc.countries.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                  <Globe2 className="h-2.5 w-2.5" /> {c}
                </span>
              ))}
            </div>
            {doc.fileUrl && (
              <a href={`${apiUrl}${doc.fileUrl}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand underline">
                {doc.originalFilename || t("Voir le fichier", "View file")}
              </a>
            )}
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.color)}>
          <StatusIcon className="h-3 w-3" /> {meta.label}
        </span>
      </div>

      {doc.status === "REJECTED" && doc.rejectionReason && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{t("Motif", "Reason")} : {doc.rejectionReason}</p>
      )}

      {(doc.status === "SUBMITTED" || doc.status === "REJECTED" || doc.status === "VALIDATED") && (
        <div className="mt-3 space-y-2">
          {!rejecting ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || doc.status === "VALIDATED"}
                onClick={handleValidate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60"
              >
                <ThumbsUp className="h-3 w-3" /> {t("Valider", "Approve")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRejecting(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition"
              >
                <ThumbsDown className="h-3 w-3" /> {t("Refuser", "Reject")}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("Motif du refus (obligatoire, visible par l'étudiant)", "Rejection reason (required, visible to the student)")}
                className="w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-brand"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setRejecting(false); setReason(""); }}
                  className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-muted hover:bg-slate-50"
                >
                  {t("Annuler", "Cancel")}
                </button>
                <button
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={handleReject}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {t("Confirmer le refus", "Confirm rejection")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
