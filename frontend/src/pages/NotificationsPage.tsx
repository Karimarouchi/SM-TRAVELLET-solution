import { NotificationIcon, notificationTime } from "@/components/notification-visual";
import {
  NOTIFICATIONS_CHANGED,
  emitNotificationsChanged,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function dayLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications({ limit: 30, unread: filter === "unread" });
      setItems(data.notifications);
      setHasMore(data.hasMore);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les notifications.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, load);
  }, [load]);

  async function loadMore() {
    if (!items.length) return;
    setLoadingMore(true);
    try {
      const data = await fetchNotifications({ limit: 30, unread: filter === "unread", before: items[items.length - 1].createdAt });
      setItems((current) => [...current, ...data.notifications]);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function onOpen(item: AppNotification) {
    if (!item.read) {
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      await markNotificationRead(item.id).catch(() => undefined);
      emitNotificationsChanged();
    }
    if (item.link) navigate(item.link);
  }

  async function onReadAll() {
    setItems((current) => (filter === "unread" ? [] : current.map((n) => ({ ...n, read: true }))));
    await markAllNotificationsRead().catch(() => undefined);
    emitNotificationsChanged();
  }

  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-7 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
          <Bell className="h-7 w-7" /> Notifications
        </h1>
        <p className="mt-2 text-sm text-white/85">Les nouveautés de vos dossiers, envoyées automatiquement par la plateforme.</p>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            { id: "all" as const, label: "Toutes" },
            { id: "unread" as const, label: "Non lues" }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-bold transition",
                filter === item.id ? "bg-brand text-white shadow-md" : "border border-line bg-white text-mid hover:border-brand hover:text-brand"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={onReadAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <section className="mt-4 overflow-hidden rounded-[24px] border border-line bg-white">
        {items.map((item, index) => {
          const showDay = index === 0 || new Date(items[index - 1].createdAt).toDateString() !== new Date(item.createdAt).toDateString();
          return (
            <div key={item.id}>
              {showDay && (
                <p className="border-b border-line bg-slate-50 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                  {dayLabel(item.createdAt)}
                </p>
              )}
              <button
                type="button"
                onClick={() => onOpen(item)}
                className={cn(
                  "group flex w-full items-start gap-4 border-b border-line/60 px-5 py-4 text-left transition hover:bg-slate-50",
                  !item.read && "bg-brand/[0.04]"
                )}
              >
                <NotificationIcon type={item.type} className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className={cn("text-sm leading-snug", item.read ? "font-medium text-mid" : "font-bold text-dark")}>{item.title}</span>
                    <span className="shrink-0 text-[11px] text-muted">{notificationTime(item.createdAt)}</span>
                  </span>
                  {item.body && <span className="mt-1 block text-[13px] text-muted">{item.body}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 self-center">
                  {!item.read && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                  {item.link && <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-brand" />}
                </span>
              </button>
            </div>
          );
        })}

        {!loading && !items.length && (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Bell className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-lg font-bold text-dark">
              {filter === "unread" ? "Tout est lu" : "Aucune notification"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {filter === "unread" ? "Vous êtes à jour." : "Vous serez prévenu ici des nouveautés de vos dossiers."}
            </p>
          </div>
        )}
        {loading && !items.length && <p className="px-6 py-12 text-center text-sm text-muted">Chargement...</p>}
      </section>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={loadMore}
            className="rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold text-mid transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {loadingMore ? "Chargement..." : "Afficher plus"}
          </button>
        </div>
      )}
    </main>
  );
}
