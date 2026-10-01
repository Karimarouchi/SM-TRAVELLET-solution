import { request } from "@/lib/auth";

// Google Calendar : liens Meet créés automatiquement (voir backend/GOOGLE_CALENDAR.md).
export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  // Réservés à l'admin :
  email?: string;
  connectedAt?: string | null;
  redirectUri?: string;
};

export type MeetKind = "interview" | "staff" | "visaPrep";

export async function fetchGoogleStatus() {
  return request<GoogleStatus>("/api/google/status");
}

// Renvoie l'adresse Google où envoyer l'admin pour accorder l'accès.
export async function fetchGoogleConnectUrl() {
  const data = await request<{ url: string }>("/api/admin/google/connect");
  return data.url;
}

export async function disconnectGoogle() {
  return request<{ connected: boolean }>("/api/admin/google", { method: "DELETE" });
}

export async function createMeetLink(applicationId: string, payload: { kind: MeetKind; date: string; durationMinutes?: number }) {
  return request<{ link: string; calendarLink: string | null }>(`/api/applications/${applicationId}/meet-link`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
