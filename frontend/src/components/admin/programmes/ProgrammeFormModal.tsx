import { cn } from "@/lib/utils";
import { Pencil, Plus, Star, X } from "lucide-react";
import { createPortal } from "react-dom";
import { CardPreview } from "./CardPreview";
import { BADGES, GRADIENTS, type FormData } from "./constants";
import { DetailLevelManager } from "./DetailLevelManager";
import { ImageDropZone } from "./ImageDropZone";

export function ProgrammeFormModal({
  open,
  onClose,
  editingId,
  formData,
  setFormData,
  saving,
  uploading,
  onSubmit,
  onFileUpload,
  canFeature,
  featuredCountExcludingCurrent
}: {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  formData: FormData;
  setFormData: (updater: (prev: FormData) => FormData) => void;
  saving: boolean;
  uploading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onFileUpload: (file: File) => void;
  canFeature: boolean;
  featuredCountExcludingCurrent: number;
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-brand/5 to-violet-50 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-dark">
              {editingId ? "✏️ Modifier le programme" : "✨ Nouveau programme"}
            </h2>
            <p className="text-xs text-muted">Renseignez les informations, puis enregistrez.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-muted transition hover:bg-red-50 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto">
          <form id="prog-form" onSubmit={onSubmit}>
            <div className="grid gap-0 lg:grid-cols-12">

              {/* ── Left: Form fields ── */}
              <div className="space-y-5 p-6 lg:col-span-7 lg:border-r lg:border-line">

                {/* Title + Country */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                      Titre du programme <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Programme Italie"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                      Pays <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Italie, Slovaquie..."
                      value={formData.country}
                      onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
                    />
                    <p className="mt-1 text-[10px] text-muted">
                      Si ce pays n'existe pas encore, il sera créé automatiquement et apparaîtra dans l'onglet "Documents".
                    </p>
                  </div>
                </div>

                {/* Degrees + Order */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                      Étiquette courte (carte)
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Licence / Master"
                      value={formData.degrees}
                      onChange={(e) => setFormData((prev) => ({ ...prev, degrees: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
                    />
                    <p className="mt-1 text-[10px] text-muted">Affiché sous le titre de la carte vitrine</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">Ordre d'affichage</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.displayOrder}
                      onChange={(e) => setFormData((prev) => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
                      className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-dark outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
                    />
                  </div>
                </div>

                {/* Badge */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">Statut & Badge</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BADGES.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          badge: b.value,
                          statusLabel: b.value.includes("Prochainement") ? "Bientôt ouvert" : "Disponible"
                        }))}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-xs font-bold transition text-center",
                          formData.badge === b.value
                            ? "bg-brand text-white border-brand shadow-md"
                            : "bg-slate-50 text-muted border-line hover:border-brand hover:text-brand"
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {formData.badge.includes("Prochainement") && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-blue-700">
                        Date de disponibilité prévue (Optionnel)
                      </label>
                      <input
                        type="date"
                        value={formData.statusLabel && formData.statusLabel !== "Bientôt ouvert" && formData.statusLabel !== "Disponible" ? formData.statusLabel : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, statusLabel: val ? val : "Bientôt ouvert" }));
                        }}
                        className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                      />
                      <p className="mt-1.5 text-[10px] text-blue-600/80">Si une date est saisie, le filtre "Prochainement" disparaîtra et les détails seront consultables sur la vitrine.</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Décrivez ce programme et ses opportunités..."
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full resize-none rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
                  />
                </div>

                {/* ── Levels / Details Manager ── */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                        Niveaux de la modal "Voir les détails"
                      </label>
                      <p className="mt-0.5 text-[10px] text-muted">
                        Ces niveaux apparaîtront comme onglets dans la modal de la vitrine.
                      </p>
                    </div>
                    {formData.details.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
                        {formData.details.length} niveau{formData.details.length > 1 ? "x" : ""}
                      </span>
                    )}
                  </div>
                  <DetailLevelManager
                    details={formData.details}
                    onChange={(details) => setFormData((prev) => ({ ...prev, details }))}
                  />
                </div>

                {/* Gradient */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">Thème visuel (dégradé)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {GRADIENTS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, gradientStyle: g.value }))}
                        title={g.label}
                        className={cn(
                          "h-8 rounded-lg border-2 transition",
                          formData.gradientStyle === g.value ? "border-white ring-2 ring-brand scale-105 shadow" : "border-transparent hover:scale-105"
                        )}
                        style={{ background: g.value }}
                      />
                    ))}
                  </div>
                </div>

                {/* Image Drop Zone */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                    Image — Glissez-déposez ou cliquez
                  </label>
                  <ImageDropZone
                    imageUrl={formData.imageUrl}
                    uploading={uploading}
                    onFile={onFileUpload}
                    onUrl={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
                  />
                </div>

                {/* Featured toggle */}
                {(() => {
                  const isCurrentlyFeatured = formData.isFeatured;
                  const isLimitReached = !canFeature && !isCurrentlyFeatured;
                  const slotsLeft = 3 - featuredCountExcludingCurrent;

                  return (
                    <div className={cn(
                      "rounded-xl border px-4 py-3 transition",
                      isLimitReached
                        ? "border-amber-300 bg-amber-50 opacity-70 cursor-not-allowed"
                        : "border-line bg-slate-50 cursor-pointer"
                    )}>
                      <label className={cn("flex items-center gap-3", isLimitReached ? "cursor-not-allowed" : "cursor-pointer")} onClick={(e) => {
                        if (isLimitReached) { e.preventDefault(); }
                      }}>
                        <div className="relative flex-shrink-0">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={formData.isFeatured}
                            disabled={isLimitReached}
                            onChange={(e) => {
                              if (!isLimitReached || !e.target.checked) {
                                setFormData((prev) => ({ ...prev, isFeatured: e.target.checked }));
                              }
                            }}
                          />
                          <div className={cn(
                            "h-5 w-9 rounded-full border-2 transition-colors",
                            formData.isFeatured ? "bg-brand border-brand" : (isLimitReached ? "bg-amber-200 border-amber-300" : "bg-slate-200 border-slate-300")
                          )}>
                            <div className={cn(
                              "h-4 w-4 rounded-full bg-white shadow transition-transform",
                              formData.isFeatured ? "translate-x-4" : "translate-x-0"
                            )} />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-dark flex items-center gap-1">
                            <Star className={cn("h-3 w-3", formData.isFeatured ? "text-amber-500" : (isLimitReached ? "text-amber-400" : "text-slate-400"))} />
                            Mettre en vedette
                            <span className={cn(
                              "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                              featuredCountExcludingCurrent >= 3 && !isCurrentlyFeatured
                                ? "bg-red-100 text-red-600"
                                : isCurrentlyFeatured
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            )}>
                              {isCurrentlyFeatured ? "★ En vedette" : `${slotsLeft < 0 ? 0 : slotsLeft} / 3 place${slotsLeft <= 1 ? "" : "s"} libre${slotsLeft <= 1 ? "" : "s"}`}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {isLimitReached
                              ? "⚠️ Limite atteinte — retirez un programme en vedette d'abord."
                              : "Affiché dans les 3 cartes principales du site vitrine"}
                          </p>
                        </div>
                      </label>
                    </div>
                  );
                })()}
              </div>

              {/* ── Right: Live Preview ── */}
              <div className="bg-slate-50 p-6 lg:col-span-5">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-brand">
                  ✨ Aperçu en direct
                </p>
                <CardPreview formData={formData} />
                <p className="mt-3 text-[10px] text-muted text-center">Rendu tel qu'il apparaîtra sur le site vitrine</p>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-line bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-slate-50 px-5 py-2.5 text-sm font-bold text-dark hover:bg-slate-100 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="prog-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all hover:scale-105 disabled:opacity-60 disabled:scale-100"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Enregistrement...
              </>
            ) : (
              <>
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Enregistrer les modifications" : "Créer le programme"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
