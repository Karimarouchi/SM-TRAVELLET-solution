import {
  confirmVisaDocuments,
  fetchApplicationStudyDocuments,
  fetchApplicationVisaDocuments,
  reuseStudyDocumentForVisa,
  fetchStudentApplications,
  fetchApplicationBlockers,
  fetchStudentApplicationHistory,
  fetchStudentDetail,
  fetchStudentDocuments,
  fetchStudentPayments,
  formatMoney,
  getSession,
  reviewApplicationVisaDocument,
  rejectDocumentAsRdv,
  requestTranslation,
  reviewStudentDocument,
  uploadStudentDocumentAsStaff,
  type ApplicationHistoryEntry,
  type AuthUser,
  type PaymentPlan,
  type PipelineStageKey,
  type StudentDocumentChecklistItem,
  type StudentBlockers,
  type StudentProfile,
  type UniversityApplication,
  type ReusableStudyDocument,
  type VisaDocumentChecklistItem
} from "@/lib/auth";
import { openProtectedFile } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { alertDialog } from "@/components/ui/dialog-host";
import ApplicationTimeline from "@/components/admin/ApplicationTimeline";
import UniversityChoicesPanel from "@/components/UniversityChoicesPanel";
import ApplicationBlockers from "@/components/ApplicationBlockers";
import StudentNotes from "@/components/StudentNotes";
import StudentMailLog from "@/components/StudentMailLog";
import TranslationSlot from "@/components/TranslationSlot";
import NonPartnerDocsCard from "@/components/NonPartnerDocsCard";
import StudentPaymentsPanel from "@/components/StudentPaymentsPanel";
import StaffVisaUploadButton from "@/components/StaffVisaUploadButton";
import { StageBadge } from "@/components/admin/StudentsPipelineBoard";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Phone,
  Plane,
  Sparkles,
  Clock,
  FileText,
  GraduationCap,
  Globe2,
  History,
  LayoutGrid,
  Mail,
  ThumbsDown,
  ThumbsUp,
  Upload,
  CircleHelp,
  Languages,
  UserRound,
  UsersRound,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PassportBadge } from "@/components/PassportBadge";
import { monthsLeft, parseExpiry } from "@/lib/passport";

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
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-dark">{value || "—"}</p>
    </div>
  );
}

type Alert = { key: string; tone: "danger" | "warning" | "info"; text: string; target: string };

const ALERT_STYLES: Record<Alert["tone"], string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-violet-200 bg-violet-50 text-violet-700"
};

// Étape du pipeline d'un étudiant (même règle que la liste du conseiller).
function stageOf(onboardingCompleted: boolean, applications: UniversityApplication[]): PipelineStageKey {
  if (!onboardingCompleted) return "onboarding";
  const latest = applications.find((a) => a.status !== "CLOSED");
  if (!latest) return "no_application";
  if (latest.status === "POSTPONED") return latest.postponedKind === "VISA" ? "visa_postponed" : "postponed";
  if (latest.status === "REJECTED") return "rejected";
  if (latest.status === "ACCEPTED") {
    if (latest.visaStatus === "ACCEPTED") return "completed";
    if (latest.visaStatus === "REJECTED") return "visa_rejected";
    if (latest.visaStatus === "SUBMITTED") return "visa_submitted";
    if (latest.visaStatus === "PREPARATION") return "visa_preparation";
    return "accepted";
  }
  if (["INTERVIEW_REQUIRED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(latest.status)) return "interview";
  if (latest.status === "WAITING_UNIVERSITY_RESPONSE") return "waiting_response";
  if (latest.status === "APPLIED") return "applied";
  if (!latest.translationDoneAt) return "in_translation";
  return "ready_to_apply";
}

function scrollToSection(id: string) {
  // Une section repliée s'ouvre d'abord, puis la page défile jusqu'à elle.
  window.dispatchEvent(new CustomEvent("open-section", { detail: id }));
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}

// Section repliée par défaut : l'admin / le conseiller l'ouvre quand il en a besoin.
function CollapsibleSection({ id, icon, title, summary, children }: { id: string; icon: React.ReactNode; title: string; summary?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent<string>).detail === id) setOpen(true);
    };
    window.addEventListener("open-section", handler);
    return () => window.removeEventListener("open-section", handler);
  }, [id]);
  return (
    <section id={id} className="scroll-mt-24">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-brand/40 hover:shadow-md"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2 font-display text-lg font-bold text-dark">{icon} {title}</span>
          {summary}
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function DocSummary({ docs }: { docs: Array<{ status: string }> }) {
  const validated = docs.filter((d) => d.status === "VALIDATED").length;
  const toReview = docs.filter((d) => d.status === "SUBMITTED").length;
  const rejected = docs.filter((d) => d.status === "REJECTED").length;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-mid">{validated}/{docs.length} validés</span>
      {toReview > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700">{toReview} à vérifier</span>}
      {rejected > 0 && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-red-600">{rejected} refusé{rejected > 1 ? "s" : ""}</span>}
    </span>
  );
}

function ContactButton({ href, icon: Icon, label, tone }: { href: string; icon: typeof Mail; label: string; tone: string }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition", tone)}>
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </a>
  );
}

function InfoGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-brand">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const session = getSession();
  const role = session?.user?.role;
  const canActUniversity = role === "ADMIN";
  // Le Responsable Dossier consulte le profil de ses étudiants en lecture seule.
  const isReviewer = role === "SALES" || role === "ADMIN";
  const passportExpiry = profile?.passportExpiresOn ? parseExpiry(profile.passportExpiresOn) : null;
  const passportMonthsLeft = passportExpiry ? monthsLeft(passportExpiry) : null;
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const [visaBundles, setVisaBundles] = useState<{ application: UniversityApplication; docs: VisaDocumentChecklistItem[] }[]>([]);
  const [studyDocs, setStudyDocs] = useState<ReusableStudyDocument[]>([]);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [blockers, setBlockers] = useState<StudentBlockers | null>(null);
  const visaDocs = visaBundles.flatMap((bundle) => bundle.docs);

  const loadApplications = () => {
    if (!id) return;
    fetchStudentApplications(id).then(setApplications).catch(() => undefined);
    fetchStudentApplicationHistory(id).then(setHistory).catch(() => undefined);
  };

  useEffect(() => {
    const accepted = applications.filter((a) => a.status === "ACCEPTED");
    if (!accepted.length) {
      setVisaBundles([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      accepted.map((application) =>
        fetchApplicationVisaDocuments(application.id)
          .then((docs) => ({ application, docs }))
          .catch(() => ({ application, docs: [] as VisaDocumentChecklistItem[] }))
      )
    ).then((rows) => {
      if (!cancelled) setVisaBundles(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [applications]);

  useEffect(() => {
    const target = visaBundles.find((bundle) => bundle.application.status === "ACCEPTED");
    if (!target || (role !== "SALES" && role !== "ADMIN" && role !== "RDV")) {
      setStudyDocs([]);
      return;
    }
    fetchApplicationStudyDocuments(target.application.id).then(setStudyDocs).catch(() => setStudyDocs([]));
  }, [visaBundles, role]);

  const reloadPayments = () => {
    if (!id || (role !== "SALES" && role !== "ADMIN" && role !== "RDV")) return;
    fetchStudentPayments(id).then((data) => setPlans(data.plans)).catch(() => undefined);
  };

  useEffect(() => {
    if (!id) return;
    reloadPayments();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleReviewed = (updated: StudentDocumentChecklistItem) => {
    setDocuments((prev) => prev.map((d) => (d.name === updated.name && (d.universityId || null) === (updated.universityId || null) ? updated : d)));
  };

  // Un vœu ajouté ou retiré change la checklist et les candidatures.
  const [choicesVersion, setChoicesVersion] = useState(0);
  const reloadAfterChoice = () => {
    if (!id) return;
    setChoicesVersion((v) => v + 1);
    fetchStudentDocuments(id).then(setDocuments).catch(() => undefined);
    loadApplications();
  };

  // reviewStudentDocument nécessite l'id étudiant : on le fournit via une closure locale
  const reviewFor = (name: string, status: "VALIDATED" | "REJECTED", reason?: string, universityId?: string | null) =>
    id
      ? role === "RDV"
        ? rejectDocumentAsRdv(id, name, reason || "", universityId)
        : reviewStudentDocument(id, name, status, reason, universityId)
      : Promise.reject(new Error(t("Étudiant inconnu.", "Unknown student.")));

  // Dépôt d'un document à la place de l'étudiant (conseiller / admin) : lu en base64 puis validé d'office.
  const uploadFor = (doc: StudentDocumentChecklistItem, file: File) =>
    new Promise<StudentDocumentChecklistItem>((resolve, reject) => {
      if (!id) return reject(new Error(t("Étudiant inconnu.", "Unknown student.")));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t("Lecture du fichier impossible.", "Unable to read the file.")));
      reader.onload = () => uploadStudentDocumentAsStaff(id, doc.name, reader.result as string, file.name, doc.universityId).then(resolve, reject);
      reader.readAsDataURL(file);
    });

  const stage = useMemo(() => stageOf(Boolean(profile?.onboardingCompleted), applications), [profile, applications]);

  // « Sans candidature » : on explique pourquoi (documents manquants, vœu absent…), pour le conseiller et l'admin.
  useEffect(() => {
    if (!id || stage !== "no_application" || !isReviewer) {
      setBlockers(null);
      return;
    }
    fetchApplicationBlockers(id).then(setBlockers).catch(() => setBlockers(null));
  }, [id, stage, isReviewer, documents]);
  const docsToReview = documents.filter((d) => d.status === "SUBMITTED").length;
  const docsRejected = documents.filter((d) => d.status === "REJECTED").length;
  const docsValidated = documents.filter((d) => d.status === "VALIDATED").length;
  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = [];
    if (docsToReview && isReviewer) list.push({ key: "docs", tone: "warning", text: t(`${docsToReview} document${docsToReview > 1 ? "s" : ""} à valider`, `${docsToReview} document(s) to review`), target: "documents" });
    const visaToReview = visaBundles.filter((bundle) => !bundle.application.visaStatus).flatMap((bundle) => bundle.docs).filter((d) => d.status === "SUBMITTED").length;
    if (visaToReview && isReviewer) list.push({ key: "visa-docs", tone: "warning", text: t(`${visaToReview} document${visaToReview > 1 ? "s" : ""} visa à valider`, `${visaToReview} visa document(s) to review`), target: "visa-documents" });
    const late = plans.find((p) => p.late);
    if (late) list.push({ key: "payment", tone: "danger", text: isReviewer ? t(`Paiement en retard : reste ${formatMoney(late.remainingTotal, late.currency)}`, `Payment overdue: ${formatMoney(late.remainingTotal, late.currency)} left`) : t("Paiement en retard", "Payment overdue"), target: "paiements" });
    if (profile?.passportStatus === "EXPIRED") list.push({ key: "passport", tone: "danger", text: t("Passeport expiré", "Passport expired"), target: "profil" });
    else if (profile?.passportStatus === "EXPIRING") list.push({ key: "passport", tone: "warning", text: t("Passeport à renouveler", "Passport to renew"), target: "profil" });
    if (docsRejected) list.push({ key: "rejected", tone: "info", text: t(`${docsRejected} document${docsRejected > 1 ? "s" : ""} refusé${docsRejected > 1 ? "s" : ""} : en attente de l'étudiant`, `${docsRejected} rejected document(s): waiting for the student`), target: "documents" });
    if (isReviewer && applications.some((a) => a.status === "READY_TO_APPLY" && !a.translationDoneAt)) list.push({ key: "translation", tone: "warning", text: t("Documents en traduction : confirmer la fin de la traduction", "Documents in translation: confirm when done"), target: "candidatures" });
    if (stage === "accepted") list.push({ key: "visa-prep", tone: "info", text: t("Accepté : préparer les documents visa", "Accepted: prepare visa documents"), target: "visa-documents" });
    return list;
  }, [docsToReview, docsRejected, visaBundles, plans, profile, stage, isReviewer, applications, t]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 pt-10 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
      </main>
    );
  }

  if (error || !user || !profile) {
    return (
      <main className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 pt-10">
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error || t("Dossier introuvable.", "File not found.")}</p>
      </main>
    );
  }

  // RDV (responsable visa) en relation avec l'étudiant, avec les candidatures qu'il suit.
  const rdvContacts = (() => {
    const map = new Map<string, { id: string; name: string; email: string | null; phone: string | null; universities: string[] }>();
    for (const app of applications) {
      if (!app.assignedRdvId || !app.assignedRdvName || app.status === "CLOSED") continue;
      const entry = map.get(app.assignedRdvId) || { id: app.assignedRdvId, name: app.assignedRdvName, email: app.assignedRdvEmail || null, phone: app.assignedRdvPhone || null, universities: [] };
      entry.universities.push(app.universityName);
      map.set(app.assignedRdvId, entry);
    }
    return [...map.values()];
  })();
  const openApplications = applications.filter((a) => a.status !== "CLOSED");
  const phoneDigits = (profile.phone || "").replace(/\D/g, "");
  const fullName = `${user.prenom} ${user.nom}`.trim();
  const passportOk = profile.passportStatus === "VALID";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-muted shadow-sm transition hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("Retour", "Back")}
      </button>

      {/* ── En-tête du dossier ─────────────────────────────────────── */}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar name={fullName} src={user.avatarUrl} size="xl" className="ring-4 ring-white/25" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">{fullName}</h1>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-white/85"><Mail className="h-3.5 w-3.5 shrink-0" /> {user.email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-1 py-0.5"><StageBadge stage={stage} /></span>
                {profile.coverOwnerName && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold text-orange-700">Remplacement de {profile.coverOwnerName} pendant son congé</span>
                )}
                {profile.preferredCountries.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold"><Globe2 className="h-3 w-3" aria-hidden /> {profile.preferredCountries.join(", ")}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {phoneDigits && <ContactButton href={`https://wa.me/${phoneDigits}`} icon={MessageCircle} label="WhatsApp" tone="bg-emerald-500 text-white hover:bg-emerald-600" />}
            {phoneDigits && <ContactButton href={`tel:+${phoneDigits}`} icon={Phone} label={t("Appeler", "Call")} tone="bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25" />}
            {/* Écrire depuis la boîte mail de l'agence (équipe SM) ; le lien mailto reste le repli pour l'ouvrir dans un autre logiciel. */}
            <Link to={`/mail?compose=1&to=${encodeURIComponent(user.email)}&name=${encodeURIComponent(fullName)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/25 transition hover:bg-white/25">
              <Mail className="h-3.5 w-3.5" aria-hidden /> {t("Écrire un mail", "Write an email")}
            </Link>
          </div>
        </div>

        {/* Équipe en charge : le conseiller et le(s) Responsable(s) Dossier de l'étudiant. */}
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
            <UsersRound className="h-3.5 w-3.5" aria-hidden /> {t("Équipe en charge", "Team in charge")}
          </p>
          <div className="grid gap-2.5 md:grid-cols-2">
            <TeamCard
              role={t("Conseiller", "Advisor")}
              icon={UserRound}
              name={profile.assignedSalesName || null}
              detail={profile.coverOwnerName ? t("En congé : vous le remplacez", "On leave: you are covering") : null}
              email={profile.assignedSalesEmail || null}
              phone={profile.assignedSalesPhone || null}
              empty={t("Aucun conseiller assigné.", "No advisor assigned.")}
            />
            {rdvContacts.length === 0 ? (
              <TeamCard
                role={t("Responsable Dossier", "Visa officer")}
                icon={Plane}
                name={null}
                empty={openApplications.length
                  ? t("Pas encore assigné : choisi automatiquement dès que les documents sont validés et traduits.", "Not assigned yet: picked automatically once documents are approved and translated.")
                  : t("Assigné dès la première candidature.", "Assigned with the first application.")}
              />
            ) : (
              rdvContacts.map((rdv) => (
                <TeamCard
                  key={rdv.id}
                  role={t("Responsable Dossier", "Visa officer")}
                  icon={Plane}
                  name={rdv.name}
                  detail={`${t("Suit", "Handles")} : ${rdv.universities.join(", ")}`}
                  email={rdv.email}
                  phone={rdv.phone}
                />
              ))
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { label: t("Documents", "Documents"), value: docsToReview ? `${docsToReview} ${t("à valider", "to review")}` : `${docsValidated} ${t("validé" + (docsValidated > 1 ? "s" : ""), "approved")}`, warn: docsToReview > 0, target: "documents" },
            { label: t("Passeport", "Passport"), value: passportOk ? t("Valide", "Valid") : profile.passportStatus === "EXPIRING" ? t("À renouveler", "To renew") : profile.passportStatus === "EXPIRED" ? t("Expiré", "Expired") : t("À renseigner", "To fill"), warn: !passportOk, target: "profil" },
            { label: t("Paiement", "Payment"), value: plans.length ? (plans.every((p) => p.status === "PAID") ? t("Soldé", "Settled") : plans.some((p) => p.late) ? t("En retard", "Overdue") : t("En cours", "In progress")) : "—", warn: plans.some((p) => p.late), target: "paiements" },
            { label: t("Candidatures", "Applications"), value: `${applications.filter((a) => a.status !== "CLOSED").length}`, warn: false, target: "candidatures" }
          ].map((chip) => (
            <button key={chip.label} type="button" onClick={() => scrollToSection(chip.target)} className="rounded-2xl bg-white/12 px-4 py-3 text-left ring-1 ring-white/20 transition hover:bg-white/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{chip.label}</p>
              <p className={cn("mt-0.5 text-sm font-extrabold", chip.warn ? "text-amber-200" : "text-white")}>{chip.value}</p>
            </button>
          ))}
        </div>

        {/* Bascule : Vue d'ensemble / Historique complet */}
        <div className="relative mt-5 inline-flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur">
          <button type="button" onClick={() => setActiveTab("overview")} className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition", activeTab === "overview" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white")}>
            <LayoutGrid className="h-3.5 w-3.5" /> {t("Vue d'ensemble", "Overview")}
          </button>
          <button type="button" onClick={() => setActiveTab("history")} className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition", activeTab === "history" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white")}>
            <History className="h-3.5 w-3.5" /> {t("Historique complet", "Full history")}
          </button>
        </div>
      </section>

      {activeTab === "overview" ? (
        <>
          {isReviewer && stage === "no_application" && blockers && (
            <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm" aria-label={t("Pourquoi pas encore de candidature", "Why no application yet")}>
              <p className="mb-2.5 flex items-center gap-2 text-sm font-extrabold text-dark">
                <CircleHelp className="h-4 w-4 text-brand" aria-hidden /> {t("Pourquoi pas encore de candidature ?", "Why no application yet?")}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-muted">{blockers.documents.validated}/{blockers.documents.required} {t("documents validés", "documents approved")}</span>
              </p>
              <ApplicationBlockers blockers={blockers} />
            </section>
          )}

          {/* À traiter */}
          {alerts.length > 0 && (
            <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm" aria-label={t("À traiter", "To handle")}>
              <p className="mb-2.5 flex items-center gap-2 text-sm font-extrabold text-dark"><Sparkles className="h-4 w-4 text-brand" aria-hidden /> {t("À traiter sur ce dossier", "To handle on this file")}</p>
              <div className="flex flex-wrap gap-2">
                {alerts.map((alert) => (
                  <button key={alert.key} type="button" onClick={() => scrollToSection(alert.target)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition hover:shadow-sm", ALERT_STYLES[alert.tone])}>
                    {alert.tone === "danger" && <AlertTriangle className="h-3 w-3" aria-hidden />} {alert.text} <ArrowRight className="h-3 w-3 opacity-60" aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Colonne de travail */}
            <div className="min-w-0 space-y-6">
              {id && <StudentNotes studentId={id} />}
              {id && <StudentMailLog studentId={id} />}

              {id && (role === "SALES" || role === "ADMIN") && (
                <NonPartnerDocsCard
                  studentId={id}
                  refreshKey={choicesVersion}
                  onChanged={() => {
                    fetchStudentDocuments(id).then(setDocuments).catch(() => undefined);
                  }}
                />
              )}

              <CollapsibleSection
                id="documents"
                icon={<FileText className="h-5 w-5 text-brand" />}
                title={`${t("Documents", "Documents")} (${documents.length})`}
                summary={documents.length ? <DocSummary docs={documents} /> : undefined}
              >
                <div className="space-y-3">
                  {documents.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
                      {t("Aucun document requis pour l'instant (l'étudiant n'a pas encore choisi de pays).", "No documents required yet (the student hasn't chosen a country yet).")}
                    </p>
                  ) : (
                    documents.map((doc) => (
                      <DocumentReviewRow key={`${doc.universityId || "pays"}:${doc.name}`} doc={doc} reviewFor={reviewFor} onReviewed={handleReviewed} canReview={isReviewer} rejectOnly={role === "RDV"} onUpload={isReviewer && profile?.onboardingCompleted && id ? (file) => uploadFor(doc, file) : undefined} translationMode={isReviewer ? "staff" : "readonly"} onTranslationChanged={() => id && fetchStudentDocuments(id).then(setDocuments).catch(() => undefined)} studentId={id} />
                    ))
                  )}
                </div>
              </CollapsibleSection>

              {visaBundles.length > 0 && (role === "SALES" || role === "ADMIN" || role === "RDV") && (
                <CollapsibleSection
                  id="visa-documents"
                  icon={<FileText className="h-5 w-5 text-brand" />}
                  title={t("Documents visa", "Visa documents")}
                  summary={visaDocs.length ? <DocSummary docs={visaDocs} /> : undefined}
                >
                  <p className="text-xs text-muted">
                    {t("Le conseiller et le Responsable Dossier de ce dossier voient les mêmes documents. Le conseiller les dépose et les valide ; ensuite le Responsable Dossier reprend le visa.", "The advisor and the visa officer on this file see the same documents. The advisor uploads and approves them; the visa officer then takes over the visa.")}
                  </p>
                  <div className="mt-3 space-y-4">
                    {visaBundles.map((bundle) => {
                      const appointed = Boolean(bundle.application.visaPrepMeetingAt || bundle.application.visaEmbassyAppointmentAt);
                      const canManage = (role === "SALES" || role === "ADMIN") && !bundle.application.visaStatus && appointed;
                      return (
                        <div key={bundle.application.id}>
                          <p className="text-xs font-bold text-dark">{bundle.application.universityName}{bundle.application.countryName ? ` · ${bundle.application.countryName}` : ""}</p>
                          {!appointed && (role === "SALES" || role === "ADMIN") ? (
                            <p className="mt-1 text-xs text-amber-700">{t("Les documents visa se déposent une fois le rendez-vous fixé par le Responsable Dossier.", "Visa documents are uploaded once the visa officer has set the appointment.")}</p>
                          ) : bundle.application.visaStatus ? (
                            <p className="mt-1 text-xs text-muted">{t("Dossier visa chez le Responsable Dossier. Les documents restent visibles ici.", "The visa file is with the visa officer. The documents stay visible here.")}</p>
                          ) : canManage ? (
                            <p className="mt-1 text-xs text-muted">{t("Validez tous les documents visa obligatoires : le dossier revient ensuite au même Responsable Dossier.", "Approve every required visa document: the file then returns to the same visa officer.")}</p>
                          ) : null}
                          {canManage && bundle.docs.filter((d) => d.required).length === 0 && (
                            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                              <p className="text-sm font-bold text-dark">{t("Aucun document visa obligatoire pour ce pays", "No required visa document for this country")}</p>
                              <p className="mt-1 text-xs text-mid">{t("Confirmez pour transmettre le dossier au Responsable Dossier : il pourra alors déposer le visa.", "Confirm to pass the file to the visa officer: they will then be able to submit the visa.")}</p>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await confirmVisaDocuments(bundle.application.id);
                                    loadApplications();
                                    reloadAfterChoice();
                                  } catch (err) {
                                    void alertDialog(err instanceof Error ? err.message : t("Action impossible.", "Action failed."), { tone: "danger" });
                                  }
                                }}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> {t("Confirmer et transmettre au Responsable Dossier", "Confirm and pass to the visa officer")}
                              </button>
                            </div>
                          )}
                          <div className="mt-2 space-y-2">
                            {bundle.docs.length === 0 ? (
                              <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
                                {t("Aucun document visa configuré pour ce pays.", "No visa document configured for this country.")}
                              </p>
                            ) : (
                              bundle.docs.map((doc) => (
                                <VisaSalesReviewRow
                                  key={doc.requirementId}
                                  applicationId={bundle.application.id}
                                  doc={doc}
                                  canManage={canManage}
                                  studyDocs={studyDocs}
                                  onReviewed={(updated) => {
                                    setVisaBundles((prev) => prev.map((row) => row.application.id === bundle.application.id
                                      ? { ...row, docs: row.docs.map((item) => (item.requirementId === updated.requirementId ? updated : item)) }
                                      : row));
                                    loadApplications();
                                  }}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              )}

              <section id="candidatures" className="scroll-mt-24">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
                  <GraduationCap className="h-5 w-5 text-brand" /> {t("Candidatures universitaires", "University applications")} ({applications.length})
                </h2>
                <div className="mt-3">
                  <ApplicationTimeline applications={applications} canAct={canActUniversity} canMarkTranslation={isReviewer} onChanged={loadApplications} />
                </div>
              </section>

              {id && <div className="[&>section]:mt-0"><UniversityChoicesPanel studentId={id} onChanged={reloadAfterChoice} readOnly={!isReviewer} /></div>}
            </div>

            {/* Colonne latérale : profil et paiements */}
            <aside className="min-w-0 space-y-6">
              <section id="profil" className="scroll-mt-24 rounded-[24px] border border-line bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
                  <UserRound className="h-5 w-5 text-brand" /> {t("Profil", "Profile")}
                </h2>
                <div className="mt-4 space-y-5">
                  <InfoGroup title={t("Contact", "Contact")}>
                    <InfoRow label={t("Téléphone", "Phone")} value={profile.phone} />
                    <InfoRow label={t("Ville", "City")} value={profile.city} />
                    <InfoRow label={t("Nationalité", "Nationality")} value={profile.nationality} />
                    <InfoRow label={t("Résidence", "Residence")} value={profile.residenceCountry} />
                  </InfoGroup>
                  <InfoGroup title={t("Passeport", "Passport")}>
                    <div className="col-span-2 min-w-0">
                      {profile.passportNumber ? <p className="break-words font-mono text-sm font-semibold tracking-wide text-dark">{profile.passportNumber}</p> : null}
                      <p className="mt-1">
                        <PassportBadge status={profile.passportStatus} expiresOn={profile.passportExpiresOn} monthsLeft={passportMonthsLeft} showDate />
                      </p>
                    </div>
                  </InfoGroup>
                  <InfoGroup title={t("Projet d'études", "Study project")}>
                    <InfoRow label={t("Pays préférés", "Preferred countries")} value={profile.preferredCountries.join(", ")} />
                    <InfoRow label={t("Niveau recherché", "Target level")} value={profile.targetLevel} />
                    <InfoRow label={t("Formation", "Program")} value={profile.targetField} />
                    <InfoRow label={t("Budget annuel", "Annual budget")} value={profile.annualBudget ? `${Number(profile.annualBudget)} €` : ""} />
                  </InfoGroup>
                  <InfoGroup title={t("Parcours et langues", "Background and languages")}>
                    <InfoRow label={t("Niveau actuel", "Current level")} value={profile.currentStudyLevel} />
                    <InfoRow label={t("Dernier diplôme", "Last diploma")} value={profile.lastDiploma} />
                    <InfoRow label={t("Français", "French")} value={profile.languageLevelFrench} />
                    <InfoRow label={t("Anglais", "English")} value={profile.languageLevelEnglish} />
                    {profile.languageTest ? <InfoRow label={t("Test de langue", "Language test")} value={profile.languageTest} /> : null}
                    {profile.languageLevelGerman ? <InfoRow label={t("Allemand", "German")} value={profile.languageLevelGerman} /> : null}
                    {profile.languageLevelItalian ? <InfoRow label={t("Italien", "Italian")} value={profile.languageLevelItalian} /> : null}
                    {profile.languageLevelSpanish ? <InfoRow label={t("Espagnol", "Spanish")} value={profile.languageLevelSpanish} /> : null}
                  </InfoGroup>
                </div>
              </section>

              {id && (role === "SALES" || role === "ADMIN") && (
                <div id="paiements" className="scroll-mt-24 [&>section]:mt-0">
                  <StudentPaymentsPanel studentId={id} onChanged={reloadPayments} compact />
                </div>
              )}
            </aside>
          </div>
        </>
      ) : (
        <FullHistoryTimeline history={history} />
      )}
    </main>
  );
}

// Chronologie de l'audit du dossier (documents, candidature, visa,
// transferts) pour que l'Admin/Sales voie d'un coup d'œil ce qui s'est passé.
function FullHistoryTimeline({ history }: { history: ApplicationHistoryEntry[] }) {
  const { t } = useLanguage();
  const entries = [...history].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

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
          entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-line bg-white px-4 py-2.5 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold text-dark">
                  <History className="h-3.5 w-3.5 shrink-0 text-brand" />
                  {entry.old_status ? `${entry.old_status} → ${entry.new_status}` : entry.new_status}
                </p>
                <p className="shrink-0 text-muted">{fmt(entry.changed_at)}</p>
              </div>
              {entry.comment && <p className="mt-1 text-mid">{entry.comment}</p>}
              <p className="mt-1 text-[11px] text-muted">
                {t("Par", "By")} {entry.changed_by_prenom ? `${entry.changed_by_prenom} ${entry.changed_by_nom}` : t("le système", "the system")}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DocumentReviewRow({
  doc,
  reviewFor,
  onReviewed,
  canReview = true,
  rejectOnly = false,
  onUpload,
  translationMode = "readonly",
  onTranslationChanged,
  studentId
}: {
  /** staff : demander / suivre / valider la traduction ; readonly : simple suivi. */
  translationMode?: "staff" | "readonly";
  onTranslationChanged?: () => void;
  studentId?: string;
  /** Conseiller / admin : dépose un fichier à la place de l'étudiant (validé automatiquement). */
  onUpload?: (file: File) => Promise<StudentDocumentChecklistItem>;
  canReview?: boolean;
  /** Responsable Dossier : peut seulement refuser (avec motif) un document déjà validé. */
  rejectOnly?: boolean;
  doc: StudentDocumentChecklistItem;
  reviewFor: (name: string, status: "VALIDATED" | "REJECTED", reason?: string, universityId?: string | null) => Promise<StudentDocumentChecklistItem>;
  onReviewed: (d: StudentDocumentChecklistItem) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = statusMeta(t)[doc.status];
  const StatusIcon = meta.icon;
  const handleValidate = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await reviewFor(doc.name, "VALIDATED", undefined, doc.universityId);
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
      const updated = await reviewFor(doc.name, "REJECTED", reason.trim(), doc.universityId);
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
      <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }} className="flex cursor-pointer flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-bold text-dark">
              {doc.name}
              {doc.required && <span className="ml-1.5 text-red-500">*</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {doc.universityName ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  <GraduationCap className="h-2.5 w-2.5" /> {doc.universityName}
                </span>
              ) : (
                doc.countries.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    <Globe2 className="h-2.5 w-2.5" /> {c}
                  </span>
                ))
              )}
            </div>
            {open && doc.fileUrl && (
              <span onClick={(e) => e.stopPropagation()} className="block"><button
                type="button"
                onClick={() => openProtectedFile(doc.fileUrl!).catch((err) => setError(err instanceof Error ? err.message : t("Impossible d'ouvrir ce document.", "Unable to open this document.")))}
                className="mt-1 inline-block text-left text-xs text-brand underline"
              >
                {doc.originalFilename || t("Voir le fichier", "View file")}
              </button></span>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.color)}>
            <StatusIcon className="h-3 w-3" /> {meta.label}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </span>
      </div>

      {open && onUpload && (
        <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/20", busy && "pointer-events-none opacity-60")}>
            <Upload className="h-3 w-3" /> {doc.fileUrl ? t("Remplacer le fichier", "Replace the file") : t("Ajouter le document", "Add the document")}
            <input
              type="file"
              className="sr-only"
              accept={doc.acceptedFileTypes === "PDF" ? "application/pdf" : doc.acceptedFileTypes === "IMAGE" ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,application/pdf"}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setBusy(true);
                setError("");
                try {
                  onReviewed(await onUpload(file));
                } catch (err) {
                  setError(err instanceof Error ? err.message : t("Échec de l'envoi.", "Upload failed."));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <span className="text-[11px] text-muted">{t("Le document est validé automatiquement.", "The document is approved automatically.")}</span>
        </div>
      )}

      {open && doc.status === "REJECTED" && doc.rejectionReason && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{t("Motif", "Reason")} : {doc.rejectionReason}</p>
      )}

      {(canReview || rejectOnly) && open && (rejectOnly ? doc.status === "VALIDATED" : doc.status === "SUBMITTED" || doc.status === "REJECTED" || doc.status === "VALIDATED") && (
        <div className="mt-3 space-y-2">
          {!rejecting ? (
            <div className="flex items-center gap-2">
              {!rejectOnly && (
                <button
                  type="button"
                  disabled={busy || doc.status === "VALIDATED"}
                  onClick={handleValidate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60"
                >
                  <ThumbsUp className="h-3 w-3" /> {t("Valider", "Approve")}
                </button>
              )}
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
                placeholder={rejectOnly ? t("Motif du refus (obligatoire, visible par l'étudiant et le conseiller)", "Rejection reason (required, visible to the student and the advisor)") : t("Motif du refus (obligatoire, visible par l'étudiant)", "Rejection reason (required, visible to the student)")}
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
      {open && error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {/* Traduction : le conseiller / l'admin choisit les documents validés qui doivent aussi être traduits. */}
      {doc.translation && <TranslationSlot translation={doc.translation} docName={doc.name} mode={translationMode} onChanged={() => onTranslationChanged?.()} />}
      {open && !doc.translation && doc.status === "VALIDATED" && translationMode === "staff" && studentId && (
        <div className="mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await requestTranslation(studentId, doc.name, doc.universityId);
                onTranslationChanged?.();
              } catch (err) {
                setError(err instanceof Error ? err.message : t("Demande impossible.", "Request failed."));
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
          >
            <Languages className="h-3 w-3" aria-hidden /> {t("Demander la traduction", "Request the translation")}
          </button>
          <span className="ml-2 text-[11px] text-muted">{t("Ouvre un champ « traduction » pour l'étudiant et pour vous.", "Opens a “translation” field for the student and for you.")}</span>
        </div>
      )}
    </div>
  );
}

function VisaSalesReviewRow({
  applicationId,
  doc,
  onReviewed,
  canManage = true,
  studyDocs = []
}: {
  applicationId: string;
  doc: VisaDocumentChecklistItem;
  onReviewed: (d: VisaDocumentChecklistItem) => void;
  canManage?: boolean;
  studyDocs?: ReusableStudyDocument[];
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = statusMeta(t)[doc.status];
  const StatusIcon = meta.icon;
  const canReview = doc.status === "SUBMITTED" || doc.status === "REJECTED";

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }} className="flex cursor-pointer flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-bold text-dark">
              {doc.name}
              {doc.required && <span className="ml-1.5 text-red-500">*</span>}
            </p>
            {open && doc.fileUrl && (
              <span onClick={(e) => e.stopPropagation()} className="block"><button
                type="button"
                onClick={() => openProtectedFile(doc.fileUrl!).catch((err) => setError(err instanceof Error ? err.message : t("Impossible d'ouvrir ce document.", "Unable to open this document.")))}
                className="mt-1 inline-block text-left text-xs text-brand underline"
              >
                {doc.originalFilename || t("Voir le fichier", "View file")}
              </button></span>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", meta.color)}>
            <StatusIcon className="h-2.5 w-2.5" /> {meta.label}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </span>
      </div>
      {open && canManage && studyDocs.length > 0 && (
        <label className="mt-3 block text-xs text-muted">
          {t("Reprendre un document déjà déposé pour l'université", "Reuse a document already filed for the university")}
          <select
            defaultValue=""
            disabled={busy}
            onChange={async (event) => {
              const sourceId = event.target.value;
              event.target.value = "";
              if (!sourceId) return;
              setBusy(true);
              setError("");
              try {
                onReviewed(await reuseStudyDocumentForVisa(applicationId, doc.requirementId, sourceId));
              } catch (err) {
                setError(err instanceof Error ? err.message : t("Erreur.", "Error."));
              } finally {
                setBusy(false);
              }
            }}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-dark"
          >
            <option value="">{t("Choisir un document déjà déposé", "Choose an already filed document")}</option>
            {studyDocs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.universityName ? ` · ${item.universityName}` : ""}{item.originalFilename ? ` · ${item.originalFilename}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {open && canManage && <StaffVisaUploadButton applicationId={applicationId} doc={doc} onUploaded={onReviewed} />}
      {open && canManage && canReview && (
        <div className="mt-3">
          {rejecting ? (
            <div className="space-y-2">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("Motif du refus", "Rejection reason")} className="w-full rounded-lg border border-line px-3 py-2 text-xs" />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
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
                  }}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {t("Confirmer le refus", "Confirm rejection")}
                </button>
                <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-muted">{t("Annuler", "Cancel")}</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    onReviewed(await reviewApplicationVisaDocument(applicationId, doc.requirementId, "VALIDATED"));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : t("Erreur.", "Error."));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
              >
                <ThumbsUp className="h-3 w-3" /> {t("Valider", "Approve")}
              </button>
              <button type="button" onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                <ThumbsDown className="h-3 w-3" /> {t("Refuser", "Reject")}
              </button>
            </div>
          )}
        </div>
      )}
      {open && error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Carte « équipe en charge » dans l'en-tête violet de la fiche étudiant.
function TeamCard({ role, icon: Icon, name, detail, email, phone, empty }: { role: string; icon: typeof Plane; name: string | null; detail?: string | null; email?: string | null; phone?: string | null; empty?: string }) {
  return (
    <div className="rounded-2xl bg-white/12 p-3.5 ring-1 ring-white/20">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70"><Icon className="h-3 w-3" aria-hidden /> {role}</p>
      {name ? (
        <>
          <div className="mt-2 flex items-center gap-2.5">
            <UserAvatar name={name} size="sm" className="h-9 w-9 shrink-0 text-xs ring-2 ring-white/30" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-white">{name}</p>
              {detail && <p className="truncate text-[11px] text-white/75">{detail}</p>}
            </div>
          </div>
          {(email || phone) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {email && (
                <a href={`mailto:${email}`} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/20 transition hover:bg-white/25">
                  <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{email}</span>
                </a>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/20 transition hover:bg-white/25">
                  <Phone className="h-3 w-3 shrink-0" /> {phone}
                </a>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-white/80">{empty}</p>
      )}
    </div>
  );
}
