import { request } from "@/lib/auth";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

// Espace de l'admin : la partie RH et la partie Clients ont chacune leurs notifications.
export type NotificationArea = "hr" | "clients";

export function notificationAreaOf(role: string | undefined, pathname: string): NotificationArea | undefined {
  if (role !== "ADMIN") return undefined;
  return pathname.startsWith("/admin/rh") ? "hr" : "clients";
}

const areaQuery = (area?: NotificationArea) => (area ? `?area=${area}` : "");

export async function fetchNotifications(params?: { before?: string; limit?: number; unread?: boolean; area?: NotificationArea }) {
  const qs = new URLSearchParams();
  if (params?.before) qs.set("before", params.before);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.unread) qs.set("unread", "true");
  if (params?.area) qs.set("area", params.area);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ notifications: AppNotification[]; hasMore: boolean }>(`/api/notifications${suffix}`);
}

export async function fetchNotificationUnread(area?: NotificationArea) {
  const data = await request<{ unread: number }>(`/api/notifications/unread-count${areaQuery(area)}`);
  return data.unread;
}

export async function markNotificationRead(id: string) {
  await request(`/api/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(area?: NotificationArea) {
  await request(`/api/notifications/read-all${areaQuery(area)}`, { method: "POST" });
}

// Diffusé quand une notification est lue ailleurs (page complète ↔ cloche),
// pour que le badge se mette à jour immédiatement sans attendre le polling.
export const NOTIFICATIONS_CHANGED = "sm:notifications-changed";

export function emitNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
