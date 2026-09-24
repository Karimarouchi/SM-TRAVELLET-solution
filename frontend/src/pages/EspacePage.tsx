import DocumentsSummaryCard from "@/components/DocumentsSummaryCard";
import { openAdvisorChat } from "@/lib/advisor-chat";
import {
  completeApplicationInterview,
  fetchMe,
  fetchMyApplications,
  fetchMyDocuments,
  fetchMyVisaChecklist,
  getSession,
  submitStudentAvis,
  type StudentDocumentChecklistItem,
  type UniversityApplication,
  type VisaDocumentChecklistItem
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Check, ExternalLink, FolderOpen, GraduationCap, MessageSquare, Plane, Rocket, UserRound, Star, Send, X } from "lucide-react";

type StepState = "done" | "current" | "upcoming" | "rejected";

type TimelineStep = {
  key: string;
  label: string;
  state: StepState;
  detail?: React.ReactNode;
};

const STATE_STYLES: Record<StepState, { dot: string; ring: string; label: string; line: string }> = {
  done: { dot: "bg-emerald-500 text-white", ring: "", label: "text-dark", line: "bg-emerald-400" },
  current: { dot: "bg-brand text-white", ring: "ring-4 ring-brand/20", label: "text-dark", line: "bg-line" },
  upcoming: { dot: "bg-slate-100 text-slate-300 border-2 border-line", ring: "", label: "text-muted", line: "bg-line" },
  rejected: { dot: "bg-red-500 text-white", ring: "ring-4 ring-red-100", label: "text-dark", line: "bg-line" }
};

function StepDot({ state, index }: { state: StepState; index: number }) {
  const styles = STATE_STYLES[state];
  return (
    <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${styles.dot} ${styles.ring}`}>
      {state === "done" ? <Check className="h-4 w-4" /> : state === "rejected" ? <X className="h-4 w-4" /> : index + 1}
    </div>
  );
}

// Timeline verticale unique, du dépôt des documents jusqu'à la décision
// visa : l'étudiant voit en un coup d'œil où il en est exactement.
function DossierProgress({ dossierStage, application, onRefresh }: { dossierStage: string; application: UniversityApplication | null; onRefresh: () => void }) {
  const { t } = useLanguage();
  const [completingInterview, setCompletingInterview] = useState(false);
  const [interviewError, setInterviewError] = useState("");
  const documentsDone = dossierStage !== "DOCUMENTS";
  const readyDone = Boolean(application);
  const appliedDone = Boolean(application?.appliedAt);
  const isAccepted = application?.status === "ACCEPTED";
  const isRejected = application?.status === "REJECTED" || application?.status === "CLOSED";
  const visaStatus = application?.visaStatus;

  const steps: TimelineStep[] = [
    {
      key: "documents",
      label: t("Dépôt des documents", "Document submission"),
      state: documentsDone ? "done" : "current"
    },
    {
      key: "ready",
      label: t("Dossier prêt à postuler", "File ready to apply"),
      state: readyDone ? "done" : documentsDone ? "current" : "upcoming"
    }
  ];

  if (application) {
    steps.push({
      key: "applied",
      label: t("Candidature déposée", "Application submitted"),
      state: appliedDone ? "done" : "current",
      detail: (
        <p className="mt-1 text-xs font-semibold text-mid">{application.universityName} · {application.countryName}</p>
      )
    });

    if (application.interviewDate) {
      steps.push({
        key: "interview",
        label: t("Entretien université", "University interview"),
        state: application.status === "INTERVIEW_SCHEDULED" ? "current" : "done",
        detail: (
          <div className="mt-1.5 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
            <p className="flex items-center gap-1.5 font-semibold">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {new Date(application.interviewDate).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {application.interviewLink && (
              <a href={application.interviewLink} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 underline">
                <ExternalLink className="h-3 w-3" /> {t("Rejoindre", "Join")}
              </a>
            )}
            {application.interviewInstructions && <p className="mt-1">{application.interviewInstructions}</p>}
            {application.status === "INTERVIEW_SCHEDULED" && (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={completingInterview}
                  onClick={async () => {
                    setCompletingInterview(true);
                    setInterviewError("");
                    try {
                      await completeApplicationInterview(application.id);
                      onRefresh();
                    } catch (err) {
                      setInterviewError(err instanceof Error ? err.message : t("Erreur.", "Error."));
                    } finally {
                      setCompletingInterview(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" /> {t("J'ai passé mon entretien", "I've had my interview")}
                </button>
                {interviewError && <p className="mt-1 text-[11px] text-red-500">{interviewError}</p>}
              </div>
            )}
          </div>
        )
      });
    }

    steps.push({
      key: "decision",
      label: isAccepted
        ? t("Candidature acceptée", "Application accepted")
        : isRejected
          ? t("Candidature refusée", "Application rejected")
          : t("Décision de l'université", "University decision"),
      state: isAccepted ? "done" : isRejected ? "rejected" : appliedDone ? "current" : "upcoming",
      detail: isRejected && application.decisionReason ? (
        <p className="mt-1 text-xs text-red-500">{t("Motif", "Reason")} : {application.decisionReason}</p>
      ) : undefined
    });

    if (isAccepted) {
      steps.push({
        key: "visa-prep",
        label: t("Préparation du dossier visa", "Visa file preparation"),
        state: visaStatus ? "done" : "current"
      });
      steps.push({
        key: "visa-submitted",
        label: t("Dossier visa déposé", "Visa file submitted"),
        state: visaStatus && ["SUBMITTED", "ACCEPTED", "REJECTED"].includes(visaStatus)
          ? "done"
          : visaStatus === "PREPARATION"
            ? "current"
            : "upcoming"
      });
      steps.push({
        key: "visa-decision",
        label: visaStatus === "ACCEPTED"
          ? t("Visa accepté 🎉", "Visa accepted 🎉")
          : visaStatus === "REJECTED"
            ? t("Visa refusé", "Visa rejected")
            : t("Décision du visa", "Visa decision"),
        state: visaStatus === "ACCEPTED" ? "done" : visaStatus === "REJECTED" ? "rejected" : visaStatus === "SUBMITTED" ? "current" : "upcoming",
        detail: visaStatus === "REJECTED" && application.visaDecisionReason ? (
          <p className="mt-1 text-xs text-red-500">{t("Motif", "Reason")} : {application.visaDecisionReason}</p>
        ) : (application.visaPrepMeetingAt || application.visaEmbassyAppointmentAt) ? (
          <div className="mt-1.5 space-y-1">
            {application.visaPrepMeetingAt && (
              <p className="text-xs text-violet-600">
                {t("Réunion de préparation", "Prep meeting")} : {new Date(application.visaPrepMeetingAt).toLocaleString("fr-FR")}
                {application.visaPrepMeetingLocation && application.visaPrepMeetingType === "ONLINE" && (
                  <> · <a href={application.visaPrepMeetingLocation} target="_blank" rel="noreferrer" className="underline">{t("lien", "link")}</a></>
                )}
                {application.visaPrepMeetingLocation && application.visaPrepMeetingType === "IN_PERSON" && <> · {application.visaPrepMeetingLocation}</>}
              </p>
            )}
            {application.visaEmbassyAppointmentAt && (
              <p className="text-xs text-amber-600">
                {t("Rendez-vous ambassade", "Embassy appointment")} : {new Date(application.visaEmbassyAppointmentAt).toLocaleString("fr-FR")}
              </p>
            )}
          </div>
        ) : undefined
      });
    }
  }

  const currentStep = steps.find((s) => s.state === "current");
  const rejectedStep = [...steps].reverse().find((s) => s.state === "rejected");
  const finalStep = steps.find((s) => s.key === "visa-decision" && s.state === "done");

  const headlineLabel = finalStep
    ? t("Parcours terminé — visa obtenu", "Journey complete — visa obtained")
    : rejectedStep
      ? rejectedStep.label
      : currentStep
        ? currentStep.label
        : t("Dossier en cours", "File in progress");

  return (
    <section className="mt-6 overflow-hidden rounded-[24px] border border-line bg-white shadow-sm">
      <div className="flex items-center gap-3 bg-gradient-to-r from-brand/5 to-violet-50 px-6 py-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
          {finalStep ? <Plane className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-dark">{t("Où en est mon dossier ?", "Where is my file at?")}</h2>
          <p className={`mt-0.5 text-sm font-semibold ${rejectedStep ? "text-red-500" : "text-brand"}`}>{headlineLabel}</p>
        </div>
      </div>

      <div className="px-6 py-6">
        {steps.map((step, index) => {
          const styles = STATE_STYLES[step.state];
          const isLast = index === steps.length - 1;
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepDot state={step.state} index={index} />
                {!isLast && <div className={`w-0.5 flex-1 ${styles.line}`} style={{ minHeight: "1.75rem" }} />}
              </div>
              <div className={isLast ? "pb-0" : "pb-5"}>
                <p className={`pt-1 text-sm font-semibold ${styles.label}`}>{step.label}</p>
                {step.detail}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function EspacePage() {
  const { t } = useLanguage();
  const session = getSession();
  const [salesName, setSalesName] = useState(session?.profile?.assignedSalesName || "");
  const [dossierStage, setDossierStage] = useState(session?.profile?.dossierStage || "DOCUMENTS");
  const [applications, setApplications] = useState<UniversityApplication[]>([]);
  const [documents, setDocuments] = useState<StudentDocumentChecklistItem[]>([]);
  const [visaDocuments, setVisaDocuments] = useState<VisaDocumentChecklistItem[]>([]);
  const [visaCountryName, setVisaCountryName] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [programme, setProgramme] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const loadApplications = () => {
    fetchMe()
      .then((data) => {
        setSalesName(data.profile?.assignedSalesName || "");
        setDossierStage(data.profile?.dossierStage || "DOCUMENTS");
      })
      .catch(() => undefined);
    fetchMyApplications().then(setApplications).catch(() => undefined);
    fetchMyDocuments().then(setDocuments).catch(() => undefined);
    fetchMyVisaChecklist()
      .then((data) => {
        setVisaCountryName(data.application?.countryName || "");
        setVisaDocuments(data.checklist);
      })
      .catch(() => undefined);
  };

  useEffect(() => { loadApplications(); }, []);

  const activeApplication = applications.find((a) => a.status !== "CLOSED") || applications[0] || null;

  if (!session?.user) return null;

  const { user } = session;
  const hasAdvisor = Boolean(session.profile?.assignedSalesId || salesName);

  const handleAvisSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    setSubmitStatus("loading");
    try {
      await submitStudentAvis({ rating, content, programme });
      setSubmitStatus("success");
      setContent("");
      setProgramme("");
      setRating(5);
    } catch (err) {
      setSubmitStatus("error");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">{t("Espace étudiant", "Student area")}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">{t("Bienvenue", "Welcome")}, {user.prenom}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          {t(
            "Votre compte est prêt. Écrivez à votre conseiller, consultez votre profil ou lancez l’accélérateur.",
            "Your account is ready. Message your advisor, check your profile, or launch the accelerator."
          )}
        </p>
      </section>

      <DossierProgress dossierStage={dossierStage} application={activeApplication} onRefresh={loadApplications} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <DocumentsSummaryCard
          icon={FolderOpen}
          title={t("Documents", "Documents")}
          subtitle={t("Checklist des documents requis pour votre inscription.", "Checklist of documents required for your enrollment.")}
          total={documents.length}
          done={documents.filter((d) => d.status === "SUBMITTED" || d.status === "VALIDATED").length}
          doneLabel={t("déposés", "uploaded")}
          emptyLabel={t("Choisissez un pays préféré dans votre profil pour voir la liste.", "Choose a preferred country in your profile to see the list.")}
          to="/documents"
        />
        {activeApplication?.visaStatus && (
          <DocumentsSummaryCard
            icon={Plane}
            title={t("Documents visa", "Visa documents")}
            subtitle={t(
              `Documents requis pour votre demande de visa${visaCountryName ? ` · ${visaCountryName}` : ""}.`,
              `Documents required for your visa application${visaCountryName ? ` · ${visaCountryName}` : ""}.`
            )}
            total={visaDocuments.length}
            done={visaDocuments.filter((d) => d.status === "VALIDATED").length}
            doneLabel={t("validés", "approved")}
            emptyLabel={t("Aucun document visa requis pour l'instant.", "No visa document required yet.")}
            to="/documents?tab=visa"
          />
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={openAdvisorChat}
          className="rounded-[20px] border border-brand/20 bg-white p-6 text-left shadow-[0_10px_28px_rgba(109,40,217,.08)] transition hover:-translate-y-1 hover:shadow-lg"
        >
          <MessageSquare className="mb-3 h-8 w-8 text-brand" />
          <h2 className="font-display text-xl font-bold">{t("Messages", "Messages")}</h2>
          <p className="mt-2 text-sm text-muted">
            {hasAdvisor
              ? t(`Ouvrir le chat avec ${salesName || "votre conseiller"}.`, `Open chat with ${salesName || "your advisor"}.`)
              : t("Ouvrir le chat avec le conseiller chargé de votre dossier.", "Open chat with the advisor handling your file.")}
          </p>
        </button>
        <Link to="/profil" className="rounded-[20px] border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
          <UserRound className="mb-3 h-8 w-8 text-brand" />
          <h2 className="font-display text-xl font-bold">{t("Profil", "Profile")}</h2>
          <p className="mt-2 text-sm text-muted">{t("Consultez et suivez vos informations personnelles.", "View and manage your personal information.")}</p>
        </Link>
        <Link to="/documents" className="rounded-[20px] border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
          <FolderOpen className="mb-3 h-8 w-8 text-brand" />
          <h2 className="font-display text-xl font-bold">{t("Documents", "Documents")}</h2>
          <p className="mt-2 text-sm text-muted">{t("Déposez les documents requis pour votre/vos pays de destination.", "Upload the documents required for your destination country/countries.")}</p>
        </Link>
        <Link to="/accelerateur" className="rounded-[20px] border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
          <Rocket className="mb-3 h-8 w-8 text-brand" />
          <h2 className="font-display text-xl font-bold">{t("Accélérateur", "Accelerator")}</h2>
          <p className="mt-2 text-sm text-muted">{t("Un parcours guidé pour accélérer votre projet d’études.", "A guided path to speed up your study project.")}</p>
        </Link>
      </div>

      {/* Donner un avis section */}
      <section className="mt-8 rounded-[24px] border border-line bg-white p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="font-display text-xl font-bold text-dark">{t("Partagez votre expérience", "Share your experience")}</h2>
          <p className="text-sm text-muted mt-1">
            {t(
              "Votre avis compte ! Aidez d'autres étudiants en partageant votre expérience avec SM Travel. Il sera publié sur notre vitrine après validation.",
              "Your review matters! Help other students by sharing your experience with SM Travel. It will be published on our website after moderation."
            )}
          </p>
        </div>

        {submitStatus === "success" ? (
          <div className="rounded-xl bg-emerald-50 p-6 text-center border border-emerald-100">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
              <Star className="h-6 w-6 fill-current" />
            </div>
            <h3 className="font-bold text-emerald-800 text-lg">{t("Merci pour votre avis !", "Thank you for your review!")}</h3>
            <p className="text-sm text-emerald-600 mt-1">{t("Il est en cours de modération et sera bientôt publié sur notre site.", "It is being moderated and will soon be published on our website.")}</p>
            <button
              onClick={() => setSubmitStatus("idle")}
              className="mt-4 text-sm font-bold text-brand hover:underline"
            >
              {t("Soumettre un autre avis", "Submit another review")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleAvisSubmit} className="max-w-2xl">
            <div className="mb-5 flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">{t("Note globale", "Overall rating")}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${star <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300 hover:text-amber-200"}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">{t("Programme / Destination (Optionnel)", "Program / Destination (Optional)")}</label>
              <input
                type="text"
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                placeholder={t("Ex: Master en Informatique à Malte", "E.g. Master in Computer Science in Malta")}
                className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <div className="mb-6 flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">{t("Votre témoignage *", "Your testimonial *")}</label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("Racontez-nous comment s'est passé votre accompagnement...", "Tell us how your support experience went...")}
                rows={4}
                className="resize-none rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <div className="flex items-center justify-between">
              {submitStatus === "error" && (
                <span className="text-sm font-bold text-red-500">{t("Une erreur est survenue. Veuillez réessayer.", "Something went wrong. Please try again.")}</span>
              )}
              <div className="flex-1" />
              <button
                type="submit"
                disabled={submitStatus === "loading"}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-xl hover:shadow-brand/30 disabled:opacity-50"
              >
                {submitStatus === "loading" ? t("Envoi en cours...", "Sending...") : (
                  <>{t("Envoyer mon avis", "Submit my review")} <Send className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
