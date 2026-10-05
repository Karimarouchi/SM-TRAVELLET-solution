import {
  createUniversityDocument,
  deleteUniversityDocument,
  fetchUniversityDocuments,
  setUniversityDocumentActive,
  type AcceptedFileType,
  type DocumentRequirement
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const FILE_TYPES: Array<{ value: AcceptedFileType; label: string }> = [
  { value: "IMAGE_PDF", label: "Image ou PDF" },
  { value: "PDF", label: "PDF" },
  { value: "IMAGE", label: "Image" }
];

// Documents demandés EN PLUS de ceux du pays, pour une université précise.
// Utilisé par l'admin (universités conventionnées) et par le conseiller
// (universités hors conventions de ses étudiants).
export default function UniversityDocumentsEditor({
  universityId,
  universityName,
  onChanged
}: {
  universityId: string;
  universityName: string;
  onChanged?: () => void;
}) {
  const [docs, setDocs] = useState<DocumentRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [required, setRequired] = useState(true);
  const [fileType, setFileType] = useState<AcceptedFileType>("IMAGE_PDF");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetchUniversityDocuments(universityId)
      .then(setDocs)
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [universityId]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!name.trim()) return;
    run(async () => {
      await createUniversityDocument(universityId, { name: name.trim(), required, acceptedFileTypes: fileType });
      setName("");
    });
  };

  return (
    <div className="rounded-xl border border-line bg-slate-50 p-3">
      <p className="text-xs font-bold text-dark">Documents spécifiques à {universityName}</p>
      <p className="mt-0.5 text-[11px] text-muted">
        Demandés en plus des documents communs du pays (déposés une seule fois par l'étudiant).
      </p>

      {error && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">{error}</p>}

      <div className="mt-2 space-y-1.5">
        {loading ? (
          <p className="text-[11px] text-muted">Chargement…</p>
        ) : docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-white px-3 py-2 text-[11px] text-muted">
            Aucun document spécifique pour l'instant : seuls les documents communs du pays sont demandés.
          </p>
        ) : (
          docs.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
              <span className={cn("min-w-0 flex-1 truncate text-xs font-semibold", doc.active ? "text-dark" : "text-muted line-through")}>
                {doc.name}
                {doc.required && <span className="ml-1 text-red-500">*</span>}
              </span>
              <span className="text-[10px] text-muted">{FILE_TYPES.find((f) => f.value === doc.acceptedFileTypes)?.label}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => setUniversityDocumentActive(doc.id, !doc.active))}
                className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-muted hover:bg-slate-50 disabled:opacity-60"
              >
                {doc.active ? "Désactiver" : "Réactiver"}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Supprimer ${doc.name}`}
                onClick={() => {
                  if (window.confirm(`Supprimer « ${doc.name} » ?`)) run(() => deleteUniversityDocument(doc.id));
                }}
                className="rounded-lg bg-red-50 p-1.5 text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nom du document (ex. Lettre de motivation)"
          className="min-w-[180px] flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
        />
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as AcceptedFileType)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"
          aria-label="Type de fichier accepté"
        >
          {FILE_TYPES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-mid">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-3.5 w-3.5 accent-violet-600" />
          Obligatoire
        </label>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Ajouter
        </button>
      </div>
    </div>
  );
}
