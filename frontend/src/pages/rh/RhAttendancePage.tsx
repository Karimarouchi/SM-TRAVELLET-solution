import EmployeePicker from "@/components/rh/EmployeePicker";
import { confirmHrAbsences, confirmHrLateness, fetchHrAttendance, saveHrAttendanceAmount, saveHrAttendanceDay, type HrAttendanceDay, type HrAttendanceEmployee, type HrAttendanceMonth } from "@/lib/hr";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const money = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`);
const fr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function presenceOf(day: HrAttendanceDay) {
  if (day.status === "LEAVE") return "Congé";
  return day.confirmed || day.status === "ABSENT" || day.status === "NO_REPLY" || day.status === "UNPAID_HOLIDAY" ? "Absent" : "Présent";
}

function detailOf(day: HrAttendanceDay) {
  const parts: string[] = [];
  if (day.status === "LEAVE") parts.push("congé accepté, rien n'est compté");
  else if (day.status === "UNPAID_HOLIDAY") parts.push(day.confirmed ? "férié impayé, jour retiré" : "férié impayé, à confirmer");
  else if (day.confirmed) parts.push("marqué manuellement");
  else if (day.status === "NO_REPLY") parts.push("sans réponse, à confirmer");
  else if (day.status === "ABSENT") parts.push("à confirmer");
  else if (day.waived || day.status === "WAIVED") parts.push("journée non comptée");
  else if (day.confirmedLate) parts.push("retard validé, compté dans la paie");
  else if (day.status === "PRESENT" && day.lateMinutes + day.earlyMinutes > 0) parts.push("retard à confirmer, hors paie");
  else if (day.corrected) parts.push("corrigé");
  if (day.note) parts.push(day.note);
  return parts.join(" · ");
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function RhAttendancePage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<HrAttendanceMonth | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<HrAttendanceDay | null>(null);
  const [late, setLate] = useState("");
  const [early, setEarly] = useState("");
  const [note, setNote] = useState("");
  const [waived, setWaived] = useState(false);
  const [absent, setAbsent] = useState(false);
  const [lateConfirmed, setLateConfirmed] = useState(false);
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [params] = useSearchParams();

  const load = (value = month) =>
    fetchHrAttendance(value).then((next) => {
      setData(next);
      setSelectedId((current) => {
        const asked = params.get("user");
        const preferred = current || asked;
        return preferred && next.employees.some((row) => row.id === preferred) ? preferred : next.employees[0]?.id || null;
      });
    }).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));

  useEffect(() => {
    load().then(() => undefined);
    // Le mois est relu explicitement au changement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => data?.employees.find((row) => row.id === selectedId) || null, [data, selectedId]);

  useEffect(() => {
    setAmount(selected?.monthAmount === null || selected?.monthAmount === undefined ? "" : String(selected.monthAmount));
    setEditing(null);
    setPicked([]);
  }, [selected]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  const openDay = (day: HrAttendanceDay) => {
    setEditing(day);
    setLate(day.corrected && !day.waived ? String(day.lateMinutes) : "");
    setEarly(day.corrected && !day.waived ? String(day.earlyMinutes) : "");
    setNote(day.note);
    setWaived(day.waived);
    setAbsent(day.confirmed);
    setLateConfirmed(day.confirmedLate);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-dark">Présences</h1>
          <p className="mt-1 text-sm text-muted">
            {data ? `Une absence ou un retard ne compte dans la paie qu'après votre validation. Journée ${data.workStart} – ${data.workEnd}.` : "Retards, départs et absences du mois."}
          </p>
        </div>
        <label className="text-xs font-bold text-mid">
          Mois
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); void load(e.target.value); }} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm" />
        </label>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!data || !selected ? (
        <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-orange-500" />
      ) : (
        <div className="mt-6 space-y-4">
          <EmployeePicker
            people={data.employees}
            selectedId={selected.id}
            onSelect={setSelectedId}
            hint={(row) => `${row.totalMinutes} min · ${money(row.amount)}`}
          />
          <EmployeeDetail
            row={selected}
            busy={busy}
            editing={editing}
            late={late}
            early={early}
            note={note}
            waived={waived}
            absent={absent}
            amount={amount}
            onLate={setLate}
            onEarly={setEarly}
            onNote={setNote}
            onWaived={(value) => { setWaived(value); if (value) { setAbsent(false); setLateConfirmed(false); } }}
            onAbsent={(value) => { setAbsent(value); if (value) { setWaived(false); setLateConfirmed(false); } }}
            lateConfirmed={lateConfirmed}
            onLateConfirmed={(value) => { setLateConfirmed(value); if (value) { setAbsent(false); setWaived(false); } }}
            onAmount={setAmount}
            onOpen={openDay}
            onSaveDay={() => {
              if (!editing) return;
              void run(async () => {
                await saveHrAttendanceDay({
                  userId: selected.id,
                  day: editing.day,
                  waived: absent ? false : waived,
                  lateMinutes: absent || waived || late.trim() === "" ? null : Number(late),
                  earlyMinutes: absent || waived || early.trim() === "" ? null : Number(early),
                  note,
                  confirmedAbsent: absent,
                  confirmedLate: absent || waived ? false : lateConfirmed
                });
                setEditing(null);
              });
            }}
            onClearDay={() => {
              if (!editing) return;
              void run(async () => {
                await saveHrAttendanceDay({ userId: selected.id, day: editing.day, waived: false, lateMinutes: null, earlyMinutes: null, note: "", confirmedAbsent: false });
                setEditing(null);
              });
            }}
            onSaveAmount={() => void run(() => saveHrAttendanceAmount(selected.id, month, amount.trim() === "" ? null : amount))}
            picked={picked}
            onToggle={(day) => setPicked((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}
            onConfirm={(absent) => void run(async () => { await confirmHrAbsences(selected.id, picked, absent); setPicked([]); })}
            onConfirmLate={(day, late) => void run(() => confirmHrLateness(selected.id, day, late))}
          />
        </div>
      )}
    </main>
  );
}

function EmployeeDetail({
  row, busy, editing, late, early, note, waived, absent, lateConfirmed, amount, picked,
  onLate, onEarly, onNote, onWaived, onAbsent, onLateConfirmed, onAmount, onOpen, onSaveDay, onClearDay, onSaveAmount, onToggle, onConfirm, onConfirmLate
}: {
  row: HrAttendanceEmployee;
  busy: boolean;
  editing: HrAttendanceDay | null;
  late: string;
  early: string;
  note: string;
  waived: boolean;
  absent: boolean;
  lateConfirmed: boolean;
  amount: string;
  picked: string[];
  onLate: (value: string) => void;
  onEarly: (value: string) => void;
  onNote: (value: string) => void;
  onWaived: (value: boolean) => void;
  onAbsent: (value: boolean) => void;
  onLateConfirmed: (value: boolean) => void;
  onAmount: (value: string) => void;
  onOpen: (day: HrAttendanceDay) => void;
  onSaveDay: () => void;
  onClearDay: () => void;
  onSaveAmount: () => void;
  onToggle: (day: string) => void;
  onConfirm: (absent: boolean) => void;
  onConfirmLate: (day: string, late: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold text-dark">{row.prenom} {row.nom}</h2>
        <p className="text-xs text-muted">
          {row.mode === "sales" ? "L'arrivée du conseiller est sa première réponse WhatsApp quand une conversation attend, sinon son heure de connexion." : "L'arrivée au bureau est la première connexion. Le départ est la dernière action sur un dossier, sinon la déconnexion."}
          {row.leaveDays ? ` ${row.leaveDays} jour(s) de congé accepté : ni absence, ni retard, rien n'est retiré.` : ""}
          {row.holidayDays ? ` ${row.holidayDays} jour(s) férié(s) ce mois.` : ""}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Minutes perdues" hint="Absences validées et retards validés seulement. Un retard détecté reste hors paie tant que vous ne le validez pas." value={String(row.totalMinutes)} />
          <Stat label="Prix d'une minute" hint="Part du salaire que coûte une minute de travail." value={money(row.minuteValue)} />
          <Stat label="Retenue calculée" hint="Minutes perdues multipliées par le prix d'une minute." value={money(row.computedAmount)} />
          <Stat label="Montant retenu" hint="Somme enlevée du salaire. Le montant saisi ci-dessous la remplace." value={money(row.amount)} />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-mid">
            Forcer un montant pour le mois (DT)
            <input value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="Vide : garder la retenue calculée" className="mt-1 block w-64 rounded-xl border border-line px-3 py-2 text-sm" />
          </label>
          <button type="button" disabled={busy} onClick={onSaveAmount} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Enregistrer le montant</button>
        </div>
      </section>

      {editing && (
        <form className="rounded-[24px] border border-orange-200 bg-orange-50 p-5" onSubmit={(e) => { e.preventDefault(); onSaveDay(); }}>
          <h3 className="font-display font-bold text-dark">Corriger {fr(editing.day)}</h3>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-mid">Retard (min)<input value={late} onChange={(e) => onLate(e.target.value)} disabled={waived || absent} className="mt-1 block w-28 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm disabled:opacity-50" /></label>
            <label className="text-xs font-bold text-mid">Départ tôt (min)<input value={early} onChange={(e) => onEarly(e.target.value)} disabled={waived || absent} className="mt-1 block w-28 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm disabled:opacity-50" /></label>
            <label className="min-w-[160px] flex-1 text-xs font-bold text-mid">Note<input value={note} onChange={(e) => onNote(e.target.value)} className="mt-1 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm" /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-mid">
            <input type="checkbox" checked={absent} onChange={(e) => onAbsent(e.target.checked)} /> Mettre ce jour en absence
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-mid">
            <input type="checkbox" checked={lateConfirmed} onChange={(e) => onLateConfirmed(e.target.checked)} /> Valider le retard de ce jour
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-mid">
            <input type="checkbox" checked={waived} onChange={(e) => onWaived(e.target.checked)} /> Ne pas compter cette journée
          </label>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={busy} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Enregistrer</button>
            <button type="button" disabled={busy} onClick={onClearDay} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-dark ring-1 ring-orange-200">Revenir au calcul</button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-[24px] border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-xs text-muted">{picked.length ? `${picked.length} jour(s) sélectionné(s). Valider retire un jour de salaire. Retirer annule cette validation.` : "Cochez les jours à compter comme absence, puis validez. Avant ça, ils ne retirent rien du salaire."}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy || picked.length === 0} onClick={() => onConfirm(true)} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Valider l'absence</button>
            <button type="button" disabled={busy || picked.length === 0} onClick={() => onConfirm(false)} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-line disabled:opacity-40">Retirer</button>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-orange-50 text-[11px] uppercase tracking-wide text-orange-800">
            <tr>
              <th className="px-4 py-2 font-bold">Jour</th>
              <th className="px-2 py-2 font-bold">Présence</th>
              <th className="px-2 py-2 font-bold">Détail</th>
              <th className="px-2 py-2 font-bold">Heure d'arrivée</th>
              <th className="px-2 py-2 font-bold">Heure de départ</th>
              <th className="px-2 py-2 text-right font-bold">Minutes perdues</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {row.days.map((day) => (
              <tr key={day.day}>
                <td className="px-4 py-2.5 font-semibold text-dark">
                  <label className="inline-flex items-center gap-2">
                    {day.status === "LEAVE" ? null : <input type="checkbox" checked={picked.includes(day.day)} onChange={() => onToggle(day.day)} />}
                    {fr(day.day)}
                  </label>
                </td>
                <td className="px-2 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${presenceOf(day) === "Absent" ? "bg-red-50 text-red-700" : presenceOf(day) === "Congé" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>{presenceOf(day)}</span>
                </td>
                <td className="px-2 py-2.5 text-muted">{detailOf(day) || "—"}</td>
                <td className="px-2 py-2.5 text-muted">{day.arrival ? `${day.arrival} · ${day.arrivalFrom}` : "—"}</td>
                <td className="px-2 py-2.5 text-muted">{day.departure ? `${day.departure} · ${day.departureFrom}` : "—"}</td>
                <td className="px-2 py-2.5 text-right">
                  {day.status !== "LEAVE" && (day.lateMinutes > 0 || day.earlyMinutes > 0) ? (
                    <>
                      {day.lateMinutes > 0 ? <span className={`block font-bold ${day.confirmedLate ? "text-red-700" : "text-amber-700"}`}>Retard {day.lateMinutes} min</span> : null}
                      {day.earlyMinutes > 0 ? <span className={`block font-bold ${day.confirmedLate ? "text-red-700" : "text-amber-700"}`}>Départ {day.earlyMinutes} min</span> : null}
                      {day.status === "PRESENT" && !day.confirmedLate ? <span className="mt-0.5 block text-[11px] font-semibold text-amber-700">hors paie</span> : null}
                      {day.confirmedLate ? <span className="mt-0.5 block text-[11px] font-semibold text-red-700">compté</span> : null}
                    </>
                  ) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {day.status === "LEAVE" ? null : (
                    <div className="flex flex-col items-end gap-1">
                      {day.status === "PRESENT" && day.lateMinutes + day.earlyMinutes > 0 ? (
                        <button type="button" disabled={busy} onClick={() => onConfirmLate(day.day, !day.confirmedLate)} className={`rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-50 ${day.confirmedLate ? "border border-line text-muted" : "bg-amber-600 text-white"}`}>
                          {day.confirmedLate ? "Retirer le retard" : "Valider le retard"}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => onOpen(day)} className="text-[11px] font-bold text-orange-700">Corriger</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {row.days.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-sm text-muted">Aucun jour ouvré sur cette période.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="rounded-2xl bg-orange-50 px-3 py-3">
      <p className="text-xs font-bold text-orange-800">{label}</p>
      <p className="mt-1 font-display text-lg font-extrabold text-dark">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-orange-900/70">{hint}</p>
    </div>
  );
}
