import {
  acceptApplication,
  assignApplicationRdv,
  closeApplication,
  completeApplicationInterview,
  fetchCountryUniversities,
  fetchRdvSuggestion,
  fetchRdvUsers,
  markApplicationApplied,
  reapplyApplication,
  rejectApplication,
  scheduleApplicationInterview,
  type ApplicationStatus,
  type CountryUniversity,
  type RdvUser,
  type UniversityApplication
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Send,
  ThumbsDown,
  ThumbsUp,
  UserCog,
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
  CLOSED: { label: "Clôturé", color: "bg-slate-100 text-slate-500 border-slate-200" }
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
  const [modal, setModal] = useState<null | "apply" | "interview" | "reject" | "reapply" | "transfer-rdv">(null);
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
            <p className="text-sm font-bold text-dark">{app.universityName}</p>
            <p className="text-xs text-muted">{app.countryName}{app.programmeTitle ? ` · ${app.programmeTitle}` : ""}</p>
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.color)}>
          {meta.label}
        </span>
      </div>

      {app.appliedAt && (
        <p className="mt-2 text-xs text-muted">Déposée le {fmt(app.appliedAt)}{app.applicationReference ? ` · Réf. ${app.applicationReference}` : ""}</p>
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
      {app.status === "ACCEPTED" && (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Accepté le {fmt(app.decisionAt)}{app.acceptanceReference ? ` · Réf. ${app.acceptanceReference}` : ""}
          {app.assignedRdvId ? " · Dossier transféré au Responsable Visa" : " · Dossier visa pas encore transféré"}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {canAct && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {app.status === "READY_TO_APPLY" && (
            <button type="button" disabled={busy} onClick={() => setModal("apply")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
              <Send className="h-3 w-3" /> Marquer comme candidature déposée
            </button>
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
          {app.status === "ACCEPTED" && !app.assignedRdvId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setModal("transfer-rdv")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
            >
              <UserCog className="h-3 w-3" /> Transférer au Responsable Dossier Visa
            </button>
          )}
          {app.status === "REJECTED" && (
            <>
              <button type="button" disabled={busy} onClick={() => act(() => closeApplication(app.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-dark hover:bg-slate-200">
                <XCircle className="h-3 w-3" /> Clôturer le parcours universitaire
              </button>
              <button type="button" disabled={busy} onClick={() => setModal("reapply")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                <Send className="h-3 w-3" /> Postuler dans une autre université
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
      {modal === "reapply" && (
        <ReapplyModal app={app} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
      {modal === "transfer-rdv" && (
        <TransferRdvModal app={app} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
    </div>
  );
}

function TransferRdvModal({ app, onClose, onDone }: { app: UniversityApplication; onClose: () => void; onDone: () => void }) {
  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [rdvUsers, setRdvUsers] = useState<RdvUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [override, setOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchRdvSuggestion(app.id), fetchRdvUsers()])
      .then(([suggestion, users]) => {
        setSuggestedId(suggestion.rdvUserId);
        setSuggestedName(suggestion.rdvName);
        setFallback(suggestion.fallback);
        setRdvUsers(users.filter((u) => u.isActive));
        setSelectedId(suggestion.rdvUserId || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur."))
      .finally(() => setLoading(false));
  }, [app.id]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await assignApplicationRdv(app.id, selectedId || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Transférer au Responsable Dossier Visa" onClose={onClose}>
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
        ) : suggestedId ? (
          <>
            <div className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Dossier transféré à</p>
              <p className="mt-0.5 text-sm font-bold text-dark">{suggestedName}</p>
            </div>
            {fallback && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Aucun RDV n'est spécialisé pour ce pays : le dossier est réparti équitablement, au RDV actif le moins chargé, toutes destinations confondues.</p>
              </div>
            )}
            {!override ? (
              <button type="button" onClick={() => setOverride(true)} className="text-xs font-bold text-brand hover:underline">
                Choisir un autre Responsable Visa
              </button>
            ) : (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Responsable Visa</label>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                  {rdvUsers.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            Aucun Responsable Dossier Visa actif n'existe pour l'instant. Créez-en un depuis Sales &gt; Responsables Visa.
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={busy || loading || !selectedId} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Confirmer le transfert</button>
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

function ApplyModal({ app, onClose, onDone }: { app: UniversityApplication; onClose: () => void; onDone: () => void }) {
  const [universities, setUniversities] = useState<CountryUniversity[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState(true);
  const [universityId, setUniversityId] = useState(app.universityId);
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUniversitiesLoading(true);
    fetchCountryUniversities(app.countryId)
      .then(setUniversities)
      .catch(() => setUniversities([]))
      .finally(() => setUniversitiesLoading(false));
  }, [app.countryId]);

  const selectedName = universities.find((u) => u.id === universityId)?.name || app.universityName;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await markApplicationApplied(app.id, { universityId, appliedAt, applicationReference: reference || undefined, notes: notes || undefined });
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
          <p className="mt-0.5 text-sm font-bold text-dark">{selectedName || "—"}</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Université *</label>
          {universitiesLoading ? (
            <div className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-muted">Chargement...</div>
          ) : universities.filter((u) => u.active).length === 0 ? (
            <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Aucune université active configurée pour ce pays. Ajoutez-en une depuis l'onglet Programmes &gt; Universités.
            </div>
          ) : (
            <select value={universityId} onChange={(e) => setUniversityId(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
              {universities.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Date de dépôt *</label>
          <input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-muted">Référence candidature</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetchCountryUniversities(app.countryId).then((list) => { setUniversities(list); setUniversityId(list.find((u) => u.id !== app.universityId)?.id || ""); }).catch(() => setUniversities([])); }, [app.countryId, app.universityId]);

  const submit = async () => {
    if (!universityId) return;
    setBusy(true);
    setError("");
    try {
      await reapplyApplication(app.id, { universityId });
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
            <option value="">Choisir...</option>
            {universities.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={busy || !universityId} onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Créer la candidature</button>
        </div>
      </div>
    </ModalShell>
  );
}
