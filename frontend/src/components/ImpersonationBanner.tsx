import { endImpersonation, getSession } from "@/lib/auth";
import { ArrowLeft, Eye } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { SALES: "conseiller(ère) commercial(e)", RDV: "gestionnaire de dossiers" };

// Bandeau visible tant que l'admin navigue dans le compte d'un employé (« Se connecter en tant que »).
export default function ImpersonationBanner() {
  const user = getSession()?.user;
  if (!user?.impersonatedBy) return null;

  const back = () => {
    const path = endImpersonation() || "/login";
    window.location.hash = `#${path}`;
    window.location.reload();
  };

  return (
    <div className="mx-auto mb-4 max-w-[1400px] px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="flex items-start gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Vous êtes dans le compte de <strong>{user.prenom} {user.nom}</strong> ({ROLE_LABEL[user.role] || user.role}). Ce que vous faites ici est enregistré à son nom.
          </span>
        </p>
        <button type="button" onClick={back} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Revenir à mon compte admin
        </button>
      </div>
    </div>
  );
}
