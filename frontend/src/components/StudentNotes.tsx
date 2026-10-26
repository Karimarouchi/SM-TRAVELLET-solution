import { confirmDialog } from "@/components/ui/dialog-host";
import { useLanguage } from "@/lib/i18n";
import { addStudentNote, deleteStudentNote, fetchStudentNotes, type StudentNote } from "@/lib/notes";
import { cn } from "@/lib/utils";
import { Lock, MessageSquarePlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

function authorRoleLabel(role: string) {
  if (role === "Conseiller") return "Conseiller(ère) commercial(e)";
  if (role === "Responsable Dossier" || role === "Responsable dossier") return "Gestionnaire de dossiers";
  return role;
}

// Remarques internes sur un étudiant : visibles seulement par l'équipe SM (admin, conseiller(ère) commercial(e), Gestionnaire de dossiers).
export default function StudentNotes({ studentId }: { studentId: string }) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState<StudentNote[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotes(null);
    fetchStudentNotes(studentId).then(setNotes).catch((err) => setError(err instanceof Error ? err.message : t("Remarques indisponibles.", "Notes unavailable.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await addStudentNote(studentId, text.trim());
      setNotes((prev) => [created, ...(prev || [])]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Ajout impossible.", "Unable to add."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note: StudentNote) => {
    if (!(await confirmDialog(t("Supprimer cette remarque ?", "Delete this note?"), { tone: "danger", confirmLabel: t("Supprimer", "Delete") }))) return;
    try {
      await deleteStudentNote(note.id);
      setNotes((prev) => (prev || []).filter((n) => n.id !== note.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Suppression impossible.", "Unable to delete."));
    }
  };

  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50/40 p-5 shadow-sm" aria-label={t("Remarques internes", "Internal notes")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
          <MessageSquarePlus className="h-5 w-5 text-brand" aria-hidden /> {t("Remarques internes", "Internal notes")}
          {notes && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-muted">{notes.length}</span>}
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
          <Lock className="h-3 w-3" aria-hidden /> {t("Visible par l'équipe SM seulement", "Visible to the SM team only")}
        </span>
      </div>

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={t("Écrire une remarque sur cet étudiant (l'étudiant ne la verra jamais)…", "Write a note about this student (the student will never see it)…")}
          className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">{text.length}/2000</span>
          <button type="button" onClick={add} disabled={busy || !text.trim()} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-hover disabled:opacity-50">
            {busy ? t("Ajout…", "Adding…") : t("Ajouter la remarque", "Add note")}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

      <div className={cn("mt-4 space-y-2.5", notes && notes.length > 4 && "max-h-[420px] overflow-y-auto pr-1")}>
        {notes === null && !error && <p className="text-xs text-muted">{t("Chargement…", "Loading…")}</p>}
        {notes && notes.length === 0 && <p className="rounded-xl border border-dashed border-amber-200 bg-white/60 px-3 py-3 text-xs text-muted">{t("Aucune remarque pour l'instant.", "No notes yet.")}</p>}
        {notes?.map((note) => (
          <article key={note.id} className="rounded-xl border border-line bg-white px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs">
                <span className="font-bold text-dark">{note.authorName}</span>
                {note.authorRole && <span className="ml-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">{authorRoleLabel(note.authorRole)}</span>}
                <span className="ml-2 text-muted">{new Date(note.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </p>
              {note.canDelete && (
                <button type="button" onClick={() => remove(note)} title={t("Supprimer", "Delete")} aria-label={t("Supprimer la remarque", "Delete the note")} className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-dark">{note.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
