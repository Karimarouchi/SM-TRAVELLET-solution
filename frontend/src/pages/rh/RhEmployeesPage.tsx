import EmployeePicker from "@/components/rh/EmployeePicker";
import { addHrEmployeeDocument, downloadHrPdf, fetchHrEmployeeDossier, fetchHrEmployees, removeHrEmployeeDocument, saveHrEmployee, type HrContract, type HrEmployee, type HrEmployeeDossier, type HrIdentityFile } from "@/lib/hr";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const CONTRACTS: { id: HrContract; label: string; leave: string }[] = [
  { id: "CDI", label: "CDI", leave: "2 jours / mois" },
  { id: "CIVP", label: "CIVP", leave: "1,5 jour / mois, puis CDI" },
  { id: "CDD", label: "CDD", leave: "à saisir" }
];

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", SALES: "Conseiller", RDV: "Responsable dossier" };
const STAGE_LABEL: Record<string, string> = {
  CODE_CLAIMED: "Étudiant inscrit via un code",
  DOCUMENTS_VALIDATED: "Documents du dossier validés",
  APPLIED: "Candidature déposée",
  ACCEPTED: "Candidature acceptée",
  VISA_DOCUMENTS_VALIDATED: "Documents visa validés",
  VISA_SUBMITTED: "Dossier visa déposé",
  VISA_ACCEPTED: "Visa accepté"
};
const LEAVE_STATUS: Record<string, string> = { PENDING: "En attente", APPROVED: "Accepté", REJECTED: "Refusé" };

const money = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
const days2 = (value: number | null) => Number(value ?? 0).toFixed(2);
const fr = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR");

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

function emptyForm(employee: HrEmployee) {
  return {
    contractType: (employee.contractType || "CDI") as HrContract,
    hiredOn: employee.hiredOn || "",
    contractEndsOn: employee.contractEndsOn || "",
    cin: employee.cin,
    cnssNumber: employee.cnssNumber,
    rib: employee.rib,
    baseSalary: employee.baseSalary === null ? "" : String(employee.baseSalary),
    leaveDaysPerMonth: employee.leaveDaysCustom === null ? "" : String(employee.leaveDaysCustom)
  };
}

export default function RhEmployeesPage() {
  const [rows, setRows] = useState<HrEmployee[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [dossier, setDossier] = useState<HrEmployeeDossier | null>(null);
  const [params] = useSearchParams();

  useEffect(() => {
    fetchHrEmployees()
      .then((list) => {
        setRows(list);
        setSelectedId((current) => current || params.get("user") || list[0]?.id || null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  }, []);

  const selected = useMemo(() => rows?.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  useEffect(() => {
    if (selected) setForm(emptyForm(selected));
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDossier(null);
    fetchHrEmployeeDossier(selectedId)
      .then((next) => { if (!cancelled) setDossier(next); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Dossier impossible à ouvrir."); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const customLeave = form?.contractType === "CDD";
  const leaveLabel = form ? CONTRACTS.find((c) => c.id === form.contractType)?.leave : "";

  const save = async () => {
    if (!selected || !form) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await saveHrEmployee(selected.id, {
        ...form,
        baseSalary: form.baseSalary.trim() === "" ? null : form.baseSalary,
        leaveDaysPerMonth: form.leaveDaysPerMonth.trim() === "" ? null : form.leaveDaysPerMonth,
        hiredOn: form.hiredOn || null,
        contractEndsOn: form.contractEndsOn || null
      });
      setRows((prev) => (prev || []).map((row) => (row.id === next.id ? next : row)));
      setDossier(await fetchHrEmployeeDossier(selected.id));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const uploadIdentity = async (kind: "CIN" | "CONTRACT", file: File) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await addHrEmployeeDocument(selected.id, kind === "CIN" ? "Copie de la CIN" : "Contrat de travail", file.name, await readFile(file), kind);
      setDossier(await fetchHrEmployeeDossier(selected.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dépôt impossible.");
    } finally {
      setBusy(false);
    }
  };

  const removeIdentity = async (id: string) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await removeHrEmployeeDocument(id);
      setDossier(await fetchHrEmployeeDossier(selected.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold text-dark">Employés</h1>
      <p className="mt-1 text-sm text-muted">Le solde de congé suivra le contrat : 2 jours par mois en CDI, 1,5 en CIVP. Un an après l'embauche, le CIVP devient un CDI.</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {!rows ? (
        <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-orange-500" />
      ) : (
        <div className="mt-6 space-y-4">
          <EmployeePicker
            people={rows}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setSaved(false); }}
            hint={(row) => {
              const role = row.roles.map((item) => ROLE_LABEL[item] || item).join(" · ") || "Employé";
              return `${role}${row.contractType ? ` · ${row.contractType}` : ""}${row.isActive ? "" : " · bloqué"}`;
            }}
          />
          {rows.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-white p-4 text-sm text-muted">Aucun employé.</p>}

          {selected && form && (
            <>
            <form
              className="rounded-[24px] border border-line bg-white p-5 shadow-sm"
              onSubmit={(e) => { e.preventDefault(); void save(); }}
            >
              <h2 className="font-display text-lg font-bold text-dark">{selected.prenom} {selected.nom}</h2>
              <p className="text-xs text-muted">{selected.email}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-mid">
                  Contrat
                  <select
                    value={form.contractType}
                    onChange={(e) => {
                      const contractType = e.target.value as HrContract;
                      setForm({ ...form, contractType, contractEndsOn: contractType === "CDI" ? "" : form.contractEndsOn });
                    }}
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-orange-500"
                  >
                    {CONTRACTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-mid">
                  Congé par mois
                  {customLeave ? (
                    <input
                      value={form.leaveDaysPerMonth}
                      onChange={(e) => setForm({ ...form, leaveDaysPerMonth: e.target.value })}
                      inputMode="decimal"
                      placeholder="0"
                      className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500"
                    />
                  ) : (
                    <p className="mt-1 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-bold text-orange-700">{leaveLabel}, calculé automatiquement</p>
                  )}
                </label>
                <label className="block text-xs font-bold text-mid">
                  Embauche
                  <input type="date" value={form.hiredOn} onChange={(e) => setForm({ ...form, hiredOn: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
                </label>
                <label className="block text-xs font-bold text-mid">
                  {form.contractType === "CDI" ? "Durée" : "Fin de contrat"}
                  {form.contractType === "CDI" ? (
                    <p className="mt-1 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-bold text-orange-700">Durée indéterminée</p>
                  ) : (
                    <input type="date" required={form.contractType === "CDD"} value={form.contractEndsOn} onChange={(e) => setForm({ ...form, contractEndsOn: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
                  )}
                </label>
                <label className="block text-xs font-bold text-mid">
                  Salaire de base (DT)
                  <input value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} inputMode="decimal" placeholder="Vide s'il n'y en a pas" className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
                </label>
                <label className="block text-xs font-bold text-mid">
                  CIN
                  <input value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
                </label>
                <label className="block text-xs font-bold text-mid">
                  N° CNSS
                  <input value={form.cnssNumber} onChange={(e) => setForm({ ...form, cnssNumber: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
                </label>
                <label className="block text-xs font-bold text-mid sm:col-span-2">
                  RIB
                  <input value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                {saved && <span className="text-xs font-bold text-emerald-600">Enregistré</span>}
                <button type="submit" disabled={busy} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
                  {busy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>

            <section className="grid gap-3 sm:grid-cols-2">
              <IdentitySlot title="Copie de la CIN" hint="PDF ou image" file={dossier?.cin || null} busy={busy} onUpload={(file) => void uploadIdentity("CIN", file)} onRemove={removeIdentity} />
              <IdentitySlot title="Contrat de travail" hint="PDF ou image" file={dossier?.contract || null} busy={busy} onUpload={(file) => void uploadIdentity("CONTRACT", file)} onRemove={removeIdentity} />
            </section>

            {!dossier ? (
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-orange-500" />
            ) : selected.hiredOn && dossier.ready && dossier.leave && dossier.payslips && dossier.commissions ? (
              <Dossier employee={selected} dossier={dossier} />
            ) : (
              <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-5 text-sm text-muted">
                Enregistrez le contrat et la date d'embauche pour ouvrir le dossier : congés, fiches de paie et commissions.
              </p>
            )}
          </>
          )}
        </div>
      )}
    </main>
  );
}

function IdentitySlot({ title, hint, file, busy, onUpload, onRemove }: {
  title: string;
  hint: string;
  file: HrIdentityFile | null;
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-white p-4">
      <p className="text-sm font-bold text-dark">{title}</p>
      <p className="text-[11px] text-muted">{hint}</p>
      {file ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => { downloadHrPdf(`/api/admin/hr/documents/${file.id}/file`, file.originalFilename).catch(() => undefined); }} className="truncate text-left text-sm font-semibold text-orange-700">{file.originalFilename}</button>
          <button type="button" disabled={busy} onClick={() => onRemove(file.id)} className="text-[11px] font-bold text-red-600">Retirer</button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Aucun fichier</p>
      )}
      <label className="mt-3 inline-flex cursor-pointer rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700">
        {file ? "Remplacer" : "Déposer"}
        <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(event) => { const next = event.target.files?.[0]; event.target.value = ""; if (next) onUpload(next); }} />
      </label>
    </div>
  );
}

function Dossier({ employee, dossier }: { employee: HrEmployee; dossier: HrEmployeeDossier }) {
  const leave = dossier.leave!;
  const payslips = dossier.payslips!;
  const commissions = dossier.commissions!;
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-line bg-white p-5">
        <h3 className="font-display text-lg font-bold text-dark">Congés · {leave.year}</h3>
        <p className="text-xs text-muted">
          {leave.monthlyLeave === null ? "Jours par mois non renseignés" : `${days2(leave.monthlyLeave)} jour par mois`}
          {leave.dayValue !== null ? ` · 1 jour = ${money(leave.dayValue)}` : ""}
        </p>
        {leave.balance && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Reporté" value={days2(leave.balance.carry)} />
            <Stat label="Acquis" value={days2(leave.balance.accrued)} />
            <Stat label="Donné" value={days2(leave.balance.manual)} />
            <Stat label="Pris" value={days2(leave.balance.used)} />
            <Stat label="Reste" value={days2(leave.balance.remaining)} />
          </div>
        )}
        {leave.openYears.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-amber-900">
            {leave.openYears.map((year) => <li key={year.year}>{year.year} encore à solder · {days2(year.remaining)} jour(s)</li>)}
          </ul>
        )}
        {leave.settlements.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {leave.settlements.map((row) => (
              <li key={row.year}>{row.year} · {row.action === "PAY" ? `payée${row.amount !== null ? ` ${money(row.amount)}` : ""}` : "reportée"} · {days2(row.days)} jour(s)</li>
            ))}
          </ul>
        )}
        <ul className="mt-4 divide-y divide-line">
          {leave.requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-semibold text-dark">{fr(request.startOn)} – {fr(request.endOn)} · {request.days} j</span>
              <span className="text-xs font-bold text-muted">{LEAVE_STATUS[request.status] || request.status}</span>
            </li>
          ))}
          {leave.requests.length === 0 && <li className="py-2 text-sm text-muted">Aucun congé enregistré.</li>}
        </ul>
      </section>

      <section className="rounded-[24px] border border-line bg-white p-5">
        <h3 className="font-display text-lg font-bold text-dark">Salaire</h3>
        <p className="text-xs text-muted">
          {employee.baseSalary === null ? "Salaire de base non renseigné." : `Salaire de base ${money(employee.baseSalary)}.`} Les fiches ci-dessous sont celles déjà émises.
        </p>
        <ul className="mt-3 divide-y divide-line">
          {payslips.map((slip) => (
            <li key={slip.month} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-semibold text-dark">{slip.month}</span>
              <span className="text-muted">{slip.official ? "Bulletin officiel" : `Base ${money(slip.baseSalary)} · commissions ${money(slip.commissions)}`}</span>
              <span className="font-bold text-dark">Net {money(slip.net)}</span>
            </li>
          ))}
          {payslips.length === 0 && <li className="py-2 text-sm text-muted">Aucune fiche émise.</li>}
        </ul>
      </section>

      <section className="rounded-[24px] border border-line bg-white p-5">
        <h3 className="font-display text-lg font-bold text-dark">Commissions Finance</h3>
        <p className="text-xs text-muted">Elles restent payées dans Finance. Elles n'entrent pas dans le net de la paie.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Total" value={money(commissions.total)} />
          <Stat label="Versé" value={money(commissions.paid)} />
          <Stat label="À verser" value={money(commissions.pending)} />
        </div>
        <ul className="mt-3 max-h-72 divide-y divide-line overflow-auto">
          {commissions.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-semibold text-dark">{row.student}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{fr(row.earnedAt)} · {STAGE_LABEL[row.stage] || row.stage}{row.country ? ` · ${row.country}` : ""}</span>
              </span>
              <span className="text-right">
                <span className="block font-bold text-dark">{money(row.amount)}</span>
                <span className="text-[11px] font-bold text-muted">{row.paid ? "Versée" : "À verser"}</span>
              </span>
            </li>
          ))}
          {commissions.rows.length === 0 && <li className="py-2 text-sm text-muted">Aucune commission.</li>}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-orange-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700/80">{label}</p>
      <p className="mt-0.5 font-display text-lg font-extrabold text-dark">{value}</p>
    </div>
  );
}
