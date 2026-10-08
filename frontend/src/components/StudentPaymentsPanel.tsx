import { FancySelect } from "@/components/ui/fancy-select";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_REFERENCE_LABELS,
  cancelStudentPayment,
  fetchPublicCountries,
  fetchStudentPayments,
  formatMoney,
  recordStudentPayment,
  type Country,
  type PaymentMethod,
  type PaymentPlan,
  type StudentPaymentsSummary,
  type TrancheState
} from "@/lib/auth";
import { cn, todayLocal } from "@/lib/utils";
import { AlertTriangle, BadgeCheck, Banknote, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

const METHODS = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));

function TrancheBox({ title, hint, state, currency }: { title: string; hint: string; state: TrancheState; currency: string }) {
  const percent = state.due > 0 ? Math.min(100, Math.round((state.paid / state.due) * 100)) : 100;
  return (
    <div className={cn("rounded-xl border p-3", state.complete ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/40")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-dark">{title}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", state.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
          {state.complete ? "Payée" : "À payer"}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
      <p className="mt-2 text-sm font-extrabold text-dark">
        {formatMoney(state.paid, currency)} <span className="font-semibold text-muted">/ {formatMoney(state.due, currency)}</span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
        <div className={cn("h-full rounded-full", state.complete ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${percent}%` }} />
      </div>
      {!state.complete && <p className="mt-1.5 text-[11px] font-semibold text-amber-800">Reste {formatMoney(state.remaining, currency)}</p>}
    </div>
  );
}

// Paiements d'un étudiant : tranches par pays, enregistrement (admin ou
// conseiller de l'étudiant) et historique. L'admin peut annuler un paiement.
export default function StudentPaymentsPanel({ studentId, onChanged, compact = false }: { studentId: string; onChanged?: () => void; compact?: boolean }) {
  const [summary, setSummary] = useState<StudentPaymentsSummary | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [tranche, setTranche] = useState<"1" | "2">("2");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  // Date du paiement : aujourd'hui par défaut, modifiable.
  const [paidAt, setPaidAt] = useState(todayLocal());
  const [reference, setReference] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = () =>
    fetchStudentPayments(studentId)
      .then((data) => {
        setSummary(data);
        setCountryId((current) => current || data.plans[0]?.countryId || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));

  useEffect(() => {
    load();
    fetchPublicCountries().then(setCountries).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const plan: PaymentPlan | undefined = summary?.plans.find((p) => p.countryId === countryId);
  const selectedState = plan ? (tranche === "1" ? plan.tranche1 : plan.tranche2) : null;

  const reset = () => {
    setAdding(false);
    setAmount("");
    setMethod("");
    setPaidAt(todayLocal());
    setReference("");
    setError("");
  };

  const submit = async () => {
    setError("");
    if (!countryId) return setError("Choisissez le pays concerné.");
    if (!method) return setError("Choisissez le mode de paiement.");
    if (PAYMENT_REFERENCE_LABELS[method] && !reference.trim()) return setError(`${PAYMENT_REFERENCE_LABELS[method]} obligatoire.`);
    setBusy(true);
    try {
      const next = await recordStudentPayment(studentId, {
        countryId,
        tranche: Number(tranche) as 1 | 2,
        method,
        amount: amount.trim() ? Number(amount.replace(",", ".")) : undefined,
        paidAt: paidAt || undefined,
        reference: PAYMENT_REFERENCE_LABELS[method] ? reference.trim() : undefined
      });
      setSummary(next);
      reset();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async (paymentId: string) => {
    if (!cancelReason.trim()) return setError("Indiquez le motif de l'annulation.");
    setBusy(true);
    setError("");
    try {
      setSummary(await cancelStudentPayment(paymentId, cancelReason.trim()));
      setCancelling(null);
      setCancelReason("");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Annulation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const countryOptions = [
    ...(summary?.plans.map((p) => ({ value: p.countryId, label: p.countryName })) || []),
    ...countries.filter((c) => c.active && !summary?.plans.some((p) => p.countryId === c.id)).map((c) => ({ value: c.id, label: c.name }))
  ];

  return (
    <section className="mt-6 rounded-[24px] border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
            <Banknote className="h-5 w-5 text-brand" aria-hidden /> Paiements
          </h2>
          <p className="mt-1 text-xs text-muted">
            Deux tranches : la 1ʳᵉ à l'inscription (code), la 2ᵉ avant le dépôt du visa. Le Responsable Dossier ne peut pas déposer le visa tant que la tranche 2 n'est pas réglée.
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Enregistrer un paiement
          </button>
        )}
      </div>

      {error && !adding && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {adding && (
        <div className="mt-4 space-y-3 rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 p-4">
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">Pays</label>
              <FancySelect value={countryId} onChange={setCountryId} options={countryOptions} placeholder="Choisir un pays" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">Tranche</label>
              <FancySelect
                value={tranche}
                onChange={(v) => setTranche(v as "1" | "2")}
                options={[
                  { value: "1", label: "Tranche 1 · inscription" },
                  { value: "2", label: "Tranche 2 · visa" }
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">Mode de paiement</label>
              <FancySelect value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={METHODS} placeholder="Choisir" />
            </div>
          </div>
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">
                Montant {plan ? `(${plan.currency === "EUR" ? "€" : "DT"})` : ""}
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder={selectedState ? `Reste ${formatMoney(selectedState.remaining, plan!.currency)}` : "Reste dû"}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">Date du paiement</label>
              <input
                type="date"
                value={paidAt}
                max={todayLocal()}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">
                {method && PAYMENT_REFERENCE_LABELS[method] ? `${PAYMENT_REFERENCE_LABELS[method]} *` : "Référence"}
              </label>
              {method && PAYMENT_REFERENCE_LABELS[method] ? (
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={40}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              ) : (
                <p className="rounded-xl border border-dashed border-line bg-white/60 px-3 py-2.5 text-xs text-muted">Aucune référence à saisir</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted">Montant vide = tout le reste dû de la tranche. La date proposée est celle d'aujourd'hui : modifiez-la si le paiement a eu lieu un autre jour. Chèque : numéro du chèque ; virement : code du virement. Chaque paiement reçoit un numéro de reçu automatique (ex. 001-2026), envoyé par e-mail à l'étudiant.</p>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-muted hover:bg-slate-50">Annuler</button>
            <button type="button" disabled={busy} onClick={submit} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {!summary ? (
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        ) : summary.plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-slate-50 p-5 text-sm text-muted">
            Aucun plan de paiement pour cet étudiant (inscrit avant la mise en place des paiements, ou pays sans tarif). Il n'est pas bloqué au dépôt du visa. Enregistrer un paiement crée son plan à partir du tarif du pays.
          </p>
        ) : (
          summary.plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-dark">
                  {p.countryName} · {formatMoney(p.total, p.currency)}
                </p>
                {p.status === "PAID" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    <BadgeCheck className="h-3 w-3" /> Soldé
                  </span>
                ) : p.late ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                    <AlertTriangle className="h-3 w-3" /> En retard · reste {formatMoney(p.remainingTotal, p.currency)}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">Reste {formatMoney(p.remainingTotal, p.currency)}</span>
                )}
              </div>
              <div className={cn("mt-3 grid gap-3", !compact && "sm:grid-cols-2")}>
                <TrancheBox title="Tranche 1 · inscription" hint="Payée à la création du code" state={p.tranche1} currency={p.currency} />
                <TrancheBox title="Tranche 2 · visa" hint="À régler avant le dépôt du visa" state={p.tranche2} currency={p.currency} />
              </div>
            </div>
          ))
        )}

        {summary && summary.payments.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Historique</p>
            <div className="space-y-2">
              {summary.payments.map((payment) => (
                <div key={payment.id} className={cn("rounded-xl border px-3 py-2.5 text-xs", payment.status === "CANCELLED" ? "border-line bg-slate-50 text-muted" : "border-line bg-white")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={cn("font-bold", payment.status === "CANCELLED" ? "line-through" : "text-dark")}>
                      {formatMoney(payment.amount, payment.currency)} · tranche {payment.tranche} · {payment.countryName}
                    </p>
                    <p>
                      {payment.methodLabel} · {new Date(payment.paidAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <p className="mt-0.5">
                    {payment.receiptNumber ? <span className="font-bold text-brand">Reçu {payment.receiptNumber}</span> : null}
                    {payment.receiptNumber ? " · " : ""}
                    {payment.reference ? `${payment.referenceLabel || "Réf."} ${payment.reference} · ` : ""}
                    Saisi par {payment.recordedByName || (payment.recordedByRole === "SALES" ? "le conseiller" : "l'administrateur")}
                  </p>
                  {payment.status === "CANCELLED" && <p className="mt-0.5 font-semibold text-red-600">Annulé : {payment.cancelReason}</p>}
                  {payment.status === "ACTIVE" && summary.canCancel && (
                    <div className="mt-2">
                      {cancelling === payment.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Motif de l'annulation"
                            className="min-w-[180px] flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
                          />
                          <button type="button" disabled={busy} onClick={() => confirmCancel(payment.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-60">
                            Confirmer l'annulation
                          </button>
                          <button type="button" onClick={() => { setCancelling(null); setCancelReason(""); }} aria-label="Fermer" className="rounded-lg border border-line p-1.5 text-muted hover:bg-slate-50">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setCancelling(payment.id)} className="rounded-lg bg-red-50 px-3 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100">
                          Annuler ce paiement
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
