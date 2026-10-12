import { fetchStudentMails, type StudentMail } from "@/lib/mail";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CheckCheck, ChevronDown, Mail, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";

const when = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Profil étudiant (équipe SM) : les e-mails envoyés à l'étudiant depuis la page Mail, avec la date d'envoi
// et la preuve qu'il les a ouverts dans son espace.
export default function StudentMailLog({ studentId }: { studentId: string }) {
  const { t } = useLanguage();
  const [mails, setMails] = useState<StudentMail[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setMails(null);
    fetchStudentMails(studentId).then(setMails).catch(() => setMails([]));
  }, [studentId]);

  if (mails === null || mails.length === 0) return null;

  return (
    <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm" aria-label={t("E-mails envoyés à l'étudiant", "Emails sent to the student")}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
        <Mail className="h-5 w-5 text-brand" aria-hidden /> {t("E-mails envoyés à l'étudiant", "Emails sent to the student")}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-muted">{mails.length}</span>
      </h2>
      <ul className="mt-3 space-y-2">
        {mails.map((mail) => (
          <li key={mail.id} className="rounded-xl border border-line">
            <button type="button" onClick={() => setOpen(open === mail.id ? null : mail.id)} aria-expanded={open === mail.id} className="flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-dark">{mail.subject}</span>
                <span className="block text-[11px] text-muted">
                  {when(mail.sentAt)}{mail.senderName ? ` · ${mail.senderName}` : ""}
                  {mail.attachments.length > 0 && <span className="ml-2 inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" aria-hidden /> {mail.attachments.length}</span>}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", mail.readAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                  {mail.readAt ? <><CheckCheck className="h-3 w-3" aria-hidden /> {t("Lu le", "Read on")} {when(mail.readAt)}</> : t("Pas encore ouvert", "Not opened yet")}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open === mail.id && "rotate-180")} aria-hidden />
              </span>
            </button>
            {open === mail.id && <p className="whitespace-pre-wrap break-words border-t border-line/60 px-3.5 py-3 text-sm leading-relaxed text-dark">{mail.body}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
