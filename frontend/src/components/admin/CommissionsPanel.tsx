import {
  fetchAdminCountries,
  fetchAllCommissionEarnings,
  fetchCommissionRules,
  upsertCommissionRule,
  type CommissionEarning,
  type CommissionRole,
  type CommissionRule,
  type CommissionStage,
  type Country
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp, Coins, Globe2, Search, UserCog, Users } from "lucide-react";
import { useEffect, useState } from "react";

const SALES_STAGES: CommissionStage[] = ["CODE_CLAIMED", "DOCUMENTS_VALIDATED", "APPLIED", "ACCEPTED"];
const RDV_STAGES: CommissionStage[] = ["VISA_SUBMITTED", "VISA_ACCEPTED"];

const STAGE_LABELS: Record<CommissionStage, string> = {
  CODE_CLAIMED: "Étudiant inscrit via un code",
  DOCUMENTS_VALIDATED: "Documents du dossier validés",
  APPLIED: "Candidature déposée",
  ACCEPTED: "Candidature acceptée par l'université",
  VISA_SUBMITTED: "Dossier visa déposé",
  VISA_ACCEPTED: "Visa accepté"
};

function RuleRow({
  countryId,
  role,
  stage,
  rule,
  onSaved
}: {
  countryId: string;
  role: CommissionRole;
  stage: CommissionStage;
  rule?: CommissionRule;
  onSaved: () => void;
}) {
  const initial = String(rule?.amountDinar ?? "");
  const [amount, setAmount] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setAmount(String(rule?.amountDinar ?? "")); }, [rule?.amountDinar]);

  const dirty = amount !== initial;

  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      setError("Montant invalide.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await upsertCommissionRule({ countryId, role, stage, amountDinar: value });
      onSaved();
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-3.5 py-3 transition-colors",
      dirty ? "border-brand/40 bg-brand-light/20" : "border-line"
    )}>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-dark">{STAGE_LABELS[stage]}</span>
      <div className="flex shrink-0 items-center gap-2">
        {error && <span className="text-[10px] font-semibold text-red-500">{error}</span>}
        {justSaved && !dirty && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-white pl-2.5 pr-1 focus-within:border-brand">
          <input
            type="number"
            min={0}
            step="0.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-14 bg-transparent py-1.5 text-right text-xs font-semibold text-dark outline-none"
          />
          <span className="text-[10px] font-bold text-muted">DT</span>
        </div>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={save}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11px] font-bold transition disabled:cursor-default",
            dirty ? "bg-brand text-white hover:opacity-90" : "pointer-events-none bg-transparent text-transparent"
          )}
        >
          {saving ? "..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/* ─── Statistiques de commissions, même style que Conseillers/RDV ────── */
function CommissionsStats({ earnings }: { earnings: CommissionEarning[] }) {
  const totalPaid = earnings.reduce((sum, e) => sum + e.amountDinar, 0);
  const salesEarnings = earnings.filter((e) => e.role === "SALES");
  const rdvEarnings = earnings.filter((e) => e.role === "RDV");
  const totalSales = salesEarnings.reduce((sum, e) => sum + e.amountDinar, 0);
  const totalRdv = rdvEarnings.reduce((sum, e) => sum + e.amountDinar, 0);

  const stats = [
    {
      key: "total",
      label: "Total versé",
      value: `${totalPaid.toFixed(2)} DT`,
      hint: `${earnings.length} commission${earnings.length > 1 ? "s" : ""} attribuée${earnings.length > 1 ? "s" : ""}`,
      icon: Coins,
      color: "from-violet-500 to-purple-600",
      isText: true
    },
    {
      key: "count",
      label: "Commissions attribuées",
      value: earnings.length,
      hint: "Toutes étapes confondues",
      icon: Users,
      color: "from-sky-500 to-blue-600"
    },
    {
      key: "sales",
      label: "Versé aux Sales",
      value: `${totalSales.toFixed(2)} DT`,
      hint: `${salesEarnings.length} commission${salesEarnings.length > 1 ? "s" : ""}`,
      icon: Users,
      color: "from-emerald-500 to-teal-600",
      isText: true
    },
    {
      key: "rdv",
      label: "Versé aux RDV",
      value: `${totalRdv.toFixed(2)} DT`,
      hint: `${rdvEarnings.length} commission${rdvEarnings.length > 1 ? "s" : ""}`,
      icon: UserCog,
      color: "from-amber-500 to-orange-600",
      isText: true
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.key} className="rounded-[20px] border border-line bg-white p-5">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white", stat.color)}>
            <stat.icon className="h-4 w-4" />
          </div>
          <p className={cn("mt-3 font-display font-extrabold text-dark", stat.isText ? "text-2xl" : "text-2xl")}>
            {stat.value}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
          <p className="mt-1 text-[11px] text-brand">{stat.hint}</p>
        </div>
      ))}
    </div>
  );
}

export default function CommissionsPanel() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [earnings, setEarnings] = useState<CommissionEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [c, r, e] = await Promise.all([fetchAdminCountries(), fetchCommissionRules(), fetchAllCommissionEarnings()]);
      setCountries(c);
      setRules(r);
      setEarnings(e);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les commissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const findRule = (countryId: string, role: CommissionRole, stage: CommissionStage) =>
    rules.find((r) => r.countryId === countryId && r.role === role && r.stage === stage);

  const filteredEarnings = earnings.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${e.userName} ${e.studentName} ${e.countryName}`.toLowerCase().includes(q);
  });

  return (
    <div className="mt-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <CommissionsStats earnings={earnings} />

      <p className="mt-6 text-xs font-medium text-muted">
        Taux de commission par destination — montant fixe en dinars versé par l'agence à chaque conseiller (Sales) ou responsable visa (RDV), une seule fois par étudiant à chaque étape franchie. L'étudiant ne paie jamais rien de ce montant.
      </p>

      {loading ? (
        <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
      ) : (
        <div className="mt-3 space-y-3">
          {countries.map((c) => {
            const isOpen = expandedId === c.id;
            return (
              <div key={c.id} className={cn("overflow-hidden rounded-[20px] border bg-white shadow-sm transition-all", isOpen ? "border-brand/30" : "border-line")}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-brand-light/30"
                >
                  <span className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[11px] font-bold text-brand">{c.code}</span>
                  <span className="flex-1 font-display text-sm font-bold text-dark">{c.name}</span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                </button>

                {isOpen && (
                  <div className="grid gap-5 border-t border-line bg-white px-4 py-4 xl:grid-cols-2">
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                        <Users className="h-3.5 w-3.5 text-brand" /> Conseiller (Sales)
                      </p>
                      <div className="space-y-2">
                        {SALES_STAGES.map((stage) => (
                          <RuleRow key={stage} countryId={c.id} role="SALES" stage={stage} rule={findRule(c.id, "SALES", stage)} onSaved={load} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                        <UserCog className="h-3.5 w-3.5 text-brand" /> Responsable Dossier Visa (RDV)
                      </p>
                      <div className="space-y-2">
                        {RDV_STAGES.map((stage) => (
                          <RuleRow key={stage} countryId={c.id} role="RDV" stage={stage} rule={findRule(c.id, "RDV", stage)} onSaved={load} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!countries.length && (
            <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-muted">Aucun pays configuré.</p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-dark">
          <Coins className="h-4 w-4 text-brand" /> Registre des commissions gagnées ({filteredEarnings.length})
        </h3>
        {earnings.length > 0 && (
          <div className="relative w-full max-w-xs sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un bénéficiaire, un étudiant..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-brand"
            />
          </div>
        )}
      </div>
      {!earnings.length ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">Aucune commission attribuée pour l'instant.</p>
      ) : !filteredEarnings.length ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">Aucune commission ne correspond à cette recherche.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5">Bénéficiaire</th>
                <th className="px-4 py-2.5">Étudiant</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Pays</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Étape</th>
                <th className="px-4 py-2.5 text-right">Montant</th>
                <th className="px-4 py-2.5 hidden lg:table-cell text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredEarnings.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-bold text-dark">{e.userName}</p>
                    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold", e.role === "SALES" ? "bg-brand-light text-brand" : "bg-violet-50 text-violet-700")}>
                      {e.role === "SALES" ? "Sales" : "RDV"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-mid">{e.studentName}</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-muted"><Globe2 className="mr-1 inline h-3 w-3" />{e.countryName}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-[11px] text-muted">{STAGE_LABELS[e.stage]}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-emerald-600">{e.amountDinar.toFixed(2)} DT</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-right text-[11px] text-muted">
                    {new Date(e.earnedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
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
