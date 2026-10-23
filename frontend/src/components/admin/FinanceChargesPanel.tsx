import { confirmDialog } from "@/components/ui/dialog-host";
import { Amount } from "@/components/ui/hidden-amounts";
import { fetchFinanceExercise, formatMoney, removeFinanceCharge, saveFinanceCharge, type FinanceCharge, type FinanceExercise } from "@/lib/auth";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const money = (value: number) => formatMoney(value, "TND");

const FIXED_CHOICES = ["Loyer", "Électricité", "Eau", "Internet et téléphone", "Assurance", "Comptable", "CNSS", "Nettoyage", "Publicité", "Logiciels", "Autre"];
const VARIABLE_CHOICES = ["Fournitures", "Réparation", "Transport", "Carburant", "Restauration", "Voyage", "Hébergement", "Frais bancaires", "Formation", "Honoraires", "Papeterie", "Autre"];

function rhythmText(rhythm: FinanceCharge["rhythm"]) {
  if (rhythm === "QUARTERLY") return "trimestre";
  if (rhythm === "SEMESTER") return "semestre";
  return "mois";
}

function localDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function ChargeForm({ kind, year, onSaved }: { kind: "FIXED" | "VARIABLE"; year: number; onSaved: (value: FinanceExercise) => void }) {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const [basis, setBasis] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [rhythm, setRhythm] = useState<"MONTHLY" | "QUARTERLY" | "SEMESTER">("MONTHLY");
  const [amount, setAmount] = useState("");
  const [startsOn, setStartsOn] = useState(`${year}-01`);
  const [endsOn, setEndsOn] = useState("");
  const [spentOn, setSpentOn] = useState(localDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choices = kind === "FIXED" ? FIXED_CHOICES : VARIABLE_CHOICES;
  const chargeName = choice === "Autre" ? custom : choice;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      onSaved(await saveFinanceCharge({
        kind,
        year,
        label: chargeName,
        basis,
        rhythm: kind === "FIXED" && basis === "AMOUNT" ? rhythm : "MONTHLY",
        amount: basis === "AMOUNT" ? Number(amount) : 0,
        percent: basis === "PERCENT" ? Number(amount) : null,
        startsOn: kind === "FIXED" ? startsOn : null,
        endsOn: kind === "FIXED" && endsOn ? endsOn : null,
        spentOn: kind === "VARIABLE" ? spentOn : null
      }));
      setChoice("");
      setCustom("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <select value={choice} onChange={(event) => setChoice(event.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand">
        <option value="">Choisir une charge</option>
        {choices.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      {choice === "Autre" && (
        <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Nom de la charge" className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setBasis("AMOUNT")} className={basis === "AMOUNT" ? "rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white" : "rounded-full border border-line px-3 py-1 text-[11px] font-bold text-mid"}>Montant</button>
        <button type="button" onClick={() => setBasis("PERCENT")} className={basis === "PERCENT" ? "rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white" : "rounded-full border border-line px-3 py-1 text-[11px] font-bold text-mid"}>Pourcentage</button>
      </div>
      {kind === "FIXED" && basis === "AMOUNT" && (
        <div className="flex flex-wrap gap-2">
          {([["MONTHLY", "Chaque mois"], ["QUARTERLY", "Chaque trimestre"], ["SEMESTER", "Chaque semestre"]] as const).map(([value, text]) => (
            <button key={value} type="button" onClick={() => setRhythm(value)} className={rhythm === value ? "rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white" : "rounded-full border border-line px-3 py-1 text-[11px] font-bold text-mid"}>{text}</button>
          ))}
        </div>
      )}
      <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder={basis === "PERCENT" ? "Pourcentage du chiffre encaissé" : kind === "FIXED" ? (rhythm === "QUARTERLY" ? "Montant par trimestre (DT)" : rhythm === "SEMESTER" ? "Montant par semestre (DT)" : "Montant par mois (DT)") : "Montant (DT)"} className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
      {kind === "FIXED" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-mid">Depuis<input type="month" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
          <label className="text-[11px] font-bold text-mid">Jusqu'au<input type="month" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
        </div>
      ) : (
        <label className="block text-[11px] font-bold text-mid">Date<input type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
      )}
      {error && <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{busy ? "Enregistrement..." : "Ajouter"}</button>
    </form>
  );
}

function ChargeList({ rows, year, onChanged }: { rows: FinanceCharge[]; year: number; onChanged: (value: FinanceExercise) => void }) {
  const remove = async (row: FinanceCharge) => {
    if (!await confirmDialog(`Retirer « ${row.label} » ?`)) return;
    onChanged(await removeFinanceCharge(row.id, year));
  };
  if (!rows.length) return <p className="mt-3 text-sm text-muted">Aucune charge pour l'instant.</p>;
  return (
    <ul className="mt-3 divide-y divide-line">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-dark">{row.label}</span>
            <span className="text-[11px] text-muted">
              {row.basis === "PERCENT" ? `${row.percent} % du chiffre` : `${money(row.amount)}${row.kind === "FIXED" ? ` / ${rhythmText(row.rhythm)}` : ""}`}
              {row.kind === "FIXED" && typeof row.periods === "number" ? ` · ${row.periods} compté${row.periods > 1 ? "s" : ""}` : ""}
              {row.kind === "FIXED" && row.startsOn ? ` · ${row.startsOn.slice(0, 7)} → ${row.endsOn ? row.endsOn.slice(0, 7) : `${year}-12`}` : ""}
              {row.spentOn ? ` · ${row.spentOn}` : ""}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Amount className="font-bold text-dark">{money(row.yearCost)}</Amount>
            <button type="button" aria-label={`Retirer ${row.label}`} onClick={() => void remove(row)} className="rounded-lg p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function FinanceChargesPanel() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<FinanceExercise | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFinanceExercise(year).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  }, [year]);

  if (error && !data) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!data) return <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />;

  const fixed = data.charges.filter((row) => row.kind === "FIXED");
  const variable = data.charges.filter((row) => row.kind === "VARIABLE");
  const lines: Array<[string, number]> = [
    ["Encaissé en dinars", data.collected],
    ["Salaires des fiches émises", -data.salaries],
    ["Primes", -data.primes],
    ["Congés versés", -data.paidLeave],
    ["Retenues déjà déduites des salaires", data.deductions],
    ["Commissions versées", -data.commissions],
    ["Charges fixes", -data.fixed],
    ["Charges variables", -data.variable],
    ...(data.salaryExtra > 0 ? [["Salaires payés sans fiche", -data.salaryExtra] as [string, number]] : [])
  ];

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">Exercice {data.year}</p>
            <h2 className="mt-1 font-display text-lg font-bold">Résultat de l'exercice</h2>
            <p className="mt-2 font-display text-4xl font-extrabold"><Amount>{money(data.result)}</Amount></p>
          </div>
          <label className="text-xs font-bold text-white/80">Année
            <input type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value) || year)} className="mt-1 block w-28 rounded-xl border-0 px-3 py-2 text-sm font-bold text-dark" />
          </label>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-white/85">Encaissements en dinars, moins les salaires, les primes, les congés versés, les commissions et les charges. Une retenue d'absence ou de retard est déjà sortie du salaire, elle est donc rendue ici.</p>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {lines.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-white/75">{label}</dt>
              <dd className="font-bold"><Amount>{money(value)}</Amount></dd>
            </div>
          ))}
        </dl>
        {data.collectedEur > 0 && <p className="mt-3 text-xs text-white/70">Encaissé en euros sur l'exercice, non converti : <Amount>{formatMoney(data.collectedEur, "EUR")}</Amount>.</p>}
      </section>

      <section className="rounded-[24px] border border-line bg-white p-5">
        <h3 className="font-display text-lg font-bold text-dark">Salaires payés</h3>
        <p className="mt-1 text-xs text-muted">Enregistrés depuis Paie. La date et le montant sont ceux du bouton Payer. Si la fiche du mois est déjà émise, le salaire est déjà retiré du résultat et n'est pas compté une deuxième fois.</p>
        <ul className="mt-3 divide-y divide-line">
          {(data.salaryPayments || []).map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="block font-semibold text-dark">Salaire de {payment.prenom} {payment.nom}</span>
                <span className="text-[11px] text-muted">{payment.month} · payé le {payment.paidOn}{payment.onSlip ? " · déjà dans les fiches émises" : " · ajouté au résultat"}</span>
              </span>
              <Amount className="font-bold text-dark">{money(payment.amount)}</Amount>
            </li>
          ))}
          {(data.salaryPayments || []).length === 0 && <li className="py-2 text-sm text-muted">Aucun salaire payé sur cet exercice.</li>}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[24px] border border-line bg-white p-5">
          <h3 className="font-display text-lg font-bold text-dark">Charges fixes</h3>
          <p className="mt-1 text-xs text-muted">Le mois en cours est inclus, les mois futurs non. Un trimestre compte quand il est terminé. Un semestre compte dès qu'il commence. La date utilisée est celle de la Tunisie.</p>
          <ChargeList rows={fixed} year={data.year} onChanged={setData} />
          <ChargeForm kind="FIXED" year={data.year} onSaved={setData} />
        </section>
        <section className="rounded-[24px] border border-line bg-white p-5">
          <h3 className="font-display text-lg font-bold text-dark">Charges variables</h3>
          <p className="mt-1 text-xs text-muted">Une dépense datée, en montant ou en pourcentage du chiffre de l'année.</p>
          <ChargeList rows={variable} year={data.year} onChanged={setData} />
          <ChargeForm kind="VARIABLE" year={data.year} onSaved={setData} />
        </section>
      </div>
    </div>
  );
}
