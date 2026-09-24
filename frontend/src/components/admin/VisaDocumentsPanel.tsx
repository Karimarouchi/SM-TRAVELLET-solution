import {
  deleteCountryDocument,
  createCountryDocument,
  fetchAdminCountries,
  fetchCountryDocuments,
  setDocumentActive,
  updateCountryDocument,
  type AcceptedFileType,
  type Country,
  type DocumentRequirement
} from "@/lib/auth";
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

// Gestion des documents VISA par destination — utilisable à la fois comme
// onglet de /admin/programmes (Admin) et sur la page dédiée
// /admin/visa-documents (comptes avec la seule permission MANAGE_VISA_DOCUMENTS,
// ou RDV limités à leurs pays — contrôle fin fait côté backend).
export default function VisaDocumentsPanel() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [documentsByCountry, setDocumentsByCountry] = useState<Record<string, DocumentRequirement[]>>({});
  const [documentsLoading, setDocumentsLoading] = useState<string | null>(null);

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
      setDocumentsByCountry((prev) => ({ ...prev, [countryId]: docs.filter((d) => d.category === "VISA") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les documents visa.");
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
        await updateCountryDocument(editingId, { ...form, category: "VISA" });
        notify("Document visa mis à jour ✓");
      } else {
        await createCountryDocument(countryId, { ...form, category: "VISA" });
        notify("Document visa ajouté ✓");
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
    if (!window.confirm(`Supprimer le document visa "${doc.name}" ?`)) return;
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
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <X className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs font-medium text-muted">
          {countries.length} pays · Cliquez sur un pays pour gérer ses documents visa
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
                <button
                  type="button"
                  onClick={() => toggleExpand(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[11px] font-bold text-brand">
                    {c.code}
                  </span>
                  <span className="flex-1 font-display text-sm font-bold text-dark">{c.name}</span>
                  {!c.active && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      Pays désactivé
                    </span>
                  )}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                </button>

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
                          <p className="text-xs italic text-muted">Aucun document visa configuré pour ce pays.</p>
                        ) : filteredDocs.length === 0 ? (
                          <p className="text-xs italic text-muted">Aucun document ne correspond à votre recherche.</p>
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
                                      className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-muted hover:bg-slate-50"
                                    >
                                      {doc.active ? "Désactiver" : "Réactiver"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditDocument(c.id, doc)}
                                      className="inline-flex items-center justify-center rounded-lg bg-brand/10 p-1.5 text-brand transition hover:bg-brand hover:text-white"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDocument(c.id, doc)}
                                      className="inline-flex items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 transition hover:bg-red-500 hover:text-white"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}

                        {editingDocumentId === null && documentForms[c.id] !== undefined ? (
                          <div className="space-y-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand/5 p-3">
                            <input
                              type="text"
                              placeholder="Nom du document visa (ex: Justificatif de fonds)"
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
                            <Plus className="h-3.5 w-3.5" /> Ajouter un document visa
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
