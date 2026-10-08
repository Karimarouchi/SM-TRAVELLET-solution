import {
  acceptApplication,
  closeApplication,
  completeApplicationInterview,
  formatMoney,
  postponeApplication,
  retryPostponedApplication,
  fetchCountryUniversities,
  markApplicationApplied,
  reapplyApplication,
  rejectApplication,
  scheduleApplicationInterview,
  scheduleStaffMeet,
  type ApplicationStatus,
  type CountryUniversity,
  type UniversityApplication
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { MeetLinkButton } from "@/components/MeetLinkButton";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  ExternalLink,
  GraduationCap,
  Send,
  ThumbsDown,
  ThumbsUp,
  Video,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";

const STATUS_META: Record<ApplicationStatus, { label: string; color: string }> = {
  READY_TO_APPLY: { label: "Prêt à postuler", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  APPLIED: { label: "Déposée", color: "bg-blue-50 text-blue-700 border-blue-200" },
  WAITING_UNIVERSITY_RESPONSE: { label: "En attente de l'université", color: "bg-amber-50 text-amber-700 border-amber-200" },
  INTERVIEW_REQUIRED: { label: "Entretien demandé", color: "bg-violet-50 text-violet-700 border-violet-200" },
  INTERVIEW_SCHEDULED: { label: "Entretien planifié", color: "bg-violet-50 text-violet-700 border-violet-200" },
  INTERVIEW_COMPLETED: { label: "Entretien terminé", color: "bg-violet-50 text-violet-700 border-violet-200" },
  ACCEPTED: { label: "Accepté", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Refusé", color: "bg-red-50 text-red-600 border-red-200" },
  CLOSED: { label: "Clôturé", color: "bg-slate-100 text-slate-500 border-slate-200" },
  POSTPONED: { label: "Reporté", color: "bg-orange-50 text-orange-700 border-orange-200" }
};

function fmt(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ApplicationTimeline({
  applications,
  canAct,
  onChanged
}: {
  applications: UniversityApplication[];
  canAct: boolean;
  onChanged: () => void;
}) {
  if (!applications.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
        Aucune candidature universitaire pour l'instant — elle apparaîtra automatiquement dès que tous les documents obligatoires seront validés.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <ApplicationCard key={app.id} app={app} canAct={canAct} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ApplicationCard({ app, canAct, onChanged }: { app: UniversityApplication; canAct: boolean; onChanged: () => void }) {
  // La liste du RDV mélange plusieurs étudiants : leur nom est joint à chaque candidature.
  const studentName = (app as UniversityApplication & { studentName?: string }).studentName;
  const [modal, setModal] = useState<null | "apply" | "interview" | "reject" | "reapply" | "meet" | "postpone">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = STATUS_META[app.status];

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            {studentName && <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">{studentName}</p>}
            <p className="text-sm font-bold text-dark">{app.universityName}{app.fieldOfStudy ? ` · ${app.fieldOfStudy}` : ""}</p>
            <p className="text-xs text-muted">{app.countryName}{app.programmeTitle ? ` · ${app.programmeTitle}` : ""}</p>
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.color)}>
          {meta.label}
        </span>
      </div>

      {app.status === "READY_TO_APPLY" && app.registrationPaymentDue && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Paiement de l'inscription non réglé : il reste {formatMoney(app.registrationPaymentDue.remaining, app.registrationPaymentDue.currency)}. Le dépôt de la candidature est bloqué, prévenez le conseiller.
        </p>
      )}
      {app.assignedRdvName && app.status !== "CLOSED" && (
        <p className="mt-2 text-xs text-muted">Suivie par le Responsable Dossier <span className="font-semibold text-dark">{app.assignedRdvName}</span></p>
      )}
      {app.appliedAt && (
        <p className="mt-2 text-xs text-muted">Déposée le {fmt(app.appliedAt)}{app.applicationReference ? ` · Réf. ${app.applicationReference}` : ""}</p>
      )}
      {app.portalLogin && (
        <PortalAccount app={app} />
      )}
      {app.interviewDate && (app.status === "INTERVIEW_SCHEDULED" || app.status === "WAITING_UNIVERSITY_RESPONSE") && (
        <div className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
          <p className="flex items-center gap-1.5 font-semibold"><Calendar className="h-3.5 w-3.5" /> Entretien : {fmtDateTime(app.interviewDate)}</p>
          {app.interviewLink && (
            <a href={app.interviewLink} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 underline">
              <ExternalLink className="h-3 w-3" /> {app.interviewLink}
            </a>
          )}
          {app.interviewInstructions && <p className="mt-1">{app.interviewInstructions}</p>}
        </div>
      )}
      {app.status === "REJECTED" && app.decisionReason && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">Motif du refus : {app.decisionReason}</p>
      )}
      {app.status === "POSTPONED" && (
        <div className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <CalendarClock className="h-3.5 w-3.5" />
            {app.postponedKind === "VISA" ? "Visa à redéposer" : "Candidature à retenter"} le {app.retryOn ? fmt(app.retryOn) : "—"}
            {app.retryIntake ? ` · rentrée ${app.retryIntake}` : ""}
          </p>
          {app.decisionReason && <p className="mt-1">Dernier refus : {app.postponedKind === "VISA" ? app.visaDecisionReason || app.decisionReason : app.decisionReason}</p>}
          {app.postponedNote && <p className="mt-1">{app.postponedNote}</p>}
          <p className="mt-1 text-[11px] text-orange-700/80">Ce dossier est hors du suivi courant : aucune tâche ni retard n'est compté avant la relance.</p>
        </div>
      )}
      {(app.attemptNumber || 1) > 1 && app.status !== "POSTPONED" && (
        <p className="mt-2 text-[11px] font-semibold text-muted">Tentative n°{app.attemptNumber}</p>
      )}
      {app.staffMeetAt && app.status === "READY_TO_APPLY" && (
        <div className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
          <p className="flex items-center gap-1.5 font-semibold"><Video className="h-3.5 w-3.5" /> Meet optionnel : {fmtDateTime(app.staffMeetAt)}</p>
          {app.staffMeetLink && (
            <a href={app.staffMeetLink} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 underline">
              <ExternalLink className="h-3 w-3" /> {app.staffMeetLink}
            </a>
          )}
          {app.staffMeetInstructions && <p className="mt-1">{app.staffMeetInstructions}</p>}
        </div>
      )}
      {app.status === "ACCEPTED" && (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Accepté le {fmt(app.decisionAt)}{app.acceptanceReference ? ` · Réf. ${app.acceptanceReference}` : ""}
          {app.visaStatus
            ? " · Dossier visa chez le Responsable Visa"
            : " · Documents visa à valider par le conseiller"}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {canAct && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {app.status === "READY_TO_APPLY" && (
            <>
              <button type="button" disabled={busy} onClick={() => setModal("meet")} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100">
                <Video className="h-3 w-3" /> {app.staffMeetAt ? "Modifier le Meet (optionnel)" : "Planifier un Meet (optionnel)"}
              </button>
              <button type="button" disabled={busy || Boolean(app.registrationPaymentDue)} title={app.registrationPaymentDue ? "Paiement de l'inscription non réglé." : undefined} onClick={() => setModal("apply")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                <Send className="h-3 w-3" /> Marquer comme candidature déposée
              </button>
            </>
          )}
          {(app.status === "WAITING_UNIVERSITY_RESPONSE" || app.status === "INTERVIEW_SCHEDULED") && (
            <>
              {app.status === "WAITING_UNIVERSITY_RESPONSE" && (
                <button type="button" disabled={busy} onClick={() => setModal("interview")} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100">
                  <Calendar className="h-3 w-3" /> Entretien demandé
                </button>
              )}
              {app.status === "INTERVIEW_SCHEDULED" && (
                <>
                  <button type="button" disabled={busy} onClick={() => setModal("interview")} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100">
                    <Calendar className="h-3 w-3" /> Modifier l'entretien
                  </button>
                  <button type="button" disabled={busy} onClick={() => act(() => completeApplicationInterview(app.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-dark hover:bg-slate-200">
                    <CheckCircle2 className="h-3 w-3" /> Entretien terminé
                  </button>
                </>
              )}
              <button type="button" disabled={busy} onClick={() => act(() => acceptApplication(app.id, {}))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                <ThumbsUp className="h-3 w-3" /> Étudiant accepté
              </button>
              <button type="button" disabled={busy} onClick={() => setModal("reject")} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                <ThumbsDown className="h-3 w-3" /> Refusé par l'université
              </button>
            </>
          )}
          {app.status === "REJECTED" && (
            <>
              <button type="button" disabled={busy} onClick={() => act(() => closeApplication(app.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-dark hover:bg-slate-200">
                <XCircle className="h-3 w-3" /> Clôturer le parcours universitaire
              </button>
              <button type="button" disabled={busy} onClick={() => setModal("postpone")} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100">
                <CalendarClock className="h-3 w-3" /> Reporter à une date
              </button>
              <button type="button" disabled={busy} onClick={() => setModal("reapply")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                <Send className="h-3 w-3" /> Postuler dans une autre université
              </button>
            </>
          )}
          {app.status === "POSTPONED" && (
            <>
              <button type="button" disabled={busy} onClick={() => act(() => retryPostponedApplication(app.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                <RotateCcw className="h-3 w-3" /> {app.postponedKind === "VISA" ? "Relancer le visa maintenant" : "Relancer la candidature maintenant"}
              </button>
              <button type="button" disabled={busy} onClick={() => setModal("postpone")} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100">
                <CalendarClock className="h-3 w-3" /> Changer la date
              </button>
              <button type="button" disabled={busy} onClick={() => act(() => closeApplication(app.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-dark hover:bg-slate-200">
                <XCircle className="h-3 w-3" /> Abandonner
              </button>
            </>
          )}
        </div>
      )}

      {modal === "apply" && (
        <ApplyModal app={app} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
      {modal === "interview" && (
        <InterviewModal app={app} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
      {modal === "reject" && (
        <ReasonModal
          title="Refuser cette candidature"
          onClose={() => setModal(null)}
          onSubmit={async (reason) => { await rejectApplication(app.id, reason); setModal(null); onChanged(); }}
        />
      )}
      {modal === "postpone" && (
        <PostponeModal app={app} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
      {modal === "reapply" && (
        <ReapplyModal app={app} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
      {modal === "meet" && (
        <StaffMeetModal app={app} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
    </div>
  );
}

// Report d'un refus : date de la nouvelle tentative (obligatoire) + rentrée visée.
export function PostponeModal({ app, onClose, onDone }: { app: UniversityApplication; onClose: () => void; onDone: () => void }) {
  const isVisa = app.visaStatus === "REJECTED";
  const [retryOn, setRetryOn] = useState(app.retryOn || "");
  const [intake, setIntake] = useState(app.retryIntake || "");
  const [note, setNote] = useState(app.postponedNote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    if (!retryOn) { setError("La date de la nouvelle tentative est obligatoire."); return; }
    setBusy(true);
    setError("");
    try {
      await postponeApplication(app.id, { retryOn, intake: intake.trim() || undefined, note: note.trim() || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setBusy(false);
    }
  };

  return (
    <ModalShell title={isVisa ? "Reporter le visa" : "Reporter la candidature"} onClose={onClose}>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-muted">
          {isVisa ? "Le visa pourra être redéposé à la date choisie." : `${app.universityName} pourra être retentée à la prochaine session.`}{" "}
          Le dossier sort du suivi courant (aucun retard ni tâche) et un rappel est envoyé avant la date.
        </p>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Date de la nouvelle tentative *</label>
          <input type="date" min={today} value={retryOn} onChange={(e) => setRetryOn(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Rentrée visée</label>
          <input type="text" maxLength={120} value={intake} onChange={(e) => setIntake(e.target.value)} placeholder="Ex. Septembre 2027" className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Note</label>
          <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={busy || !retryOn} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Reporter</button>
        </div>
      </div>
    </ModalShell>
  );
}

function StaffMeetModal({ app, onClose, onDone }: { app: UniversityApplication; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(app.staffMeetAt ? app.staffMeetAt.slice(0, 16) : "");
  const [link, setLink] = useState(app.staffMeetLink || "");
  const [instructions, setInstructions] = useState(app.staffMeetInstructions || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!date) { setError("La date et l'heure sont obligatoires."); return; }
    if (!link.trim()) { setError("Le lien Meet est obligatoire."); return; }
    setBusy(true);
    setError("");
    try {
      await scheduleStaffMeet(app.id, { date: new Date(date).toISOString(), link: link.trim(), instructions: instructions.trim() || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Meet optionnel avec l'étudiant" onClose={onClose}>
      <p className="mt-1 text-xs text-muted">Ce rendez-vous n'est pas obligatoire : vous pouvez déposer la candidature sans le planifier.</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Date et heure</label>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Lien Meet</label>
          <input type="text" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
          <MeetLinkButton applicationId={app.id} kind="staff" date={date} onCreated={setLink} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Instructions (optionnel)</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Enregistrer</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-bold text-dark">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function PortalAccount({ app }: { app: UniversityApplication }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-muted">
      <p className="font-bold uppercase tracking-wide text-[10px]">Compte sur la plateforme de l'université</p>
      <p className="mt-1">Identifiant : <span className="font-semibold text-dark">{app.portalLogin}</span></p>
      <p className="flex items-center gap-1.5">
        Mot de passe : <span className="font-mono font-semibold text-dark">{show ? app.portalPassword || "—" : "••••••••"}</span>
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Masquer" : "Afficher"} className="rounded-full p-0.5 text-muted transition hover:text-dark">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </p>
      {app.portalUrl && (
        <a href={app.portalUrl} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-brand underline">
          <ExternalLink className="h-3 w-3" /> {app.portalUrl}
        </a>
      )}
    </div>
  );
}

function ApplyModal({ app, onClose, onDone }: { app: UniversityApplication; onClose: () => void; onDone: () => void }) {
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [portalLogin, setPortalLogin] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!portalLogin.trim()) {
      setError("Saisissez l'identifiant (e-mail) du compte créé sur la plateforme de l'université.");
      return;
    }
    if (!portalPassword) {
      setError("Saisissez le mot de passe du compte créé sur la plateforme de l'université.");
      return;
    }
    if (portalUrl.trim() && !/^https?:\/\/\S+$/i.test(portalUrl.trim())) {
      setError("Le lien de la plateforme doit commencer par http:// ou https://.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await markApplicationApplied(app.id, {
        portalLogin: portalLogin.trim(),
        portalPassword,
        portalUrl: portalUrl.trim() || undefined,
        appliedAt,
        notes: notes || undefined
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Marquer comme candidature déposée" onClose={onClose}>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Université visée par l'étudiant</p>
          <p className="mt-0.5 text-sm font-bold text-dark">{app.universityName || "—"}</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Date de dépôt *</label>
          <input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Identifiant du compte (e-mail) *</label>
          <input type="text" autoComplete="off" maxLength={200} value={portalLogin} onChange={(e) => setPortalLogin(e.target.value)} placeholder="E-mail utilisé pour créer le compte sur la plateforme" className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Mot de passe du compte *</label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={200} value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} placeholder="Mot de passe du compte créé" className="w-full rounded-lg border border-line bg-slate-50 py-2 pl-3 pr-10 text-sm" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition hover:text-dark">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Lien de la plateforme de l'université (facultatif)</label>
          <input type="url" maxLength={500} value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Commentaire</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Confirmer la candidature</button>
        </div>
      </div>
    </ModalShell>
  );
}

function InterviewModal({ app, onClose, onDone }: { app: UniversityApplication; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(app.interviewDate ? app.interviewDate.slice(0, 16) : "");
  const [link, setLink] = useState(app.interviewLink || "");
  const [instructions, setInstructions] = useState(app.interviewInstructions || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await scheduleApplicationInterview(app.id, { interviewDate: new Date(date).toISOString(), interviewType: "ONLINE", interviewLink: link || undefined, instructions: instructions || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Entretien avec l'université (en ligne)" onClose={onClose}>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Date et heure *</label>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Lien (Meet/Teams/Zoom) *</label>
          <input type="text" value={link} onChange={(e) => setLink(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
          <MeetLinkButton applicationId={app.id} kind="interview" date={date} onCreated={setLink} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Instructions</label>
          <textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={busy || !date || !link} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Confirmer</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ReasonModal({ title, onClose, onSubmit }: { title: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="mt-4 space-y-3">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (obligatoire, visible par l'étudiant)" className="w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" autoFocus />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onSubmit(reason.trim());
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur.");
                setBusy(false);
              }
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            Confirmer
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ReapplyModal({ app, onClose, onDone }: { app: UniversityApplication; onClose: () => void; onDone: () => void }) {
  const [universities, setUniversities] = useState<CountryUniversity[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const useCustom = universityId === "__other__";

  useEffect(() => {
    fetchCountryUniversities(app.countryId)
      .then((list) => {
        setUniversities(list);
        setUniversityId(list.find((u) => u.id !== app.universityId)?.id || "__other__");
      })
      .catch(() => setUniversities([]));
  }, [app.countryId, app.universityId]);

  const submit = async () => {
    if (useCustom && customName.trim().length < 2) {
      setError("Saisissez le nom de l'université.");
      return;
    }
    if (!useCustom && !universityId) return;
    setBusy(true);
    setError("");
    try {
      await reapplyApplication(app.id, useCustom ? { universityName: customName.trim() } : { universityId });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Postuler dans une autre université" onClose={onClose}>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-muted">L'ancienne candidature ({app.universityName} — Refusé) reste conservée dans l'historique.</p>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Nouvelle université *</label>
          <select value={universityId} onChange={(e) => setUniversityId(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
            <option value="">Choisir</option>
            {universities.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            <option value="__other__">Autre — taper un nom</option>
          </select>
          {useCustom && (
            <input
              type="text"
              maxLength={200}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Nom de l'université"
              className="mt-2 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
            />
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={busy || (!useCustom && !universityId) || (useCustom && customName.trim().length < 2)} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Créer la candidature</button>
        </div>
      </div>
    </ModalShell>
  );
}
