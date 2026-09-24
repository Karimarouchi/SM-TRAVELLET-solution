import {
  createProgramme,
  deleteProgramme,
  fetchAdminProgrammes,
  mediaUrl,
  updateProgramme,
  uploadProgrammeImage,
  type Programme
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import CountriesDocumentsPanel from "@/components/admin/CountriesDocumentsPanel";
import CountriesUniversitiesPanel from "@/components/admin/CountriesUniversitiesPanel";
import VisaDocumentsPanel from "@/components/admin/VisaDocumentsPanel";
import { DEFAULT_FORM, type FormData } from "@/components/admin/programmes/constants";
import { ProgrammeFormModal } from "@/components/admin/programmes/ProgrammeFormModal";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  GraduationCap,
  GripVertical,
  LayoutGrid,
  List,
  Pencil,
  Plane,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ─── Main Page ──────────────────────────────────────────── */
export default function AdminProgrammesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"programmes" | "documents" | "universities" | "visa">("programmes");
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterBadge, setFilterBadge] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;
  const TABLE_SIZE = 7;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProgrammes();
      setProgrammes(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les programmes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredProgrammes = useMemo(() => {
    setPage(1); // reset pagination on filter change
    return programmes.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.country.toLowerCase().includes(search.toLowerCase());
      const matchBadge = !filterBadge || p.badge === filterBadge;
      return matchSearch && matchBadge;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmes, search, filterBadge]);

  const stats = useMemo(() => ({
    total: programmes.length,
    disponibles: programmes.filter((p) => p.badge === "Disponible").length,
    prochainement: programmes.filter((p) => p.badge === "Prochainement disponible").length,
    vedettes: programmes.filter((p) => p.isFeatured).length
  }), [programmes]);

  // Number of OTHER programmes already featured (excluding the one being edited)
  const featuredCountExcludingCurrent = useMemo(() => {
    return programmes.filter((p) => p.isFeatured && p.id !== editingId).length;
  }, [programmes, editingId]);

  const canFeature = featuredCountExcludingCurrent < 3;

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ ...DEFAULT_FORM, displayOrder: programmes.length + 1 });
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Programme) => {
    setEditingId(p.id);
    setFormData({
      title: p.title,
      country: p.country,
      countryId: p.countryId,
      degrees: p.degrees,
      description: p.description,
      imageUrl: p.imageUrl,
      badge: p.badge,
      statusLabel: p.statusLabel,
      gradientStyle: p.gradientStyle,
      isFeatured: p.isFeatured,
      displayOrder: p.displayOrder,
      details: Array.isArray(p.details) ? p.details : []
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Supprimer "${title}" ?`)) return;
    try {
      await deleteProgramme(id);
      setSuccess(`"${title}" supprimé.`);
      loadData();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert("L'image dépasse 5 Mo."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setUploading(true);
        const res = await uploadProgrammeImage(reader.result as string);
        setFormData((prev) => ({ ...prev, imageUrl: res.imageUrl }));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erreur lors de l'upload.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateProgramme(editingId, formData);
        setSuccess("Programme mis à jour ✓");
      } else {
        await createProgramme(formData);
        setSuccess("Programme créé ✓");
      }
      setModalOpen(false);
      loadData();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const badgeStyles: Record<string, string> = {
    "Disponible": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Prochainement disponible": "bg-amber-100 text-amber-800 border-amber-200",
    "Planifié": "bg-indigo-100 text-indigo-700 border-indigo-200"
  };

  return (
    <>
      {/* ── Page ────────────────────────────────────── */}
      <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0533] via-brand to-violet-600 p-6 sm:p-8 text-white shadow-[0_24px_60px_rgba(109,40,217,.30)]">
          {/* decorative orbs */}
          <span className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-8 left-16 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/20 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
              </button>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight">
                {activeTab === "programmes"
                  ? "Gestion des Programmes"
                  : activeTab === "documents"
                    ? "Pays & Documents requis"
                    : activeTab === "universities"
                      ? "Universités par pays"
                      : "Documents visa par destination"}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                {activeTab === "programmes"
                  ? "Ajoutez, modifiez ou planifiez les badges des destinations du site vitrine."
                  : activeTab === "documents"
                    ? "Configurez les pays de destination et les documents requis pour chaque pays."
                    : activeTab === "universities"
                      ? "Configurez les universités disponibles pour chaque pays, utilisées dans le formulaire étudiant."
                      : "Documents demandés à l'étudiant une fois son dossier transféré au Responsable Dossier Visa."}
              </p>
            </div>
            {activeTab === "programmes" && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-display text-sm font-bold text-brand shadow-xl hover:bg-brand-light transition-all hover:scale-105"
              >
                <Plus className="h-4 w-4" /> Nouveau programme
              </button>
            )}
          </div>

          {/* Tab switch: Programmes / Documents */}
          <div className="relative mt-5 inline-flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => setActiveTab("programmes")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition",
                activeTab === "programmes" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <Globe className="h-3.5 w-3.5" /> Programmes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition",
                activeTab === "documents" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <FileText className="h-3.5 w-3.5" /> Documents
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("universities")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition",
                activeTab === "universities" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <GraduationCap className="h-3.5 w-3.5" /> Universités
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("visa")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition",
                activeTab === "visa" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <Plane className="h-3.5 w-3.5" /> Documents visa
            </button>
          </div>
        </div>

        {activeTab === "documents" ? (
          <CountriesDocumentsPanel />
        ) : activeTab === "universities" ? (
          <CountriesUniversitiesPanel />
        ) : activeTab === "visa" ? (
          <VisaDocumentsPanel />
        ) : (
        <>
        {/* Notifications */}
        {error && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            <X className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* KPI Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total", value: stats.total, icon: Globe, color: "text-brand", bg: "bg-brand/10" },
            { label: "Disponibles", value: stats.disponibles, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Prochainement", value: stats.prochainement, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "En vedette", value: `${stats.vedettes}/3`, icon: Star, color: "text-amber-500", bg: "bg-amber-50" }
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-white p-4 flex items-center gap-3 shadow-sm">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", bg)}>
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted">{label}</p>
                <p className={cn("text-2xl font-extrabold font-display", color)}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Rechercher un programme ou un pays..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-line bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-brand focus:bg-white transition"
            />
          </div>
          <div className="flex items-center gap-2">
            {["", "Disponible", "Prochainement disponible"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setFilterBadge(b)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                  filterBadge === b
                    ? "bg-brand text-white border-brand shadow"
                    : "bg-white text-muted border-line hover:border-brand hover:text-brand"
                )}
              >
                {b || "Tous"}
              </button>
            ))}
          </div>
        </div>

        {/* View toggle + count */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted font-medium">{filteredProgrammes.length} programme{filteredProgrammes.length !== 1 ? "s" : ""} affiché{filteredProgrammes.length !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => { setViewMode("cards"); setPage(1); }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "cards" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cartes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "table" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
              )}
            >
              <List className="h-3.5 w-3.5" /> Tableau
            </button>
          </div>
        </div>

        {/* Programme List */}
        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
            <p className="text-sm text-muted">Chargement des programmes...</p>
          </div>
        ) : filteredProgrammes.length === 0 ? (
          <div className="mt-16 text-center">
            <Globe className="mx-auto h-12 w-12 text-line" />
            <p className="mt-4 font-display text-lg font-bold text-dark">Aucun programme trouvé</p>
            <p className="text-sm text-muted">Ajoutez votre premier programme ou modifiez vos filtres.</p>
          </div>
        ) : viewMode === "cards" ? (
          (() => {
            const totalPages = Math.ceil(filteredProgrammes.length / PAGE_SIZE);
            const paged = filteredProgrammes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            return (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paged.map((p) => {
                    const isComingSoon = p.badge.includes("Prochainement") || p.badge === "Planifié";
                    return (
                      <article
                        key={p.id}
                        className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                      >
                        {/* Image Header */}
                        <div
                          className="relative h-40 w-full overflow-hidden"
                          style={{ background: p.gradientStyle }}
                        >
                          <img
                            src={p.imageUrl ? mediaUrl(p.imageUrl) : ""}
                            alt={p.title}
                            className={cn(
                              "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
                              isComingSoon && "opacity-60 saturate-50"
                            )}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                          {/* Country badge */}
                          <div className="absolute left-3 top-3">
                            <span className="inline-flex items-center rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                              {p.country}
                            </span>
                          </div>

                          {/* Status badges */}
                          <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
                            {p.isFeatured && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                                <Sparkles className="h-2.5 w-2.5" /> Vedette
                              </span>
                            )}
                            {isComingSoon && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                                <Clock className="h-2.5 w-2.5" /> {p.badge}
                              </span>
                            )}
                          </div>

                          {/* Order */}
                          <div className="absolute bottom-3 left-3">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
                              <GripVertical className="h-3 w-3" /> #{p.displayOrder}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex-1">
                            <h3 className="font-display text-base font-bold text-dark leading-tight">{p.title}</h3>
                            <p className="mt-0.5 text-[11px] font-bold text-brand uppercase tracking-wide">{p.degrees}</p>
                            <p className="mt-2 text-xs text-muted leading-relaxed line-clamp-2">{p.description}</p>
                            {Array.isArray(p.details) && p.details.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {p.details.slice(0, 3).map((d, i) => (
                                  <span key={i} className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                                    {d.name || `Niveau ${i + 1}`}
                                  </span>
                                ))}
                                {p.details.length > 3 && (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-muted">
                                    +{p.details.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                              badgeStyles[p.badge] || "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {p.badge}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-brand/10 px-3 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white"
                              >
                                <Pencil className="h-3 w-3" /> Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id, p.title)}
                                className="inline-flex items-center justify-center rounded-xl bg-red-50 p-1.5 text-red-500 transition hover:bg-red-500 hover:text-white"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {/* Add new card — only on last page */}
                  {page === totalPages && (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-slate-50 text-muted transition-all hover:border-brand hover:bg-brand/5 hover:text-brand"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-line">
                        <Plus className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-semibold">Ajouter un programme</span>
                    </button>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition",
                          n === page
                            ? "border-brand bg-brand text-white shadow"
                            : "border-line bg-white text-muted hover:border-brand hover:text-brand"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="ml-2 text-xs text-muted">Page {page} / {totalPages}</span>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          /* ── TABLE VIEW ── */
          (() => {
            const totalTablePages = Math.ceil(filteredProgrammes.length / TABLE_SIZE);
            const pagedTable = filteredProgrammes.slice((page - 1) * TABLE_SIZE, page * TABLE_SIZE);
            return (
              <>
                <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-slate-50">
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted w-8">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Programme</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Pays</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">Niveaux</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden lg:table-cell">Détails</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Statut</th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {pagedTable.map((p) => (
                        <tr key={p.id} className="group transition hover:bg-brand/5">
                          <td className="px-4 py-3 text-xs text-muted font-mono">{p.displayOrder}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg"
                                style={{ background: p.gradientStyle }}
                              >
                                <img
                                  src={p.imageUrl ? mediaUrl(p.imageUrl) : ""}
                                  alt={p.title}
                                  className="h-full w-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              </div>
                              <div>
                                <p className="font-bold text-dark text-xs leading-tight">{p.title}</p>
                                {p.isFeatured && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600">
                                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Vedette
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {p.country}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-[11px] text-muted max-w-[160px] truncate">{p.degrees}</p>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {Array.isArray(p.details) && p.details.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                                {p.details.length} niveau{p.details.length > 1 ? "x" : ""}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted/50">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              badgeStyles[p.badge] || "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {p.badge}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white"
                              >
                                <Pencil className="h-3 w-3" /> Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id, p.title)}
                                className="inline-flex items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 transition hover:bg-red-500 hover:text-white"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Table footer: add button + pagination */}
                  <div className="flex items-center justify-between border-t border-line/60 bg-slate-50 px-4 py-3">
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="inline-flex items-center gap-2 rounded-xl border border-dashed border-brand/40 bg-white px-4 py-2 text-xs font-bold text-brand transition hover:bg-brand hover:text-white hover:border-brand"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter un programme
                    </button>

                    {totalTablePages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        {Array.from({ length: totalTablePages }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold transition",
                              n === page
                                ? "border-brand bg-brand text-white shadow"
                                : "border-line bg-white text-muted hover:border-brand hover:text-brand"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalTablePages, p + 1))}
                          disabled={page === totalTablePages}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <span className="ml-1 text-xs text-muted">Page {page} / {totalTablePages}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()
        )}
        </>
        )}
      </main>


      {/* ── Modal ────────────────────────────────────── */}
      <ProgrammeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        uploading={uploading}
        onSubmit={handleSubmit}
        onFileUpload={handleFileUpload}
        canFeature={canFeature}
        featuredCountExcludingCurrent={featuredCountExcludingCurrent}
      />
    </>
  );
}
