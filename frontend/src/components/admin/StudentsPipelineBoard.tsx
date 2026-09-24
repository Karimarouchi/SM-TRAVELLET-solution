import { type PipelineStageKey, type StudentOverview } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Ban, CheckCircle2, ExternalLink, Lock, Unlock, UserRound } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

export const STAGE_META: Record<PipelineStageKey, { label: string; color: string; dot: string }> = {
  onboarding: { label: "Onboarding en cours", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  no_application: { label: "Sans candidature", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  ready_to_apply: { label: "Prêt à postuler", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  applied: { label: "Candidature déposée", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  waiting_response: { label: "En attente université", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  interview: { label: "Entretien", color: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  accepted: { label: "Accepté par l'université", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  visa_preparation: { label: "Visa en préparation", color: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  visa_submitted: { label: "Visa déposé", color: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  completed: { label: "Visa obtenu · Terminé", color: "bg-brand/10 text-brand border-brand/20", dot: "bg-brand" },
  rejected: { label: "Candidature refusée", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
  visa_rejected: { label: "Visa refusé", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" }
};

export function StageBadge({ stage }: { stage: PipelineStageKey }) {
  const meta = STAGE_META[stage];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

// ── Popover partagée : une seule instance pour toutes les bulles ───────────
// Avec une popover locale à chaque bulle, passer rapidement de l'une à
// l'autre laissait l'ancienne se fermer avec son propre délai pendant que la
// nouvelle s'ouvrait déjà : deux popovers visibles en même temps. En centra-
// lisant l'état "bulle survolée" dans un contexte partagé, il n'existe plus
// qu'un seul nœud popover dans le DOM — changer de bulle le déplace au lieu
// d'en empiler un second.
type PopoverState = { student: StudentOverview; coords: { top: number; left: number } } | null;

const PopoverContext = createContext<{
  popover: PopoverState;
  open: (student: StudentOverview, rect: DOMRect) => void;
  scheduleClose: () => void;
  cancelClose: () => void;
} | null>(null);

function usePopoverCtx() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error("usePopoverCtx doit être utilisé sous PipelinePopoverProvider");
  return ctx;
}

function PipelinePopoverProvider({ children }: { children: React.ReactNode }) {
  const [popover, setPopover] = useState<PopoverState>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // Un léger délai avant de fermer : la popover vit dans un portail, donc
  // physiquement hors de la bulle, et il faut laisser au curseur le temps de
  // traverser le petit espace qui les sépare pour atteindre les boutons.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setPopover(null), 200);
  };

  const open = (student: StudentOverview, rect: DOMRect) => {
    cancelClose();
    const POPOVER_HALF_WIDTH = 128;
    const clampedLeft = Math.min(
      Math.max(rect.left + rect.width / 2, POPOVER_HALF_WIDTH + 8),
      window.innerWidth - POPOVER_HALF_WIDTH - 8
    );
    setPopover({ student, coords: { top: rect.bottom + 8, left: clampedLeft } });
  };

  useEffect(() => () => cancelClose(), []);

  return (
    <PopoverContext.Provider value={{ popover, open, scheduleClose, cancelClose }}>
      {children}
    </PopoverContext.Provider>
  );
}

function StudentPopoverCard({
  busyId,
  onToggleBlock
}: {
  busyId: string | null;
  onToggleBlock: (student: StudentOverview) => void;
}) {
  const { popover, cancelClose, scheduleClose } = usePopoverCtx();
  const navigate = useNavigate();
  if (!popover) return null;
  const { student, coords } = popover;
  const busy = busyId === student.id;

  return createPortal(
    <div
      className="fixed z-[999] w-64 -translate-x-1/2 rounded-2xl border border-line bg-white p-4 text-left shadow-2xl"
      style={{ top: coords.top, left: coords.left }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <div className="flex items-center gap-3">
        <UserAvatar name={`${student.prenom} ${student.nom}`} src={student.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-dark">{student.prenom} {student.nom}</p>
          <p className="truncate text-[11px] text-muted">{student.email}</p>
        </div>
      </div>

      <div className="mt-3">
        <StageBadge stage={student.stage} />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-mid">
        <UserRound className="h-3.5 w-3.5 shrink-0 text-brand" />
        {student.assignedSalesName ? (
          <span><span className="font-semibold">{student.assignedSalesName}</span> · Conseiller</span>
        ) : (
          <span className="text-amber-600 font-semibold">Aucun conseiller assigné</span>
        )}
      </p>

      {student.applications.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-line pt-2">
          {student.applications.slice(0, 3).map((app) => (
            <p key={app.id} className="text-[11px] text-muted">
              {app.countryName} · {app.universityName}
              {app.visaStatus ? ` · Visa: ${app.visaStatus}` : ""}
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
          student.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        )}>
          {student.isActive ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
          {student.isActive ? "Actif" : "Bloqué"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleBlock(student)}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition disabled:opacity-50",
            student.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          )}
        >
          {student.isActive ? <><Ban className="h-3 w-3" /> Bloquer</> : <><Unlock className="h-3 w-3" /> Débloquer</>}
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/conseiller/etudiants/${student.id}`)}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90"
      >
        <ExternalLink className="h-3 w-3" /> Voir la fiche complète
      </button>
    </div>,
    document.body
  );
}

// ── Bulle avatar : ouvre la popover partagée au survol ─────────────────────
function StudentBubble({ student }: { student: StudentOverview }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { popover, open, scheduleClose } = usePopoverCtx();
  const isOpen = popover?.student.id === student.id;

  const handleEnter = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) open(student, rect);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={scheduleClose}>
      <button
        ref={anchorRef}
        type="button"
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full shadow-md ring-2 ring-white transition hover:scale-110",
          !student.isActive && "ring-red-400 grayscale",
          isOpen && "scale-110"
        )}
      >
        <UserAvatar name={`${student.prenom} ${student.nom}`} src={student.avatarUrl} size="lg" className="h-11 w-11 text-xs" />
        {!student.isActive && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-white">
            <Lock className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </button>
    </div>
  );
}

const BUBBLES_PER_COLUMN = 6;

// ── Colonne pipeline : au-delà de 6 étudiants, une bulle "+N" remplace le
// reste et déplie la colonne au clic ; une bulle "Réduire" la replie ensuite.
function PipelineColumn({
  stageKey,
  students
}: {
  stageKey: PipelineStageKey;
  students: StudentOverview[];
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STAGE_META[stageKey];
  const hidden = students.length - BUBBLES_PER_COLUMN;
  const visible = expanded || hidden <= 0 ? students : students.slice(0, BUBBLES_PER_COLUMN);

  return (
    <div className="w-[220px] shrink-0 rounded-[20px] border border-line bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-dark">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} /> {meta.label}
        </span>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-muted shadow-sm">{students.length}</span>
      </div>
      {students.length ? (
        <div className="flex flex-wrap gap-2 pb-2 pt-1">
          {visible.map((student) => (
            <StudentBubble key={student.id} student={student} />
          ))}
          {hidden > 0 && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title={`Afficher ${hidden} étudiant${hidden > 1 ? "s" : ""} de plus`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-dark text-xs font-black text-white shadow-md ring-2 ring-white transition hover:scale-110 hover:bg-brand"
            >
              +{hidden}
            </button>
          )}
          {expanded && hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              title="Réduire"
              className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-dark text-[9px] font-black uppercase text-white shadow-md ring-2 ring-white transition hover:scale-110 hover:bg-brand"
            >
              <span>▴</span>
              Réduire
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-2 py-4 text-center text-[11px] text-muted">
          Aucun étudiant
        </p>
      )}
    </div>
  );
}

// ── Composant public : Kanban pipeline complet, réutilisable partout ───────
export default function StudentsPipelineBoard({
  students,
  busyId,
  onToggleBlock
}: {
  students: StudentOverview[];
  busyId: string | null;
  onToggleBlock: (student: StudentOverview) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<PipelineStageKey, StudentOverview[]>();
    for (const key of Object.keys(STAGE_META) as PipelineStageKey[]) map.set(key, []);
    for (const student of students) {
      map.get(student.stage)?.push(student);
    }
    return map;
  }, [students]);

  return (
    <PipelinePopoverProvider>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {(Object.keys(STAGE_META) as PipelineStageKey[]).map((key) => (
          <PipelineColumn key={key} stageKey={key} students={grouped.get(key) || []} />
        ))}
      </div>
      <StudentPopoverCard busyId={busyId} onToggleBlock={onToggleBlock} />
    </PipelinePopoverProvider>
  );
}
