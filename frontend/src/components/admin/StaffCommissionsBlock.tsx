import { STAGE_LABELS_FR } from "@/components/MyCommissionsCard";
import { alertDialog, confirmDialog } from "@/components/ui/dialog-host";
import { fetchUserCommissionPayouts, formatMoney, payUserCommissions, type UserCommissions } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, HandCoins, History, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CountUp } from "./anim";

const dt = (value: number) => formatMoney(value, "TND");
const frDate = (value: string) => new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

// Page de stats d'un employé : ses commissions à payer (avec le bouton Payer) et ses versements passés.
export default function StaffCommissionsBlock({ userId, name }: { userId: string; name: string }) {
  const [data, setData] = useState<UserCommissions | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchUserCommissionPayouts(userId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Commissions indisponibles."));

  useEffect(() => {
    setData(null);
    void load();
  }, [userId]);

  async function payAll() {
    if (!data || !data.due.length) return;
    const confirmed = await confirmDialog(`Marquer ${data.due.length} commission${data.due.length > 1 ? "s" : ""} (${dt(data.dueTotal)}) comme versée${data.due.length > 1 ? "s" : ""} à ${name} ? Il sera prévenu et le versement ajouté à l'historique.`, {
      title: "Payer les commissions ?",
      confirmLabel: "Payer",
      tone: "warning"
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await payUserCommissions(userId);
      await load();
    } catch (err) {
      void alertDialog(err instanceof Error ? err.message : "Versement impossible.", { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 overflow-hidden rounded-[24px] border border-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark"><HandCoins className="h-5 w-5 text-brand" /> Commissions</h2>
          <p className="mt-0.5 text-xs text-muted">Ce qu'il reste à verser à {name}, et ce qui a déjà été payé.</p>
        </div>
        <Link to="/admin/finance?tab=versements" className="text-xs font-bold text-brand hover:underline">Tous les versements →</Link>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700"><Wallet className="h-3.5 w-3.5" /> À payer</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none text-dark"><CountUp value={data.dueTotal} decimals={2} suffix=" DT" /></p>
          <p className="mt-1 text-[11px] text-amber-800/80">{data.due.length} commission{data.due.length > 1 ? "s" : ""} en attente</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Déjà payé</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none text-dark"><CountUp value={data.paidTotal} decimals={2} suffix=" DT" /></p>
          <p className="mt-1 text-[11px] text-emerald-800/80">{data.payouts.length} versement{data.payouts.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-line p-4">
          <button type="button" disabled={busy || !data.due.length} onClick={() => void payAll()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
            <HandCoins className="h-4 w-4" /> {busy ? "Versement…" : data.due.length ? `Payer ${dt(data.dueTotal)}` : "Rien à payer"}
          </button>
        </div>
      </div>

      {data.due.length > 0 && (
        <div className="border-t border-line">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-3 text-left text-xs font-bold text-mid transition hover:text-brand sm:px-6">
            Détail des commissions à payer
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="overflow-x-auto pb-3">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-muted">
                    <th className="px-6 py-2">Étudiant</th>
                    <th className="px-3 py-2">Étape</th>
                    <th className="px-3 py-2">Pays</th>
                    <th className="px-3 py-2">Gagnée le</th>
                    <th className="px-6 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {data.due.map((line) => (
                    <tr key={line.id}>
                      <td className="px-6 py-2 font-semibold text-dark">{line.studentName}</td>
                      <td className="px-3 py-2 text-mid">{STAGE_LABELS_FR[line.stage]}</td>
                      <td className="px-3 py-2 text-mid">{line.countryName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{frDate(line.earnedAt)}</td>
                      <td className="whitespace-nowrap px-6 py-2 text-right font-bold text-dark">{dt(line.amountDinar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {data.payouts.length > 0 && (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><History className="h-3.5 w-3.5" /> Historique des versements</h3>
          <ul className="mt-2 divide-y divide-line/60">
            {data.payouts.slice(0, 6).map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="font-bold text-dark">{payout.number}</span>
                <span className="text-muted">{frDate(payout.paidAt)} · {payout.count} commission{payout.count > 1 ? "s" : ""}{payout.paidByName ? ` · par ${payout.paidByName}` : ""}</span>
                <span className="font-bold text-emerald-700">{dt(payout.amountDinar)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}
