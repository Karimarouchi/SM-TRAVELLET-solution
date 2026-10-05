import type { PendingConversation } from "@/lib/auth";
import { formatWhatsAppPhone } from "@/lib/whatsapp";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowRight, Clock, MessageCircle } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

// Conversations WhatsApp qui attendent une réponse, regroupées par conseiller
// (celui qui doit répondre), les plus anciennes d'abord. Un clic ouvre la
// conversation dans la bonne messagerie.
export default function PendingConversationsList({ items }: { items: PendingConversation[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; items: PendingConversation[] }>();
    for (const item of items) {
      const key = item.ownerId || "none";
      const group = map.get(key) || { key, name: item.ownerName || "Sans conseiller", items: [] };
      group.items.push(item);
      map.set(key, group);
    }
    // « Sans conseiller » en tête (urgent), puis le conseiller dont l'attente la plus ancienne est la plus longue.
    return [...map.values()].sort(
      (a, b) => (a.key === "none" ? -1 : 0) - (b.key === "none" ? -1 : 0) || b.items[0].waitingMinutes - a.items[0].waitingMinutes
    );
  }, [items]);

  if (!items.length) {
    return <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Aucune conversation n'attend de réponse.</p>;
  }

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-3" role="region" aria-label="Conversations en attente de réponse">
      <p className="px-1 text-xs font-bold text-amber-900">
        {items.length} conversation{items.length > 1 ? "s" : ""} à traiter, regroupée{items.length > 1 ? "s" : ""} par conseiller
      </p>
      <div className="mt-2 space-y-3">
        {groups.map((group) => (
          <div key={group.key} className="rounded-xl bg-white">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <UserAvatar name={group.name} size="sm" className="h-6 w-6 text-[9px]" />
              <span className={`min-w-0 flex-1 truncate text-xs font-extrabold ${group.key === "none" ? "text-red-700" : "text-dark"}`}>
                {group.key === "none" ? "Sans conseiller : personne ne doit répondre" : group.name}
              </span>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{group.items.length}</span>
            </div>
            <ul className="divide-y divide-line/60">
              {group.items.map((item) => (
                <li key={item.contactId}>
                  <Link to={`/whatsapp/${item.segment}?open=${item.contactId}`} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-brand/5">
                    <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-dark">{item.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {formatWhatsAppPhone(item.phone)} · {item.segment === "inscrits" ? "étudiant inscrit" : "non inscrit"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-amber-800">
                      <Clock className="h-3 w-3" aria-hidden /> {item.waitingLabel}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-[10px] text-muted">Durée d'attente en heures ouvrées. Un clic ouvre la conversation dans WhatsApp.</p>
    </div>
  );
}
