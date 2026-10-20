import { downloadHrPdf, fetchMyAbsences, fetchMyDocumentRequests, fetchMyDocuments, fetchMyHolidays, fetchMyLeave, fetchMyPayslips, previewMyLeave, requestHrDocument, requestMyLeave, submitMyAbsence, type HrAbsenceDay, type HrDocumentRequest, type HrEmployeeDocument, type HrHoliday, type HrLeaveEmployee, type HrLeavePreview, type HrMyPayslip } from "@/lib/hr";
import { cn } from "@/lib/utils";
import { HeartPulse, LayoutDashboard, Palmtree, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const money = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
const fr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");

function wholeDays(value: number) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function jours(value: number) {
  const n = wholeDays(value);
  return `${n} jour${n > 1 ? "s" : ""}`;
}

const WEEKDAYS = ["lu", "ma", "me", "je", "ve", "sa", "di"];
type Tab = "apercu" | "conge" | "absences" | "paie";
const TABS: Array<{ id: Tab; label: string; icon: typeof Palmtree }> = [
  { id: "apercu", label: "Aperçu", icon: LayoutDashboard },
  { id: "conge", label: "Congé", icon: Palmtree },
  { id: "absences", label: "Absences", icon: HeartPulse },
  { id: "paie", label: "Paie", icon: Wallet }
];

function countsAsLeave(iso: string, holidays: HrHoliday[]) {
  const day = new Date(`${iso}T12:00:00`).getDay();
  if (day === 0 || day === 6) return false;
  return !holidays.some((row) => row.day.slice(0, 10) === iso && row.paid);
}

function isoOf(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function LeaveCalendar({ startOn, endOn, coveredEnd, holidays, onPick }: { startOn: string; endOn: string; coveredEnd: string; holidays: HrHoliday[]; onPick: (iso: string) => void }) {
  const now = new Date();
  const initial = startOn || isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [cursor, setCursor] = useState(() => initial.slice(0, 7));
  const [year, month] = cursor.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const cells: Array<string | null> = [...Array(pad).fill(null)];
  for (let day = 1; day <= count; day += 1) cells.push(isoOf(year, month, day));
  const rangeEnd = coveredEnd || endOn;
  const title = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const holidayDays = new Set(holidays.map((row) => row.day.slice(0, 10)));

  return (
    <div className="mt-3 rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setCursor(isoOf(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, 1).slice(0, 7))} className="rounded-full px-3 py-1 text-sm font-bold text-mid hover:bg-orange-50" aria-label="Mois précédent">‹</button>
        <p className="font-display text-sm font-bold capitalize text-dark">{title}</p>
        <button type="button" onClick={() => setCursor(isoOf(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1).slice(0, 7))} className="rounded-full px-3 py-1 text-sm font-bold text-mid hover:bg-orange-50" aria-label="Mois suivant">›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-muted">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((iso, index) => {
          if (!iso) return <span key={`empty-${index}`} />;
          const inRange = Boolean(startOn && rangeEnd && iso >= startOn && iso <= rangeEnd);
          const counts = inRange && countsAsLeave(iso, holidays);
          const edge = iso === startOn || iso === rangeEnd;
          const holiday = holidayDays.has(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={`relative h-9 rounded-lg text-sm font-semibold ${counts && edge ? "bg-orange-600 text-white" : counts ? "bg-orange-100 text-orange-900" : edge ? "bg-white text-dark ring-2 ring-orange-400" : inRange ? "bg-slate-100 text-muted" : "text-dark hover:bg-slate-50"}`}
            >
              {Number(iso.slice(8))}
              {holiday && <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${edge ? "bg-white" : "bg-amber-500"}`} />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Cliquez le début, puis la fin. Seuls les jours ouvrés, en orange, retirent du solde.</p>
    </div>
  );
}

function Kpi({ label, value, hint, tone, onClick }: { label: string; value: string; hint: string; tone: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-[24px] border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", tone)}>{label}</span>
      <p className="mt-3 font-display text-3xl font-extrabold leading-none text-dark">{value}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </button>
  );
}

function Apercu({ data, absences, payslips, requests, holidays, monthTitle, monthHolidays, onOpen }: {
  data: HrLeaveEmployee;
  absences: HrAbsenceDay[];
  payslips: HrMyPayslip[];
  requests: HrDocumentRequest[];
  holidays: HrHoliday[];
  monthTitle: string;
  monthHolidays: HrHoliday[];
  onOpen: (tab: Tab) => void;
}) {
  const today = isoOf(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  const pendingLeave = data.requests.filter((row) => row.status === "PENDING").length;
  const missingCert = absences.filter((day) => !day.accepted).length;
  const pendingDocs = requests.filter((row) => row.status === "PENDING").length;
  const nextHoliday = holidays.find((row) => row.day.slice(0, 10) >= today);
  const latestSlip = payslips[0];
  const remaining = data.balance ? wholeDays(data.balance.remaining) : null;
  const earned = data.balance ? wholeDays(data.balance.accrued + data.balance.manual) : null;
  const taken = data.balance ? wholeDays(data.balance.used) : null;

  return (
    <>
      {!data.balance && (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-muted">Votre fiche RH n'est pas encore remplie. L'administrateur enregistre le contrat et la date d'embauche. Le solde de congé apparaîtra ensuite.</p>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Solde" value={remaining === null ? "—" : String(remaining)} hint={remaining === null ? "Fiche à remplir" : remaining > 1 ? "jours restants" : "jour restant"} tone="bg-orange-100 text-orange-700" onClick={() => onOpen("conge")} />
        <Kpi label="En attente" value={String(pendingLeave)} hint={pendingLeave > 1 ? "demandes de congé" : "demande de congé"} tone="bg-amber-100 text-amber-800" onClick={() => onOpen("conge")} />
        <Kpi label="Pris" value={taken === null ? "—" : String(taken)} hint={taken !== null && taken > 1 ? "jours déjà retirés" : "jour déjà retiré"} tone="bg-emerald-100 text-emerald-800" onClick={() => onOpen("conge")} />
        <Kpi label="Acquis" value={earned === null ? "—" : String(earned)} hint={data.balance ? `Reportés ${wholeDays(data.balance.carry)}` : "Fiche à remplir"} tone="bg-orange-50 text-orange-800" onClick={() => onOpen("conge")} />
        <Kpi label="Absences" value={String(absences.length)} hint="validées ce mois-ci" tone="bg-rose-100 text-rose-700" onClick={() => onOpen("absences")} />
        <Kpi label="Certificats" value={String(missingCert)} hint={missingCert ? "encore à déposer" : "tous déposés"} tone="bg-rose-50 text-rose-800" onClick={() => onOpen("absences")} />
        <Kpi label="Fiches" value={String(payslips.length)} hint={latestSlip ? `Dernière ${latestSlip.month} · ${money(latestSlip.net)}` : "aucune fiche émise"} tone="bg-emerald-50 text-emerald-800" onClick={() => onOpen("paie")} />
        <Kpi label="Documents" value={String(pendingDocs)} hint={pendingDocs ? "demandes en cours" : "aucune demande en cours"} tone="bg-slate-100 text-slate-700" onClick={() => onOpen("paie")} />
      </div>
      <section className="mt-4 rounded-[24px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display font-bold text-dark">Jours fériés · {monthTitle}</h2>
          <p className="text-xs text-muted">{nextHoliday ? `Prochain : ${nextHoliday.label} · ${fr(nextHoliday.day)}` : "Aucun férié à venir"}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {monthHolidays.map((row) => (
            <span key={row.id} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs">
              <span className="font-bold text-dark">{fr(row.day)}</span>
              <span className="text-muted">{row.label}</span>
              <span className={row.paid ? "font-bold text-emerald-700" : "font-bold text-amber-800"}>{row.paid ? "Payé" : "Impayé"}</span>
            </span>
          ))}
          {monthHolidays.length === 0 && <span className="text-sm text-muted">Aucun jour férié ce mois-ci.</span>}
        </div>
      </section>
    </>
  );
}

export default function MyRhPage() {
  const [data, setData] = useState<HrLeaveEmployee | null>(null);
  const [error, setError] = useState("");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [payslips, setPayslips] = useState<HrMyPayslip[]>([]);
  const [documents, setDocuments] = useState<HrEmployeeDocument[]>([]);
  const [holidays, setHolidays] = useState<HrHoliday[]>([]);
  const [pdfError, setPdfError] = useState("");
  const [absences, setAbsences] = useState<HrAbsenceDay[]>([]);
  const [delay, setDelay] = useState(72);
  const [requests, setRequests] = useState<HrDocumentRequest[]>([]);
  const [preview, setPreview] = useState<HrLeavePreview | null>(null);
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = requested === "conge" || requested === "absences" || requested === "paie" ? requested : "apercu";

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [pickedMonths, setPickedMonths] = useState<string[]>([month]);
  const [docKind, setDocKind] = useState<"WORK" | "PAYSLIP">("PAYSLIP");
  const monthTitle = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const monthHolidays = holidays.filter((row) => row.day.startsWith(month));
  const loadAbsences = () => fetchMyAbsences(month).then((next) => { setAbsences(next.days); setDelay(next.certDelayHours); }).catch(() => setAbsences([]));

  const load = () => fetchMyLeave().then(setData).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));

  useEffect(() => {
    load().then(() => undefined);
    fetchMyPayslips().then(setPayslips).catch(() => setPayslips([]));
    fetchMyDocumentRequests().then(setRequests).catch(() => setRequests([]));
    fetchMyDocuments().then(setDocuments).catch(() => setDocuments([]));
    fetchMyHolidays().then(setHolidays).catch(() => setHolidays([]));
    loadAbsences().then(() => undefined);
  }, []);

  useEffect(() => {
    if (!data?.balance || !startOn || !endOn || endOn < startOn) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    previewMyLeave(startOn, endOn)
      .then((next) => { if (!cancelled) setPreview(next); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [data?.balance, startOn, endOn]);

  const latest = (kind: HrDocumentRequest["kind"], month?: string) =>
    requests.find((row) => row.kind === kind && (kind === "WORK" || row.month === month));

  const ask = (kind: HrDocumentRequest["kind"], month?: string) => {
    setPdfError("");
    requestHrDocument({ kind, month }).then((row) => setRequests((current) => [row as HrDocumentRequest, ...current])).catch((err) => setPdfError(err instanceof Error ? err.message : "Demande impossible."));
  };

  const askMonths = () => {
    const months = pickedMonths.filter((value) => {
      const status = latest("PAYSLIP", value)?.status;
      return status !== "PENDING" && status !== "APPROVED";
    });
    setPdfError("");
    if (!months.length) {
      setPdfError("Ces mois sont déjà demandés ou validés.");
      return;
    }
    requestHrDocument({ kind: "PAYSLIP", months })
      .then((row) => setRequests((current) => [...(Array.isArray(row) ? row : [row]), ...current]))
      .catch((err) => setPdfError(err instanceof Error ? err.message : "Demande impossible."));
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    setSent(false);
    try {
      await requestMyLeave(startOn, endOn, reason);
      setReason("");
      setSent(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demande impossible.");
    } finally {
      setBusy(false);
    }
  };

  const openTab = (next: Tab) => setParams(next === "apercu" ? {} : { tab: next }, { replace: true });

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <section className="rounded-[28px] bg-gradient-to-br from-orange-700 via-orange-500 to-amber-400 p-6 text-white shadow-[0_16px_40px_rgba(234,88,12,.22)] sm:p-8">
        <p className="text-sm text-white/80">Espace employé</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">Mon espace RH</h1>
        <p className="mt-2 max-w-xl text-sm text-white/85">Congés, absences et paie. Une seule partie à la fois.</p>
        <div className="relative mt-6 grid grid-cols-4 gap-1 rounded-xl bg-white/15 p-1">
          {TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => openTab(item.id)} className={cn("flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition", tab === item.id ? "bg-white text-orange-700 shadow" : "text-white/85 hover:text-white")}>
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </section>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!data ? (
        <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-orange-500" />
      ) : tab === "conge" && !data.balance ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-muted">Votre fiche RH n'est pas encore remplie. L'administrateur enregistre le contrat et la date d'embauche. Le solde de congé apparaîtra ensuite.</p>
      ) : tab === "conge" && data.balance ? (
        <section className="mt-6 rounded-[24px] border border-line bg-white p-5">
          <p className="text-sm text-muted">{data.year} · {data.contractType}{data.contractEndsOn ? ` jusqu'au ${fr(data.contractEndsOn)}` : ""}</p>
          <p className="mt-2 font-display text-4xl font-extrabold text-dark">{wholeDays(data.balance.remaining)} <span className="text-lg text-muted">{wholeDays(data.balance.remaining) > 1 ? "jours restants" : "jour restant"}</span></p>
          <p className="mt-2 text-xs text-muted">Reportés {wholeDays(data.balance.carry)} · acquis {wholeDays(data.balance.accrued + data.balance.manual)} · pris {wholeDays(data.balance.used)}</p>
        </section>
      ) : null}
      {data && tab === "conge" && (
        <form className="mt-4 rounded-[24px] border border-line bg-white p-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 className="font-display font-bold text-dark">Demander un congé</h2>
          {!data.balance ? (
            <p className="mt-2 text-sm text-muted">La demande s'ouvre quand le contrat et la date d'embauche sont enregistrés.</p>
          ) : (
            <>
              {data.leaveNoticeFactor > 0 && (
                <p className="mt-1 text-xs text-muted">La demande doit partir au moins {data.leaveNoticeFactor} fois sa durée avant le premier jour. Si ce délai n'est pas respecté, elle n'est pas enregistrée.</p>
              )}
              <LeaveCalendar
                startOn={startOn}
                endOn={endOn}
                coveredEnd={preview?.coveredEnd || ""}
                holidays={holidays}
                onPick={(iso) => {
                  if (!startOn || endOn) {
                    setStartOn(iso);
                    setEndOn("");
                    return;
                  }
                  if (iso < startOn) setStartOn(iso);
                  else setEndOn(iso);
                }}
              />
              <p className="mt-2 text-sm font-semibold text-dark">Du {startOn ? fr(startOn) : "…"} au {endOn ? fr(endOn) : "…"}</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-[160px] flex-1 text-xs font-bold text-mid">Motif<input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
                <button type="submit" disabled={busy || !preview || !preview.noticeOk || !preview.enough} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Envoi…" : "Envoyer"}</button>
              </div>
              {preview && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-950">
                    <p className="font-bold">{preview.total > 1 ? `${jours(preview.total)} ouvrés seront décomptés` : `${jours(preview.total)} ouvré sera décompté`}</p>
                    {preview.enough && <p className="mt-1">Après cette demande, il restera {jours(preview.remaining - preview.total)}.</p>}
                  </div>
                  {!preview.noticeOk && preview.earliestStart && (
                    <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      Cette demande de {jours(preview.total)} doit être faite au moins {jours(preview.noticeDays)} à l'avance. Date de début au plus tôt : {fr(preview.earliestStart)}.
                    </div>
                  )}
                  {!preview.enough && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                      Solde insuffisant : {jours(preview.remaining)} disponible{wholeDays(preview.remaining) > 1 ? "s" : ""}, {jours(preview.total)} demandé{preview.total > 1 ? "s" : ""}. La demande ne peut pas être envoyée.
                    </div>
                  )}
                </div>
              )}
              {sent && <p className="mt-2 text-xs font-bold text-emerald-600">Demande envoyée. Elle attend la validation.</p>}
            </>
          )}
          <ul className="mt-3 divide-y divide-line">
            {data.requests.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-semibold text-dark">{fr(request.startOn)} – {fr(request.endOn)} · {request.days} j{request.reason ? ` · ${request.reason}` : ""}</span>
                  {request.status === "APPROVED" && request.cover && request.cover.length > 0 && (
                    <span className="block text-xs text-mid">Remplacé par {request.cover.map((sub) => `${sub.name} (${sub.percent} %)`).join(", ")}</span>
                  )}
                </span>
                <span className="text-xs font-bold text-muted">{request.status === "PENDING" ? "En attente" : request.status === "APPROVED" ? "Accepté" : "Refusé"}</span>
              </li>
            ))}
            {data.requests.length === 0 && <li className="py-2 text-sm text-muted">Aucune demande envoyée.</li>}
          </ul>
        </form>
      )}
      {data && tab === "paie" && (
        <div className="mt-4 space-y-4">
          {pdfError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{pdfError}</p>}
          <section className="rounded-[24px] border border-line bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">1 · Demander</p>
            <h2 className="mt-1 font-display font-bold text-dark">Choisir le document</h2>
            <p className="mt-1 text-xs text-muted">Un seul type par demande. L'attestation de travail est unique, pour le mois en cours. La fiche de paie se choisit par mois : plusieurs mois donnent un seul PDF.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setDocKind("WORK")} className={cn("rounded-2xl px-4 py-3 text-left", docKind === "WORK" ? "bg-orange-600 text-white" : "bg-white text-dark ring-1 ring-line")}>
                <span className="block text-sm font-bold">Attestation de travail</span>
                <span className={cn("mt-1 block text-xs", docKind === "WORK" ? "text-orange-100" : "text-muted")}>Une seule. Pas de mois à choisir.</span>
              </button>
              <button type="button" onClick={() => setDocKind("PAYSLIP")} className={cn("rounded-2xl px-4 py-3 text-left", docKind === "PAYSLIP" ? "bg-orange-600 text-white" : "bg-white text-dark ring-1 ring-line")}>
                <span className="block text-sm font-bold">Fiche de paie</span>
                <span className={cn("mt-1 block text-xs", docKind === "PAYSLIP" ? "text-orange-100" : "text-muted")}>Un ou plusieurs mois, un seul PDF.</span>
              </button>
            </div>
            {docKind === "WORK" ? (
              <div className="mt-4">
                <p className="text-xs text-muted">Elle décrit la situation actuelle, pour {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}. Elle ne se décline pas mois par mois.</p>
                {latest("WORK")?.status === "PENDING" ? (
                  <p className="mt-3 text-xs font-semibold text-orange-800">Demande envoyée. Elle est suivie plus bas.</p>
                ) : latest("WORK")?.status === "APPROVED" ? (
                  <p className="mt-3 text-xs font-semibold text-emerald-700">Validée. Le PDF est dans Télécharger.</p>
                ) : (
                  <button type="button" onClick={() => ask("WORK")} className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">{latest("WORK")?.status === "REJECTED" ? "Redemander l'attestation" : "Demander l'attestation"}</button>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs font-bold text-dark">Mois de {now.getFullYear()}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: 12 }, (_, index) => `${now.getFullYear()}-${String(index + 1).padStart(2, "0")}`).map((value) => {
                    const on = pickedMonths.includes(value);
                    const title = new Date(`${value}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
                    const status = latest("PAYSLIP", value)?.status;
                    return (
                      <button key={value} type="button" onClick={() => setPickedMonths((current) => on ? current.filter((item) => item !== value) : [...current, value].sort())} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", on ? "bg-orange-600 text-white" : status === "APPROVED" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : status === "PENDING" ? "bg-orange-50 text-orange-800 ring-1 ring-orange-200" : "bg-white text-dark ring-1 ring-line")}>{title}</button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted">Orange clair : déjà envoyé. Vert : déjà validé. Plusieurs mois cochés partent ensemble et sortiront dans un seul PDF.</p>
                <button type="button" disabled={pickedMonths.length === 0} onClick={askMonths} className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Demander {pickedMonths.length} mois</button>
              </div>
            )}
          </section>
          <section className="rounded-[24px] border border-line bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">2 · Suivre</p>
            <h2 className="mt-1 font-display font-bold text-dark">Demandes en cours</h2>
            <ul className="mt-3 divide-y divide-line">
              {latest("WORK")?.status === "PENDING" && <li className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="font-semibold text-dark">Attestation de travail</span><span className="text-xs font-bold text-orange-800">Envoyée</span></li>}
              {latest("WORK")?.status === "REJECTED" && <li className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="font-semibold text-dark">Attestation de travail</span><span className="text-xs font-bold text-red-600">Refusée</span></li>}
              {requests.filter((row) => row.kind === "PAYSLIP" && row.status !== "APPROVED").map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-semibold text-dark">Fiche de {new Date(`${row.month}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
                  <span className={cn("text-xs font-bold", row.status === "REJECTED" ? "text-red-600" : "text-orange-800")}>{row.status === "REJECTED" ? "Refusée" : row.readyOn ? `Prête le ${fr(row.readyOn)}` : "Envoyée"}</span>
                </li>
              ))}
              {latest("WORK")?.status !== "PENDING" && latest("WORK")?.status !== "REJECTED" && requests.every((row) => row.kind !== "PAYSLIP" || row.status === "APPROVED") && <li className="py-2 text-sm text-muted">Aucune demande en cours.</li>}
            </ul>
          </section>
          <section className="rounded-[24px] border border-line bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">3 · Télécharger</p>
            <h2 className="mt-1 font-display font-bold text-dark">Documents prêts</h2>
            <ul className="mt-3 divide-y divide-line">
              {latest("WORK")?.status === "APPROVED" && (
                <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-semibold text-dark">Attestation de travail</span>
                  <button type="button" onClick={() => { setPdfError(""); downloadHrPdf("/api/hr/me/attestations/pdf?type=work", "Attestation-travail.pdf").catch((err) => setPdfError(err instanceof Error ? err.message : "Téléchargement impossible.")); }} className="text-xs font-bold text-orange-700">Télécharger</button>
                </li>
              )}
              {requests.some((row) => row.kind === "PAYSLIP" && row.status === "APPROVED") && (
                <li className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-dark">Fiches de paie · {requests.filter((row) => row.kind === "PAYSLIP" && row.status === "APPROVED").map((row) => new Date(`${row.month}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")).join(", ")}</span>
                    <button type="button" onClick={() => { setPdfError(""); const months = requests.filter((row) => row.kind === "PAYSLIP" && row.status === "APPROVED" && row.month).map((row) => row.month).sort().join(","); downloadHrPdf(`/api/hr/me/payslips/pdf?months=${months}`, "Fiches-paie.pdf").catch((err) => setPdfError(err instanceof Error ? err.message : "Téléchargement impossible.")); }} className="text-xs font-bold text-orange-700">Télécharger</button>
                  </div>
                  <p className="mt-1 text-xs text-muted">Un seul PDF, une page par mois validé.</p>
                </li>
              )}
              {data.baseSalary !== null && (
                <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-semibold text-dark">Attestation de salaire</span>
                  <button type="button" onClick={() => { setPdfError(""); downloadHrPdf("/api/hr/me/attestations/pdf?type=salary", "Attestation-salaire.pdf").catch((err) => setPdfError(err instanceof Error ? err.message : "Téléchargement impossible.")); }} className="text-xs font-bold text-orange-700">Télécharger</button>
                </li>
              )}
              {data.contractType !== "CDI" && data.contractEndsOn && (
                <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-semibold text-dark">Attestation de fin de contrat</span>
                  <button type="button" onClick={() => { setPdfError(""); downloadHrPdf("/api/hr/me/attestations/pdf?type=end", "Attestation-fin-de-contrat.pdf").catch((err) => setPdfError(err instanceof Error ? err.message : "Téléchargement impossible.")); }} className="text-xs font-bold text-orange-700">Télécharger</button>
                </li>
              )}
              {latest("WORK")?.status !== "APPROVED" && requests.every((row) => row.kind !== "PAYSLIP" || row.status !== "APPROVED") && data.baseSalary === null && !(data.contractType !== "CDI" && data.contractEndsOn) && <li className="py-2 text-sm text-muted">Rien à télécharger pour l'instant.</li>}
            </ul>
          </section>
        </div>
      )}
      {data && tab === "apercu" && (
        <Apercu
          data={data}
          absences={absences}
          payslips={payslips}
          requests={requests}
          holidays={holidays}
          monthTitle={monthTitle}
          monthHolidays={monthHolidays}
          onOpen={openTab}
        />
      )}
      {data && tab === "absences" && (
        <section className="mt-4 rounded-[24px] border border-line bg-white p-5">
          <h2 className="font-display font-bold text-dark">Mes absences</h2>
          <p className="mt-1 text-xs text-muted">Seules les absences validées par l'administrateur apparaissent. Le certificat doit arriver dans les {delay} h.</p>
          <ul className="mt-2 divide-y divide-line">
            {absences.map((day) => (
              <li key={day.day} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="font-semibold text-dark">{fr(day.day)} · {day.status === "NO_REPLY" ? "Sans réponse" : day.status === "ABSENT" ? "Absence" : [day.lateMinutes ? `${day.lateMinutes} min de retard` : "", day.earlyMinutes ? `${day.earlyMinutes} min en avance` : ""].filter(Boolean).join(", ")} · {day.accepted ? "Justifiée" : day.submitted ? "Hors délai" : "Sans certificat"}</span>
                {!day.accepted && (
                  <label className="text-xs font-bold text-orange-700">
                    Déposer le certificat
                    <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setError("");
                        submitMyAbsence(day.day, file.name, String(reader.result || "")).then(() => loadAbsences()).catch((err) => setError(err instanceof Error ? err.message : "Dépôt impossible."));
                      };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                )}
              </li>
            ))}
            {absences.length === 0 && <li className="py-2 text-sm text-muted">Aucune absence ce mois-ci.</li>}
          </ul>
        </section>
      )}
      {data && tab === "paie" && (
        <section className="mt-4 rounded-[24px] border border-line bg-white p-5">
          <h2 className="font-display font-bold text-dark">Documents déposés</h2>
          <p className="mt-1 text-xs text-muted">Fichiers ajoutés par l'administrateur sur votre fiche. Ce ne sont pas les fiches de paie.</p>
          <ul className="mt-2 divide-y divide-line">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold text-dark">{document.label}</span>
                <button type="button" onClick={() => { setPdfError(""); downloadHrPdf(`/api/hr/me/documents/${document.id}/file`, document.originalFilename).catch((err) => setPdfError(err instanceof Error ? err.message : "Téléchargement impossible.")); }} className="text-xs font-bold text-orange-700">Télécharger</button>
              </li>
            ))}
            {documents.length === 0 && <li className="py-2 text-sm text-muted">Aucun document déposé.</li>}
          </ul>
        </section>
      )}
    </main>
  );
}
