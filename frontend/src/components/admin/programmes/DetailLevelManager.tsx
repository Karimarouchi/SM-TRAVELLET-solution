import type { ProgrammeDetail } from "@/lib/auth";
import { Plus } from "lucide-react";
import { EMPTY_DETAIL } from "./constants";
import { DetailLevelPanel } from "./DetailLevelPanel";

export function DetailLevelManager({
  details,
  onChange
}: {
  details: ProgrammeDetail[];
  onChange: (details: ProgrammeDetail[]) => void;
}) {
  const addLevel = () => onChange([...details, { ...EMPTY_DETAIL }]);

  const updateLevel = (i: number, updated: ProgrammeDetail) => {
    const next = [...details];
    next[i] = updated;
    onChange(next);
  };

  const removeLevel = (i: number) => {
    onChange(details.filter((_, idx) => idx !== i));
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...details];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };

  const moveDown = (i: number) => {
    if (i === details.length - 1) return;
    const next = [...details];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {details.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-slate-50 py-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-line">
            <Plus className="h-5 w-5 text-muted" />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">Aucun niveau ajouté</p>
          <p className="text-[11px] text-muted/70">Cliquez sur "+ Ajouter un niveau" pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {details.map((d, i) => (
            <DetailLevelPanel
              key={i}
              detail={d}
              index={i}
              total={details.length}
              onChange={(updated) => updateLevel(i, updated)}
              onRemove={() => removeLevel(i)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addLevel}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand/5 py-2.5 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand/10"
      >
        <Plus className="h-4 w-4" />
        Ajouter un niveau (Licence, Master, etc.)
      </button>
    </div>
  );
}
