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

export async function fetchWhatsAppUnread() {
  const data = await request<{ unread: number }>("/api/whatsapp/unread-count");
  return data.unread;
}

export function formatWhatsAppPhone(phone: string) {
  if (phone.startsWith("216") && phone.length === 11) {
    return `+216 ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return `+${phone}`;
}
