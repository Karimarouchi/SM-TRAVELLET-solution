import { fetchMailRecipients, type MailRecipient } from "@/lib/mail";
import { cn } from "@/lib/utils";
import { UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// Destinataires d'un mail : on cherche un étudiant par son nom et on clique pour l'ajouter. Le conseiller et le
// Responsable Dossier ne voient que leurs propres étudiants ; seul l'admin peut aussi saisir une adresse libre.
export default function RecipientInput({
  value,
  onChange,
  allowFree,
  placeholder,
  names
}: {
  value: string;
  onChange: (next: string) => void;
  allowFree: boolean;
  placeholder?: string;
  /** Noms déjà connus (adresse → nom), pour afficher le nom d'un étudiant au lieu de son adresse. */
  names?: Record<string, string>;
}) {
  const emails = useMemo(() => value.split(/[;,]/).map((e) => e.trim()).filter(Boolean), [value]);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<MailRecipient[]>([]);
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<Record<string, string>>(names || {});
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchMailRecipients(text)
        .then((list) => !cancelled && setSuggestions(list.filter((r) => !emails.some((e) => e.toLowerCase() === r.email.toLowerCase()))))
        .catch(() => !cancelled && setSuggestions([]));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, open, emails]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const set = (list: string[]) => onChange(list.join(", "));
  const add = (email: string, name?: string) => {
    if (!email || emails.some((e) => e.toLowerCase() === email.toLowerCase())) return;
    if (name) setKnown((prev) => ({ ...prev, [email.toLowerCase()]: name }));
    set([...emails, email]);
    setText("");
    setOpen(false);
  };
  const commitTyped = () => {
    const typed = text.trim().replace(/[;,]$/, "");
    if (allowFree && EMAIL.test(typed)) add(typed);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        {emails.map((email) => {
          const label = known[email.toLowerCase()] || names?.[email.toLowerCase()];
          return (
            <span key={email} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand/10 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-brand" title={email}>
              <span className="truncate">{label || email}</span>
              <button type="button" onClick={() => set(emails.filter((e) => e !== email))} aria-label={`Retirer ${label || email}`} className="rounded-full p-0.5 hover:bg-brand/20"><X className="h-3 w-3" /></button>
            </span>
          );
        })}
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === "," || e.key === ";") && text.trim()) {
              e.preventDefault();
              if (suggestions.length === 1 && !allowFree) add(suggestions[0].email, suggestions[0].name);
              else commitTyped();
            }
            if (e.key === "Backspace" && !text && emails.length) set(emails.slice(0, -1));
          }}
          placeholder={emails.length ? "" : placeholder}
          className="min-w-[140px] flex-1 border-0 bg-transparent py-1.5 text-sm outline-none"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-xl">
          {suggestions.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted">
              {allowFree ? "Aucun étudiant trouvé : saisissez une adresse e-mail puis Entrée." : "Aucun de vos étudiants ne correspond. Vous ne pouvez écrire qu'aux étudiants qui vous sont assignés."}
            </p>
          ) : (
            suggestions.map((r) => (
              <button key={r.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(r.email, r.name)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-brand/10")}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><UserRound className="h-3.5 w-3.5" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-dark">{r.name}</span>
                  <span className="block truncate text-[11px] text-muted">{r.email}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
