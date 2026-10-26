import { uploadApplicationVisaDocument, type VisaDocumentChecklistItem } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useState } from "react";

// Conseiller(ère) commercial(e) ou Gestionnaire de dossiers : dépose un document visa à la place de l'étudiant (validé directement).
export default function StaffVisaUploadButton({
  applicationId,
  doc,
  onUploaded
}: {
  applicationId: string;
  doc: VisaDocumentChecklistItem;
  onUploaded: (d: VisaDocumentChecklistItem) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = doc.acceptedFileTypes === "PDF" ? "application/pdf" : doc.acceptedFileTypes === "IMAGE" ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,application/pdf";

  const send = (file: File) =>
    new Promise<VisaDocumentChecklistItem>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t("Lecture du fichier impossible.", "Unable to read the file.")));
      reader.onload = () => uploadApplicationVisaDocument(applicationId, doc.requirementId, reader.result as string, file.name).then(resolve, reject);
      reader.readAsDataURL(file);
    });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/20", busy && "pointer-events-none opacity-60")}>
        <Upload className="h-3 w-3" /> {doc.fileUrl ? t("Remplacer le fichier", "Replace the file") : t("Ajouter le document", "Add the document")}
        <input
          type="file"
          className="sr-only"
          accept={accept}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              onUploaded(await send(file));
            } catch (err) {
              setError(err instanceof Error ? err.message : t("Échec de l'envoi.", "Upload failed."));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <span className="text-[11px] text-muted">{t("Le document est validé automatiquement.", "The document is approved automatically.")}</span>
      {error && <p className="w-full text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
