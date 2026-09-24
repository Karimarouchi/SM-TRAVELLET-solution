import {
  fetchConversation,
  fetchUnreadCount,
  getSession,
  openChatWithStudent,
  sendChatMessage,
  type ChatMessage
} from "@/lib/auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ADVISOR_CHAT_OPEN } from "@/lib/advisor-chat";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { FormEvent, useEffect, useRef, useState } from "react";

const AVATAR_SRC = "/vitrine/IMAGE/chatbot.jpeg";

function chatClock(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function StudentAdvisorChat() {
  const { t } = useLanguage();
  const session = getSession();
  const me = session?.user;
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [conversationId, setConversationId] = useState("");
  const [advisorName, setAdvisorName] = useState(t("Votre conseiller", "Your advisor"));
  const [canSend, setCanSend] = useState(false);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [emptyHint, setEmptyHint] = useState("");
  const [ready, setReady] = useState(false);
  const [myAvatar, setMyAvatar] = useState(me?.avatarUrl || "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef("");

  async function refreshUnread() {
    const data = await fetchUnreadCount();
    setUnread(data.unread || 0);
  }

  async function loadThread(id: string) {
    const data = await fetchConversation(id);
    setThread(data.messages);
    setCanSend(data.conversation.canSend);
    setAdvisorName(data.conversation.salesName || t("Votre conseiller", "Your advisor"));
    setConversationId(id);
    conversationRef.current = id;
  }

  async function bootConversation() {
    if (!me?.id) return;
    setError("");
    try {
      const opened = await openChatWithStudent(me.id);
      setEmptyHint("");
      await loadThread(opened.conversation.id);
    } catch (err) {
      setEmptyHint(err instanceof Error ? err.message : t("Aucun conseiller ne vous est encore affecté.", "No advisor has been assigned to you yet."));
      setCanSend(false);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(ADVISOR_CHAT_OPEN, onOpen);
    return () => window.removeEventListener(ADVISOR_CHAT_OPEN, onOpen);
  }, []);

  useEffect(() => {
    refreshUnread().catch(() => undefined);
    const timer = window.setInterval(() => {
      refreshUnread().catch(() => undefined);
      if (open && conversationRef.current) {
        loadThread(conversationRef.current).catch(() => undefined);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    setMyAvatar(getSession()?.user.avatarUrl || "");
    if (!open) return;
    if (!conversationRef.current) bootConversation();
    else loadThread(conversationRef.current).catch(() => undefined);
    const focus = window.setTimeout(() => inputRef.current?.focus(), 280);
    return () => window.clearTimeout(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, thread.length]);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!conversationId || !draft.trim() || !canSend) return;
    try {
      const created = await sendChatMessage(conversationId, draft.trim());
      setDraft("");
      setThread((current) => [...current, created]);
      setUnread(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Envoi impossible.", "Unable to send."));
    }
  }

  if (!me || me.role !== "STUDENT") return null;

  return (
    <>
      <button
        type="button"
        aria-label={t("Ouvrir le chat", "Open chat")}
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[1100] flex h-[60px] w-[60px] items-center justify-center rounded-full border-0 bg-[linear-gradient(135deg,#4f46e5_0%,#3730a3_100%)] shadow-[0_8px_28px_rgba(79,70,229,.5)] transition duration-300 hover:scale-110",
          open && "pointer-events-none invisible scale-[0.6] opacity-0"
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#ef4444] text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <div
        className={cn(
          "fixed bottom-5 right-6 z-[1099] flex w-[360px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-black/5 bg-[#f8fafc] shadow-[0_20px_50px_rgba(0,0,0,0.08),0_4px_20px_rgba(79,70,229,0.05)] transition duration-300",
          open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-5 scale-[0.97] opacity-0"
        )}
        style={{ maxHeight: "min(560px, calc(100dvh - 2.5rem))", height: 520 }}
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="h-11 w-11 overflow-hidden rounded-full bg-slate-100">
            <img src={AVATAR_SRC} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.1rem] font-extrabold text-[#4f46e5]">{advisorName}</p>
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e]" />
              {emptyHint ? t("Indisponible", "Unavailable") : t("En ligne", "Online")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("Fermer", "Close")}
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center text-[#4f46e5] opacity-80 hover:scale-110 hover:opacity-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-2 pt-4">
          {!ready && <p className="pt-8 text-center text-sm text-slate-500">{t("Chargement de la discussion…", "Loading conversation…")}</p>}
          {ready && emptyHint && !thread.length && (
            <div className="flex max-w-[88%] items-end gap-2 self-start">
              <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-100">
                <img src={AVATAR_SRC} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="rounded-[18px] rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-5 text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
                {emptyHint}
              </div>
            </div>
          )}
          {ready && !emptyHint && !thread.length && (
            <div className="flex max-w-[88%] items-end gap-2 self-start">
              <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-100">
                <img src={AVATAR_SRC} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="rounded-[18px] rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-5 text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
                {t(
                  `Bonjour ${me.prenom} ! Je suis votre conseiller SM Travel. Écrivez-moi ici pour avancer sur votre dossier.`,
                  `Hello ${me.prenom}! I'm your SM Travel advisor. Write to me here to move your file forward.`
                )}
              </div>
            </div>
          )}
          {thread.map((item) => {
            const mine = item.senderId === me.id;
            return (
              <div key={item.id} className={cn("flex max-w-[88%] items-end gap-2", mine ? "flex-row-reverse self-end" : "self-start")}>
                {mine ? (
                  <UserAvatar name={`${me.prenom} ${me.nom}`} src={myAvatar || item.senderAvatarUrl} size="sm" />
                ) : item.senderAvatarUrl ? (
                  <UserAvatar name={item.senderName || "?"} src={item.senderAvatarUrl} size="sm" />
                ) : (
                  <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-100">
                    <img src={AVATAR_SRC} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div
                  className={cn(
                    "px-3.5 py-2.5 text-sm leading-5",
                    mine
                      ? "rounded-[18px] rounded-br-sm bg-[linear-gradient(160deg,#6366f1_0%,#4f46e5_55%,#4338ca_100%)] text-white shadow-[0_6px_16px_rgba(79,70,229,0.28)]"
                      : "rounded-[18px] rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{item.body}</p>
                  <p className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-slate-400")}>{chatClock(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}

        <form onSubmit={onSend} className="mx-3.5 mb-3.5 mt-2 flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-4 pr-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] focus-within:border-[#4f46e5] focus-within:shadow-[0_4px_12px_rgba(79,70,229,0.1)]">
          <input
            ref={inputRef}
            value={draft}
            maxLength={2000}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("Écrivez votre message…", "Type your message…")}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!canSend || !draft.trim()}
            aria-label={t("Envoyer", "Send")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4f46e5] text-white transition hover:scale-105 hover:bg-[#4338ca] disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "translate(-1px, 1px)" }}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
