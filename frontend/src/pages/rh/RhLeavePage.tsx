import EmployeePicker from "@/components/rh/EmployeePicker";
import { confirmDialog } from "@/components/ui/dialog-host";
import { FancySelect } from "@/components/ui/fancy-select";
import { SkeletonPage } from "@/components/ui/skeleton";
import LeaveCoverDialog from "@/components/rh/LeaveCoverDialog";
import { HR_LEAVE_TYPES, coverHrAbsences, createHrLeave, decideHrLeave, fetchHrLeave, fetchLeaveAbsences, previewHrLeave, setHrLeaveBalance, settleHrLeave, updateLeaveCover, type HrAbsenceToCover, type HrCoverPlan, type HrLeaveEmployee, type HrLeavePreview, type HrLeaveType } from "@/lib/hr";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const money = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
const days2 = (value: number | null) => Number(value ?? 0).toFixed(2);
const fr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");
const frLong = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const todayTunis = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date());

// Fenêtre des remplaçants : acceptation d'une demande, congé posé par l'admin, ou modification.
type CoverTarget = {
  mode: "approve" | "edit";
  leaveId: string | null;
  startOn: string;
  endOn: string;
  confirm: (plan: HrCoverPlan | undefined) => Promise<unknown>;
};

function absenceLabel(day: HrAbsenceToCover) {
  const name = day.status === "NO_REPLY" ? "Sans réponse" : "Absent";
  return day.confirmed ? name : `${name} · à confirmer`;
}

function Balance({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-orange-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700/80">{label}</p>
      <p className="mt-0.5 font-display text-lg font-extrabold text-dark">{value}</p>
    </div>
  );
}

export default function RhLeavePage() {
  const [rows, setRows] = useState<HrLeaveEmployee[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [reason, setReason] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [given, setGiven] = useState("");
  const [absences, setAbsences] = useState<HrAbsenceToCover[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [coverTarget, setCoverTarget] = useState<CoverTarget | null>(null);
  // Donner un congé : type, motif, simulation du solde et confirmation si le solde devient négatif.
  const [giveType, setGiveType] = useState<HrLeaveType>("SICK");
  const [giveReason, setGiveReason] = useState("");
  const [preview, setPreview] = useState<HrLeavePreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [ackNegative, setAckNegative] = useState(false);
  const [params] = useSearchParams();

  const load = () => fetchHrLeave().then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));

  useEffect(() => {
    const asked = params.get("user");
    if (asked) setSelectedId(asked);
    load().then(() => undefined);
  }, []);

  const selected = useMemo(() => rows?.find((row) => row.id === selectedId) || rows?.[0] || null, [rows, selectedId]);

  useEffect(() => {
    setGiven(selected?.balance ? days2(selected.balance.remaining) : "");
  }, [selected?.id, selected?.balance?.remaining]);

  useEffect(() => {
    if (!selected?.id) return;
    let cancelled = false;
    setPicked([]);
    setAbsences([]);
    fetchLeaveAbsences(selected.id)
      .then((days) => { if (!cancelled) setAbsences(days); })
      .catch(() => { if (!cancelled) setAbsences([]); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    setAckNegative(false);
    if (!selected?.id || !selected.contractType || !startOn || !endOn || endOn < startOn) return;
    let cancelled = false;
    previewHrLeave(selected.id, startOn, endOn)
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch((err) => { if (!cancelled) setPreviewError(err instanceof Error ? err.message : ""); });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.contractType, startOn, endOn, rows]);

  const giveDirect = HR_LEAVE_TYPES.find((item) => item.value === giveType)?.direct === true;
  const giveBlocked = !preview || preview.overlap === true || (preview.negative === true && !ackNegative);

  // Maladie : acceptée tout de suite, après le choix des remplaçants. Autres types : enregistrés comme demande.
  const submitGive = () => {
    if (!selected) return;
    setError("");
    if (endOn < startOn) { setError("La fin est avant le début."); return; }
    const allowNegative = preview?.negative === true;
    const done = () => { setGiveReason(""); setAckNegative(false); };
    if (giveDirect) {
      setCoverTarget({
        mode: "approve",
        leaveId: null,
        startOn,
        endOn,
        confirm: async (plan) => {
          await createHrLeave({ userId: selected.id, startOn, endOn, reason: giveReason, type: giveType, approveNow: true, allowNegative, cover: plan });
          done();
        }
      });
      return;
    }
    void run(async () => {
      await createHrLeave({ userId: selected.id, startOn, endOn, reason: giveReason, type: giveType, allowNegative });
      done();
    });
  };

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

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold text-dark">Congés</h1>
      <p className="mt-1 text-sm text-muted">Le solde monte avec le contrat. Une année terminée se reporte ou se paie.</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!rows || !selected ? (
        rows && !error ? <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-muted">Aucun employé.</p> : !error && <SkeletonPage className="mt-6" />
      ) : (
        <div className="mt-6 space-y-4">
          <EmployeePicker
            people={rows}
            selectedId={selected.id}
            onSelect={setSelectedId}
            hint={(row) => row.balance ? `${days2(row.balance.remaining)} j restants` : "Fiche à remplir"}
          />
          <div className="space-y-4">
            {!selected.contractType || !selected.balance ? (
              <p className="rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-muted">Renseignez le contrat et la date d'embauche dans Employés.</p>
            ) : (
              <>
                <section className="rounded-[24px] border border-line bg-white p-5">
                  <h2 className="font-display text-lg font-bold text-dark">{selected.prenom} {selected.nom} · {selected.year}</h2>
                  <p className="text-xs text-muted">{days2(selected.monthlyLeave)} jour par mois{selected.dayValue !== null ? ` · 1 jour = ${money(selected.dayValue)}` : ""}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Balance label="Reporté" value={days2(selected.balance.carry)} />
                    <Balance label="Acquis" value={days2(selected.balance.accrued)} />
                    <Balance label="Donné" value={days2(selected.balance.manual)} />
                    <Balance label="Pris" value={days2(selected.balance.used)} />
                    <Balance label="Reste" value={days2(selected.balance.remaining)} />
                  </div>
                  {selected.balance.remaining <= 0 && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {selected.balance.remaining < 0
                        ? `Solde négatif (${days2(selected.balance.remaining)} jour) : les jours acquis chaque mois le feront remonter.`
                        : "Solde épuisé : tout congé donné maintenant rendra le solde négatif, après votre confirmation."}
                    </p>
                  )}
                  <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => setHrLeaveBalance(selected.id, given)); }}>
                    <label className="text-xs font-bold text-mid">
                      Solde à donner
                      <input value={given} onChange={(e) => setGiven(e.target.value)} inputMode="decimal" className="mt-1 block w-28 rounded-xl border border-line px-3 py-2 text-sm" />
                    </label>
                    <button type="submit" disabled={busy} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Enregistrer le solde</button>
                    <p className="w-full text-xs text-muted">Ce nombre devient le solde restant. Les congés déjà acceptés restent retirés. Une demande n'est retirée qu'après acceptation.</p>
                  </form>
                </section>
                {selected.openYears.map((year) => {
                  const key = `${selected.id}-${year.year}`;
                  const suggested = selected.dayValue === null ? "" : String(Math.round(year.remaining * selected.dayValue * 1000) / 1000);
                  return (
                    <section key={key} className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                      <h3 className="font-display font-bold text-dark">{year.year} à solder · {days2(year.remaining)} jour(s)</h3>
                      <p className="mt-1 text-xs text-amber-900">Acquis {days2(year.accrued)}, pris {days2(year.used)}, reporté {days2(year.carry)}.</p>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <label className="text-xs font-bold text-amber-950">
                          Montant si paiement (DT)
                          <input value={amounts[key] ?? suggested} onChange={(e) => setAmounts({ ...amounts, [key]: e.target.value })} className="mt-1 block w-36 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" />
                        </label>
                        <button type="button" disabled={busy} onClick={() => void run(() => settleHrLeave({ userId: selected.id, year: year.year, action: "CARRY" }))} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-amber-300">Reporter sur {year.year + 1}</button>
                        <button type="button" disabled={busy} onClick={() => void run(() => settleHrLeave({ userId: selected.id, year: year.year, action: "PAY", amount: (amounts[key] ?? suggested) || null }))} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white">Payer</button>
                      </div>
                    </section>
                  );
                })}
                <section className="rounded-[24px] border border-line bg-white p-5">
                  <h3 className="font-display font-bold text-dark">Poser un congé</h3>
                  <p className="mt-1 text-xs text-muted">Cochez les jours d'absence à compenser. Chaque jour retiré du solde n'est plus compté comme une absence.</p>
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                    {absences.map((day) => (
                      <li key={day.day}>
                        <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-orange-50">
                          <input
                            type="checkbox"
                            checked={picked.includes(day.day)}
                            onChange={(e) => setPicked((current) => e.target.checked ? [...current, day.day] : current.filter((item) => item !== day.day))}
                          />
                          <span className="font-semibold text-dark">{frLong(day.day)}</span>
                          <span className="text-xs text-muted">{absenceLabel(day)}</span>
                        </label>
                      </li>
                    ))}
                    {absences.length === 0 && <li className="py-2 text-sm text-muted">Aucune absence à compenser.</li>}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-[160px] flex-1 text-xs font-bold text-mid">Motif<input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
                    <button
                      type="button"
                      disabled={busy || picked.length === 0 || (selected.balance?.remaining ?? 0) < picked.length}
                      onClick={() => void run(async () => {
                        await coverHrAbsences(selected.id, picked, reason);
                        setReason("");
                        setPicked([]);
                        setAbsences(await fetchLeaveAbsences(selected.id));
                      })}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Compenser {picked.length > 1 ? `${picked.length} jours` : picked.length === 1 ? "1 jour" : "les absences"}
                    </button>
                  </div>
                  {picked.length > 0 && selected.balance && selected.balance.remaining < picked.length && (
                    <p className="mt-2 text-sm text-red-600">Solde insuffisant : {days2(selected.balance.remaining)} jour(s) disponible(s), {picked.length} demandé(s).</p>
                  )}
                  <form
                    className="mt-5 border-t border-line pt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitGive();
                    }}
                  >
                    <h4 className="text-sm font-bold text-dark">Donner un congé</h4>
                    <p className="mt-1 text-xs text-muted">
                      {giveDirect
                        ? "Le congé maladie est accepté tout de suite : vous choisissez ensuite qui prend en charge son travail."
                        : "Ce type s'enregistre comme demande : vous l'acceptez ensuite dans la liste « Demandes » ci-dessous, en choisissant qui prend en charge son travail."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="w-full sm:w-72">
                        <span className="mb-1 block text-xs font-bold text-mid">Type de congé</span>
                        <FancySelect value={giveType} onChange={(value) => setGiveType(value as HrLeaveType)} options={HR_LEAVE_TYPES.map((item) => ({ value: item.value, label: item.label }))} />
                      </div>
                      <label className="text-xs font-bold text-mid">Du<input type="date" required value={startOn} onChange={(e) => setStartOn(e.target.value)} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold text-mid">Au<input type="date" required value={endOn} onChange={(e) => setEndOn(e.target.value)} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm" /></label>
                      <label className="min-w-[160px] flex-1 text-xs font-bold text-mid">Motif<input value={giveReason} onChange={(e) => setGiveReason(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
                    </div>
                    {previewError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{previewError}</p>}
                    {preview && (
                      <div className={cn("mt-3 rounded-xl border px-3 py-2.5 text-xs", preview.overlap || preview.negative ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                        <p className="font-bold">
                          {preview.total} jour{preview.total > 1 ? "s" : ""} ouvré{preview.total > 1 ? "s" : ""} retiré{preview.total > 1 ? "s" : ""} · solde {days2(preview.remaining)} → {days2(preview.after ?? preview.remaining - preview.total)}
                        </p>
                        {preview.overlap && <p className="mt-1">Un congé est déjà accepté sur ces dates.</p>}
                        {preview.negative && !preview.overlap && (
                          <>
                            <p className="mt-1 flex items-start gap-1.5 font-semibold">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                              {preview.remaining <= 0 ? "Alerte : le solde de cet employé est épuisé." : "Alerte : le solde de cet employé est insuffisant."} Ce congé le rendra négatif ({days2(preview.after ?? 0)} jour).
                            </p>
                            <label className="mt-2 flex items-start gap-2 font-semibold">
                              <input type="checkbox" checked={ackNegative} onChange={(e) => setAckNegative(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
                              Je confirme : le solde passera à {days2(preview.after ?? 0)} jour.
                            </label>
                          </>
                        )}
                      </div>
                    )}
                    <div className="mt-3">
                      <button type="submit" disabled={busy || giveBlocked} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                        {giveDirect ? "Enregistrer et accepter" : "Enregistrer la demande"}
                      </button>
                    </div>
                  </form>
                </section>
                <section className="rounded-[24px] border border-line bg-white p-5">
                  <h3 className="font-display font-bold text-dark">Demandes</h3>
                  <ul className="mt-2 divide-y divide-line">
                    {selected.requests.map((request) => (
                      <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <span>
                          <span className="mr-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">{request.typeLabel}</span>
                          <span className="font-bold text-dark">{fr(request.startOn)} – {fr(request.endOn)}</span>
                          <span className="ml-2 text-muted">{request.days} j{request.coversAbsence ? " · absence couverte" : ""}{request.reason ? ` · ${request.reason}` : ""}</span>
                          {request.status === "PENDING" && selected.balance && selected.balance.remaining < request.days && (
                            <span className="mt-0.5 flex items-start gap-1 text-xs font-semibold text-red-700">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                              Solde {days2(selected.balance.remaining)} jour : l'accepter le passera à {days2(selected.balance.remaining - request.days)}.
                            </span>
                          )}
                          {request.status === "APPROVED" && request.cover && request.cover.length > 0 && (
                            <span className="mt-0.5 block text-xs text-mid">
                              Remplacé par {request.cover.map((sub) => `${sub.name} (${sub.percent} %${request.cover!.some((other) => other.scope !== sub.scope) ? `, ${sub.scope === "RDV" ? "dossiers" : "conseiller(ère) commercial(e)"}` : ""})`).join(", ")}
                              {request.endOn >= todayTunis() && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setCoverTarget({
                                    mode: "edit",
                                    leaveId: request.id,
                                    startOn: request.startOn,
                                    endOn: request.endOn,
                                    confirm: (plan) => updateLeaveCover(request.id, plan || {})
                                  })}
                                  className="ml-2 font-bold text-orange-700 hover:underline"
                                >
                                  Modifier
                                </button>
                              )}
                            </span>
                          )}
                        </span>
                        {request.status === "PENDING" ? (
                          <span className="flex gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                const short = Boolean(selected.balance && selected.balance.remaining < request.days);
                                if (short) {
                                  const ok = await confirmDialog(
                                    `Le solde de ${selected.prenom} ${selected.nom} est de ${days2(selected.balance?.remaining ?? 0)} jour. Accepter ce congé le passera à ${days2((selected.balance?.remaining ?? 0) - request.days)} jour. Continuer ?`,
                                    { title: "Solde insuffisant", tone: "warning", confirmLabel: "Accepter quand même" }
                                  );
                                  if (!ok) return;
                                }
                                setCoverTarget({
                                  mode: "approve",
                                  leaveId: request.id,
                                  startOn: request.startOn,
                                  endOn: request.endOn,
                                  confirm: (plan) => decideHrLeave(request.id, "APPROVED", plan, short ? true : undefined)
                                });
                              }}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
                            >
                              Accepter
                            </button>
                            <button type="button" disabled={busy} onClick={() => void run(() => decideHrLeave(request.id, "REJECTED"))} className="rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">Refuser</button>
                          </span>
                        ) : (
                          <span className={cn("text-[11px] font-bold", request.status === "APPROVED" ? "text-emerald-600" : "text-red-500")}>{request.status === "APPROVED" ? "Accepté" : "Refusé"}</span>
                        )}
                      </li>
                    ))}
                    {selected.requests.length === 0 && <li className="py-2 text-sm text-muted">Aucune demande.</li>}
                  </ul>
                </section>
              </>
            )}
          </div>
        </div>
      )}
      {coverTarget && selected && (
        <LeaveCoverDialog
          employeeName={`${selected.prenom} ${selected.nom}`.trim()}
          userId={selected.id}
          startOn={coverTarget.startOn}
          endOn={coverTarget.endOn}
          leaveId={coverTarget.leaveId}
          mode={coverTarget.mode}
          onConfirm={async (plan) => {
            await coverTarget.confirm(plan);
            await load();
          }}
          onClose={() => setCoverTarget(null)}
        />
      )}
    </main>
  );
}
