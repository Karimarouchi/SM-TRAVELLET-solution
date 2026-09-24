import {
  createCountryUniversity,
  deleteCountryUniversity,
  fetchAdminCountries,
  fetchCountryUniversities,
  setUniversityActive,
  updateCountryUniversity,
  type Country,
  type CountryUniversity
} from "@/lib/auth";
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useState } from "react";

type UniFormData = { name: string };
const DEFAULT_UNI_FORM: UniFormData = { name: "" };

export default function CountriesUniversitiesPanel() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [universitiesByCountry, setUniversitiesByCountry] = useState<Record<string, CountryUniversity[]>>({});
  const [listLoading, setListLoading] = useState<string | null>(null);

  const [forms, setForms] = useState<Record<string, UniFormData>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingCountryId, setSavingCountryId] = useState<string | null>(null);

  const [countrySearch, setCountrySearch] = useState("");
  const [uniSearch, setUniSearch] = useState<Record<string, string>>({});

  const notify = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 4000);
  };

  useEffect(() => {
    fetchAdminCountries()
      .then(setCountries)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les pays."))
      .finally(() => setLoading(false));
  }, []);

  const loadUniversities = async (countryId: string) => {
    setListLoading(countryId);
    try {
      const list = await fetchCountryUniversities(countryId);
      setUniversitiesByCountry((prev) => ({ ...prev, [countryId]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les universités.");
    } finally {
      setListLoading(null);
    }
  };

  const toggleExpand = (countryId: string) => {
    if (expandedId === countryId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(countryId);
    if (!universitiesByCountry[countryId]) loadUniversities(countryId);
  };

  const getForm = (countryId: string) => forms[countryId] || DEFAULT_UNI_FORM;
  const setForm = (countryId: string, patch: Partial<UniFormData>) => {
    setForms((prev) => ({ ...prev, [countryId]: { ...getForm(countryId), ...patch } }));
  };

  const startCreate = (countryId: string) => {
    setEditingId(null);
    setForms((prev) => ({ ...prev, [countryId]: DEFAULT_UNI_FORM }));
  };

  const startEdit = (countryId: string, uni: CountryUniversity) => {
    setEditingId(uni.id);
    setForms((prev) => ({ ...prev, [countryId]: { name: uni.name } }));
  };

  const handleSubmit = async (countryId: string, editing: string | null) => {
    const form = getForm(countryId);
    if (!form.name.trim()) {
      alert("Le nom de l'université est obligatoire.");
      return;
    }
    setSavingCountryId(countryId);
    try {
      if (editing) {
        await updateCountryUniversity(editing, form);
        notify("Université mise à jour ✓");
      } else {
        await createCountryUniversity(countryId, form);
        notify("Université ajoutée ✓");
      }
      setEditingId(null);
      setForms((prev) => ({ ...prev, [countryId]: DEFAULT_UNI_FORM }));
      await loadUniversities(countryId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSavingCountryId(null);
    }
  };

  const handleToggleActive = async (countryId: string, uni: CountryUniversity) => {
    try {
      await setUniversityActive(uni.id, !uni.active);
      await loadUniversities(countryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du changement de statut.");
    }
  };

  const handleDelete = async (countryId: string, uni: CountryUniversity) => {
    if (!window.confirm(`Supprimer "${uni.name}" ?`)) return;
    try {
      await deleteCountryUniversity(uni.id);
      notify(`"${uni.name}" supprimée.`);
      await loadUniversities(countryId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <>
      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          <X className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
          <GraduationCap className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-muted font-medium">
          {countries.length} pays · Cliquez sur un pays pour gérer ses universités disponibles
        </p>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Rechercher un pays..."
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            className="w-full rounded-xl border border-line bg-white pl-9 pr-4 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
          />
        </div>
      </div>
      {loading ? (
        <div className="mt-16 flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {countries
            .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase()))
            .map((c) => {
            const isOpen = expandedId === c.id;
            const universities = universitiesByCountry[c.id] || [];
            const searchU = uniSearch[c.id] || "";
            const filteredUniversities = universities.filter(u => u.name.toLowerCase().includes(searchU.toLowerCase()));
            
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleExpand(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[11px] font-bold text-brand">
                    {c.code}
                  </span>
                  <span className="flex-1 font-display text-sm font-bold text-dark">{c.name}</span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                </button>

                {isOpen && (
                  <div className="border-t border-line bg-slate-50 px-4 py-4">
                    {listLoading === c.id ? (
                      <p className="text-xs text-muted">Chargement...</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                          <input
                            type="text"
                            placeholder="Rechercher une université..."
                            value={uniSearch[c.id] || ""}
                            onChange={(e) => setUniSearch(prev => ({ ...prev, [c.id]: e.target.value }))}
                            className="w-full rounded-lg border border-line bg-white pl-9 pr-4 py-2 text-xs outline-none transition focus:border-brand shadow-sm"
                          />
                        </div>

                        <div className="space-y-2">
                        {universities.length === 0 ? (
                          <p className="text-xs text-muted italic">Aucune université configurée pour ce pays.</p>
                        ) : filteredUniversities.length === 0 ? (
                          <p className="text-xs text-muted italic">Aucune université ne correspond à votre recherche.</p>
                        ) : (
                          filteredUniversities.map((uni) => (
                            <div key={uni.id} className="rounded-xl border border-line bg-white p-3 shadow-sm hover:shadow-md transition">
                              {editingId === uni.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={getForm(c.id).name}
                                    onChange={(e) => setForm(c.id, { name: e.target.value })}
                                    className="flex-1 rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-brand"
                                    autoFocus
                                  />
                                  <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-muted hover:bg-slate-50">Annuler</button>
                                  <button
                                    type="button"
                                    disabled={savingCountryId === c.id}
                                    onClick={() => handleSubmit(c.id, uni.id)}
                                    className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                                  >
                                    Enregistrer
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <GraduationCap className="h-3.5 w-3.5 shrink-0 text-brand" />
                                    <p className="text-xs font-bold text-dark">
                                      {uni.name}
                                      {!uni.active && (
                                        <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                          Désactivée
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActive(c.id, uni)}
                                      className="rounded-lg px-2 py-1 text-[10px] font-bold border border-line text-muted hover:bg-slate-50"
                                    >
                                      {uni.active ? "Désactiver" : "Réactiver"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEdit(c.id, uni)}
                                      className="inline-flex items-center justify-center rounded-lg bg-brand/10 p-1.5 text-brand hover:bg-brand hover:text-white transition"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(c.id, uni)}
                                      className="inline-flex items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-500 hover:text-white transition"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}

                        {editingId === null && forms[c.id] !== undefined ? (
                          <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand/5 p-3">
                            <input
                              type="text"
                              placeholder="Nom de l'université"
                              value={getForm(c.id).name}
                              onChange={(e) => setForm(c.id, { name: e.target.value })}
                              className="flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setForms((prev) => { const next = { ...prev }; delete next[c.id]; return next; })}
                              className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-muted hover:bg-white"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              disabled={savingCountryId === c.id}
                              onClick={() => handleSubmit(c.id, null)}
                              className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                            >
                              Ajouter
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startCreate(c.id)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-white py-2 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand/5"
                          >
                            <Plus className="h-3.5 w-3.5" /> Ajouter une université
                          </button>
                        )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
