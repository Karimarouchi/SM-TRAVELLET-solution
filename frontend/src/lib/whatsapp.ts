import { request } from "@/lib/auth";

export type WhatsAppStatus = "received" | "sent" | "delivered" | "read" | "failed";

export type WhatsAppConversation = {
  id: string;
  phone: string;
  profileName: string | null;
  studentId: string | null;
  studentName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  lastMessageAt: string | null;
  lastBody: string;
  lastHidden: boolean;
  lastDirection: "in" | "out" | null;
  lastStatus: WhatsAppStatus | null;
  unread: number;
  windowOpen: boolean;
  windowExpiresAt: string | null;
};

export type WhatsAppMessage = {
  id: string;
  direction: "in" | "out";
  type: string;
  body: string;
  hidden: boolean;
  hiddenByName: string | null;
  status: WhatsAppStatus;
  error: string | null;
  senderName: string | null;
  // Admin seulement : ce message a été envoyé par l'admin, au nom du conseiller affiché.
  sentByAdmin?: boolean;
  createdAt: string;
};

export async function fetchWhatsAppConversations(search = "") {
  const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const data = await request<{ conversations: WhatsAppConversation[] }>(`/api/whatsapp/conversations${qs}`);
  return data.conversations;
}

export async function fetchWhatsAppMessages(contactId: string, before?: string) {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return request<{ messages: WhatsAppMessage[]; hasMore: boolean }>(`/api/whatsapp/conversations/${contactId}/messages${qs}`);
}

export async function sendWhatsAppMessage(contactId: string, text: string) {
  return request<WhatsAppMessage>(`/api/whatsapp/conversations/${contactId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

// Masque le message dans l'application seulement : l'API de Meta ne permet pas
// de le supprimer, l'étudiant le voit toujours sur son téléphone.
export async function hideWhatsAppMessage(contactId: string, messageId: string) {
  return request<{ hidden: boolean }>(`/api/whatsapp/conversations/${contactId}/messages/${messageId}/hide`, { method: "POST" });
}

export async function linkWhatsAppStudent(contactId: string, studentId: string | null) {
  return request<WhatsAppConversation>(`/api/whatsapp/conversations/${contactId}/student`, {
    method: "PATCH",
    body: JSON.stringify({ studentId })
  });
}

export async function assignWhatsAppOwner(contactId: string, salesId: string | null) {
  return request<WhatsAppConversation>(`/api/whatsapp/conversations/${contactId}/owner`, {
    method: "PATCH",
    body: JSON.stringify({ salesId })
  });
}

// Deux messageries : les étudiants déjà inscrits (conversation liée à un compte)
// et les prospects (pas encore inscrits, ex. contacts à qui un code a été envoyé).
export type WhatsAppSegment = "registered" | "prospects";

export const WHATSAPP_SEGMENTS: { id: WhatsAppSegment; path: string; label: string; short: string }[] = [
  { id: "registered", path: "inscrits", label: "Étudiants inscrits", short: "Inscrits" },
  { id: "prospects", path: "prospects", label: "Non inscrits", short: "Non inscrits" }
];

export function segmentFromPath(path: string | undefined): WhatsAppSegment | null {
  return WHATSAPP_SEGMENTS.find((s) => s.path === path)?.id ?? null;
}

export function segmentOf(conversation: { studentId: string | null }): WhatsAppSegment {
  return conversation.studentId ? "registered" : "prospects";
}

export type WhatsAppUnread = { unread: number; registered: number; prospects: number };

export async function fetchWhatsAppUnread() {
  return request<WhatsAppUnread>("/api/whatsapp/unread-count");
}

export function formatWhatsAppPhone(phone: string) {
  if (phone.startsWith("216") && phone.length === 11) {
    return `+216 ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return `+${phone}`;
}
