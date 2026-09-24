import {
  fetchConversation,
  fetchConversations,
  fetchMyStudents,
  getSession,
  openChatWithStudent,
  sendChatMessage,
  type BoardStudent,
  type ChatConversation,
  type ChatMessage
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { UserAvatar } from "@/components/ui/user-avatar";
import { openAdvisorChat } from "@/lib/advisor-chat";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, MessageCircle, Search, Send, Smile } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type Contact = {
  key: string;
  name: string;
  studentId?: string;
  conversationId?: string;
  lastBody: string;
  lastAt: string;
  unread: number;
  avatarUrl?: string;
};

const EMOJIS = [
  "😀", "😂", "😊", "😍", "😘", "😉", "😎", "🤔", "😅", "😢",
  "😭", "😡", "👍", "👎", "🙏", "👏", "💪", "🤝", "❤️", "🔥",
  "🎉", "✨", "✅", "❌", "📄", "📎", "✈️", "🎓", "🏆", "⏰"
];

function relativeTime(value: string | undefined, t: (fr: string, en: string) => string) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("à l’instant", "just now");
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return t("hier", "yesterday");
  if (days < 7) return `${days} ${t("j", "d")}`;
  return new Date(value).toLocaleDateString(t("fr-FR", "en-US"), { day: "2-digit", month: "short" });
}

function chatClock(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(value: string, t: (fr: string, en: string) => string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return t("Aujourd’hui", "Today");
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t("Hier", "Yesterday");
  return date.toLocaleDateString(t("fr-FR", "en-US"), { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function buildContacts(role: string | undefined, conversations: ChatConversation[], students: BoardStudent[], t: (fr: string, en: string) => string): Contact[] {
  const noMessage = t("Aucun message", "No message");
  if (role === "SALES") {
    return students
      .map((student) => {
        const conversation = conversations.find((item) => item.studentId === student.id);
        return {
          key: student.id,
          name: `${student.prenom} ${student.nom}`.trim(),
          studentId: student.id,
          conversationId: conversation?.id,
          lastBody: conversation?.lastBody || noMessage,
          lastAt: conversation?.lastAt || "",
          unread: conversation?.unread || 0,
          avatarUrl: conversation?.studentAvatarUrl || student.avatarUrl
        };
      })
      .sort((a, b) => {
        if (Boolean(b.lastAt) !== Boolean(a.lastAt)) return b.lastAt ? 1 : -1;
        return (b.lastAt || "").localeCompare(a.lastAt || "");
      });
  }

  return conversations.map((item) => ({
    key: item.id,
    name: role === "STUDENT" ? item.salesName : `${item.studentName} · ${item.salesName}`,
    studentId: item.studentId,
    conversationId: item.id,
    lastBody: item.lastBody || noMessage,
    lastAt: item.lastAt,
    unread: item.unread,
    avatarUrl: role === "STUDENT" ? item.salesAvatarUrl : item.studentAvatarUrl
  }));
}

function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full right-0 mb-2 grid w-[264px] grid-cols-6 gap-1 rounded-2xl border border-line bg-white p-3 shadow-[0_18px_40px_rgba(76,29,149,0.18)]"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg transition hover:bg-brand-light"
        >
          {emoji}
        </button>
      ))}
    </motion.div>
  );
}

export default function MessagesPage() {
  const { t } = useLanguage();
  const session = getSession();
  const me = session?.user;
  const navigate = useNavigate();
  const isStudent = me?.role === "STUDENT";
  const isSales = me?.role === "SALES";
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [students, setStudents] = useState<BoardStudent[]>([]);
  const [activeId, setActiveId] = useState(params.get("c") || "");
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [peerName, setPeerName] = useState(t("Discussion", "Conversation"));
  const [peerHint, setPeerHint] = useState("");
  const [peerAvatar, setPeerAvatar] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [emptyHint, setEmptyHint] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [mobileChat, setMobileChat] = useState(Boolean(params.get("c") || params.get("student") || isStudent));
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef("");
  const draftInputRef = useRef<HTMLInputElement>(null);

  const studentQuery = params.get("student");

  async function loadList() {
    const data = await fetchConversations();
    setConversations(data.conversations || []);
    if (isSales) {
      // Liste complète nécessaire ici (choix du destinataire d'un nouveau
      // message), pas de pagination pertinente pour ce usage.
      const mine = await fetchMyStudents({ pageSize: 1000 });
      setStudents(mine.students || []);
    }
    return data.conversations || [];
  }

  async function loadThread(id: string) {
    const data = await fetchConversation(id);
    setThread(data.messages);
    setCanSend(data.conversation.canSend);
    if (me?.role === "ADMIN") {
      setPeerName(data.conversation.studentName);
      setPeerHint(data.conversation.salesName);
      setPeerAvatar(data.conversation.studentAvatarUrl || "");
    } else if (isSales) {
      setPeerName(data.conversation.studentName);
      setPeerHint(t("Étudiant", "Student"));
      setPeerAvatar(data.conversation.studentAvatarUrl || "");
    } else {
      setPeerName(data.conversation.salesName);
      setPeerHint(t("Votre conseiller", "Your advisor"));
      setPeerAvatar(data.conversation.salesAvatarUrl || "");
    }
    setActiveId(id);
    activeRef.current = id;
    setMobileChat(true);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (isStudent) return;
      setError("");
      try {
        let nextId = params.get("c") || "";
        if (studentQuery) {
          const opened = await openChatWithStudent(studentQuery);
          if (cancelled) return;
          nextId = opened.conversation.id;
          setParams({ c: nextId }, { replace: true });
          setActiveId(nextId);
        } else if (isStudent && me?.id) {
          try {
            const opened = await openChatWithStudent(me.id);
            if (cancelled) return;
            nextId = opened.conversation.id;
            setActiveId(nextId);
            setParams({ c: nextId }, { replace: true });
          } catch (err) {
            if (!cancelled) setEmptyHint(err instanceof Error ? err.message : t("Aucun conseiller affecté.", "No advisor assigned."));
          }
        }
        const list = await loadList();
        if (cancelled) return;
        if (!nextId) nextId = list[0]?.id || "";
        if (nextId) await loadThread(nextId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("Impossible de charger la messagerie.", "Unable to load messages."));
      }
    }

    boot();
    const timer = window.setInterval(() => {
      loadList().catch(() => undefined);
      if (activeRef.current) loadThread(activeRef.current).catch(() => undefined);
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentQuery]);

  useEffect(() => {
    if (!isStudent) return;
    navigate("/espace", { replace: true });
    openAdvisorChat();
  }, [isStudent, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  const contacts = useMemo(() => {
    const all = buildContacts(me?.role, conversations, students, t);
    const searched = query.trim()
      ? all.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
      : all;
    return filter === "unread" ? searched.filter((item) => item.unread > 0) : searched;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role, conversations, students, query, filter]);

  async function onOpen(contact: Contact) {
    setError("");
    try {
      if (contact.conversationId) {
        setParams({ c: contact.conversationId });
        await loadThread(contact.conversationId);
      } else if (contact.studentId) {
        const opened = await openChatWithStudent(contact.studentId);
        setParams({ c: opened.conversation.id });
        await loadThread(opened.conversation.id);
      }
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Impossible d’ouvrir cette discussion.", "Unable to open this conversation."));
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !draft.trim()) return;
    try {
      const created = await sendChatMessage(activeId, draft.trim());
      setDraft("");
      setShowEmoji(false);
      setThread((current) => [...current, created]);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Envoi impossible.", "Unable to send."));
    }
  }

  function insertEmoji(emoji: string) {
    setDraft((current) => `${current}${emoji}`);
    draftInputRef.current?.focus();
  }

  if (!me || isStudent) return null;

  const showSidebar = true;

  return (
    <main className="px-3 pb-5 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mx-auto overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_20px_60px_rgba(109,40,217,.12)]",
          isStudent ? "max-w-2xl" : "max-w-6xl"
        )}
        style={{ height: "calc(100dvh - 8rem)" }}
      >
        <div className={cn("flex h-full min-h-0", showSidebar && "md:grid md:grid-cols-[320px_1fr]")}>
          {showSidebar && (
            <aside
              className={cn(
                "flex h-full w-full min-h-0 flex-col border-line bg-slate-50/70 md:w-auto md:border-r",
                mobileChat ? "hidden md:flex" : "flex"
              )}
            >
              <div className="bg-gradient-to-br from-brand-dark via-brand to-violet-500 px-4 pb-4 pt-5">
                <h1 className="flex items-center gap-2 font-display text-xl font-extrabold text-white">
                  <MessageCircle className="h-5 w-5" /> {t("Discussions", "Conversations")}
                </h1>
                <label className="mt-3 flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 backdrop-blur">
                  <Search className="h-4 w-4 text-white/70" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("Rechercher", "Search")}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/60"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  {[
                    { id: "all", label: t("Tout", "All") },
                    { id: "unread", label: t("Non lu", "Unread") }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id as "all" | "unread")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition",
                        filter === item.id ? "bg-white text-brand shadow" : "bg-white/15 text-white hover:bg-white/25"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {contacts.map((item, index) => {
                  const active = item.conversationId === activeId || (!item.conversationId && item.studentId === studentQuery);
                  return (
                    <motion.button
                      key={item.key}
                      type="button"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
                      whileHover={{ x: 2 }}
                      onClick={() => onOpen(item)}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-brand/5",
                        active && "bg-brand/10"
                      )}
                    >
                      <UserAvatar name={item.name} src={item.avatarUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", item.unread ? "font-extrabold text-dark" : "font-semibold text-mid")}>
                            {item.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted">{relativeTime(item.lastAt, t)}</span>
                        </span>
                        <span className={cn("mt-0.5 block truncate text-xs", item.unread ? "font-semibold text-dark" : "text-muted")}>
                          {item.lastBody}
                        </span>
                      </span>
                      {item.unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />}
                    </motion.button>
                  );
                })}
                {!contacts.length && (
                  <p className="px-5 py-10 text-sm text-muted">{emptyHint || t("Aucune discussion pour le moment.", "No conversation yet.")}</p>
                )}
              </div>
            </aside>
          )}

          <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col bg-white", showSidebar && !mobileChat && "hidden md:flex")}>
            {activeId ? (
              <>
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  {showSidebar && (
                    <button
                      type="button"
                      className="rounded-full p-2 text-muted transition hover:bg-brand-light hover:text-brand md:hidden"
                      onClick={() => setMobileChat(false)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  <UserAvatar name={peerName} src={peerAvatar} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-dark">{peerName}</p>
                    <p className="text-xs text-muted">{peerHint || (isStudent ? t("Votre conseiller", "Your advisor") : t("Discussion", "Conversation"))}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-gradient-to-b from-brand-light/30 to-white px-3 py-4">
                  {thread.map((item, index) => {
                    const mine = item.senderId === me.id;
                    const previous = thread[index - 1];
                    const showDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
                    return (
                      <div key={item.id}>
                        {showDay && (
                          <p className="my-3 text-center text-[11px] font-medium text-muted">{dayLabel(item.createdAt, t)}</p>
                        )}
                        {!item.senderId ? (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="my-4 flex justify-center"
                          >
                            <div className="flex max-w-[85%] items-center gap-2.5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-2.5 shadow-sm">
                              <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                              </span>
                              <div>
                                <p className="text-[11px] font-semibold text-sky-800">{item.body}</p>
                                <p className="mt-0.5 text-[9px] text-sky-500">{chatClock(item.createdAt)}</p>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}
                          >
                            {!mine && <UserAvatar name={item.senderName || ""} src={item.senderAvatarUrl} size="sm" />}
                            <div
                              className={cn(
                                "max-w-[78%] px-3.5 py-2 text-sm leading-5 shadow-sm",
                                mine
                                  ? "rounded-[18px] rounded-br-md bg-gradient-to-br from-brand to-violet-600 text-white"
                                  : "rounded-[18px] rounded-bl-md border border-line bg-white text-dark"
                              )}
                            >
                              {me.role === "ADMIN" && !mine && item.senderRole && (
                                <p className={cn("mb-1 text-[10px] font-semibold uppercase tracking-wide", "text-brand/70")}>
                                  {item.senderRole === "SALES" ? t("Conseiller", "Advisor") : t("Étudiant", "Student")}
                                </p>
                              )}
                              <p className="whitespace-pre-wrap break-words">{item.body}</p>
                              <p className={cn("mt-1 text-[10px]", mine ? "text-white/75" : "text-muted")}>{chatClock(item.createdAt)}</p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                  {!thread.length && (
                    <p className="pt-16 text-center text-sm text-muted">
                      {canSend ? t("Écrivez le premier message.", "Write the first message.") : emptyHint || t("Aucun message pour le moment.", "No message yet.")}
                    </p>
                  )}
                  <div ref={bottomRef} />
                </div>

                {error && <p className="px-4 pb-1 text-sm text-red-500">{error}</p>}

                <form onSubmit={onSend} className="relative flex items-center gap-2 border-t border-line px-3 py-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmoji((current) => !current)}
                      disabled={!canSend || !activeId}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-brand-light hover:text-brand disabled:opacity-40"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <AnimatePresence>
                      {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
                    </AnimatePresence>
                  </div>
                  <input
                    ref={draftInputRef}
                    className="flex-1 rounded-full border border-line bg-slate-50 px-4 py-2.5 text-sm text-dark outline-none transition placeholder:text-muted focus:border-brand focus:bg-white focus:shadow-[0_0_0_4px_rgba(109,40,217,0.1)]"
                    placeholder={canSend ? t("Écrire un message...", "Write a message...") : t("Lecture seule", "Read only")}
                    value={draft}
                    maxLength={2000}
                    disabled={!canSend || !activeId}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.9 }}
                    disabled={!canSend || !activeId || !draft.trim()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-violet-600 text-white shadow-md transition disabled:opacity-35"
                  >
                    <Send className="h-4 w-4" />
                  </motion.button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-brand-light/30 to-white px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
                  <MessageCircle className="h-8 w-8 text-brand" />
                </div>
                <p className="font-display text-xl font-bold text-dark">
                  {isStudent ? t("Votre conseiller", "Your advisor") : t("Choisissez une personne", "Choose a person")}
                </p>
                <p className="mt-2 max-w-sm text-sm text-muted">
                  {emptyHint || error || (isSales
                    ? t("Cliquez sur un étudiant à gauche pour ouvrir la discussion.", "Click a student on the left to open the conversation.")
                    : t("La discussion s’ouvrira ici.", "The conversation will open here."))}
                </p>
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </main>
  );
}
