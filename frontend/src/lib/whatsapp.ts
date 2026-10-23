import { API_URL, getSession, request } from "@/lib/auth";

export type WhatsAppStatus = "received" | "sent" | "delivered" | "read" | "failed";

export type WhatsAppConversation = {
  id: string;
  phone: string;
  profileName: string | null;
  studentId: string | null;
  studentName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  /** Conversation d'un conseiller en congé, que l'utilisateur connecté traite en remplacement. */
  coverOwnerName?: string | null;
  lastMessageAt: string | null;
  lastBody: string;
  lastHidden: boolean;
  lastDirection: "in" | "out" | null;
  lastStatus: WhatsAppStatus | null;
  unread: number;
  /** Sourdine : pas de non lus, de notification ni d'alerte « en attente ». */
  muted: boolean;
  /** Bloquée : les nouveaux messages sont ignorés et on ne peut plus lui écrire. */
  blocked: boolean;
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
  /** Envoyé par un remplaçant pendant le congé du conseiller (auteur réel, visible par l'équipe). */
  coverAuthorName?: string | null;
  /** Réponse automatique d'un jour non travaillé (jamais comptée comme une réponse d'un conseiller). */
  auto?: boolean;
  /** Fichier joint (image ou document) envoyé depuis l'application. */
  media?: { name: string; mime: string; kind: "image" | "document" | "audio" | "video" } | null;
  caption?: string;
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

export const WA_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const WA_MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
/** Formats acceptés par WhatsApp : images JPEG/PNG, PDF, Word, Excel, PowerPoint, texte. */
export const WA_ACCEPTED_FILES = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/jpeg,image/png,application/pdf";

export async function sendWhatsAppMedia(contactId: string, payload: { file: string; filename: string; caption?: string }) {
  return request<WhatsAppMessage>(`/api/whatsapp/conversations/${contactId}/media`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// Fichier d'un message : téléchargé avec la session (jamais en lien public).
export async function fetchWhatsAppMediaBlob(contactId: string, messageId: string): Promise<Blob> {
  const session = getSession();
  const response = await fetch(`${API_URL}/api/whatsapp/conversations/${contactId}/messages/${messageId}/media`, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {}
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Impossible d'ouvrir ce fichier.");
  }
  return response.blob();
}

// Masque le message dans l'application seulement : l'API de Meta ne permet pas
// de le supprimer, l'étudiant le voit toujours sur son téléphone.
export type WhatsAppDiagnostic = {
  config: { tokenSet: boolean; appSecretSet: boolean; verifyTokenSet: boolean; phoneNumberId: string | null; graphVersion: string };
  sender: { displayPhone?: string | null; verifiedName?: string | null; quality?: string | null; status?: string | null; error?: string; code?: number | null } | null;
  receiving: Array<{ phoneNumberId: string; displayPhone: string | null; contacts: number; lastInboundAt: string | null }>;
  since: string | null;
  traffic: { inbound: number; outbound: number; system: number; manual: number };
  outbound24h: { sent: number; delivered: number; read: number; failed: number };
  recentFailures: Array<{ at: string; to: string; error: string | null }>;
  last: {
    inbound: { at: string; phoneNumberId: string | null; displayPhone: string | null; from: string } | null;
    status: { at: string; status: string; code: number | null; error: string | null } | null;
    send: { at: string; ok: boolean; from: string; code?: number | null; error?: string | null; waMessageId?: string | null } | null;
  };
  warnings: string[];
};

export async function fetchWhatsAppDiagnostic() {
  return request<WhatsAppDiagnostic>("/api/whatsapp/diagnostic");
}

export async function resetWhatsAppDiagnostic() {
  return request<WhatsAppDiagnostic>("/api/whatsapp/diagnostic/reset", { method: "POST" });
}

export async function muteWhatsAppConversation(contactId: string, muted: boolean) {
  return request<WhatsAppConversation>(`/api/whatsapp/conversations/${contactId}/mute`, { method: "PATCH", body: JSON.stringify({ muted }) });
}

export async function blockWhatsAppConversation(contactId: string, blocked: boolean) {
  return request<WhatsAppConversation>(`/api/whatsapp/conversations/${contactId}/block`, { method: "PATCH", body: JSON.stringify({ blocked }) });
}

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
