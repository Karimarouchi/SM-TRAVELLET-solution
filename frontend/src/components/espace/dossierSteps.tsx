import type { UniversityApplication } from "@/lib/auth";
import { Calendar, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export type StepState = "done" | "current" | "upcoming" | "rejected";

export type TimelineStep = {
  key: string;
  label: string;
  state: StepState;
  detail?: ReactNode;
};

type T = (fr: string, en: string) => string;

export type StepsResult = {
  steps: TimelineStep[];
  headline: string;
  tone: "progress" | "success" | "danger";
  doneCount: number;
};

// Étapes du parcours, des documents jusqu'à la décision du visa. L'action
// « J'ai passé mon entretien » est fournie par l'appelant (elle a son état).
export function buildSteps({
  dossierStage,
  application,
  t,
  interviewAction
}: {
  dossierStage: string;
  application: UniversityApplication | null;
  t: T;
  interviewAction?: ReactNode;
}): StepsResult {
  const documentsDone = dossierStage !== "DOCUMENTS";
  const readyDone = Boolean(application);
  const appliedDone = Boolean(application?.appliedAt);
  const isAccepted = application?.status === "ACCEPTED";
  const isRejected = application?.status === "REJECTED" || application?.status === "CLOSED";
  const visaStatus = application?.visaStatus;

  const steps: TimelineStep[] = [
    { key: "documents", label: t("Dépôt des documents", "Document submission"), state: documentsDone ? "done" : "current" },
    { key: "ready", label: t("Dossier prêt à postuler", "File ready to apply"), state: readyDone ? "done" : documentsDone ? "current" : "upcoming" }
  ];

  if (application) {
    steps.push({
      key: "applied",
      label: t("Candidature déposée", "Application submitted"),
      state: appliedDone ? "done" : "current",
      detail: (
        <p className="mt-0.5 text-xs font-semibold text-mid">
          {application.universityName}
          {application.fieldOfStudy ? ` · ${application.fieldOfStudy}` : ""} · {application.countryName}
        </p>
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
            {application.status === "INTERVIEW_SCHEDULED" && interviewAction}
          </div>
        )
      });
    }

    steps.push({
      key: "decision",
      label: isAccepted ? t("Candidature acceptée", "Application accepted") : isRejected ? t("Candidature refusée", "Application rejected") : t("Décision de l'université", "University decision"),
      state: isAccepted ? "done" : isRejected ? "rejected" : appliedDone ? "current" : "upcoming",
      detail: isRejected && application.decisionReason ? (
        <p className="mt-0.5 text-xs text-red-500">{t("Motif", "Reason")} : {application.decisionReason}</p>
      ) : undefined
    });

    if (isAccepted) {
      steps.push({ key: "visa-prep", label: t("Préparation du dossier visa", "Visa file preparation"), state: visaStatus ? "done" : "current" });
      steps.push({
        key: "visa-submitted",
        label: t("Dossier visa déposé", "Visa file submitted"),
        state: visaStatus && ["SUBMITTED", "ACCEPTED", "REJECTED"].includes(visaStatus) ? "done" : visaStatus === "PREPARATION" ? "current" : "upcoming"
      });
      steps.push({
        key: "visa-decision",
        label: visaStatus === "ACCEPTED" ? t("Visa accepté 🎉", "Visa accepted 🎉") : visaStatus === "REJECTED" ? t("Visa refusé", "Visa rejected") : t("Décision du visa", "Visa decision"),
        state: visaStatus === "ACCEPTED" ? "done" : visaStatus === "REJECTED" ? "rejected" : visaStatus === "SUBMITTED" ? "current" : "upcoming",
        detail:
          visaStatus === "REJECTED" && application.visaDecisionReason ? (
            <p className="mt-0.5 text-xs text-red-500">{t("Motif", "Reason")} : {application.visaDecisionReason}</p>
          ) : application.visaPrepMeetingAt || application.visaEmbassyAppointmentAt ? (
            <div className="mt-1 space-y-1">
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

  const current = steps.find((s) => s.state === "current");
  const rejected = [...steps].reverse().find((s) => s.state === "rejected");
  const finished = steps.find((s) => s.key === "visa-decision" && s.state === "done");
  return {
    steps,
    headline: finished ? t("Parcours terminé — visa obtenu", "Journey complete — visa obtained") : rejected ? rejected.label : current ? current.label : t("Dossier en cours", "File in progress"),
    tone: finished ? "success" : rejected ? "danger" : "progress",
    doneCount: steps.filter((s) => s.state === "done").length
  };
}
