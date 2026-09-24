import { mediaUrl } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Clock, Sparkles } from "lucide-react";
import type { FormData } from "./constants";

export function CardPreview({ formData }: { formData: FormData }) {
  const hasDate = formData.statusLabel && formData.statusLabel !== "Bientôt ouvert" && formData.statusLabel !== "Disponible";
  const isComingSoon = formData.badge.includes("Prochainement") && !hasDate;
  const preview = formData.imageUrl ? mediaUrl(formData.imageUrl) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
      {/* Card Image Header */}
      <div className="relative h-56 overflow-hidden" style={{ background: formData.gradientStyle }}>
        {preview && (
          <img
            src={preview}
            alt="Preview"
            className={cn("absolute inset-0 h-full w-full object-cover", isComingSoon && "opacity-60 saturate-50 blur-[1px]")}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {/* Light overlay */}
        <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(circle at top right,rgba(255,255,255,.28),transparent 42%),radial-gradient(circle at bottom left,rgba(255,255,255,.18),transparent 40%)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

        {/* Country badge — exactly matching vitrine design: bg-black/45 backdrop-blur-sm */}
        <div className="relative z-10 h-full p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="inline-flex items-center w-max rounded-full bg-black/45 text-white text-xs font-semibold px-3 py-1 backdrop-blur-sm">
              {formData.country || "Pays"}
              {formData.badge.includes("Prochainement") && hasDate && (
                ` • Prévu pour le ${formData.statusLabel.split('-').reverse().join('/')}`
              )}
            </span>
            {formData.isFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                <Sparkles className="h-2.5 w-2.5" /> Vedette
              </span>
            )}
          </div>
          {isComingSoon && (
            <span className="self-start inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-bold text-white shadow">
              <Clock className="h-3 w-3" /> {formData.badge || "Badge"}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-7">
        <h4 className="font-display text-xl font-bold text-dark mb-3 leading-tight">{formData.title || "Titre du programme"}</h4>
        <p className="text-muted text-sm leading-relaxed mb-6">
          <strong>{formData.country || "Pays"} • {formData.degrees}</strong>
          <br />
          {formData.description || "La description du programme apparaîtra ici..."}
        </p>
        {/* Preview "Voir les détails" button — non functional, display only */}
        {!isComingSoon && (
          <span className="inline-flex items-center gap-2 text-brand font-bold text-sm opacity-80 cursor-default select-none">
            Voir les détails
            <span className="text-base leading-none">↗</span>
          </span>
        )}
      </div>

      {/* Detail levels summary */}
      {formData.details.length > 0 && (
        <div className="border-t border-line/60 px-7 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
            Niveaux dans la modal ({formData.details.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {formData.details.map((d, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-semibold text-brand">
                {d.name || `Niveau ${i + 1}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
