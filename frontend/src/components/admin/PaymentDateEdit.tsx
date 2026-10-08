import { updateStudentPaymentDate } from "@/lib/auth";
import { todayLocal } from "@/lib/utils";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

// Admin : corriger la date d'un paiement déjà enregistré (il change alors de mois dans les statistiques).
export default function PaymentDateEdit({ paymentId, paidAt, onSaved }: { paymentId: string; paidAt: string; onSaved: () => void }) {
  const current = String(paidAt).slice(0, 10);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!value || value === current) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateStudentPaymentDate(paymentId, value);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setValue(current); setEditing(true); }}
        title="Modifier la date du paiement"
        aria-label="Modifier la date du paiement"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-brand/10 hover:text-brand"
      >
        <Pencil className="h-3 w-3" />
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        type="date"
        value={value}
        max={todayLocal()}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-brand"
      />
      <button type="button" disabled={busy} onClick={save} aria-label="Enregistrer la date" className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => { setEditing(false); setError(""); }} aria-label="Annuler" className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-slate-200">
        <X className="h-3.5 w-3.5" />
      </button>
      {error && <span className="w-full text-[11px] font-semibold text-red-600">{error}</span>}
    </span>
  );
}
