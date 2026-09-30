import { fetchTeamPerformance, type PerformancePeriod, type StaffPerformance, type TeamPerformance } from "@/lib/auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronRight, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PeriodSelector, StatTile, StatusChip, WhatsAppFunnelBars, WorkHoursNote, convertedHint, durationHint, percent } from "./performance-ui";

type Column = { label: string; value: (s: StaffPerformance) => string | number; warn?: (s: StaffPerformance) => boolean };

const SALES_COLUMNS: Column[] = [
  { label: "Conversations", value: (s) => s.sales!.whatsapp.conversations },
  { label: "Abouties", value: (s) => percent(s.sales!.whatsapp.conversionRate) },
  { label: "1re réponse", value: (s) => s.sales!.whatsapp.firstReply.label },
  { label: "En attente", value: (s) => s.sales!.whatsapp.pendingNow, warn: (s) => s.sales!.whatsapp.pendingNow > 0 },
  { label: "Vérif. documents", value: (s) => s.sales!.documentReview.label },
  { label: "Dossier → RDV", value: (s) => s.sales!.handoff.label },
  { label: "Mi-parcours", value: (s) => s.sales!.halfwayDossiers, warn: (s) => s.sales!.halfwayDossiers > 0 }
];

const RDV_COLUMNS: Column[] = [
  { label: "Dossiers", value: (s) => s.rdv!.dossiers },
  { label: "Prêt → déposé", value: (s) => s.rdv!.readyToApplied.label },
  { label: "Déposé → décision", value: (s) => s.rdv!.appliedToDecision.label },
  { label: "Docs visa → dépôt", value: (s) => s.rdv!.visaDocsToSubmit.label },
  { label: "Acceptation", value: (s) => percent(s.rdv!.acceptanceRate) },
  { label: "Mi-parcours", value: (s) => s.rdv!.halfwayDossiers, warn: (s) => s.rdv!.halfwayDossiers > 0 }
];

// Liste d'employés : cartes sur téléphone, tableau à partir de sm.
function StaffList({ title, people, columns, period }: { title: string; people: StaffPerformance[]; columns: Column[]; period: PerformancePeriod }) {
  if (!people.length) return null;
  const link = (s: StaffPerformance) => `/admin/equipe/${s.id}?period=${period}`;
  return (
    <div className="mt-6">
      <h3 className="font-display text-base font-bold text-dark">{title}</h3>

      <div className="mt-3 space-y-3 sm:hidden">
        {people.map((s) => (
          <Link key={s.id} to={link(s)} className="block rounded-2xl border border-line bg-white p-4 transition hover:border-brand/40">
            <div className="flex items-center gap-2.5">
              <UserAvatar name={`${s.prenom} ${s.nom}`} size="sm" className="h-8 w-8 text-[10px]" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-dark">{s.prenom} {s.nom}</span>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-brand">
                Stats <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {columns.map((col) => (
                <div key={col.label} className="min-w-0">
                  <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">{col.label}</dt>
                  <dd className={cn("text-sm font-bold", col.warn?.(s) ? "text-amber-700" : "text-dark")}>{col.value(s)}</dd>
                </div>
              ))}
            </dl>
          </Link>
        ))}
      </div>

      <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-line sm:block">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50">
            <tr className="text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Employé</th>
              {columns.map((col) => (
                <th key={col.label} className="px-3 py-2.5">{col.label}</th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {people.map((s) => (
              <tr key={s.id} className={cn("transition hover:bg-brand/5", !s.isActive && "opacity-60")}>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <UserAvatar name={`${s.prenom} ${s.nom}`} size="sm" className="h-7 w-7 text-[10px]" />
                    <span className="font-semibold text-dark">{s.prenom} {s.nom}</span>
                  </span>
                </td>
                {columns.map((col) => (
                  <td key={col.label} className={cn("px-3 py-2.5 font-semibold", col.warn?.(s) ? "text-amber-700" : "text-dark")}>
                    {col.value(s)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <Link to={link(s)} className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white">
                    <BarChart3 className="h-3 w-3" /> Voir stats
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TeamPerformancePanel() {
  const [period, setPeriod] = useState<PerformancePeriod>("30");
  const [data, setData] = useState<TeamPerformance | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetchTeamPerformance(period)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les statistiques."));
  }, [period]);

  const wa = data?.whatsapp;
  const sales = (data?.staff || []).filter((s) => s.sales);
  const rdv = (data?.staff || []).filter((s) => s.rdv);

  return (
    <section className="mt-6 rounded-[24px] border border-line bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-dark">Statistiques de l'équipe</h2>
          <p className="mt-0.5 text-xs text-muted">WhatsApp, délais de traitement et dossiers bloqués, par employé.</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="mt-6 text-sm text-muted">Chargement...</p>}

      {data && wa && (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-dark">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <StatTile label="1re réponse" value={wa.firstReply.label} hint={`en moyenne, ${durationHint(wa.firstReply, "conversation")}`} />
                <StatTile label="Temps de réponse" value={wa.reply.label} hint={`moyenne de toutes les réponses, ${durationHint(wa.reply, "réponse")}`} />
                <StatTile
                  label="Taux d'aboutissement"
                  value={percent(wa.conversionRate)}
                  hint={convertedHint(wa.converted, wa.answered)}
                />
                <StatTile
                  label="En attente"
                  value={wa.pendingNow}
                  hint="conversations qui attendent une réponse maintenant"
                  tone={wa.pendingNow ? "warning" : "default"}
                />
              </div>
              {wa.unassigned > 0 && (
                <div className="mt-3">
                  <StatusChip count={wa.unassigned} label={wa.unassigned > 1 ? "conversations sans conseiller" : "conversation sans conseiller"} />
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-line p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Entonnoir WhatsApp</p>
              <div className="mt-3">
                <WhatsAppFunnelBars funnel={wa} />
              </div>
            </div>
          </div>

          <StaffList title="Conseillers" people={sales} columns={SALES_COLUMNS} period={period} />
          <StaffList title="Responsables Visa" people={rdv} columns={RDV_COLUMNS} period={period} />

          <div className="mt-4">
            <WorkHoursNote workHours={data.workHours} />
          </div>
        </>
      )}
    </section>
  );
}
