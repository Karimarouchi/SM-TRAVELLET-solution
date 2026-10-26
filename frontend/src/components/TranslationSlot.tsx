import {
  deleteTranslation,
  openProtectedFile,
  reviewTranslation,
  uploadMyTranslation,
  uploadTranslationAsStaff,
  type TranslationSlot as Translation
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Languages, ThumbsDown, ThumbsUp, Trash2, Upload, XCircle } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// Champ « traduction » d'un document validé : demandé par le conseiller(ère) commercial(e) (ou l'admin), rempli par l'étudiant ou par le conseiller(ère) commercial(e).
// mode "student" : l'étudiant dépose ; "staff" : le conseiller(ère) commercial(e) / l'admin dépose (validé d'office), valide, refuse ou supprime la demande ;
// mode "readonly" : simple suivi (Gestionnaire de dossiers).
export default function TranslationSlot({
  translation,
  docName,
  mode,
  onChanged
}: {
  translation: Translation;
  docName: string;
  mode: "student" | "staff" | "readonly";
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const meta = {
    PENDING: { label: t("À déposer", "To upload"), tone: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
    SUBMITTED: { label: t("Envoyée · en vérification", "Sent · under review"), tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    VALIDATED: { label: t("Validée", "Approved"), tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    REJECTED: { label: t("Refusée · à renvoyer", "Rejected · resend"), tone: "bg-red-50 text-red-600 border-red-200", icon: XCircle }
  }[translation.status];
  const StatusIcon = meta.icon;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action impossible.", "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(t("Le fichier dépasse 5 Mo.", "The file exceeds 5 MB."));
      return;
    }
    await run(async () => {
      const data = await readFile(file);
      return mode === "staff" ? uploadTranslationAsStaff(translation.id, data, file.name) : uploadMyTranslation(translation.id, data, file.name);
    });
  };

  // L'étudiant ne peut plus changer une traduction validée ; le conseiller(ère) commercial(e) / l'admin peut toujours la remplacer.
  const showUpload = (mode === "student" && translation.status !== "VALIDATED") || mode === "staff";

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-violet-900">
          <Languages className="h-3.5 w-3.5" aria-hidden /> {t("Traduction demandée", "Translation requested")} · <span className="font-semibold text-violet-800">{docName}</span>
        </p>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold", meta.tone)}>
          <StatusIcon className="h-3 w-3" aria-hidden /> {meta.label}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-violet-800">
        {mode === "student"
          ? t("Votre conseiller(ère) commercial(e) demande aussi la version traduite de ce document. Déposez-la ici.", "Your advisor also asks for the translated version of this document. Upload it here.")
          : t("Version traduite à déposer par l'étudiant ou par le conseiller(ère) commercial(e).", "Translated version to be uploaded by the student or the advisor.")}
      </p>

      {translation.status === "REJECTED" && translation.rejectionReason && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{translation.rejectionReason}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {translation.fileUrl && (
          <button
            type="button"
            onClick={() => openProtectedFile(translation.fileUrl!).catch((err) => setError(err instanceof Error ? err.message : "Impossible d'ouvrir ce fichier."))}
            className="max-w-[220px] truncate text-xs text-brand underline"
          >
            {translation.originalFilename || t("Voir le fichier", "View file")}
          </button>
        )}
        {showUpload && (
          <>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand/40 bg-white px-3 py-1.5 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand/5 disabled:opacity-60">
              <Upload className="h-3 w-3" aria-hidden /> {translation.fileUrl ? t("Remplacer le fichier", "Replace file") : t("Déposer la traduction", "Upload the translation")}
            </button>
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />
          </>
        )}
        {mode === "staff" && translation.status === "SUBMITTED" && !rejecting && (
          <>
            <button type="button" disabled={busy} onClick={() => run(() => reviewTranslation(translation.id, "VALIDATED"))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60">
              <ThumbsUp className="h-3 w-3" aria-hidden /> {t("Valider", "Approve")}
            </button>
            <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100">
              <ThumbsDown className="h-3 w-3" aria-hidden /> {t("Refuser", "Reject")}
            </button>
          </>
        )}
        {mode === "staff" && !translation.fileUrl && (
          <button type="button" disabled={busy} onClick={() => run(() => deleteTranslation(translation.id))} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60">
            <Trash2 className="h-3 w-3" aria-hidden /> {t("Annuler la demande", "Cancel the request")}
          </button>
        )}
      </div>

      {mode === "staff" && rejecting && (
        <div className="mt-2.5 space-y-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("Motif du refus (obligatoire, visible par l'étudiant)", "Rejection reason (required, visible to the student)")} className="w-full resize-none rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-brand" autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setRejecting(false); setReason(""); }} className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-muted hover:bg-slate-50">{t("Annuler", "Cancel")}</button>
            <button type="button" disabled={busy || !reason.trim()} onClick={() => run(async () => { await reviewTranslation(translation.id, "REJECTED", reason.trim()); setRejecting(false); setReason(""); })} className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-60">{t("Confirmer le refus", "Confirm rejection")}</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
