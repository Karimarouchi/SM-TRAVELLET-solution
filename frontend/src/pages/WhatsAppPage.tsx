import { fetchAssignmentBoard, fetchMyStudents, getSession, type BoardSales, type BoardStudent } from "@/lib/auth";
import {
  assignWhatsAppOwner,
  fetchWhatsAppConversations,
  fetchWhatsAppMessages,
  formatWhatsAppPhone,
  linkWhatsAppStudent,
  sendWhatsAppMessage,
  type WhatsAppConversation,
  type WhatsAppMessage
} from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  FileWarning,
  Link2,
  Link2Off,
  MessageCircle,
  Search,
  Send,
  UserCog,
  X
} from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const MAX_LENGTH = 4096;
const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 5_000;
const TEXT_TYPES = ["text", "button", "interactive"];

function displayName(item: WhatsAppConversation) {
  return item.studentName || item.profileName || formatWhatsAppPhone(item.phone);
}

function listTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function clock(value: string) {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function StatusTicks({ message }: { message: WhatsAppMessage }) {
  if (message.status === "failed") {
    return (
      <span title={message.error || "Échec de l'envoi"}>
        <AlertCircle className="h-3.5 w-3.5 text-red-200" />
      </span>
    );
  }
  if (message.status === "read") return <CheckCheck className="h-3.5 w-3.5 text-sky-200" />;
  if (message.status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-white/75" />;
  if (message.status === "sent") return <Check className="h-3.5 w-3.5 text-white/75" />;
  return <Clock className="h-3 w-3 text-white/75" />;
}

/* ─── Modale : lier la conversation à un étudiant ─────────────────────── */
function LinkStudentModal({ onClose, onPick }: { onClose: () => void; onPick: (studentId: string) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<BoardStudent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchMyStudents({ search, pageSize: 20 })
        .then((data) => setStudents(data.students))
        .catch((err) => setError(err instanceof Error ? err.message : "Erreur."));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function pick(studentId: string) {
    setBusyId(studentId);
    setError("");
    try {
      await onPick(studentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
            <Link2 className="h-5 w-5 text-brand" /> Lier à un étudiant
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-xs text-muted">La conversation sera ensuite suivie par le conseiller de cet étudiant.</p>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2.5 focus-within:border-brand">
          <Search className="h-4 w-4 text-muted" />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou email de l'étudiant" className="w-full bg-transparent text-sm outline-none" />
        </label>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {students.map((student) => (
            <button
              key={student.id}
              type="button"
              disabled={busyId !== null}
              onClick={() => pick(student.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-brand/5 disabled:opacity-50"
            >
              <UserAvatar name={`${student.prenom} ${student.nom}`} src={student.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-dark">{student.prenom} {student.nom}</span>
                <span className="block truncate text-[11px] text-muted">{student.email}{student.phone ? ` · ${student.phone}` : ""}</span>
              </span>
              {busyId === student.id && <span className="text-[11px] text-brand">...</span>}
            </button>
          ))}
          {!students.length && <p className="py-6 text-center text-xs text-muted">Aucun étudiant trouvé.</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Modale admin : réattribuer la conversation à un sales ───────────── */
function AssignOwnerModal({
  currentOwnerId,
  onClose,
  onPick
}: {
  currentOwnerId: string | null;
  onClose: () => void;
  onPick: (salesId: string | null) => Promise<void>;
}) {
  const [sales, setSales] = useState<BoardSales[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAssignmentBoard()
      .then((board) => setSales(board.sales.filter((item) => item.isActive)))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur."));
  }, []);

  async function pick(salesId: string | null) {
    setBusy(true);
    setError("");
    try {
      await onPick(salesId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
            <UserCog className="h-5 w-5 text-brand" /> Responsable
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {error && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</p>}
        <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
          {sales.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={busy}
              onClick={() => pick(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-brand/5 disabled:opacity-50",
                item.id === currentOwnerId && "bg-brand/10"
              )}
            >
              <UserAvatar name={`${item.prenom} ${item.nom}`} size="sm" />
              <span className="flex-1 truncate text-sm font-semibold text-dark">{item.prenom} {item.nom}</span>
              {item.id === currentOwnerId && <Check className="h-4 w-4 text-brand" />}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => pick(null)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted transition hover:bg-slate-100 disabled:opacity-50"
          >
            Laisser non attribuée
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  const me = getSession()?.user;
  const isAdmin = me?.role === "ADMIN";

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "unassigned">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileChat, setMobileChat] = useState(false);

  const [thread, setThread] = useState<WhatsAppMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const preserveScrollRef = useRef<number | null>(null);

  const active = conversations.find((item) => item.id === activeId) || null;

  const loadList = useCallback(async () => {
    try {
      setConversations(await fetchWhatsAppConversations(search));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les conversations.");
    } finally {
      setListLoaded(true);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(loadList, 250);
    const interval = window.setInterval(loadList, LIST_POLL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [loadList]);

  const loadThread = useCallback(async (contactId: string) => {
    try {
      const data = await fetchWhatsAppMessages(contactId);
      setThread((previous) => {
        // Les messages plus anciens déjà chargés (pagination) sont conservés.
        const olderKept = previous.filter((item) => data.messages.length && item.createdAt < data.messages[0].createdAt);
        return [...olderKept, ...data.messages];
      });
      setHasMore((previous) => previous || data.hasMore);
      setConversations((previous) => previous.map((item) => (item.id === contactId ? { ...item, unread: 0 } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les messages.");
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setThread([]);
    setHasMore(false);
    lastMessageIdRef.current = null;
    loadThread(activeId);
    const interval = window.setInterval(() => loadThread(activeId), THREAD_POLL_MS);
    return () => window.clearInterval(interval);
  }, [activeId, loadThread]);

  // Défilement : en bas à chaque nouveau message, position conservée quand
  // on charge des messages plus anciens, rien du tout sur un simple polling.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (preserveScrollRef.current !== null) {
      el.scrollTop = el.scrollHeight - preserveScrollRef.current;
      preserveScrollRef.current = null;
      return;
    }
    const lastId = thread.length ? thread[thread.length - 1].id : null;
    if (lastId && lastId !== lastMessageIdRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    lastMessageIdRef.current = lastId;
  }, [thread]);

  async function loadOlder() {
    if (!activeId || !thread.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await fetchWhatsAppMessages(activeId, thread[0].createdAt);
      preserveScrollRef.current = scrollRef.current ? scrollRef.current.scrollHeight - scrollRef.current.scrollTop : null;
      setThread((previous) => [...data.messages, ...previous]);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoadingOlder(false);
    }
  }

  function openConversation(id: string) {
    setError("");
    setText("");
    setActiveId(id);
    setMobileChat(true);
  }

  async function onSend() {
    const body = text.trim();
    if (!activeId || !body || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await sendWhatsAppMessage(activeId, body);
      setText("");
      setThread((previous) => [...previous, { ...message, senderName: `${me?.prenom || ""} ${me?.nom || ""}`.trim() }]);
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  async function onLink(studentId: string | null) {
    if (!activeId) return;
    await linkWhatsAppStudent(activeId, studentId);
    setLinkOpen(false);
    await loadList();
  }

  async function onAssign(salesId: string | null) {
    if (!activeId) return;
    await assignWhatsAppOwner(activeId, salesId);
    setAssignOpen(false);
    await loadList();
  }

  const visible = conversations.filter((item) => {
    if (filter === "unread") return item.unread > 0;
    if (filter === "unassigned") return !item.ownerId;
    return true;
  });

  const filters = [
    { id: "all" as const, label: "Toutes" },
    { id: "unread" as const, label: "Non lues" },
    ...(isAdmin ? [{ id: "unassigned" as const, label: "Non attribuées" }] : [])
  ];

  if (!me) return null;

  return (
    <main className="px-3 pb-5 md:px-6">
      <div
        className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_20px_60px_rgba(109,40,217,.12)]"
        style={{ height: "calc(100dvh - 8rem)" }}
      >
        <div className="flex h-full min-h-0 md:grid md:grid-cols-[340px_1fr]">
          {/* ── Liste des conversations ─────────────────────────────────── */}
          <aside className={cn("h-full w-full min-h-0 flex-col border-line bg-slate-50/70 md:flex md:w-auto md:border-r", mobileChat ? "hidden" : "flex")}>
            <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-4 pb-4 pt-5">
              <h1 className="flex items-center gap-2 font-display text-xl font-extrabold text-white">
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </h1>
              <label className="mt-3 flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 backdrop-blur">
                <Search className="h-4 w-4 text-white/70" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nom ou numéro"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/60"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {filters.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      filter === item.id ? "bg-white text-emerald-700 shadow" : "bg-white/15 text-white hover:bg-white/25"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openConversation(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-emerald-50",
                    item.id === activeId && "bg-emerald-50"
                  )}
                >
                  <UserAvatar name={displayName(item)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", item.unread ? "font-extrabold text-dark" : "font-semibold text-mid")}>
                        {displayName(item)}
                      </span>
                      <span className={cn("shrink-0 text-[11px]", item.unread ? "font-bold text-emerald-600" : "text-muted")}>
                        {listTime(item.lastMessageAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={cn("block flex-1 truncate text-xs", item.unread ? "font-semibold text-dark" : "text-muted")}>
                        {item.lastDirection === "out" && "Vous : "}{item.lastBody}
                      </span>
                      {item.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                          {item.unread}
                        </span>
                      )}
                    </span>
                    {isAdmin && (
                      <span className={cn("mt-1 block truncate text-[10px] font-semibold", item.ownerName ? "text-brand/70" : "text-amber-600")}>
                        {item.ownerName ? `→ ${item.ownerName}` : "Non attribuée"}
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {listLoaded && !visible.length && (
                <p className="px-5 py-10 text-center text-sm text-muted">
                  {conversations.length ? "Aucune conversation pour ce filtre." : "Aucune conversation WhatsApp pour le moment."}
                </p>
              )}
            </div>
          </aside>

          {/* ── Conversation ouverte ────────────────────────────────────── */}
          <section className={cn("min-h-0 min-w-0 flex-1 flex-col bg-white md:flex", mobileChat ? "flex" : "hidden")}>
            {active ? (
              <>
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <button
                    type="button"
                    className="rounded-full p-2 text-muted transition hover:bg-emerald-50 hover:text-emerald-700 md:hidden"
                    onClick={() => setMobileChat(false)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <UserAvatar name={displayName(active)} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-dark">{displayName(active)}</p>
                    <p className="truncate text-xs text-muted">
                      {formatWhatsAppPhone(active.phone)}
                      {active.studentName && active.profileName && active.profileName !== active.studentName && ` · « ${active.profileName} »`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {active.studentId ? (
                      <>
                        <Link
                          to={`/conseiller/etudiants/${active.studentId}`}
                          className="inline-flex items-center gap-1 rounded-full bg-brand-light px-3 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white"
                        >
                          <ExternalLink className="h-3 w-3" /> Fiche étudiant
                        </Link>
                        <button
                          type="button"
                          title="Délier cet étudiant"
                          onClick={() => onLink(null).catch((err) => setError(err instanceof Error ? err.message : "Erreur."))}
                          className="rounded-full p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Link2Off className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLinkOpen(true)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
                      >
                        <Link2 className="h-3 w-3" /> Lier à un étudiant
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setAssignOpen(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[11px] font-bold text-mid transition hover:border-brand hover:text-brand"
                      >
                        <UserCog className="h-3 w-3" /> {active.ownerName || "Non attribuée"}
                      </button>
                    )}
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] px-3 py-4">
                  {hasMore && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={loadOlder}
                        disabled={loadingOlder}
                        className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-muted shadow-sm hover:text-dark disabled:opacity-60"
                      >
                        {loadingOlder ? "Chargement..." : "Messages plus anciens"}
                      </button>
                    </div>
                  )}
                  {thread.map((item, index) => {
                    const mine = item.direction === "out";
                    const previous = thread[index - 1];
                    const showDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
                    const isMedia = !TEXT_TYPES.includes(item.type);
                    return (
                      <div key={item.id}>
                        {showDay && (
                          <p className="my-3 text-center">
                            <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-muted shadow-sm">{dayLabel(item.createdAt)}</span>
                          </p>
                        )}
                        <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[78%] px-3 py-1.5 text-sm leading-5 shadow-sm",
                              mine ? "rounded-[14px] rounded-tr-sm bg-emerald-600 text-white" : "rounded-[14px] rounded-tl-sm bg-white text-dark"
                            )}
                          >
                            {mine && item.senderName && (
                              <p className="mb-0.5 text-[10px] font-semibold text-white/70">{item.senderName}</p>
                            )}
                            {isMedia ? (
                              <p className={cn("flex items-start gap-1.5 italic", mine ? "text-white/90" : "text-muted")}>
                                <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {item.body}
                              </p>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{item.body}</p>
                            )}
                            <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-white/75" : "text-muted")}>
                              {clock(item.createdAt)}
                              {mine && <StatusTicks message={item} />}
                            </p>
                            {mine && item.status === "failed" && item.error && (
                              <p className="mt-1 text-[10px] font-semibold text-red-100">Non délivré : {item.error}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!active.windowOpen && (
                  <div className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                    <span className="font-bold">Fenêtre de 24 h fermée.</span> WhatsApp n'autorise une réponse libre que dans les 24 h qui suivent le
                    dernier message de l'étudiant : il doit vous réécrire, ou un modèle de message approuvé par Meta est nécessaire.
                  </div>
                )}
                {error && <p className="px-4 pt-2 text-xs text-red-500">{error}</p>}

                <div className="flex items-end gap-2 border-t border-line px-3 py-3">
                  <div className="relative flex-1">
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
                      onKeyDown={onKeyDown}
                      disabled={!active.windowOpen || sending}
                      rows={Math.min(5, Math.max(1, text.split("\n").length))}
                      placeholder={active.windowOpen ? "Écrire un message (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)" : "Réponse impossible : fenêtre de 24 h fermée"}
                      className="block w-full resize-none rounded-2xl border border-line bg-slate-50 px-4 py-2.5 text-sm text-dark outline-none transition placeholder:text-muted focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {text.length > MAX_LENGTH - 200 && (
                      <span className="absolute bottom-1 right-3 text-[10px] text-muted">{text.length}/{MAX_LENGTH}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onSend}
                    disabled={!active.windowOpen || sending || !text.trim()}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-35"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center bg-[#f7f5f2] px-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <MessageCircle className="h-8 w-8" />
                </span>
                <p className="mt-4 font-display text-lg font-bold text-dark">WhatsApp de l'agence</p>
                <p className="mt-1 max-w-sm text-sm text-muted">
                  {isAdmin
                    ? "Toutes les conversations WhatsApp, réparties entre les conseillers. Sélectionnez-en une pour la lire."
                    : "Les conversations WhatsApp qui vous sont attribuées. Sélectionnez-en une pour répondre."}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {linkOpen && <LinkStudentModal onClose={() => setLinkOpen(false)} onPick={(studentId) => onLink(studentId)} />}
      {assignOpen && active && (
        <AssignOwnerModal currentOwnerId={active.ownerId} onClose={() => setAssignOpen(false)} onPick={onAssign} />
      )}
    </main>
  );
}
