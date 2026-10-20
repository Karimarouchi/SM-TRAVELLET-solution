import { getSession } from "@/lib/auth";
import { fetchMyLeaveCover, type MyLeaveCover } from "@/lib/hr";
import { CalendarClock, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const fr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// Bandeaux du congé avec remplaçants : l'absent voit qu'il est en lecture seule et qui le remplace ;
// le remplaçant voit les collègues dont il traite les dossiers (mention « Remplacement de » dans les listes).
export default function LeaveCoverBanner() {
  const location = useLocation();
  const [data, setData] = useState<MyLeaveCover | null>(null);
  const user = getSession()?.user;
  const roles = user?.roles?.length ? user.roles : [user?.role];
  const concerned = roles.includes("SALES") || roles.includes("RDV");

  useEffect(() => {
    if (!concerned) return;
    let cancelled = false;
    fetchMyLeaveCover()
      .then((next) => { if (!cancelled) setData(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [concerned, location.pathname]);

  if (!concerned || !data || (!data.absence && data.covering.length === 0)) return null;

  return (
    <div className="mx-auto mb-4 max-w-[1400px] space-y-2 px-4 sm:px-6">
      {data.absence && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span>
            <strong>Vous êtes en congé jusqu'au {fr(data.absence.endOn)}.</strong> Vos dossiers sont en lecture seule :{" "}
            {data.absence.substitutes.length
              ? `${data.absence.substitutes.map((sub) => `${sub.name} (${sub.percent} %)`).join(", ")} ${data.absence.substitutes.length > 1 ? "s'en occupent" : "s'en occupe"}.`
              : "vos remplaçants s'en occupent."}{" "}
            Tout vous revient automatiquement à votre retour.
          </span>
        </p>
      )}
      {data.covering.map((cover) => (
        <p key={`${cover.leaveId}-${cover.scope}`} className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden />
          <span>
            <strong>Vous remplacez {cover.ownerName} jusqu'au {fr(cover.endOn)}</strong> ({cover.percent} % de ses {cover.scope === "RDV" ? "dossiers" : "étudiants, conversations WhatsApp et nouveaux leads"}).
            Ils apparaissent dans vos listes avec la mention « Remplacement de {cover.ownerName} ».
          </span>
        </p>
      ))}
    </div>
  );
}
