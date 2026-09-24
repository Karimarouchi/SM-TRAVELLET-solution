import type { ProgrammeDetail } from "@/lib/auth";
import { ChevronDown, ChevronUp, Languages, Trash2 } from "lucide-react";
import { useState, type ChangeEvent } from "react";

export function DetailLevelPanel({
  detail,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown
}: {
  detail: ProgrammeDetail;
  index: number;
  total: number;
  onChange: (updated: ProgrammeDetail) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const field = (key: keyof ProgrammeDetail) => (
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...detail, [key]: e.target.value })
  );

  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 border-b border-line">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-slate-200 disabled:opacity-30 transition"
            title="Monter"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-slate-200 disabled:opacity-30 transition"
            title="Descendre"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-dark truncate">
            {detail.name || <span className="italic text-muted font-normal">Nouveau niveau</span>}
          </span>
          {detail.lang && (
            <span className="ml-auto hidden sm:inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
              <Languages className="h-2.5 w-2.5" />
              {detail.lang}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition"
          title="Supprimer ce niveau"
        >
          <Trash2 className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-slate-200 transition"
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Panel Body */}
      {!collapsed && (
        <div className="space-y-3 p-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Titre du niveau <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="ex: Licence, Master, Préparatoire..."
              value={detail.name}
              onChange={field("name")}
              className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Décrivez ce niveau de formation, les prérequis, le public visé..."
              value={detail.desc}
              onChange={field("desc")}
              className="w-full resize-none rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
            />
          </div>

          {/* Lang + Fees */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Langue d'enseignement
              </label>
              <input
                type="text"
                placeholder="ex: Français ou Anglais"
                value={detail.lang}
                onChange={field("lang")}
                className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Frais d'études
              </label>
              <input
                type="text"
                placeholder="ex: Sur demande / 3 500 €/an"
                value={detail.fees}
                onChange={field("fees")}
                className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
              />
            </div>
          </div>

          {/* Dates + Status */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Période d'inscription
              </label>
              <input
                type="text"
                placeholder="ex: Du 01/01 au 15/07"
                value={detail.dates}
                onChange={field("dates")}
                className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Statut
              </label>
              <input
                type="text"
                placeholder="ex: Inscription ouverte"
                value={detail.status}
                onChange={field("status")}
                className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
              />
            </div>
          </div>

          {/* Scholarship */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Bourses & Avantages
            </label>
            <textarea
              rows={3}
              placeholder="Décrivez les bourses disponibles, avantages, conditions spéciales..."
              value={detail.scholarship}
              onChange={field("scholarship")}
              className="w-full resize-none rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
            />
          </div>
        </div>
      )}
    </div>
  );
}
