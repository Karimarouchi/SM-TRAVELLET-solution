import { NotificationIcon, notificationTime } from "@/components/notification-visual";
import {
  NOTIFICATIONS_CHANGED,
  emitNotificationsChanged,
  fetchNotificationUnread,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const POLL_MS = 15_000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshCount = useCallback(() => {
    fetchNotificationUnread().then(setUnread).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    };
  }, [refreshCount]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchNotifications({ limit: 8 })
      .then((data) => setItems(data.notifications))
      .catch(() => undefined)
      .finally(() => setLoading(false));

    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  async function onOpenItem(item: AppNotification) {
    if (!item.read) {
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
      await markNotificationRead(item.id).catch(() => undefined);
      emitNotificationsChanged();
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  }

  async function onReadAll() {
    setItems((current) => current.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await markAllNotificationsRead().catch(() => undefined);
    emitNotificationsChanged();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Notifications"
        aria-label={unread ? `${unread} notification(s) non lue(s)` : "Notifications"}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white transition hover:border-brand hover:text-brand",
          open ? "border-brand text-brand" : "border-line text-gray-900"
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full mt-3 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display text-sm font-bold text-dark">
                Notifications {unread > 0 && <span className="ml-1 text-brand">({unread})</span>}
              </p>
              {unread > 0 && (
                <button type="button" onClick={onReadAll} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
                  <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-slate-50",
                    !item.read && "bg-brand/[0.04]"
                  )}
                >
                  <NotificationIcon type={item.type} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13px] leading-snug", item.read ? "font-medium text-mid" : "font-bold text-dark")}>
                      {item.title}
                    </span>
                    {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{item.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted">{notificationTime(item.createdAt)}</span>
                  </span>
                  {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </button>
              ))}
              {!loading && !items.length && (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Bell className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-dark">Aucune notification</p>
                  <p className="mt-1 text-xs text-muted">Vous serez prévenu ici des nouveautés de vos dossiers.</p>
                </div>
              )}
              {loading && !items.length && <p className="px-4 py-8 text-center text-xs text-muted">Chargement...</p>}
            </div>

            <Link to="/notifications" className="block border-t border-line px-4 py-2.5 text-center text-xs font-bold text-brand transition hover:bg-brand/5">
              Voir toutes les notifications
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
