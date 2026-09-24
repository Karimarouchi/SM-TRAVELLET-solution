import {
  deleteCountryDocument,
  createCountryDocument,
  fetchAdminCountries,
  fetchCountryDocuments,
  setCountryActive,
  setDocumentActive,
  updateCountry,
  updateCountryDocument,
  type AcceptedFileType,
  type Country,
  type DocumentRequirement
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe2,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useState } from "react";

type CountryFormData = { code: string; name: string; displayOrder: number };
const DEFAULT_COUNTRY_FORM: CountryFormData = { code: "", name: "", displayOrder: 0 };

type DocumentFormData = { name: string; description: string; required: boolean; acceptedFileTypes: AcceptedFileType };
const DEFAULT_DOCUMENT_FORM: DocumentFormData = { name: "", description: "", required: true, acceptedFileTypes: "IMAGE_PDF" };

const FILE_TYPE_OPTIONS: { value: AcceptedFileType; label: string }[] = [
  { value: "IMAGE_PDF", label: "Image ou PDF" },
  { value: "IMAGE", label: "Image uniquement" },
  { value: "PDF", label: "PDF uniquement" }
];

const FILE_TYPE_LABEL: Record<AcceptedFileType, string> = {
  IMAGE_PDF: "Image ou PDF",
  IMAGE: "Image",
  PDF: "PDF"
};

// Documents du DOSSIER universitaire uniquement — les documents visa ont
// leur propre page dédiée (/admin/visa-documents), avec leur propre
// permission (MANAGE_VISA_DOCUMENTS).
export default function CountriesDocumentsPanel() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [documentsByCountry, setDocumentsByCountry] = useState<Record<string, DocumentRequirement[]>>({});
  const [documentsLoading, setDocumentsLoading] = useState<string | null>(null);

  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [editingCountryId, setEditingCountryId] = useState<string | null>(null);
  const [countryForm, setCountryForm] = useState<CountryFormData>(DEFAULT_COUNTRY_FORM);
  const [savingCountry, setSavingCountry] = useState(false);

  const [documentForms, setDocumentForms] = useState<Record<string, DocumentFormData>>({});
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [savingDocumentCountryId, setSavingDocumentCountryId] = useState<string | null>(null);

  const [countrySearch, setCountrySearch] = useState("");
  const [docSearch, setDocSearch] = useState<Record<string, string>>({});

  const notify = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 4000);
  };

  const loadCountries = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminCountries();
      setCountries(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les pays.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCountries(); }, []);

  const loadDocuments = async (countryId: string) => {
    setDocumentsLoading(countryId);
    try {
      const docs = await fetchCountryDocuments(countryId);
      setDocumentsByCountry((prev) => ({ ...prev, [countryId]: docs.filter((d) => d.category === "DOSSIER") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les documents requis.");
    } finally {
      setDocumentsLoading(null);
    }
  };

  const toggleExpand = (countryId: string) => {
    if (expandedId === countryId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(countryId);
    if (!documentsByCountry[countryId]) loadDocuments(countryId);
  };

  const handleOpenEditCountry = (c: Country) => {
    setEditingCountryId(c.id);
    setCountryForm({ code: c.code, name: c.name, displayOrder: c.displayOrder });
    setCountryModalOpen(true);
  };

  const handleSubmitCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCountryId) return;
    setSavingCountry(true);
    try {
      await updateCountry(editingCountryId, countryForm);
      notify("Pays mis à jour ✓");
      setCountryModalOpen(false);
      await loadCountries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de l'enregistrement du pays.");
    } finally {
      setSavingCountry(false);
    }
  };

  const handleToggleCountryActive = async (c: Country) => {
    try {
      await setCountryActive(c.id, !c.active);
      await loadCountries();
      notify(c.active ? `${c.name} désactivé.` : `${c.name} réactivé.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du changement de statut.");
    }
  };

  const getDocForm = (countryId: string) => documentForms[countryId] || DEFAULT_DOCUMENT_FORM;
  const setDocForm = (countryId: string, patch: Partial<DocumentFormData>) => {
    setDocumentForms((prev) => ({ ...prev, [countryId]: { ...getDocForm(countryId), ...patch } }));
  };

  const handleStartCreateDocument = (countryId: string) => {
    setEditingDocumentId(null);
    setDocumentForms((prev) => ({ ...prev, [countryId]: DEFAULT_DOCUMENT_FORM }));
  };

  const handleStartEditDocument = (countryId: string, doc: DocumentRequirement) => {
    setEditingDocumentId(doc.id);
    setDocumentForms((prev) => ({
      ...prev,
      [countryId]: {
        name: doc.name,
        description: doc.description || "",
        required: doc.required,
        acceptedFileTypes: doc.acceptedFileTypes
      }
    }));
  };

  const handleSubmitDocument = async (countryId: string, editingId: string | null) => {
    const form = getDocForm(countryId);
    if (!form.name.trim()) {
      alert("Le nom du document est obligatoire.");
      return;
    }
    setSavingDocumentCountryId(countryId);
    try {
      if (editingId) {
        await updateCountryDocument(editingId, { ...form, category: "DOSSIER" });
        notify("Document mis à jour ✓");
      } else {
        await createCountryDocument(countryId, { ...form, category: "DOSSIER" });
        notify("Document ajouté ✓");
      }
      setEditingDocumentId(null);
      setDocumentForms((prev) => ({ ...prev, [countryId]: DEFAULT_DOCUMENT_FORM }));
      await loadDocuments(countryId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de l'enregistrement du document.");
    } finally {
      setSavingDocumentCountryId(null);
    }
  };

  const handleToggleDocumentActive = async (countryId: string, doc: DocumentRequirement) => {
    try {
      await setDocumentActive(doc.id, !doc.active);
      await loadDocuments(countryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du changement de statut du document.");
    }
  };

  const handleDeleteDocument = async (countryId: string, doc: DocumentRequirement) => {
    if (!window.confirm(`Supprimer le document "${doc.name}" ?`)) return;
    try {
      await deleteCountryDocument(doc.id);
      notify(`"${doc.name}" supprimé.`);
      await loadDocuments(countryId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Suppression impossible (document déjà utilisé par un dossier étudiant) — désactivez-le à la place.");
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
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      <div className="mt-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted font-medium">
            {countries.length} pays · Cliquez sur un pays pour gérer ses documents requis
          </p>
          <p className="mt-1 text-[11px] text-muted/70">
            Un nouveau pays se crée automatiquement depuis l'onglet "Programmes" en tapant son nom dans un nouveau programme. Les documents visa se gèrent depuis la page dédiée "Documents visa".
          </p>
        </div>
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
          <p className="text-sm text-muted">Chargement des pays...</p>
        </div>
      ) : countries.length === 0 ? (
        <div className="mt-16 text-center">
          <Globe2 className="mx-auto h-12 w-12 text-line" />
          <p className="mt-4 font-display text-lg font-bold text-dark">Aucun pays configuré</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {countries
            .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase()))
            .map((c) => {
            const isOpen = expandedId === c.id;
            const docs = documentsByCountry[c.id] || [];
            const searchD = docSearch[c.id] || "";
            const filteredDocs = docs.filter(d => d.name.toLowerCase().includes(searchD.toLowerCase()));
            
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                {/* Country row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[11px] font-bold text-brand">
                      {c.code}
                    </span>
                    <span className="font-display text-sm font-bold text-dark">{c.name}</span>
                    {!c.active && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        Désactivé
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCountryActive(c)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-bold border transition",
                      c.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-line bg-slate-50 text-muted hover:bg-slate-100"
                    )}
                  >
                    {c.active ? "Actif" : "Inactif"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditCountry(c)}
                    className="inline-flex items-center justify-center rounded-lg bg-brand/10 p-1.5 text-brand transition hover:bg-brand hover:text-white"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-slate-100 transition"
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Documents accordion body */}
                {isOpen && (
                  <div className="border-t border-line bg-slate-50 px-4 py-4">
                    {documentsLoading === c.id ? (
                      <p className="text-xs text-muted">Chargement des documents...</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                          <input
                            type="text"
                            placeholder="Rechercher un document..."
                            value={docSearch[c.id] || ""}
                            onChange={(e) => setDocSearch(prev => ({ ...prev, [c.id]: e.target.value }))}
                            className="w-full rounded-lg border border-line bg-white pl-9 pr-4 py-2 text-xs outline-none transition focus:border-brand shadow-sm"
                          />
                        </div>

                        <div className="space-y-2">
                        {docs.length === 0 ? (
                          <p className="text-xs text-muted italic">Aucun document requis configuré pour ce pays.</p>
                        ) : filteredDocs.length === 0 ? (
                          <p className="text-xs text-muted italic">Aucun document ne correspond à votre recherche.</p>
                        ) : (
                          filteredDocs.map((doc) => (
                            <div key={doc.id} className="rounded-xl border border-line bg-white p-3 shadow-sm hover:shadow-md transition">
                              {editingDocumentId === doc.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Nom du document"
                                    value={getDocForm(c.id).name}
                                    onChange={(e) => setDocForm(c.id, { name: e.target.value })}
                                    className="w-full rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-brand"
                                  />
                                  <textarea
                                    rows={2}
                                    placeholder="Description / instruction (optionnel)"
                                    value={getDocForm(c.id).description}
                                    onChange={(e) => setDocForm(c.id, { description: e.target.value })}
                                    className="w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-brand"
                                  />
                                  <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                                      Type de fichier accepté
                                    </label>
                                    <select
                                      value={getDocForm(c.id).acceptedFileTypes}
                                      onChange={(e) => setDocForm(c.id, { acceptedFileTypes: e.target.value as AcceptedFileType })}
                                      className="w-full rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-brand"
                                    >
                                      {FILE_TYPE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-[11px] font-semibold text-muted">
                                      <input
                                        type="checkbox"
                                        checked={getDocForm(c.id).required}
                                        onChange={(e) => setDocForm(c.id, { required: e.target.checked })}
                                      />
                                      Document obligatoire
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingDocumentId(null)}
                                        className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-muted hover:bg-slate-50"
                                      >
                                        Annuler
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingDocumentCountryId === c.id}
                                        onClick={() => handleSubmitDocument(c.id, doc.id)}
                                        className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                                      >
                                        Enregistrer
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2">
                                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                                    <div>
                                      <p className="text-xs font-bold text-dark">
                                        {doc.name}
                                        {doc.required && (
                                          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
                                            Obligatoire
                                          </span>
                                        )}
                                        {!doc.active && (
                                          <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                            Désactivé
                                          </span>
                                        )}
                                      </p>
                                      {doc.description && (
                                        <p className="mt-0.5 text-[11px] text-muted">{doc.description}</p>
                                      )}
                                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                                        <ImageIcon className="h-2.5 w-2.5" /> {FILE_TYPE_LABEL[doc.acceptedFileTypes]}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleDocumentActive(c.id, doc)}
                                      className="rounded-lg px-2 py-1 text-[10px] font-bold border border-line text-muted hover:bg-slate-50"
                                    >
                                      {doc.active ? "Désactiver" : "Réactiver"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditDocument(c.id, doc)}
                                      className="inline-flex items-center justify-center rounded-lg bg-brand/10 p-1.5 text-brand hover:bg-brand hover:text-white transition"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDocument(c.id, doc)}
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

                        {/* Add document inline form */}
                        {editingDocumentId === null && documentForms[c.id] !== undefined ? (
                          <div className="rounded-xl border-2 border-dashed border-brand/30 bg-brand/5 p-3 space-y-2">
                            <input
                              type="text"
                              placeholder="Nom du document (ex: Passeport)"
                              value={getDocForm(c.id).name}
                              onChange={(e) => setDocForm(c.id, { name: e.target.value })}
                              className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
                              autoFocus
                            />
                            <textarea
                              rows={2}
                              placeholder="Description / instruction (optionnel)"
                              value={getDocForm(c.id).description}
                              onChange={(e) => setDocForm(c.id, { description: e.target.value })}
                              className="w-full resize-none rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
                            />
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                                Type de fichier accepté
                              </label>
                              <select
                                value={getDocForm(c.id).acceptedFileTypes}
                                onChange={(e) => setDocForm(c.id, { acceptedFileTypes: e.target.value as AcceptedFileType })}
                                className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
                              >
                                {FILE_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-[11px] font-semibold text-muted">
                                <input
                                  type="checkbox"
                                  checked={getDocForm(c.id).required}
                                  onChange={(e) => setDocForm(c.id, { required: e.target.checked })}
                                />
                                Document obligatoire
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDocumentForms((prev) => {
                                    const next = { ...prev };
                                    delete next[c.id];
                                    return next;
                                  })}
                                  className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-muted hover:bg-white"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  disabled={savingDocumentCountryId === c.id}
                                  onClick={() => handleSubmitDocument(c.id, null)}
                                  className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                                >
                                  Ajouter
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartCreateDocument(c.id)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-white py-2 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand/5"
                          >
                            <Plus className="h-3.5 w-3.5" /> Ajouter un document requis
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

      {/* Country modal */}
      {countryModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setCountryModalOpen(false); }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-brand/5 to-violet-50 px-6 py-4">
              <h2 className="font-display text-lg font-extrabold text-dark">
                ✏️ Modifier le pays
              </h2>
              <button
                type="button"
                onClick={() => setCountryModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-muted transition hover:bg-red-50 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitCountry} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                  Code pays <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: IT, DE, PL..."
                  value={countryForm.code}
                  onChange={(e) => setCountryForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  maxLength={10}
                  className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                  Nom du pays <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Italie"
                  value={countryForm.name}
                  onChange={(e) => setCountryForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">Ordre d'affichage</label>
                <input
                  type="number"
                  min={0}
                  value={countryForm.displayOrder}
                  onChange={(e) => setCountryForm((prev) => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCountryModalOpen(false)}
                  className="rounded-xl border border-line bg-slate-50 px-5 py-2.5 text-sm font-bold text-dark hover:bg-slate-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingCountry}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:opacity-90 transition disabled:opacity-60"
                >
                  {savingCountry ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
