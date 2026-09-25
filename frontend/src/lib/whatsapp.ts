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
