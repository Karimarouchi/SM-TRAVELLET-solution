import EmployeePicker from "@/components/rh/EmployeePicker";
import { acceptHrAbsence, downloadHrPdf, fetchHrAbsences, submitHrAbsence, type HrAbsenceEmployee, type HrAbsenceMonth } from "@/lib/hr";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const fr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const until = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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

function label(day: HrAbsenceEmployee["days"][number]) {
  const fact = day.status === "NO_REPLY" ? "Sans réponse" : day.status === "ABSENT" ? "Absence" : [day.lateMinutes ? `${day.lateMinutes} min de retard` : "", day.earlyMinutes ? `${day.earlyMinutes} min en avance` : ""].filter(Boolean).join(", ") || "Retard";
  if (day.accepted) return `${fact} · justifiée`;
  if (day.submitted) return `${fact} · hors délai`;
  return fact;
}

export default function RhAbsencesPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<HrAbsenceMonth | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();

  const load = (value = month) =>
    fetchHrAbsences(value)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => data?.employees.find((row) => row.id === selectedId) || null, [data, selectedId]);

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
          <h1 className="font-display text-2xl font-extrabold text-dark">Absences</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {data ? `Seules les absences validées dans Présences apparaissent ici. Un certificat déposé dans les ${data.certDelayHours} h retire la retenue.` : "Certificats des journées validées."}
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
            hint={(row) => {
              const pending = row.days.filter((day) => !day.accepted).length;
              return pending ? `${pending} à justifier` : "Rien à justifier";
            }}
          />
          <section className="overflow-hidden rounded-[24px] border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-orange-50 text-[11px] uppercase tracking-wide text-orange-800">
                <tr>
                  <th className="px-4 py-2 font-bold">Jour</th>
                  <th className="px-2 py-2 font-bold">État</th>
                  <th className="px-2 py-2 font-bold">Limite</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {selected.days.map((day) => (
                  <tr key={day.day}>
                    <td className="px-4 py-2.5 font-semibold text-dark">{fr(day.day)}</td>
                    <td className="px-2 py-2.5 text-muted">{label(day)}</td>
                    <td className="px-2 py-2.5 text-muted">{until(day.deadline)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-2">
                        {day.submitted && (
                          <button type="button" onClick={() => void downloadHrPdf(`/api/admin/hr/absences/file?userId=${selected.id}&day=${day.day}`, day.filename || "certificat").catch((err) => setError(err instanceof Error ? err.message : "Téléchargement impossible."))} className="text-[11px] font-bold text-dark">Voir</button>
                        )}
                        {day.submitted && !day.accepted && (
                          <button type="button" disabled={busy} onClick={() => void run(() => acceptHrAbsence(selected.id, day.day))} className="text-[11px] font-bold text-orange-700">Accepter</button>
                        )}
                        <label className="text-[11px] font-bold text-orange-700">
                          {day.submitted ? "Remplacer" : "Déposer"}
                          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void run(() => readFile(file).then((body) => submitHrAbsence(selected.id, day.day, file.name, body))); }} />
                        </label>
                      </span>
                    </td>
                  </tr>
                ))}
                {selected.days.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-sm text-muted">Rien à justifier sur cette période.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </main>
  );
}
