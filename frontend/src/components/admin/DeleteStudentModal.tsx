import { deleteStudent, fetchStudentDeletionPreview, type StudentDeletionPreview } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, Ban, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

// Confirmation de suppression d'un étudiant (fenêtre de l'application, pas la
// boîte d'alerte du navigateur). Charge d'abord ce qui sera réellement effacé.
export default function DeleteStudentModal({
  student,
  onClose,
  onDeleted,
  onBlockInstead
}: {
  student: { id: string; prenom: string; nom: string; email: string; isActive: boolean };
  onClose: () => void;
  onDeleted: () => void;
  /** Proposé quand la suppression est impossible (commissions) ou comme alternative. */
  onBlockInstead: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<StudentDeletionPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStudentDeletionPreview(student.id)
      .then(setPreview)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Impossible de vérifier ce compte."));
  }, [student.id]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [busy, onClose]);

  async function confirmDelete() {
    setBusy(true);
    setError("");
    try {
      await deleteStudent(student.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    setError("");
    try {
      await onBlockInstead();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
      setBusy(false);
    }
  }

  const name = `${student.prenom} ${student.nom}`.trim();
  const items = preview
    ? [
        "Son compte, son profil et son historique",
        preview.documents ? `${plural(preview.documents, "document déposé", "documents déposés")} (fichiers effacés du serveur)` : null,
        preview.applications ? `${plural(preview.applications, "candidature")} et leur suivi (entretiens, visa)` : null,
        preview.codesUsed ? `${plural(preview.codesUsed, "code conseiller utilisé", "codes conseiller utilisés")} pour s'inscrire` : null,
        "Ses notifications"
      ].filter(Boolean)
    : [];

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-student-title"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Trash2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="delete-student-title" className="font-display text-lg font-bold text-dark">Supprimer cet étudiant ?</h3>
            <p className="truncate text-sm font-semibold text-dark">{name}</p>
            <p className="truncate text-xs text-muted">{student.email}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer" className="rounded-full p-1.5 text-muted transition hover:bg-slate-100 hover:text-dark">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadError ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
        ) : !preview ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Vérification du compte...</p>
        ) : !preview.canDelete ? (
          <>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-snug text-amber-900">
              <p className="flex items-center gap-1.5 font-bold"><AlertTriangle className="h-4 w-4 shrink-0" /> Suppression impossible</p>
              <p className="mt-1">
                Cet étudiant a généré {plural(preview.commissions, "commission")} pour des conseillers ou des responsables visa. Le supprimer effacerait
                ces gains : l'historique de commissions doit être conservé.
              </p>
              <p className="mt-1">Vous pouvez à la place <strong>bloquer son compte</strong> : il ne pourra plus se connecter, et tout son historique est gardé.</p>
            </div>
            {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-line py-2.5 text-sm font-bold text-mid">Fermer</button>
              {student.isActive && (
                <button
                  type="button"
                  onClick={block}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-500 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
                >
                  <Ban className="h-4 w-4" /> {busy ? "..." : "Bloquer le compte"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Action définitive, impossible à annuler
              </p>
              <p className="mt-1.5 text-xs font-semibold text-red-800">Sera supprimé :</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-red-900">
                {items.map((item) => (
                  <li key={item as string}>{item}</li>
                ))}
              </ul>
              {preview.whatsappContacts > 0 && (
                <p className="mt-2 text-[12px] text-red-900/80">
                  Sa conversation WhatsApp est conservée : elle est simplement détachée de son compte.
                </p>
              )}
            </div>

            {student.isActive && (
              <p className="mt-3 text-xs text-muted">
                Pour garder son historique sans le supprimer, préférez{" "}
                <button type="button" onClick={block} disabled={busy} className="font-bold text-amber-700 underline disabled:opacity-60">
                  bloquer son compte
                </button>.
              </p>
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-dark">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
              />
              <span>Je comprends que la suppression de <strong>{name}</strong> est définitive.</span>
            </label>

            {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-line py-2.5 text-sm font-bold text-mid">
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!understood || busy}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold text-white transition",
                  understood && !busy ? "bg-red-600 hover:bg-red-700" : "cursor-not-allowed bg-red-300"
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {busy ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
