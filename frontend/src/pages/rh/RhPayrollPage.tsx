import EmployeePicker from "@/components/rh/EmployeePicker";
import { addHrEmployeeDocument, addHrPayrollEntry, confirmHrPayslipImport, decideHrDocumentRequest, downloadHrPdf, fetchHrDocumentRequests, fetchHrPayroll, issueHrPayslip, previewHrPayslipImport, removeHrEmployeeDocument, removeHrOfficialPayslip, removeHrPayrollEntry, reopenHrPayslip, saveHrPayrollNote, scheduleHrDocumentRequest, setHrPayrollCommission, type HrPayrollEmployee, type HrPayrollMonth, type HrPayslipDraft, type HrPayslipImport, type HrPendingDocument } from "@/lib/hr";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const money = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
const STAGE_LABEL: Record<string, string> = {
  CODE_CLAIMED: "Étudiant inscrit via un code",
  DOCUMENTS_VALIDATED: "Documents du dossier validés",
  APPLIED: "Candidature déposée",
  ACCEPTED: "Candidature acceptée",
  VISA_DOCUMENTS_VALIDATED: "Documents visa validés",
  VISA_SUBMITTED: "Dossier visa déposé",
  VISA_ACCEPTED: "Visa accepté"
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

export default function RhPayrollPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<HrPayrollMonth | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("BONUS");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [docLabel, setDocLabel] = useState("");
  const [requests, setRequests] = useState<HrPendingDocument[]>([]);
  const [readyDates, setReadyDates] = useState<Record<string, string>>({});
  const [bulletin, setBulletin] = useState<HrPayslipImport | null>(null);
  const [drafts, setDrafts] = useState<Array<HrPayslipDraft & { userId: string }>>([]);
  const [reading, setReading] = useState(false);
  const [params] = useSearchParams();

  const loadRequests = () => fetchHrDocumentRequests().then(setRequests).catch(() => setRequests([]));

  const load = (value = month) =>
    fetchHrPayroll(value)
      .then((next) => {
        setData(next);
        setSelectedId((current) => {
          const preferred = current || params.get("user");
          return preferred && next.employees.some((row) => row.id === preferred) ? preferred : next.employees[0]?.id || null;
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));

  useEffect(() => {
    load().then(() => undefined);
    loadRequests().then(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => data?.employees.find((row) => row.id === selectedId) || null, [data, selectedId]);

  useEffect(() => {
    setNote(selected?.note || "");
    setKind("BONUS");
    setLabel("");
    setAmount("");
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

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-dark">Paie</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Le salaire comprend déjà les congés acceptés et les jours fériés payés. Le net ajoute les primes, les commissions payées que vous cochez et, s'il est versé, le solde de congés d'une année. Il retire les absences validées, les retards validés, un jour de salaire pour chaque jour férié impayé validé, et l'avance déjà remise. Une avance d'un mois précédent se rembourse au plus à 10 % du salaire dû.</p>
        </div>
        <label className="text-xs font-bold text-mid">
          Mois
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); void load(e.target.value); }} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm" />
        </label>
      </div>
      {data && (!data.hasSignature || !data.hasStamp) && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Déposez la signature et le cachet dans Paramètres RH pour les imprimer sur les PDF.</p>
      )}
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <BulletinImport
        bulletin={bulletin}
        drafts={drafts}
        reading={reading}
        busy={busy}
        onDrafts={setDrafts}
        onRead={async (file) => {
          setReading(true);
          setError("");
          try {
            const next = await previewHrPayslipImport(file.name, await readFile(file));
            setBulletin(next);
            setDrafts(next.slips.map((slip) => ({ ...slip, userId: slip.suggestedUserId || "" })));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Lecture impossible.");
          } finally {
            setReading(false);
          }
        }}
        onSave={async () => {
          if (!bulletin) return;
          await run(async () => {
            await confirmHrPayslipImport({ fileId: bulletin.fileId, filename: "bulletin.pdf", slips: drafts });
            setBulletin(null);
            setDrafts([]);
          });
        }}
        onCancel={() => { setBulletin(null); setDrafts([]); }}
      />
      <section className="mt-4 rounded-[24px] border border-line bg-white p-5">
        <h2 className="font-display font-bold text-dark">Demandes des employés</h2>
        <p className="mt-1 text-xs text-muted">Valide ou refuse. Pour une fiche absente, indique le jour où elle sera prête : la demande reste ouverte et un rappel arrive ce jour-là.</p>
        <ul className="mt-2 divide-y divide-line">
          {requests.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-dark">{row.prenom} {row.nom} · {row.kind === "WORK" ? "Attestation de travail" : `Fiche de paie ${row.month}`}</p>
                  {row.kind === "PAYSLIP" && !row.hasFiche && <p className="mt-1 text-xs font-semibold text-amber-800">Ce mois n'a pas encore de fiche de paie.</p>}
                  {row.readyOn && <p className="mt-1 text-xs text-muted">Prête le {new Date(`${row.readyOn}T12:00:00`).toLocaleDateString("fr-FR")}. La demande reste ouverte.</p>}
                </div>
                <span className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void run(async () => { await decideHrDocumentRequest(row.id, "APPROVED"); await loadRequests(); })} className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white">Valider</button>
                  <button type="button" disabled={busy} onClick={() => void run(async () => { await decideHrDocumentRequest(row.id, "REJECTED"); await loadRequests(); })} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-dark ring-1 ring-line">Refuser</button>
                </span>
              </div>
              {row.kind === "PAYSLIP" && (
                <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); const readyOn = readyDates[row.id] || row.readyOn || ""; if (!readyOn) return; void run(async () => { await scheduleHrDocumentRequest(row.id, readyOn); await loadRequests(); }); }}>
                  <label className="text-xs font-bold text-mid">Prête le
                    <input type="date" value={readyDates[row.id] ?? row.readyOn ?? ""} onChange={(event) => setReadyDates((current) => ({ ...current, [row.id]: event.target.value }))} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm" />
                  </label>
                  <button type="submit" disabled={busy || !(readyDates[row.id] || row.readyOn)} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-orange-200">Prévenir l'employé</button>
                </form>
              )}
            </li>
          ))}
          {requests.length === 0 && <li className="py-2 text-sm text-muted">Aucune demande en attente.</li>}
        </ul>
      </section>
      {!data || !selected ? (
        <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-orange-500" />
      ) : (
        <div className="mt-6 space-y-4">
          <EmployeePicker
            people={data.employees}
            selectedId={selected.id}
            onSelect={setSelectedId}
            hint={(row) => row.official ? `${money(row.official.netToPay)} · bulletin` : `${money(row.lines.net)}${row.issued ? " · émise" : ""}`}
          />
          <Detail
            row={selected}
            month={month}
            onOpenMonth={(value) => { setMonth(value); void load(value); }}
            onToggleCommission={(earningId, include) => void run(async () => { await setHrPayrollCommission(selected.id, month, earningId, include); })}
            busy={busy}
            kind={kind}
            label={label}
            amount={amount}
            note={note}
            docLabel={docLabel}
            onKind={setKind}
            onLabel={setLabel}
            onAmount={setAmount}
            onNote={setNote}
            onDocLabel={setDocLabel}
            onAdd={() => void run(async () => {
              await addHrPayrollEntry({ userId: selected.id, month, kind, label: label.trim(), amount });
              setLabel("");
              setAmount("");
            })}
            onRemoveEntry={(id) => void run(() => removeHrPayrollEntry(id))}
            onSave={() => void run(() => saveHrPayrollNote(selected.id, month, note))}
            onIssue={() => void run(() => issueHrPayslip(selected.id, month))}
            onReopen={() => void run(() => reopenHrPayslip(selected.id, month))}
            onDownload={async (path, filename) => {
              setError("");
              try {
                await downloadHrPdf(path, filename);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Téléchargement impossible.");
              }
            }}
            onUpload={async (file) => {
              if (!docLabel.trim()) {
                setError("Nommez le document avant de le déposer.");
                return;
              }
              await run(async () => {
                await addHrEmployeeDocument(selected.id, docLabel.trim(), file.name, await readFile(file));
                setDocLabel("");
              });
            }}
            onRemove={(id) => void run(() => removeHrEmployeeDocument(id))}
            onRemoveOfficial={() => void run(() => removeHrOfficialPayslip(selected.id, month))}
          />
        </div>
      )}
    </main>
  );
}

function field(drafts: Array<HrPayslipDraft & { userId: string }>, index: number, key: keyof HrPayslipDraft, value: string) {
  const next = drafts.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value === "" ? null : Number(value.replace(",", ".")) } : row);
  return next;
}

function BulletinImport({
  bulletin, drafts, reading, busy, onDrafts, onRead, onSave, onCancel
}: {
  bulletin: HrPayslipImport | null;
  drafts: Array<HrPayslipDraft & { userId: string }>;
  reading: boolean;
  busy: boolean;
  onDrafts: (drafts: Array<HrPayslipDraft & { userId: string }>) => void;
  onRead: (file: File) => Promise<void>;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const amountKeys: Array<[keyof HrPayslipDraft, string]> = [
    ["baseSalary", "Salaire de base"],
    ["presenceDays", "Jours de présence"],
    ["presenceAmount", "Valeur présence"],
    ["leaveDays", "Jours de congé"],
    ["leaveAmount", "Valeur congé"],
    ["transport", "Transport"],
    ["presenceBonus", "Prime de présence"],
    ["functionAllowance", "Indemnité de fonction"],
    ["responsibilityBonus", "Prime de responsabilité"],
    ["gross", "Brut"],
    ["cnssDeduction", "CNSS"],
    ["taxable", "Imposable"],
    ["irpp", "IRPP"],
    ["css", "Solidarité"],
    ["netToPay", "Net à payer"]
  ];
  return (
    <section className="mt-4 rounded-[24px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-dark">Importer un bulletin</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted">Déposez le PDF du comptable. Un fichier peut contenir plusieurs mois. L'application lit les montants, propose l'employé par le nom ou le numéro CNSS, puis vous vérifiez avant d'enregistrer. Le bulletin remplace la fiche calculée de ce mois.</p>
        </div>
        <label className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">
          {reading ? "Lecture..." : "Choisir un PDF"}
          <input type="file" accept="application/pdf" disabled={reading || busy} className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void onRead(file); }} />
        </label>
      </div>
      {bulletin && (
        <div className="mt-4 space-y-4">
          {drafts.map((slip, index) => (
            <article key={slip.page} className="rounded-2xl border border-line p-4">
              <p className="text-sm font-bold text-dark">{slip.employeeName || "Nom non lu"}{slip.cnss ? ` · CNSS ${slip.cnss}` : ""}</p>
              {!slip.suggestedUserId && <p className="mt-1 text-xs font-semibold text-amber-800">Aucune personne ne correspond. Choisissez l'employé.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="text-xs font-bold text-mid">Mois
                  <input type="month" value={slip.month} onChange={(e) => onDrafts(drafts.map((row, rowIndex) => rowIndex === index ? { ...row, month: e.target.value } : row))} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm" />
                </label>
                <label className="min-w-[220px] flex-1 text-xs font-bold text-mid">Employé
                  <select value={slip.userId} onChange={(e) => onDrafts(drafts.map((row, rowIndex) => rowIndex === index ? { ...row, userId: e.target.value } : row))} className="mt-1 block w-full rounded-xl border border-line px-3 py-2 text-sm">
                    <option value="">Choisir</option>
                    {bulletin.employees.map((person) => <option key={person.id} value={person.id}>{person.prenom} {person.nom}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {amountKeys.map(([key, label]) => (
                  <label key={key} className="text-[11px] font-bold text-mid">{label}
                    <input value={slip[key] === null || slip[key] === undefined ? "" : String(slip[key]).replace(".", ",")} onChange={(e) => onDrafts(field(drafts, index, key, e.target.value))} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" />
                  </label>
                ))}
              </div>
            </article>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || drafts.some((slip) => !slip.userId || !slip.month)} onClick={() => void onSave()} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">Enregistrer les bulletins</button>
            <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-dark ring-1 ring-line">Annuler</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Detail({
  row, month, onOpenMonth, onToggleCommission, busy, kind, label, amount, note, docLabel, onKind, onLabel, onAmount, onNote, onDocLabel, onAdd, onRemoveEntry, onSave, onIssue, onReopen, onDownload, onUpload, onRemove, onRemoveOfficial
}: {
  row: HrPayrollEmployee;
  month: string;
  onOpenMonth: (month: string) => void;
  onToggleCommission: (earningId: string, include: boolean) => void;
  busy: boolean;
  kind: string;
  label: string;
  amount: string;
  note: string;
  docLabel: string;
  onKind: (value: string) => void;
  onLabel: (value: string) => void;
  onAmount: (value: string) => void;
  onNote: (value: string) => void;
  onDocLabel: (value: string) => void;
  onAdd: () => void;
  onRemoveEntry: (id: string) => void;
  onSave: () => void;
  onIssue: () => void;
  onReopen: () => void;
  onDownload: (path: string, filename: string) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onRemove: (id: string) => void;
  onRemoveOfficial: () => void;
}) {
  const lines = row.lines;
  const taken = lines.presenceAdjustment !== null ? lines.presenceAdjustment : lines.absenceDeduction + lines.latenessDeduction;
  const included = lines.includedCommissions || 0;
  const gross = lines.baseSalary + lines.bonus + lines.paidLeave + included;
  const deductions = taken + lines.unpaidHolidayDeduction + lines.advance;
  const period = new Date(`${month}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const year = month.slice(0, 4);
  const yearMonths = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const [picked, setPicked] = useState<string[]>([]);
  const officialKey = (row.officialMonths || []).join(",");
  useEffect(() => {
    const seeded = officialKey.split(",").filter((value) => value.startsWith(year));
    setPicked(seeded.length ? seeded : [month]);
    // Le mois affiché ne doit pas effacer les mois déjà cochés.
  }, [row.id, year, officialKey]);
  const kindLabel = (value: string) => (value === "BONUS" ? "Prime" : value === "ADVANCE" ? "Avance versée" : "Retenue sur avance");
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-line bg-white p-5">
        <p className="text-xs font-bold text-dark">Mois à mettre dans le PDF</p>
        <p className="mt-1 text-[11px] text-muted">Coche juillet, août, septembre ou les mois que tu veux. Chaque mois devient une page, dans un seul fichier.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {yearMonths.map((value) => {
            const on = picked.includes(value);
            const title = new Date(`${value}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
            return (
              <button key={value} type="button" onClick={() => setPicked((current) => on ? current.filter((item) => item !== value) : [...current, value].sort())} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", on ? "bg-orange-600 text-white" : "bg-white text-dark ring-1 ring-line")}>
                {title}
              </button>
            );
          })}
        </div>
        <button type="button" disabled={busy || picked.length === 0} onClick={() => void onDownload(`/api/admin/hr/payroll/${row.id}/fiches?months=${picked.join(",")}`, "Fiches-paie.pdf")} className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          Télécharger {picked.length} mois en un PDF
        </button>
      </section>
      <section className="rounded-[24px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-dark">{row.prenom} {row.nom}</h2>
            <p className="text-xs text-muted">{period}{row.cin ? ` · CIN ${row.cin}` : ""}{row.cnssNumber ? ` · CNSS ${row.cnssNumber}` : ""}{row.hiredOn ? ` · embauché le ${new Date(`${row.hiredOn}T12:00:00`).toLocaleDateString("fr-FR")}` : ""}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold", row.official ? "bg-emerald-50 text-emerald-700" : row.issued ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>{row.official ? "Bulletin officiel" : row.issued ? "Émise" : "Brouillon"}</span>
        </div>
        {!row.official && (row.officialMonths || []).length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>Ce mois n’a pas de bulletin importé. Le PDF téléchargé ici garde les champs calculés. Les champs du bulletin (présence, congés, transport, CNSS, IRPP, net du comptable) sont sur un autre mois.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(row.officialMonths || []).map((value) => (
                <button key={value} type="button" onClick={() => onOpenMonth(value)} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-dark ring-1 ring-amber-200">
                  Ouvrir {new Date(`${value}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </button>
              ))}
            </div>
          </div>
        )}
        {row.official ? (
          <>
            <p className="mt-3 text-xs text-muted">Ce mois vient du bulletin déposé. La fiche SM Travel reprend ses lignes et ses montants : présence, congés, transport, primes, brut, CNSS, IRPP, solidarité et net. Elle ne reprend pas les absences, les retards ni l’avance calculés ici.</p>
            <dl className="mt-4 text-sm">
              <Row label="Salaire de base" value={money(row.official.baseSalary)} />
              <Row label={`Jours de présence · ${row.official.presenceDays} j`} value={money(row.official.presenceAmount)} />
              <Row label={`Jours de congé · ${row.official.leaveDays} j`} value={money(row.official.leaveAmount)} />
              <Row label="Indemnité de transport" value={money(row.official.transport)} />
              <Row label="Prime de présence" value={money(row.official.presenceBonus)} />
              <Row label="Indemnité de fonction" value={money(row.official.functionAllowance)} />
              <Row label="Prime de responsabilité" value={money(row.official.responsibilityBonus)} />
              <Row label="Brut" value={money(row.official.gross)} strong />
              <Row label="CNSS" value={money(-row.official.cnssDeduction)} />
              <Row label="Imposable" value={money(row.official.taxable)} />
              <Row label="IRPP" value={money(-row.official.irpp)} />
              <Row label="Contribution sociale de solidarité" value={money(-row.official.css)} />
            </dl>
            <div className="mt-4 rounded-2xl bg-orange-600 px-4 py-3 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wide text-orange-100">Net à payer</p>
              <p className="font-display text-2xl font-extrabold">{money(row.official.netToPay)}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void onDownload(`/api/admin/hr/payroll/${row.id}/bulletin?month=${month}`, `Fiche-paie-${month}.pdf`)} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">Télécharger la fiche SM</button>
              <button type="button" disabled={busy} onClick={() => void onDownload(`/api/admin/hr/payroll/${row.id}/bulletin?month=${month}&original=1`, `Bulletin-original-${month}.pdf`)} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-dark ring-1 ring-orange-200">PDF du comptable</button>
              <button type="button" disabled={busy} onClick={onRemoveOfficial} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-dark ring-1 ring-orange-200">Retirer le bulletin</button>
              <button type="button" disabled={busy} onClick={() => void onDownload(`/api/admin/hr/attestations/${row.id}/pdf?type=work`, "Attestation-travail.pdf")} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-line">Attestation de travail</button>
            </div>
          </>
        ) : (
        <>
        <dl className="mt-5 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Gains</p>
          <Row label="Salaire de base" value={money(lines.baseSalary)} />
          <p className="-mt-1 text-[11px] text-muted">Congés acceptés et jours fériés payés inclus.</p>
          <Row label="Primes" value={money(lines.bonus)} />
          {lines.paidLeave > 0 && <Row label="Solde de congés versé" value={money(lines.paidLeave)} />}
          {included > 0 && <Row label="Commissions sur ventes" value={money(included)} />}
          <div className="mt-3 rounded-2xl bg-orange-50/50 p-3">
            <p className="text-xs font-bold text-dark">Commissions payées</p>
            <p className="mt-1 text-[11px] text-muted">Payée ce mois : versée dans Finance pendant ce mois. Déjà payée : versée avant, et pas encore mise sur une fiche. Coche celles à ajouter au salaire : elles entrent dans le net et dans le PDF envoyé au comptable.</p>
            <ul className="mt-2 divide-y divide-orange-100">
              {(row.paidCommissions || []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={item.included} disabled={row.issued || busy || (!item.included && item.includedMonth !== null && item.includedMonth !== month)} onChange={(event) => onToggleCommission(item.id, event.target.checked)} />
                    <span>
                      <span className="font-semibold text-dark">{item.student}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{STAGE_LABEL[item.stage] || item.stage} · {item.paidThisMonth ? "payée ce mois" : "déjà payée"}{item.includedMonth && item.includedMonth !== month ? ` · reprise en ${item.includedMonth}` : ""}</span>
                    </span>
                  </label>
                  <span className="font-semibold text-dark">{money(item.amount)}</span>
                </li>
              ))}
              {(row.paidCommissions || []).length === 0 && <li className="py-2 text-sm text-muted">Aucune commission payée pour ce mois.</li>}
            </ul>
            {row.issued && <p className="mt-2 text-[11px] text-muted">Rouvrez la fiche pour changer les commissions incluses.</p>}
          </div>
          <Row label="Salaire brut" value={money(gross)} strong />
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted">Retenues</p>
          {lines.presenceAdjustment !== null ? (
            <Row label="Retenue de présence saisie" value={money(lines.presenceAdjustment ? -lines.presenceAdjustment : 0)} />
          ) : (
            <>
              <Row label={`Retenue d'absence · ${row.absenceDays} jour(s) validé(s)`} value={money(lines.absenceDeduction ? -lines.absenceDeduction : 0)} />
              <Row label={`Retenue de retard · ${row.latenessMinutes} min validée(s)`} value={money(lines.latenessDeduction ? -lines.latenessDeduction : 0)} />
            </>
          )}
          {lines.unpaidHolidayDeduction > 0 && <Row label="Jours fériés impayés" value={money(-lines.unpaidHolidayDeduction)} />}
          <Row label="Avance versée" value={money(lines.advance ? -lines.advance : 0)} />
          <Row label="Total des retenues" value={money(deductions ? -deductions : 0)} strong />
        </dl>
        <div className="mt-4 rounded-2xl bg-orange-600 px-4 py-3 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange-100">Net à payer</p>
          <p className="font-display text-2xl font-extrabold">{money(lines.net)}</p>
        </div>
        <dl className="mt-3 text-sm">
          <Row label="Commissions Finance, hors fiche" value={money(lines.unpaidCommissions || 0)} muted />
          <p className="-mt-1 text-[11px] text-muted">Commissions gagnées et pas encore payées. Elles n'entrent jamais dans le salaire. Après le PDF du mois, cette somme revient à 0.</p>
          <Row label="Solde d'avances encore dû" value={money(lines.advanceBalance || 0)} muted />
        </dl>
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
          <label className="min-w-[160px] flex-1 text-xs font-bold text-mid">Note<input value={note} onChange={(e) => onNote(e.target.value)} disabled={row.issued || busy} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm disabled:opacity-50" /></label>
          {!row.issued && <button type="submit" disabled={busy} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-orange-200">Enregistrer la note</button>}
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {row.issued ? (
            <>
              <button type="button" disabled={busy} onClick={() => void onDownload(`/api/admin/hr/payroll/${row.id}/pdf?month=${month}`, `Fiche-paie-${month}.pdf`)} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">Télécharger la fiche</button>
              <button type="button" disabled={busy} onClick={onReopen} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-dark ring-1 ring-orange-200">Rouvrir</button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={onIssue} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">Émettre la fiche</button>
          )}
          <button type="button" disabled={busy} onClick={() => void onDownload(`/api/admin/hr/attestations/${row.id}/pdf?type=work`, "Attestation-travail.pdf")} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-line">Attestation de travail</button>
          <button type="button" disabled={busy} onClick={() => void onDownload(`/api/admin/hr/attestations/${row.id}/pdf?type=salary`, "Attestation-salaire.pdf")} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-line">Attestation de salaire</button>
          {row.contractType !== "CDI" && row.contractEndsOn && <button type="button" disabled={busy} onClick={() => void onDownload(`/api/admin/hr/attestations/${row.id}/pdf?type=end`, "Attestation-fin-de-contrat.pdf")} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-dark ring-1 ring-line">Fin de contrat</button>}
        </div>
        </>
        )}
      </section>
      {!row.official && <section className="rounded-[24px] border border-line bg-white p-5">
        <h3 className="font-display font-bold text-dark">Primes et avances</h3>
        <p className="mt-1 text-xs text-muted">Ces lignes alimentent la fiche au-dessus. Une prime s'ajoute au brut. Une avance versée se retire du net.</p>
        <ul className="mt-3 divide-y divide-line">
          {row.entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="text-dark"><span className="font-bold">{kindLabel(entry.kind)}</span> · {entry.label}</span>
              <span className="flex items-center gap-3">
                <span className="font-semibold">{money(entry.amount)}</span>
                {!row.issued && <button type="button" onClick={() => onRemoveEntry(entry.id)} className="text-[11px] font-bold text-red-600">Retirer</button>}
              </span>
            </li>
          ))}
          {row.entries.length === 0 && <li className="py-2 text-sm text-muted">Aucune prime ni avance ce mois-ci.</li>}
        </ul>
        {!row.issued && (
          <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onAdd(); }}>
            <label className="text-xs font-bold text-mid">Type
              <select value={kind} onChange={(e) => onKind(e.target.value)} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm">
                <option value="BONUS">Prime</option>
                <option value="ADVANCE">Avance versée</option>
                <option value="RECOVERY">Retenue sur avance</option>
              </select>
            </label>
            <label className="min-w-[140px] flex-1 text-xs font-bold text-mid">Libellé<input value={label} onChange={(e) => onLabel(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
            <label className="text-xs font-bold text-mid">Montant (DT)<input value={amount} onChange={(e) => onAmount(e.target.value)} className="mt-1 block w-28 rounded-xl border border-line px-3 py-2 text-sm" /></label>
            <button type="submit" disabled={busy} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white">Ajouter</button>
          </form>
        )}
      </section>}
      <section className="rounded-[24px] border border-line bg-white p-5">
        <h3 className="font-display font-bold text-dark">Documents</h3>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[160px] flex-1 text-xs font-bold text-mid">Nom<input value={docLabel} onChange={(e) => onDocLabel(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
          <label className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">
            Déposer
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void onUpload(file); }} />
          </label>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {row.documents.map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <button type="button" onClick={() => void onDownload(`/api/admin/hr/documents/${document.id}/file`, document.originalFilename)} className="truncate text-left font-semibold text-dark">{document.label}</button>
              <button type="button" onClick={() => onRemove(document.id)} className="text-[11px] font-bold text-red-600">Retirer</button>
            </li>
          ))}
          {row.documents.length === 0 && <li className="py-2 text-sm text-muted">Aucun document.</li>}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1", muted && "text-muted", strong && "mt-1 border-t border-line pt-2 font-bold text-dark")}>
      <dt>{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
