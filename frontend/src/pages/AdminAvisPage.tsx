import {
  createManualAvis,
  deleteAvis,
  fetchAdminAvis,
  patchAvisStatus,
  updateAvis,
  type Avis,
  type AvisPayload,
  type AvisStatus
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  MessageSquareQuote,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

type TabValue = "manual" | "student_pending" | "all";

export default function AdminAvisPage() {
  const navigate = useNavigate();
  const [avisList, setAvisList] = useState<Avis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [activeTab, setActiveTab] = useState<TabValue>("manual");
  const [page, setPage] = useState(1);
  const TABLE_SIZE = 7;

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [authorName, setAuthorName] = useState("");
  const [authorCountry, setAuthorCountry] = useState("");
  const [authorPhoto, setAuthorPhoto] = useState("");
  const [programme, setProgramme] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");

  const loadAvis = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminAvis();
      setAvisList(data);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvis();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setAuthorName("");
    setAuthorCountry("");
    setAuthorPhoto("");
    setProgramme("");
    setRating(5);
    setContent("");
    setModalOpen(true);
  };

  const handleOpenEdit = (a: Avis) => {
    setEditingId(a.id);
    setAuthorName(a.author_name || "");
    setAuthorCountry(a.author_country || "");
    setAuthorPhoto(a.author_photo || "");
    setProgramme(a.programme || "");
    setRating(a.rating || 5);
    setContent(a.content || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!authorName.trim() || !content.trim()) {
      setError("Le nom et le contenu sont obligatoires");
      return;
    }

    try {
      const payload: AvisPayload = {
        author_name: authorName,
        author_country: authorCountry,
        author_photo: authorPhoto,
        programme: programme,
        rating,
        content
      };

      if (editingId) {
        await updateAvis(editingId, payload);
        setSuccess("Avis modifié avec succès");
      } else {
        await createManualAvis(payload);
        setSuccess("Avis créé avec succès");
      }
      setModalOpen(false);
      loadAvis();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer l'avis de ${name} ?`)) return;
    try {
      await deleteAvis(id);
      setSuccess("Avis supprimé");
      loadAvis();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression");
    }
  };

  const handleStatusChange = async (id: string, status: AvisStatus) => {
    try {
      await patchAvisStatus(id, status);
      setSuccess(`Statut mis à jour (${status})`);
      loadAvis();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour du statut");
    }
  };

  // Derived state
  const filteredAvis = avisList.filter((a) => {
    if (activeTab === "manual") return a.source === "manual";
    if (activeTab === "student_pending") return a.source === "student" && a.status === "pending";
    return true; // all
  });

  const totalTablePages = Math.ceil(filteredAvis.length / TABLE_SIZE);
  const pagedTable = filteredAvis.slice((page - 1) * TABLE_SIZE, page * TABLE_SIZE);

  const stats = {
    total: avisList.length,
    pending: avisList.filter(a => a.status === "pending").length,
    approved: avisList.filter(a => a.status === "approved").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* ── Header & Stats ── */}
      <header className="bg-white border-b border-line px-6 py-8 md:px-12 relative overflow-hidden">

        <div className="mx-auto max-w-6xl relative z-10">
          <button
            onClick={() => navigate("/admin")}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 hover:text-dark"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </button>
          
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-extrabold tracking-tight text-dark md:text-4xl">
                Gestion des Avis
              </h1>
              <p className="mt-2 text-sm text-muted md:text-base">
                Ajoutez manuellement des témoignages ou modérez les avis soumis par les étudiants.
              </p>
            </div>
            
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-xl hover:shadow-brand/30"
            >
              <Plus className="h-4 w-4" /> Ajouter un avis manuel
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <MessageSquareQuote className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider">Total Avis</p>
                <p className="text-2xl font-black text-dark">{stats.total}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider">En attente</p>
                <p className="text-2xl font-black text-dark">{stats.pending}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider">Approuvés</p>
                <p className="text-2xl font-black text-dark">{stats.approved}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-6xl px-6 py-8 md:px-12">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600 flex items-center justify-between">
            {error}
            <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-600 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess("")}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 rounded-xl bg-slate-200/50 p-1 mb-6 max-w-md">
          <button
            onClick={() => { setActiveTab("manual"); setPage(1); }}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
              activeTab === "manual" ? "bg-white text-dark shadow-sm" : "text-muted hover:text-dark hover:bg-white/50"
            )}
          >
            Avis Manuels
          </button>
          <button
            onClick={() => { setActiveTab("student_pending"); setPage(1); }}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
              activeTab === "student_pending" ? "bg-white text-dark shadow-sm" : "text-muted hover:text-dark hover:bg-white/50"
            )}
          >
            Étudiants (En attente)
          </button>
          <button
            onClick={() => { setActiveTab("all"); setPage(1); }}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
              activeTab === "all" ? "bg-white text-dark shadow-sm" : "text-muted hover:text-dark hover:bg-white/50"
            )}
          >
            Tous
          </button>
        </div>

        {/* Table View */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-line bg-white/50">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/30 border-t-brand" />
          </div>
        ) : filteredAvis.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/50 text-center">
            <MessageSquareQuote className="mb-3 h-10 w-10 text-muted/30" />
            <p className="font-bold text-dark">Aucun avis trouvé</p>
            <p className="text-sm text-muted">Il n'y a pas d'avis correspondant à cet onglet.</p>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-slate-50">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Auteur</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Avis</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">Source / Programme</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Statut</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {pagedTable.map((a) => (
                  <tr key={a.id} className="group transition hover:bg-brand/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-slate-100 flex items-center justify-center">
                          {a.author_photo ? (
                            <img src={a.author_photo} alt={a.author_name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-lg font-bold text-slate-400">{a.author_name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-dark text-xs">{a.author_name}</p>
                          {a.author_country && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted">
                              <Globe className="h-3 w-3" /> {a.author_country}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-3 w-3", i < a.rating ? "fill-amber-500 text-amber-500" : "fill-slate-200 text-slate-200")} />
                        ))}
                      </div>
                      <p className="text-[11px] text-muted line-clamp-2">{a.content}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "inline-flex w-max items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                          a.source === "manual" ? "bg-slate-100 text-slate-600" : "bg-brand/10 text-brand"
                        )}>
                          {a.source === "manual" ? "Saisi manuellement" : "Étudiant"}
                        </span>
                        {a.programme && <span className="text-[10px] text-muted">{a.programme}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold border",
                        a.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        a.status === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                        "bg-amber-50 text-amber-600 border-amber-200"
                      )}>
                        {a.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                        {a.status === "rejected" && <XCircle className="h-3 w-3" />}
                        {a.status === "pending" && <AlertCircle className="h-3 w-3" />}
                        {a.status === "approved" ? "Approuvé" : a.status === "rejected" ? "Rejeté" : "En attente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {a.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleStatusChange(a.id, "approved")}
                              className="inline-flex items-center justify-center rounded-lg bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
                              title="Approuver"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(a.id, "rejected")}
                              className="inline-flex items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-600 transition hover:bg-red-500 hover:text-white"
                              title="Rejeter"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(a)}
                          className="inline-flex items-center justify-center rounded-lg bg-brand/10 p-1.5 text-brand transition hover:bg-brand hover:text-white"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id, a.author_name)}
                          className="inline-flex items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 transition hover:bg-red-500 hover:text-white"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table Footer / Pagination */}
            <div className="flex items-center justify-between border-t border-line/60 bg-slate-50 px-4 py-3">
              <span className="text-xs text-muted">
                Affichage de {pagedTable.length} sur {filteredAvis.length} avis
              </span>
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
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Modal Create/Edit ── */}
      {modalOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line bg-slate-50 px-6 py-4">
              <h2 className="text-xl font-black text-dark">
                {editingId ? "Modifier l'avis" : "Ajouter un avis manuel"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-muted transition hover:bg-slate-200 hover:text-dark"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="avisForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">Nom de l'auteur *</label>
                    <input
                      type="text"
                      required
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-dark outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                      placeholder="Ex: Sophie Dubois"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">Pays d'origine</label>
                    <input
                      type="text"
                      value={authorCountry}
                      onChange={(e) => setAuthorCountry(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-dark outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                      placeholder="Ex: France"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">Programme / Université</label>
                    <input
                      type="text"
                      value={programme}
                      onChange={(e) => setProgramme(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-dark outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                      placeholder="Ex: Master IT - Malte"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">Note (Étoiles)</label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-dark outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                    >
                      <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
                      <option value="4">⭐⭐⭐⭐ (4/5)</option>
                      <option value="3">⭐⭐⭐ (3/5)</option>
                      <option value="2">⭐⭐ (2/5)</option>
                      <option value="1">⭐ (1/5)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Photo (URL de l'image, optionnel)</label>
                  <input
                    type="url"
                    value={authorPhoto}
                    onChange={(e) => setAuthorPhoto(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-dark outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Témoignage *</label>
                  <textarea
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-dark outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                    placeholder="L'expérience était incroyable..."
                  />
                </div>
              </form>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-muted transition hover:bg-slate-200 hover:text-dark"
              >
                Annuler
              </button>
              <button
                form="avisForm"
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-hover hover:shadow-xl hover:shadow-brand/30"
              >
                {editingId ? (
                  <>Mettre à jour</>
                ) : (
                  <><Plus className="h-4 w-4" /> Créer l'avis</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
