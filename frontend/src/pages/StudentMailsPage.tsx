import { fetchMyMails, markMyMailRead, type StudentMail } from "@/lib/mail";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronDown, Mail, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";

const when = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

// Espace étudiant : tous les e-mails que l'équipe SM lui a envoyés, avec la date d'envoi. Rien n'est à « chercher » dans sa boîte mail.
export default function StudentMailsPage() {
  const { t } = useLanguage();
  const [mails, setMails] = useState<StudentMail[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyMails()
      .then(setMails)
      .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger vos e-mails.", "Unable to load your emails.")));
  }, [t]);

  const toggle = (mail: StudentMail) => {
    setOpenId((current) => (current === mail.id ? null : mail.id));
    if (!mail.read) {
      markMyMailRead(mail.id)
        .then(() => {
          setMails((prev) => (prev || []).map((m) => (m.id === mail.id ? { ...m, read: true } : m)));
          // Le badge de la barre du haut se met à jour.
          window.dispatchEvent(new Event("student-mails-changed"));
        })
        .catch(() => undefined);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl"><Mail className="h-7 w-7" aria-hidden /> {t("Mes e-mails", "My emails")}</h1>
        <p className="mt-2 text-sm text-white/85">{t("Tous les e-mails que l'équipe SM Travel vous a envoyés, avec leur date. Retrouvez ici chaque message, même si vous ne l'avez pas vu dans votre boîte mail.", "All the emails the SM Travel team sent you, with their date. Find every message here, even if you did not see it in your inbox.")}</p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!mails && !error && <p className="mt-8 text-center text-sm text-muted">{t("Chargement…", "Loading…")}</p>}
      {mails && mails.length === 0 && (
        <p className="mt-6 rounded-[20px] border border-dashed border-line bg-white p-8 text-center text-sm text-muted">{t("Aucun e-mail reçu pour le moment.", "No email received yet.")}</p>
      )}

      <ul className="mt-6 space-y-3">
        {mails?.map((mail) => {
          const open = openId === mail.id;
          return (
            <li key={mail.id} className={cn("rounded-[20px] border bg-white shadow-sm transition", mail.read ? "border-line" : "border-brand/40")}>
              <button type="button" onClick={() => toggle(mail)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {!mail.read && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">{t("Nouveau", "New")}</span>}
                    <span className={cn("text-sm", mail.read ? "font-semibold text-dark" : "font-extrabold text-dark")}>{mail.subject}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {when(mail.sentAt)} · SM Travel{mail.senderName ? ` (${mail.senderName})` : ""}
                    {mail.attachments.length > 0 && <span className="ml-2 inline-flex items-center gap-1"><Paperclip className="h-3 w-3" aria-hidden /> {mail.attachments.length}</span>}
                  </span>
                </span>
                <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
              </button>
              {open && (
                <div className="border-t border-line/60 px-5 py-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-dark">{mail.body}</p>
                  {mail.attachments.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {mail.attachments.map((a, i) => (
                        <li key={`${a.filename}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-mid">
                          <Paperclip className="h-3 w-3 text-brand" aria-hidden /> {a.filename} <span className="text-muted">{size(a.size)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {mail.attachments.length > 0 && <p className="mt-2 text-[11px] text-muted">{t("Les pièces jointes ont été envoyées avec ce message dans votre boîte mail.", "The attachments were sent with this message to your inbox.")}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
