import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Coins,
  FileUp,
  GraduationCap,
  MessageCircle,
  PlaneTakeoff,
  UserPlus,
  XCircle,
  type LucideIcon
} from "lucide-react";

const VISUALS: Record<string, { icon: LucideIcon; tone: string }> = {
  DOCUMENT_VALIDATED: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600" },
  VISA_DOCUMENT_VALIDATED: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600" },
  DOCUMENT_REJECTED: { icon: XCircle, tone: "bg-red-100 text-red-600" },
  VISA_DOCUMENT_REJECTED: { icon: XCircle, tone: "bg-red-100 text-red-600" },
  DOCUMENT_UPLOADED: { icon: FileUp, tone: "bg-sky-100 text-sky-600" },
  VISA_DOCUMENT_UPLOADED: { icon: FileUp, tone: "bg-sky-100 text-sky-600" },
  APPLICATION_UPDATE: { icon: GraduationCap, tone: "bg-brand-light text-brand" },
  STUDENT_ASSIGNED: { icon: UserPlus, tone: "bg-violet-100 text-violet-600" },
  STUDENT_REGISTERED: { icon: UserPlus, tone: "bg-brand-light text-brand" },
  WHATSAPP_ASSIGNED: { icon: MessageCircle, tone: "bg-emerald-100 text-emerald-600" },
  WHATSAPP_UNASSIGNED: { icon: MessageCircle, tone: "bg-amber-100 text-amber-600" },
  COMMISSION_EARNED: { icon: Coins, tone: "bg-amber-100 text-amber-600" },
  VISA_ACCEPTED: { icon: PlaneTakeoff, tone: "bg-emerald-100 text-emerald-600" },
  VISA_REJECTED: { icon: XCircle, tone: "bg-red-100 text-red-600" },
  STALLED_DOSSIER: { icon: AlertTriangle, tone: "bg-amber-100 text-amber-600" },
  BACKUP_FAILED: { icon: AlertTriangle, tone: "bg-red-100 text-red-600" },
  PASSPORT_EXPIRING: { icon: AlertTriangle, tone: "bg-amber-100 text-amber-600" }
};

export function NotificationIcon({ type, className }: { type: string; className?: string }) {
  const visual = VISUALS[type] || { icon: Bell, tone: "bg-slate-100 text-slate-500" };
  const Icon = visual.icon;
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full", visual.tone, className || "h-9 w-9")}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function notificationTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
