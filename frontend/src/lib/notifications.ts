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

export async function fetchNotifications(params?: { before?: string; limit?: number; unread?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.before) qs.set("before", params.before);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.unread) qs.set("unread", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ notifications: AppNotification[]; hasMore: boolean }>(`/api/notifications${suffix}`);
}

export async function fetchNotificationUnread() {
  const data = await request<{ unread: number }>("/api/notifications/unread-count");
  return data.unread;
}

export async function markNotificationRead(id: string) {
  await request(`/api/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  await request("/api/notifications/read-all", { method: "POST" });
}

// Diffusé quand une notification est lue ailleurs (page complète ↔ cloche),
// pour que le badge se mette à jour immédiatement sans attendre le polling.
export const NOTIFICATIONS_CHANGED = "sm:notifications-changed";

export function emitNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
