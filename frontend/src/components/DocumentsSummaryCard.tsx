import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

// Carte compacte pour l'espace étudiant : juste le titre, un sous-titre et
// une barre de progression, sans la liste des documents ni l'upload — le
// dépôt des fichiers se fait sur /documents (onglet Inscription ou Visa).
export default function DocumentsSummaryCard({
  icon: Icon,
  title,
  subtitle,
  total,
  done,
  doneLabel,
  emptyLabel,
  to
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  total: number;
  done: number;
  doneLabel: string;
  emptyLabel: string;
  to: string;
}) {
  return (
    <Link to={to} className="block rounded-[24px] border border-line bg-white p-6 transition hover:border-brand/40 hover:shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
        <Icon className="h-5 w-5 text-brand" /> {title}
      </h2>
      <p className="mt-1 text-xs text-muted">{subtitle}</p>
      {total > 0 ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold text-muted">{done} / {total} {doneLabel}</span>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">{emptyLabel}</p>
      )}
    </Link>
  );
}
