import { API_URL, getSession, request } from "@/lib/auth";

export type MailFolder = "inbox" | "sent";
export type MailAddress = { name: string; address: string };

export type MailStatus = {
  configured: boolean;
  ok: boolean;
  address: string;
  host?: string;
  hasSentFolder?: boolean;
  unread?: number;
  error?: string;
};

export type MailListItem = {
  uid: number;
  from: MailAddress | null;
  to: MailAddress[];
  subject: string;
  date: string | null;
  seen: boolean;
  hasAttachments: boolean;
};

export type MailList = { items: MailListItem[]; total: number; page: number; pageSize: number; folderMissing?: boolean };

export type MailAttachment = { index: number; filename: string; contentType: string; size: number };

export type MailMessage = {
  uid: number;
  folder: MailFolder;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  date: string | null;
  messageId: string | null;
  references: string[];
  text: string;
  html: string;
  attachments: MailAttachment[];
};

export type OutgoingAttachment = { filename: string; contentType: string; content: string };

export type SendMailPayload = {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachments?: OutgoingAttachment[];
  inReplyTo?: string;
  references?: string[];
};

export const fetchMailStatus = () => request<MailStatus>("/api/mail/status");
export const fetchMailUnread = () => request<{ unread: number }>("/api/mail/unread-count");

export function fetchMailList(folder: MailFolder, page: number, q: string) {
  const params = new URLSearchParams({ folder, page: String(page) });
  if (q.trim()) params.set("q", q.trim());
  return request<MailList>(`/api/mail/messages?${params.toString()}`);
}

export const fetchMailMessage = (folder: MailFolder, uid: number) => request<MailMessage>(`/api/mail/messages/${folder}/${uid}`);

export const sendMail = (payload: SendMailPayload) => request<{ ok: boolean }>("/api/mail/send", { method: "POST", body: JSON.stringify(payload) });

// Pièce jointe reçue : téléchargée avec la session (jamais en lien public).
export async function downloadMailAttachment(folder: MailFolder, uid: number, attachment: MailAttachment) {
  const session = getSession();
  const response = await fetch(`${API_URL}/api/mail/messages/${folder}/${uid}/attachments/${attachment.index}`, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {}
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Impossible de télécharger cette pièce jointe.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const formatBytes = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);
