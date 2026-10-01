import { fetchAssignmentBoard, fetchMyStudents, getSession, type BoardSales, type BoardStudent } from "@/lib/auth";
import {
  assignWhatsAppOwner,
  fetchWhatsAppConversations,
  fetchWhatsAppMessages,
  formatWhatsAppPhone,
  hideWhatsAppMessage,
  linkWhatsAppStudent,
  sendWhatsAppMessage,
  segmentOf,
  WHATSAPP_SEGMENTS,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type WhatsAppSegment
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
  EyeOff,
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
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

const MAX_LENGTH = 4096;
const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 5_000;
const TEXT_TYPES = ["text", "button", "interactive"];

// Gras façon WhatsApp : *texte* s'affiche en gras (sur une seule ligne).
function withBold(text: string) {
  return text.split(/(\*[^*\n]+\*)/g).map((part, index) =>
    /^\*[^*\n]+\*$/.test(part) ? <strong key={index}>{part.slice(1, -1)}</strong> : part
  );
}

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
        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      </span>
    );
  }
  if (message.status === "read") return <CheckCheck className="h-4 w-4 text-[#53bdeb]" />;
  if (message.status === "delivered") return <CheckCheck className="h-4 w-4 text-[#8696a0]" />;
  if (message.status === "sent") return <Check className="h-4 w-4 text-[#8696a0]" />;
  return <Clock className="h-3 w-3 text-[#8696a0]" />;
}

/* ─── Modale : lier la conversation à un étudiant ─────────────────────── */
/* ─── Confirmation : masquer un message (dans l'application seulement) ─── */
function HideMessageModal({ message, onClose, onConfirm }: { message: WhatsAppMessage; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de masquer ce message.");
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <EyeOff className="h-5 w-5" />
          </span>
          <h3 className="font-display text-lg font-bold text-dark">Masquer ce message ?</h3>
        </div>
        <p className="mt-3 line-clamp-3 rounded-xl bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]">{message.body}</p>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900">
          <p className="font-bold">L'étudiant le verra toujours sur son WhatsApp.</p>
          <p className="mt-1">
            WhatsApp ne permet pas de supprimer un message envoyé depuis l'application. Il sera seulement masqué ici, pour les
            conseillers et l'admin. Pour corriger une erreur, envoyez plutôt un nouveau message à l'étudiant.
          </p>
        </div>
        {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-line py-2.5 text-sm font-bold text-mid">
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="flex-1 rounded-full bg-amber-500 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
          >
            {busy ? "..." : "Masquer ici"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

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

// Boîte de réception WhatsApp (remplit toute la hauteur de la carte qui la
// contient, voir pages/WhatsAppPage).
export default function WhatsAppInbox({ segment }: { segment: WhatsAppSegment }) {
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
  const [hideTarget, setHideTarget] = useState<WhatsAppMessage | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const preserveScrollRef = useRef<number | null>(null);

  // La conversation ouverte doit appartenir à la messagerie affichée.
  const active = conversations.find((item) => item.id === activeId && segmentOf(item) === segment) || null;

  // Changer de messagerie referme la conversation ouverte.
  useEffect(() => {
    setActiveId(null);
    setMobileChat(false);
    setFilter("all");
  }, [segment]);

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

  async function onHide(message: WhatsAppMessage) {
    if (!activeId) return;
    await hideWhatsAppMessage(activeId, message.id);
    setThread((previous) => previous.map((m) => (m.id === message.id ? { ...m, hidden: true, body: "", hiddenByName: `${me?.prenom || ""} ${me?.nom || ""}`.trim() } : m)));
    setHideTarget(null);
    loadList();
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

  // Chaque messagerie ne montre que ses conversations : « inscrits » = liées à
  // un compte étudiant, « non inscrits » = les autres. Quand un prospect
  // s'inscrit avec son code, sa conversation passe toute seule côté inscrits.
  const inSegment = conversations.filter((item) => segmentOf(item) === segment);
  const otherUnread = conversations.filter((item) => segmentOf(item) !== segment).reduce((sum, item) => sum + item.unread, 0);

  const visible = inSegment.filter((item) => {
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
    <>
        <div className="flex h-full min-h-0 md:grid md:grid-cols-[340px_1fr]">
          {/* ── Liste des conversations ─────────────────────────────────── */}
          <aside className={cn("h-full w-full min-h-0 flex-col border-line bg-slate-50/70 md:flex md:w-auto md:border-r", mobileChat ? "hidden" : "flex")}>
            <div className="bg-[#008069] px-4 pb-3 pt-4 md:pb-4 md:pt-5">
              <h1 className="flex items-center gap-2 font-display text-xl font-extrabold text-white">
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </h1>
              {/* Bascule entre les deux messageries (en plus du menu de la barre de navigation). */}
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-black/15 p-1" role="tablist" aria-label="Messagerie WhatsApp">
                {WHATSAPP_SEGMENTS.map((item) => {
                  const selected = item.id === segment;
                  return (
                    <Link
                      key={item.id}
                      to={`/whatsapp/${item.path}`}
                      role="tab"
                      aria-selected={selected}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-bold transition",
                        selected ? "bg-white text-emerald-700 shadow" : "text-white/85 hover:bg-white/15"
                      )}
                    >
                      {item.short}
                      {!selected && otherUnread > 0 && item.id !== segment && (
                        <span className="rounded-full bg-emerald-400 px-1.5 text-[10px] font-extrabold leading-4 text-white">{otherUnread}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
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
                        {item.lastHidden ? (
                          <span className="inline-flex items-center gap-1 italic"><EyeOff className="h-3 w-3" /> Message masqué</span>
                        ) : (
                          <>{item.lastDirection === "out" && "Vous : "}{item.lastBody}</>
                        )}
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
                  {inSegment.length
                    ? "Aucune conversation pour ce filtre."
                    : segment === "registered"
                      ? "Aucun étudiant inscrit n'a encore écrit sur WhatsApp."
                      : "Aucune conversation avec une personne non inscrite pour le moment."}
                </p>
              )}
            </div>
          </aside>

          {/* ── Conversation ouverte ────────────────────────────────────── */}
          <section className={cn("min-h-0 min-w-0 flex-1 flex-col bg-white md:flex", mobileChat ? "flex" : "hidden")}>
            {active ? (
              <>
                {/* En-tête : barre verte façon appli WhatsApp sur téléphone,
                    barre claire façon WhatsApp Web sur ordinateur. */}
                <div className="flex items-center gap-2 bg-[#008069] px-1.5 py-2 text-white md:gap-3 md:border-b md:border-line md:bg-[#f0f2f5] md:px-4 md:py-2.5 md:text-dark">
                  <button
                    type="button"
                    aria-label="Retour aux conversations"
                    className="rounded-full p-2 text-white transition hover:bg-white/15 md:hidden"
                    onClick={() => setMobileChat(false)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <UserAvatar name={displayName(active)} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-bold md:text-sm">{displayName(active)}</p>
                    <p className="truncate text-xs text-white/80 md:text-muted">
                      {formatWhatsAppPhone(active.phone)}
                      {active.studentName && active.profileName && active.profileName !== active.studentName && ` · « ${active.profileName} »`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 md:gap-1.5">
                    {active.studentId ? (
                      <>
                        <Link
                          to={`/conseiller/etudiants/${active.studentId}`}
                          title="Fiche étudiant"
                          className="inline-flex items-center gap-1 rounded-full p-2 text-white transition hover:bg-white/15 md:bg-brand-light md:px-3 md:py-1.5 md:text-[11px] md:font-bold md:text-brand md:hover:bg-brand md:hover:text-white"
                        >
                          <ExternalLink className="h-[18px] w-[18px] md:h-3 md:w-3" />
                          <span className="hidden md:inline">Fiche étudiant</span>
                        </Link>
                        <button
                          type="button"
                          title="Délier cet étudiant"
                          onClick={() => onLink(null).catch((err) => setError(err instanceof Error ? err.message : "Erreur."))}
                          className="rounded-full p-2 text-white transition hover:bg-white/15 md:p-1.5 md:text-muted md:hover:bg-red-50 md:hover:text-red-600"
                        >
                          <Link2Off className="h-[18px] w-[18px] md:h-4 md:w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        title="Lier à un étudiant"
                        onClick={() => setLinkOpen(true)}
                        className="inline-flex items-center gap-1 rounded-full p-2 text-white transition hover:bg-white/15 md:bg-emerald-50 md:px-3 md:py-1.5 md:text-[11px] md:font-bold md:text-emerald-700 md:hover:bg-emerald-600 md:hover:text-white"
                      >
                        <Link2 className="h-[18px] w-[18px] md:h-3 md:w-3" />
                        <span className="hidden md:inline">Lier à un étudiant</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        title={`Responsable : ${active.ownerName || "non attribuée"}`}
                        onClick={() => setAssignOpen(true)}
                        className="inline-flex items-center gap-1 rounded-full p-2 text-white transition hover:bg-white/15 md:border md:border-line md:bg-white md:px-3 md:py-1.5 md:text-[11px] md:font-bold md:text-mid md:hover:border-brand md:hover:text-brand"
                      >
                        <UserCog className="h-[18px] w-[18px] md:h-3 md:w-3" />
                        <span className="hidden md:inline">{active.ownerName || "Non attribuée"}</span>
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
                        <div className={cn("group flex items-center gap-1", mine ? "justify-end" : "justify-start")}>
                          {/* Masquer : visible au survol sur ordinateur, toujours sur écran tactile. */}
                          {mine && !item.hidden && (
                            <button
                              type="button"
                              title="Masquer ce message ici"
                              aria-label="Masquer ce message ici"
                              onClick={() => setHideTarget(item)}
                              className="shrink-0 rounded-full p-1.5 text-[#667781] opacity-0 transition hover:bg-white/80 hover:text-amber-600 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
                            >
                              <EyeOff className="h-4 w-4" />
                            </button>
                          )}
                          {item.hidden ? (
                            <div className="max-w-[82%] rounded-lg rounded-tr-none border border-dashed border-[#8696a0]/60 bg-white/60 px-2.5 py-1.5 text-[13px] leading-5 text-[#667781] md:max-w-[70%]">
                              <p className="flex items-center gap-1.5 italic">
                                <EyeOff className="h-3.5 w-3.5 shrink-0" /> Message masqué ici
                              </p>
                              <p className="text-[11px]">
                                Toujours visible chez l'étudiant{item.hiddenByName ? ` · masqué par ${item.hiddenByName}` : ""}
                              </p>
                              <p className="-mb-0.5 mt-0.5 text-right text-[11px]">{clock(item.createdAt)}</p>
                            </div>
                          ) : (
                          <div
                            className={cn(
                              "max-w-[82%] px-2.5 py-1.5 text-[14.5px] leading-5 text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] md:max-w-[70%]",
                              mine ? "rounded-lg rounded-tr-none bg-[#d9fdd3]" : "rounded-lg rounded-tl-none bg-white"
                            )}
                          >
                            {mine && item.senderName && (
                              <p className="mb-0.5 text-[11px] font-semibold text-[#008069]">{item.senderName}</p>
                            )}
                            {isMedia ? (
                              <p className="flex items-start gap-1.5 italic text-[#667781]">
                                <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {item.body}
                              </p>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{withBold(item.body)}</p>
                            )}
                            <p className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                              {clock(item.createdAt)}
                              {mine && <StatusTicks message={item} />}
                            </p>
                            {mine && item.status === "failed" && item.error && (
                              <p className="mt-1 text-[11px] font-semibold text-red-600">Non délivré : {item.error}</p>
                            )}
                          </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!active.windowOpen && (
                  <div className="flex items-start gap-2 bg-[#fff8e1] px-4 py-2 text-[12px] leading-snug text-amber-900">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-bold">Fenêtre de 24 h fermée.</span> L'étudiant doit vous réécrire pour que vous puissiez répondre
                      <span className="hidden md:inline"> (ou un modèle de message approuvé par Meta est nécessaire)</span>.
                    </span>
                  </div>
                )}
                {error && <p className="bg-[#f0f2f5] px-4 pt-2 text-xs text-red-500">{error}</p>}

                {!isAdmin ? (
                <div
                  className="flex items-end gap-2 bg-[#f0f2f5] px-2 pt-2 md:px-3"
                  style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
                >
                  <div className="relative flex-1">
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
                      onKeyDown={onKeyDown}
                      disabled={!active.windowOpen || sending}
                      rows={Math.min(5, Math.max(1, text.split("\n").length))}
                      placeholder={active.windowOpen ? "Message" : "Réponse impossible pour l'instant"}
                      className="block w-full resize-none rounded-3xl border-0 bg-white px-4 py-2.5 text-[15px] text-[#111b21] shadow-sm outline-none placeholder:text-[#8696a0] disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {text.length > MAX_LENGTH - 200 && (
                      <span className="absolute bottom-1 right-3 text-[10px] text-muted">{text.length}/{MAX_LENGTH}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onSend}
                    aria-label="Envoyer"
                    disabled={!active.windowOpen || sending || !text.trim()}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-md transition hover:bg-[#008f6f] disabled:opacity-40"
                  >
                    <Send className="h-[18px] w-[18px]" />
                  </button>
                </div>
                ) : (
                  <p className="bg-[#f0f2f5] px-4 py-3 text-xs text-muted">Lecture seule : seuls les conseillers peuvent envoyer un message WhatsApp.</p>
                )}
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

      {linkOpen && <LinkStudentModal onClose={() => setLinkOpen(false)} onPick={(studentId) => onLink(studentId)} />}
      {hideTarget && <HideMessageModal message={hideTarget} onClose={() => setHideTarget(null)} onConfirm={() => onHide(hideTarget)} />}
      {assignOpen && active && (
        <AssignOwnerModal currentOwnerId={active.ownerId} onClose={() => setAssignOpen(false)} onPick={onAssign} />
      )}
    </>
  );
}
