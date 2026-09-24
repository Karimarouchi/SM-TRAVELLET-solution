import { uploadMyVisaDocument, type VisaDocumentChecklistItem } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, FileText, Upload, XCircle } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

function statusMeta(t: (fr: string, en: string) => string): Record<VisaDocumentChecklistItem["status"], { label: string; color: string; icon: typeof Clock }> {
  return {
    PENDING: { label: t("À déposer", "To upload"), color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
    SUBMITTED: { label: t("Envoyé · en vérification", "Sent · under review"), color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    VALIDATED: { label: t("Validé", "Approved"), color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    REJECTED: { label: t("Refusé · à renvoyer", "Rejected · resend"), color: "bg-red-50 text-red-600 border-red-200", icon: XCircle }
  };
}

function acceptAttr(type: VisaDocumentChecklistItem["acceptedFileTypes"]) {
  if (type === "IMAGE") return "image/png,image/jpeg,image/webp";
  if (type === "PDF") return "application/pdf";
  return "image/png,image/jpeg,image/webp,application/pdf";
}

function VisaDocumentRow({ doc, onUploaded }: { doc: VisaDocumentChecklistItem; onUploaded: (updated: VisaDocumentChecklistItem) => void }) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = statusMeta(t)[doc.status];
  const StatusIcon = meta.icon;

  const handleFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(t("Le fichier dépasse 5 Mo.", "The file exceeds 5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(true);
      setError("");
      try {
        const updated = await uploadMyVisaDocument(doc.requirementId, reader.result as string, file.name);
        onUploaded(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("Échec de l'envoi.", "Upload failed."));
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-bold text-dark">
              {doc.name}
              {doc.required && <span className="ml-1.5 text-red-500">*</span>}
            </p>
            {doc.description && <p className="mt-0.5 text-xs text-muted">{doc.description}</p>}
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.color)}>
          <StatusIcon className="h-3 w-3" /> {meta.label}
        </span>
      </div>

      {doc.status === "REJECTED" && doc.rejectionReason && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {doc.rejectionReason}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-2 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand/10 disabled:opacity-60"
        >
          {uploading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {doc.fileUrl ? t("Remplacer le fichier", "Replace file") : t("Déposer le fichier", "Upload file")}
        </button>
        {doc.originalFilename && <span className="text-xs text-muted truncate max-w-[200px]">{doc.originalFilename}</span>}
        <input ref={inputRef} type="file" accept={acceptAttr(doc.acceptedFileTypes)} className="hidden" onChange={onChange} />
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Liste pure des documents visa, réutilisée dans l'onglet "Documents visa"
// de /documents. Le chargement/l'état sont gérés par la page appelante.
export default function VisaDocumentsChecklist({
  documents,
  onUploaded
}: {
  documents: VisaDocumentChecklistItem[];
  onUploaded: (updated: VisaDocumentChecklistItem) => void;
}) {
  const { t } = useLanguage();
  if (documents.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="mt-4 font-display text-lg font-bold text-dark">{t("Aucun document visa requis pour l'instant", "No visa document required yet")}</p>
        <p className="text-sm text-muted">
          {t("La liste apparaîtra dès que votre responsable dossier visa l'aura configurée.", "The list will appear once your visa officer has configured it.")}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-3">
      {documents.map((doc) => (
        <VisaDocumentRow key={doc.requirementId} doc={doc} onUploaded={onUploaded} />
      ))}
    </div>
  );
}
