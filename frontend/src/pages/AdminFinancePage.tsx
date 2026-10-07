import { confirmDialog } from "@/components/ui/dialog-host";
import CommissionsPanel from "@/components/admin/CommissionsPanel";
import FinanceStatsSection from "@/components/admin/FinanceStats";
import { StatTile } from "@/components/admin/performance-ui";
import StudentPaymentsPanel from "@/components/StudentPaymentsPanel";
import { FancySelect } from "@/components/ui/fancy-select";
import {
  fetchFinanceOverview,
  fetchPaymentJournal,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type StudentPayment,
  fetchFinancePlans,
  fetchFinancePricing,
  formatMoney,
  removeFinancePricing,
  saveFinancePricing,
  type CountryPricing,
  type Currency,
  type FinanceOverview,
  type PaymentPlan
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, BadgeCheck, Banknote, ChevronDown, ChevronUp, Coins, LayoutDashboard, Receipt, ScrollText, Search, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Tab = "apercu" | "paiements" | "journal" | "tarifs" | "commissions";

const TABS: Array<{ id: Tab; label: string; icon: typeof Coins }> = [
  { id: "apercu", label: "Aperçu", icon: LayoutDashboard },
  { id: "paiements", label: "Paiements", icon: Receipt },
  { id: "journal", label: "Journal", icon: ScrollText },
  { id: "tarifs", label: "Tarifs", icon: Tag },
  { id: "commissions", label: "Commissions", icon: Coins }
];

const CURRENCIES: Currency[] = ["TND", "EUR"];

// Plusieurs monnaies : une ligne par monnaie (« 12 000 DT · 800 € »).
function moneyLines(values: Partial<Record<Currency, number>>): string {
  const parts = CURRENCIES.filter((c) => values[c]).map((c) => formatMoney(values[c] || 0, c));
  return parts.length ? parts.join(" · ") : formatMoney(0, "TND");
}

function Overview() {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFinanceOverview().then(setData).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  }, []);

  if (error) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!data) return <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />;

  const month: Partial<Record<Currency, number>> = {};
  const total: Partial<Record<Currency, number>> = {};
  for (const c of CURRENCIES) {
    if (data.collected[c]) {
      month[c] = data.collected[c]!.month;
      total[c] = data.collected[c]!.total;
    }
  }

  const Breakdown = ({ title, rows }: { title: string; rows: FinanceOverview["byCountry"] }) => (
    <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
      <h3 className="font-display text-base font-bold text-dark">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Aucune donnée pour l'instant.</p>
      ) : (
        <div className="mt-3 divide-y divide-line/60">
          {rows.map((row) => {
            const collected: Partial<Record<Currency, number>> = {};
            const remaining: Partial<Record<Currency, number>> = {};
            for (const c of CURRENCIES) {
              const bucket = row.byCurrency[c];
              if (bucket) {
                collected[c] = bucket.collected;
                remaining[c] = bucket.remaining;
              }
            }
            return (
              <div key={row.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="font-semibold text-dark">{row.name}</span>
                <span className="text-xs">
                  <span className="font-bold text-emerald-700">{moneyLines(collected)}</span> encaissés ·{" "}
                  <span className="font-bold text-amber-700">{moneyLines(remaining)}</span> restants
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Encaissé ce mois" value={moneyLines(month)} />
        <StatTile label="Encaissé au total" value={moneyLines(total)} />
        <StatTile label="Reste à encaisser" value={moneyLines(data.remaining)} tone={Object.values(data.remaining).some(Boolean) ? "warning" : "default"} />
        <StatTile
          label="Étudiants en retard"
          value={data.lateCount}
          hint={`sur ${data.planCount} plan${data.planCount > 1 ? "s" : ""} de paiement`}
          tone={data.lateCount ? "warning" : "default"}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="Par pays" rows={data.byCountry} />
        <Breakdown title="Par conseiller" rows={data.bySales} />
      </div>
      <FinanceStatsSection />
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "late", label: "En retard" },
  { value: "UNPAID", label: "Impayé" },
  { value: "PARTIAL", label: "Partiel" },
  { value: "PAID", label: "Payé" }
];

function Payments({ initialStudent }: { initialStudent: string | null }) {
  const [plans, setPlans] = useState<PaymentPlan[] | null>(null);
  const [pricing, setPricing] = useState<CountryPricing[]>([]);
  const [status, setStatus] = useState("");
  const [countryId, setCountryId] = useState("");
  const [salesId, setSalesId] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(initialStudent);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetchFinancePricing().then(setPricing).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchFinancePlans({ status, countryId, salesId, q: search })
        .then(setPlans)
        .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [status, countryId, salesId, search, version]);

  // Conseillers présents dans les plans, pour le filtre.
  const salesOptions = useMemo(() => {
    const map = new Map<string, string>();
    (plans || []).forEach((p) => p.salesId && map.set(p.salesId, p.salesName || "Conseiller"));
    return [{ value: "", label: "Tous les conseillers" }, ...[...map.entries()].map(([value, label]) => ({ value, label }))];
  }, [plans]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
              status === f.value ? "border-brand bg-brand text-white" : "border-line bg-white text-mid hover:border-brand/40"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FancySelect
          value={countryId}
          onChange={setCountryId}
          options={[{ value: "", label: "Tous les pays" }, ...pricing.map((c) => ({ value: c.countryId, label: c.countryName }))]}
        />
        <FancySelect value={salesId} onChange={setSalesId} options={salesOptions} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un étudiant…"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 space-y-3">
        {!plans ? (
          <div className="mx-auto mt-10 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        ) : plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
            Aucun plan de paiement ne correspond. Les plans se créent quand un conseiller génère un code d'inscription pour un pays qui a un tarif, ou quand un paiement est enregistré sur la fiche d'un étudiant.
          </p>
        ) : (
          plans.map((plan) => {
            const isOpen = open === plan.studentId;
            return (
              <div key={plan.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : plan.studentId)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-dark">{plan.studentName}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {plan.countryName} · {plan.salesName || "Sans conseiller"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-mid">
                      T1 {plan.tranche1.complete ? "✓" : formatMoney(plan.tranche1.remaining, plan.currency)} · T2 {plan.tranche2.complete ? "✓" : formatMoney(plan.tranche2.remaining, plan.currency)}
                    </span>
                    {plan.status === "PAID" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        <BadgeCheck className="h-3 w-3" /> Payé
                      </span>
                    ) : plan.late ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                        <AlertTriangle className="h-3 w-3" /> En retard
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">{plan.status === "PARTIAL" ? "Partiel" : "Impayé"}</span>
                    )}
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-line bg-slate-50 px-4 pb-4">
                    <StudentPaymentsPanel studentId={plan.studentId} onChanged={() => setVersion((v) => v + 1)} />
                    <Link to={`/conseiller/etudiants/${plan.studentId}`} className="mt-3 inline-block text-xs font-bold text-brand underline">
                      Ouvrir la fiche de l'étudiant
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Journal : tous les paiements, avec leur numéro de reçu et le chèque / code de virement.
function Journal() {
  const [rows, setRows] = useState<StudentPayment[] | null>(null);
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchPaymentJournal({ method, q: search })
        .then(setRows)
        .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [method, search]);

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Reçu (001-2026), n° de chèque, code de virement, étudiant…"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <FancySelect
          value={method}
          onChange={setMethod}
          options={[{ value: "", label: "Tous les modes" }, ...(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))]}
        />
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {!rows ? (
        <div className="mx-auto mt-10 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">Aucun paiement ne correspond.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Reçu</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Étudiant</th>
                <th className="px-4 py-3">Tranche</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Chèque / virement</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((p) => (
                <tr key={p.id} className={cn(p.status === "CANCELLED" && "bg-slate-50 text-muted")}>
                  <td className={cn("px-4 py-3 font-bold", p.status === "CANCELLED" ? "line-through" : "text-brand")}>{p.receiptNumber || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(p.paidAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <Link to={`/conseiller/etudiants/${p.studentId}`} className="font-semibold text-dark hover:text-brand">{p.studentName}</Link>
                    <span className="block text-[11px] text-muted">{p.countryName}</span>
                  </td>
                  <td className="px-4 py-3">T{p.tranche}</td>
                  <td className="px-4 py-3">{p.methodLabel}</td>
                  <td className="px-4 py-3">
                    {p.reference ? (
                      <>
                        <span className="block font-semibold">{p.reference}</span>
                        <span className="block text-[11px] text-muted">{p.referenceLabel}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={cn("px-4 py-3 text-right font-bold whitespace-nowrap", p.status === "CANCELLED" && "line-through")}>
                    {formatMoney(p.amount, p.currency)}
                    {p.status === "CANCELLED" && <span className="block text-[11px] font-semibold text-red-600 no-underline">Annulé</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PricingRow({ row, onSaved }: { row: CountryPricing; onSaved: (next: CountryPricing) => void }) {
  const [currency, setCurrency] = useState<Currency>(row.currency);
  const [tranche1, setTranche1] = useState(row.tranche1 === null ? "" : String(row.tranche1));
  const [tranche2, setTranche2] = useState(row.tranche2 === null ? "" : String(row.tranche2));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const total = (Number(tranche1.replace(",", ".")) || 0) + (Number(tranche2.replace(",", ".")) || 0);
  const symbol = currency === "EUR" ? "€" : "DT";

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await saveFinancePricing(row.countryId, {
        currency,
        tranche1: Number(tranche1.replace(",", ".")) || 0,
        tranche2: Number(tranche2.replace(",", ".")) || 0
      });
      onSaved(next);
      setMessage("Enregistré ✓");
      window.setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if ((await confirmDialog(`Supprimer le tarif de ${row.countryName} ? Les étudiants déjà engagés gardent leur tarif ; les nouveaux codes ne demanderont plus de paiement.`, { tone: "danger", confirmLabel: "Supprimer" }))) return;
    setBusy(true);
    try {
      const next = await removeFinancePricing(row.countryId);
      onSaved(next);
      setTranche1("");
      setTranche2("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-dark">
          <span className="inline-flex h-7 w-10 items-center justify-center rounded-lg bg-brand/10 text-[11px] font-bold text-brand">{row.code}</span>
          {row.countryName}
        </p>
        {row.configured ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Tarif défini</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Pas de tarif · aucun paiement exigé</span>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-mid">Monnaie</label>
          <FancySelect value={currency} onChange={(v) => setCurrency(v as Currency)} options={[{ value: "TND", label: "DT (dinar)" }, { value: "EUR", label: "€ (euro)" }]} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-mid">Tranche 1 · inscription ({symbol})</label>
          <input value={tranche1} onChange={(e) => setTranche1(e.target.value)} inputMode="decimal" placeholder="ex. 1000" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-mid">Tranche 2 · visa ({symbol})</label>
          <input value={tranche2} onChange={(e) => setTranche2(e.target.value)} inputMode="decimal" placeholder="ex. 1000" className={input} />
        </div>
        <div className="flex flex-col justify-end">
          <p className="mb-1 text-[11px] font-bold text-mid">Prix total</p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-extrabold text-dark">{formatMoney(total, currency)}</p>
        </div>
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {message && <span className="text-xs font-bold text-emerald-700">{message}</span>}
        {row.configured && (
          <button type="button" disabled={busy} onClick={remove} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-60">
            Supprimer le tarif
          </button>
        )}
        <button type="button" disabled={busy || total <= 0} onClick={save} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function Pricing() {
  const [rows, setRows] = useState<CountryPricing[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFinancePricing().then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  }, []);

  return (
    <div className="mt-6">
      <p className="rounded-2xl border border-line bg-white p-4 text-sm text-mid">
        Fixez le prix de chaque pays en <strong>2 tranches</strong> : la tranche 1 est encaissée à l'inscription (le conseiller la confirme en créant le code), la tranche 2 avant le dépôt du visa.
        Le tarif est figé pour chaque étudiant à son inscription : modifier un prix ne change pas les étudiants déjà engagés.
      </p>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 space-y-3">
        {!rows ? (
          <div className="mx-auto mt-10 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        ) : (
          rows.map((row) => (
            <PricingRow key={`${row.countryId}:${row.configured}`} row={row} onSaved={(next) => setRows((prev) => (prev || []).map((r) => (r.countryId === next.countryId ? next : r)))} />
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminFinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const student = searchParams.get("student");
  const [tab, setTab] = useState<Tab>(
    requested === "paiements" || requested === "journal" || requested === "tarifs" || requested === "commissions" ? requested : student ? "paiements" : "apercu"
  );

  // Un lien (ex. alerte « paiement non réglé ») peut changer l'onglet sans recharger la page.
  useEffect(() => {
    if (requested === "paiements" || requested === "journal" || requested === "tarifs" || requested === "commissions") setTab(requested);
    else if (student) setTab("paiements");
  }, [requested, student]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSearchParams(next === "apercu" ? {} : { tab: next }, { replace: true });
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <p className="text-sm text-white/80">Espace administrateur</p>
        <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-extrabold">
          <Banknote className="h-8 w-8" aria-hidden /> Finance
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/85">
          Chiffre d'affaires, paiements des étudiants en 2 tranches (inscription puis visa), tarifs par pays et commissions de l'équipe.
        </p>
        <div className="relative mt-6 grid grid-cols-3 gap-1 rounded-xl bg-white/10 p-1 backdrop-blur sm:inline-flex sm:items-center">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4",
                tab === item.id ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" /> {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "apercu" && <Overview />}
      {tab === "paiements" && <Payments key={student || "all"} initialStudent={student} />}
      {tab === "journal" && <Journal />}
      {tab === "tarifs" && <Pricing />}
      {tab === "commissions" && <CommissionsPanel />}
    </main>
  );
}
