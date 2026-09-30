import { fetchWorkHoursReport, type WorkHoursReport } from "@/lib/auth";
import { Clock, Users2, UserCog } from "lucide-react";
import { useEffect, useState } from "react";

const DAY_LABELS: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
  7: "Dim"
};

export default function AdminWorkHoursPage() {
  const [data, setData] = useState<WorkHoursReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkHoursReport()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les heures de travail."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 sm:p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">Espace administrateur</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold">
          <Clock className="h-7 w-7" /> Heures de travail
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85">
          Les durées ci-dessous ne comptent que les jours et plages horaires définis dans Paramètres. Nuits et jours non ouvrés sont exclus.
        </p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-6 text-sm text-muted">Chargement...</p>}

      {data && (
        <>
          <section className="mt-6 rounded-[24px] border border-line bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Plage retenue</p>
            <p className="mt-1 text-sm font-semibold text-dark">
              {data.workHours.days.map((d) => DAY_LABELS[d]).join(" · ")} · {data.workHours.start} – {data.workHours.end} ({data.workHours.timezone})
            </p>
            <p className="mt-1 text-xs text-muted">
              Un dossier est signalé « à mi-parcours » au-delà de {Math.round(data.workHours.halfwayMinutes / 60)} h ouvrées sans avancer.
            </p>
          </section>

          <section className="mt-6 rounded-[24px] border border-line bg-white p-5 overflow-x-auto">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
              <Users2 className="h-5 w-5 text-brand" /> Conseillers
            </h2>
            <table className="mt-4 w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3">Conseiller</th>
                  <th className="pb-2 pr-3">Étudiants</th>
                  <th className="pb-2 pr-3">Docs validés</th>
                  <th className="pb-2 pr-3">Assignation → docs</th>
                  <th className="pb-2 pr-3">Mi-parcours</th>
                  <th className="pb-2 pr-3">WA semaine</th>
                  <th className="pb-2 pr-3">WA mois</th>
                  <th className="pb-2">Délai WA</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2.5 pr-3 font-semibold text-dark">{row.prenom} {row.nom}</td>
                    <td className="py-2.5 pr-3">{row.students}</td>
                    <td className="py-2.5 pr-3">{row.documentsValidated}</td>
                    <td className="py-2.5 pr-3">{row.avgAssignToDocsLabel}</td>
                    <td className="py-2.5 pr-3">{row.halfwayDossiers}</td>
                    <td className="py-2.5 pr-3">{row.whatsappConversationsWeek}</td>
                    <td className="py-2.5 pr-3">{row.whatsappConversationsMonth}</td>
                    <td className="py-2.5">{row.avgWhatsappReplyLabel}</td>
                  </tr>
                ))}
                {!data.sales.length && (
                  <tr><td colSpan={8} className="py-6 text-muted">Aucun conseiller.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-6 rounded-[24px] border border-line bg-white p-5 overflow-x-auto">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
              <UserCog className="h-5 w-5 text-brand" /> Responsables visa
            </h2>
            <table className="mt-4 w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3">RDV</th>
                  <th className="pb-2 pr-3">Dossiers</th>
                  <th className="pb-2 pr-3">Prêt → déposé</th>
                  <th className="pb-2 pr-3">Déposé → accepté</th>
                  <th className="pb-2 pr-3">Visa → dépôt</th>
                  <th className="pb-2">Mi-parcours</th>
                </tr>
              </thead>
              <tbody>
                {data.rdv.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2.5 pr-3 font-semibold text-dark">{row.prenom} {row.nom}</td>
                    <td className="py-2.5 pr-3">{row.dossiers}</td>
                    <td className="py-2.5 pr-3">{row.avgReadyToAppliedLabel}</td>
                    <td className="py-2.5 pr-3">{row.avgAppliedToAcceptedLabel}</td>
                    <td className="py-2.5 pr-3">{row.avgVisaPrepToSubmitLabel}</td>
                    <td className="py-2.5">{row.halfwayDossiers}</td>
                  </tr>
                ))}
                {!data.rdv.length && (
                  <tr><td colSpan={6} className="py-6 text-muted">Aucun dossier RDV pour l'instant.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
