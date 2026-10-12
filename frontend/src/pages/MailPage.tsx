import {
  downloadMailAttachment,
  fetchMailList,
  fetchMailMessage,
  fetchMailStatus,
  formatBytes,
  sendMail,
  type MailAddress,
  type MailFolder,
  type MailList,
  type MailListItem,
  type MailMessage,
  type MailStatus,
  type OutgoingAttachment
} from "@/lib/mail";
import { getSession } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Inbox, Loader2, Mail, Paperclip, PenSquare, Reply, RefreshCw, Search, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const MAX_ATTACHMENTS_BYTES = 10 * 1024 * 1024;

const nameOf = (a: MailAddress | null | undefined) => (a ? a.name || a.address : "—");

function shortDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return date.toLocaleDateString("fr-FR");
}

const longDate = (value: string | null) => (value ? new Date(value).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

type Draft = { to: string; cc: string; subject: string; text: string; inReplyTo?: string; references?: string[] };

function signature() {
  const user = getSession()?.user;
  const name = user ? `${user.prenom} ${user.nom}`.trim() : "";
  return `\n\nCordialement,\n${name}\nSM Travel`;
}

// Contenu d'un mail HTML dans un cadre isolé : aucun script, aucun accès à l'application, images distantes masquées par défaut.
function MessageBody({ message, showImages }: { message: MailMessage; showImages: boolean }) {
  const srcDoc = useMemo(() => {
    const images = showImages ? "data: https: http:" : "data:";
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${images}; style-src 'unsafe-inline'"><base target="_blank"><style>body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}a{color:#6d28d9}</style></head><body>${message.html}</body></html>`;
  }, [message.html, showImages]);
  if (message.html) {
    return <iframe title="Contenu du mail" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={srcDoc} className="h-[56vh] w-full rounded-xl border border-line bg-white" />;
  }
  return <pre className="whitespace-pre-wrap break-words rounded-xl border border-line bg-white p-4 font-sans text-sm leading-relaxed text-dark">{message.text || "(message vide)"}</pre>;
}

function ComposeModal({ initial, onClose, onSent }: { initial: Draft; onClose: () => void; onSent: () => void }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft>(initial);
  const [showCc, setShowCc] = useState(Boolean(initial.cc));
  const [attachments, setAttachments] = useState<Array<OutgoingAttachment & { size: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const total = attachments.reduce((sum, a) => sum + a.size, 0);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const next = [...attachments];
    let bytes = total;
    for (const file of Array.from(files)) {
      bytes += file.size;
      if (bytes > MAX_ATTACHMENTS_BYTES) {
        setError(t("Les pièces jointes dépassent 10 Mo au total.", "Attachments exceed 10 MB in total."));
        break;
      }
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read"));
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!content) {
        setError(t("Lecture du fichier impossible.", "Unable to read the file."));
        continue;
      }
      next.push({ filename: file.name, contentType: file.type || "application/octet-stream", content, size: file.size });
    }
    setAttachments(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await sendMail({
        to: draft.to,
        cc: draft.cc || undefined,
        subject: draft.subject,
        text: draft.text,
        inReplyTo: draft.inReplyTo,
        references: draft.references,
        attachments: attachments.map(({ filename, contentType, content }) => ({ filename, contentType, content }))
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Envoi impossible.", "Unable to send."));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" role="dialog" aria-label={t("Nouveau mail", "New mail")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-dark">{draft.inReplyTo ? t("Répondre", "Reply") : t("Nouveau mail", "New mail")}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t("Fermer", "Close")} className="rounded-full p-2 text-muted hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted">{t("À", "To")}</label>
              {!showCc && <button type="button" onClick={() => setShowCc(true)} className="text-[11px] font-bold text-brand hover:underline">{t("Ajouter Cc", "Add Cc")}</button>}
            </div>
            <input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder="nom@exemple.com" className={field} autoFocus={!draft.to} />
          </div>
          {showCc && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Cc</label>
              <input value={draft.cc} onChange={(e) => setDraft({ ...draft, cc: e.target.value })} placeholder="nom@exemple.com, autre@exemple.com" className={field} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{t("Objet", "Subject")}</label>
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} maxLength={300} className={field} autoFocus={Boolean(draft.to) && !draft.subject} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{t("Message", "Message")}</label>
            <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={11} className={cn(field, "resize-y leading-relaxed")} autoFocus={Boolean(draft.to && draft.subject)} />
          </div>

          {attachments.length > 0 && (
            <ul className="space-y-1.5">
              {attachments.map((a, i) => (
                <li key={`${a.filename}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2"><Paperclip className="h-3.5 w-3.5 shrink-0 text-brand" /> <span className="truncate font-semibold text-dark">{a.filename}</span> <span className="shrink-0 text-muted">{formatBytes(a.size)}</span></span>
                  <button type="button" onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} aria-label={t("Retirer", "Remove")} className="rounded-full p-1 text-muted hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-mid transition hover:border-brand hover:text-brand">
              <Paperclip className="h-3.5 w-3.5" /> {t("Joindre un fichier", "Attach a file")}
            </button>
            <span className="text-[11px] text-muted">{formatBytes(total)} / 10 Mo</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-muted hover:bg-slate-50">{t("Annuler", "Cancel")}</button>
            <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white transition hover:bg-brand-hover disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {busy ? t("Envoi…", "Sending…") : t("Envoyer", "Send")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MailPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<MailList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");

  const loadList = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      fetchMailList(folder, page, search)
        .then((data) => { setList(data); setError(""); })
        .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger les mails.", "Unable to load mails.")))
        .finally(() => setLoading(false));
    },
    [folder, page, search, t]
  );

  useEffect(() => {
    fetchMailStatus().then(setStatus).catch(() => undefined);
  }, []);

  // La liste se charge sans attendre le test de connexion ; une erreur de connexion s'affiche dans le bandeau.
  useEffect(() => {
    loadList();
  }, [loadList]);

  // Recherche : on attend la fin de la frappe, et on revient à la première page.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query); setPage(1); }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Lien depuis un profil étudiant : /mail?compose=1&to=…
  useEffect(() => {
    if (searchParams.get("compose")) {
      setDraft({ to: searchParams.get("to") || "", cc: "", subject: searchParams.get("subject") || "", text: signature() });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const open = (item: MailListItem) => {
    setSelected(item.uid);
    setMessage(null);
    setShowImages(false);
    setMessageLoading(true);
    fetchMailMessage(folder, item.uid)
      .then((data) => {
        setMessage(data);
        if (!item.seen) setList((prev) => (prev ? { ...prev, items: prev.items.map((m) => (m.uid === item.uid ? { ...m, seen: true } : m)) } : prev));
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("Mail introuvable.", "Mail not found.")))
      .finally(() => setMessageLoading(false));
  };

  const switchFolder = (next: MailFolder) => {
    setFolder(next);
    setPage(1);
    setSelected(null);
    setMessage(null);
  };

  const reply = () => {
    if (!message) return;
    const quoted = (message.text || "").split(/\r?\n/).map((line) => `> ${line}`).join("\n");
    const subject = /^re\s*:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`;
    const target = folder === "sent" ? message.to[0] : message.from;
    setDraft({
      to: target?.address || "",
      cc: "",
      subject,
      text: `${signature()}\n\nLe ${longDate(message.date)}, ${nameOf(message.from)} a écrit :\n${quoted}`,
      inReplyTo: message.messageId || undefined,
      references: [...message.references, ...(message.messageId ? [message.messageId] : [])]
    });
  };

  const pageCount = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  const unreadCount = list ? list.items.filter((m) => !m.seen).length : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">{t("Boîte mail de l'agence", "Agency mailbox")}</p>
            <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl"><Mail className="h-7 w-7" aria-hidden /> Mail</h1>
            {status?.address && <p className="mt-1 text-xs text-white/80">{status.address}</p>}
          </div>
          <button type="button" onClick={() => setDraft({ to: "", cc: "", subject: "", text: signature() })} disabled={Boolean(status && !status.ok)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand transition hover:bg-violet-50 disabled:opacity-50">
            <PenSquare className="h-4 w-4" aria-hidden /> {t("Nouveau mail", "New mail")}
          </button>
        </div>
      </section>

      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}

      {status && !status.ok && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">{t("La boîte mail n'est pas accessible", "The mailbox is not reachable")}</p>
          <p className="mt-1">{status.error}</p>
          {getSession()?.user.role === "ADMIN" && <Link to="/admin/settings" className="mt-3 inline-flex rounded-lg bg-amber-900 px-3.5 py-2 text-xs font-bold text-white">{t("Ouvrir les paramètres e-mail", "Open email settings")}</Link>}
        </div>
      )}

      {!(status && !status.ok) && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* ── Liste ── */}
          <section className={cn("min-w-0 rounded-[24px] border border-line bg-white p-4 shadow-sm", selected !== null && "hidden lg:block")}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => switchFolder("inbox")} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition", folder === "inbox" ? "bg-brand text-white" : "bg-slate-100 text-mid hover:bg-slate-200")}>
                <Inbox className="h-3.5 w-3.5" aria-hidden /> {t("Réception", "Inbox")}{folder === "inbox" && unreadCount > 0 ? ` · ${unreadCount}` : ""}
              </button>
              <button type="button" onClick={() => switchFolder("sent")} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition", folder === "sent" ? "bg-brand text-white" : "bg-slate-100 text-mid hover:bg-slate-200")}>
                <Send className="h-3.5 w-3.5" aria-hidden /> {t("Envoyés", "Sent")}
              </button>
              <button type="button" onClick={() => loadList()} aria-label={t("Actualiser", "Refresh")} className="ml-auto rounded-full p-2 text-muted transition hover:bg-slate-100"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Rechercher (expéditeur, objet, texte)…", "Search (sender, subject, text)…")} className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-brand" />
            </div>

            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
            {loading && !list && <p className="py-10 text-center text-sm text-muted">{t("Chargement…", "Loading…")}</p>}
            {list?.folderMissing && <p className="py-8 text-center text-sm text-muted">{t("Aucun dossier « Envoyés » trouvé sur ce serveur.", "No “Sent” folder found on this server.")}</p>}
            {list && !list.folderMissing && list.items.length === 0 && !loading && <p className="py-10 text-center text-sm text-muted">{search ? t("Aucun mail ne correspond.", "No matching mail.") : t("Aucun mail.", "No mail.")}</p>}

            <ul className="mt-3 divide-y divide-line/60">
              {list?.items.map((item) => {
                const who = folder === "sent" ? nameOf(item.to[0]) : nameOf(item.from);
                return (
                  <li key={item.uid}>
                    <button type="button" onClick={() => open(item)} className={cn("flex w-full items-start gap-3 px-2 py-3 text-left transition hover:bg-brand/5", selected === item.uid && "bg-brand/10")}>
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.seen ? "bg-transparent" : "bg-brand")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-sm", item.seen ? "font-semibold text-mid" : "font-extrabold text-dark")}>{who}</span>
                          <span className="shrink-0 text-[11px] text-muted">{shortDate(item.date)}</span>
                        </span>
                        <span className={cn("block truncate text-xs", item.seen ? "text-muted" : "font-bold text-dark")}>
                          {item.hasAttachments && <Paperclip className="mr-1 inline h-3 w-3" aria-label={t("Pièce jointe", "Attachment")} />}
                          {item.subject || t("(sans objet)", "(no subject)")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {list && list.total > list.pageSize && (
              <nav className="mt-3 flex items-center justify-between gap-2 text-xs" aria-label={t("Pagination des mails", "Mail pagination")}>
                <span className="text-muted">{(page - 1) * list.pageSize + 1}–{Math.min(page * list.pageSize, list.total)} / {list.total}</span>
                <span className="flex items-center gap-1.5">
                  <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="inline-flex items-center rounded-lg border border-line bg-white px-2.5 py-1.5 font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" aria-hidden /></button>
                  <span className="font-bold text-dark">{page} / {pageCount}</span>
                  <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="inline-flex items-center rounded-lg border border-line bg-white px-2.5 py-1.5 font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
                </span>
              </nav>
            )}
          </section>

          {/* ── Lecture ── */}
          <section className={cn("min-w-0 rounded-[24px] border border-line bg-white p-5 shadow-sm", selected === null && "hidden lg:block")}>
            {selected === null ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted">
                <Mail className="h-10 w-10 text-brand/30" aria-hidden />
                <p>{t("Sélectionnez un mail pour le lire.", "Select a mail to read it.")}</p>
              </div>
            ) : messageLoading || !message ? (
              <p className="py-16 text-center text-sm text-muted">{t("Chargement du mail…", "Loading mail…")}</p>
            ) : (
              <div>
                <button type="button" onClick={() => { setSelected(null); setMessage(null); }} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-mid hover:text-brand lg:hidden"><ArrowLeft className="h-3.5 w-3.5" /> {t("Retour à la liste", "Back to list")}</button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 font-display text-xl font-bold text-dark">{message.subject || t("(sans objet)", "(no subject)")}</h2>
                  <button type="button" onClick={reply} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-hover"><Reply className="h-3.5 w-3.5" aria-hidden /> {t("Répondre", "Reply")}</button>
                </div>
                <dl className="mt-3 space-y-0.5 text-xs text-mid">
                  <div><dt className="inline font-bold text-muted">{t("De", "From")} : </dt><dd className="inline">{message.from ? `${message.from.name ? `${message.from.name} ` : ""}<${message.from.address}>` : "—"}</dd></div>
                  <div><dt className="inline font-bold text-muted">{t("À", "To")} : </dt><dd className="inline">{message.to.map((a) => a.address).join(", ") || "—"}</dd></div>
                  {message.cc.length > 0 && <div><dt className="inline font-bold text-muted">Cc : </dt><dd className="inline">{message.cc.map((a) => a.address).join(", ")}</dd></div>}
                  <div><dt className="inline font-bold text-muted">{t("Date", "Date")} : </dt><dd className="inline">{longDate(message.date)}</dd></div>
                </dl>

                {message.attachments.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {message.attachments.map((a) => (
                      <li key={a.index}>
                        <button
                          type="button"
                          onClick={() => downloadMailAttachment(message.folder, message.uid, a).catch((err) => setError(err instanceof Error ? err.message : "Téléchargement impossible."))}
                          className="inline-flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs font-semibold text-dark transition hover:border-brand hover:text-brand"
                        >
                          <Download className="h-3.5 w-3.5 text-brand" aria-hidden /> {a.filename} <span className="text-muted">{formatBytes(a.size)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {message.html && !showImages && /<img[^>]+src=["']https?:/i.test(message.html) && (
                  <p className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {t("Les images distantes sont masquées pour protéger votre vie privée.", "Remote images are hidden to protect your privacy.")}
                    <button type="button" onClick={() => setShowImages(true)} className="rounded-lg bg-amber-900 px-3 py-1 text-[11px] font-bold text-white">{t("Afficher les images", "Show images")}</button>
                  </p>
                )}
                <div className="mt-4"><MessageBody message={message} showImages={showImages} /></div>
              </div>
            )}
          </section>
        </div>
      )}

      {draft && (
        <ComposeModal
          initial={draft}
          onClose={() => setDraft(null)}
          onSent={() => {
            setDraft(null);
            setNotice(t("Mail envoyé ✓", "Mail sent ✓"));
            window.setTimeout(() => setNotice(""), 5000);
            if (folder === "sent") loadList(true);
          }}
        />
      )}
    </main>
  );
}
