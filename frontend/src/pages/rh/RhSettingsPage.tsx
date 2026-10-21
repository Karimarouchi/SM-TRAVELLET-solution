import { addHrHoliday, fetchHrBrandPreview, fetchHrBranding, fetchHrHolidays, fetchHrSettings, removeHrHoliday, saveHrBrandFile, saveHrSettings, setHrHolidayPaid, type HrHoliday, type HrSettings } from "@/lib/hr";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function RhSettingsPage() {
  const [settings, setSettings] = useState<HrSettings | null>(null);
  const [holidays, setHolidays] = useState<HrHoliday[] | null>(null);
  const [day, setDay] = useState("");
  const [label, setLabel] = useState("");
  const [paid, setPaid] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState<{ hasSignature: boolean; hasStamp: boolean } | null>(null);
  const [brandTick, setBrandTick] = useState(0);

  useEffect(() => {
    fetchHrSettings().then(setSettings).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
    fetchHrHolidays().then(setHolidays).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
    fetchHrBranding().then(setBrand).catch(() => setBrand({ hasSignature: false, hasStamp: false }));
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      setSettings(await saveHrSettings(settings));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await addHrHoliday(day, label.trim(), paid);
      setHolidays((prev) => [...(prev || []), created].sort((a, b) => a.day.localeCompare(b.day)));
      setDay("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout impossible.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError("");
    try {
      await removeHrHoliday(id);
      setHolidays((prev) => (prev || []).filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const switchPaid = async (row: HrHoliday) => {
    setError("");
    try {
      const updated = await setHrHolidayPaid(row.id, !row.paid);
      setHolidays((prev) => (prev || []).map((item) => item.id === row.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    }
  };

  const visible = (holidays || []).filter((row) => row.day.startsWith(year));
  const months = [...new Set(visible.map((row) => row.day.slice(5, 7)))];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold text-dark">Jours fériés et règles</h1>
      <p className="mt-1 text-sm text-muted">Un jour férié ne comptera ni comme une absence ni comme un retard.</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <section className="mt-6 rounded-[24px] border border-line bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold text-dark">Règles de calcul</h2>
        {!settings ? (
          <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-orange-500" />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-mid">
              Un jour de salaire = salaire ÷
              <input
                type="number"
                min={1}
                max={31}
                value={settings.dayDivisor}
                onChange={(e) => setSettings({ ...settings, dayDivisor: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500"
              />
            </label>
            <label className="block text-xs font-bold text-mid">
              Certificat médical sous (heures)
              <input
                type="number"
                min={1}
                max={240}
                value={settings.certDelayHours}
                onChange={(e) => setSettings({ ...settings, certDelayHours: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500"
              />
            </label>
            <label className="block text-xs font-bold text-mid sm:col-span-2">
              Le pointage automatique commence le
              <input
                type="date"
                value={settings.attendanceSince}
                onChange={(e) => setSettings({ ...settings, attendanceSince: e.target.value })}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500"
              />
              <span className="mt-1 block font-medium text-muted">Avant cette date, aucun jour n'est pointé. La journée en cours n'apparaît qu'après l'heure de fin.</span>
            </label>
            <label className="block text-xs font-bold text-mid sm:col-span-2">
              Préavis de congé = durée ×
              <input
                type="number"
                min={0}
                max={30}
                value={settings.leaveNoticeFactor}
                onChange={(e) => setSettings({ ...settings, leaveNoticeFactor: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500"
              />
              <span className="mt-1 block font-medium text-muted">Exemple : 2 et un congé de 4 jours. La demande de l'employé doit partir au plus tard 8 jours avant le début. Sinon elle n'est pas enregistrée. 0 désactive le préavis. Vous pouvez toujours poser un congé vous-même.</span>
            </label>
            <label className="block text-xs font-bold text-mid sm:col-span-2">
              Alerte fin de CDD, jours avant
              <input
                type="number"
                min={0}
                max={365}
                value={settings.cddNoticeDays}
                onChange={(e) => setSettings({ ...settings, cddNoticeDays: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500"
              />
              <span className="mt-1 block font-medium text-muted">Exemple : 15. Un CDD qui se termine le 30 novembre prévient les administrateurs à partir du 15 novembre. Une seule notification par date de fin. 0 désactive l'alerte.</span>
            </label>
            <div className="sm:col-span-2 flex items-center justify-end gap-3">
              {saved && <span className="text-xs font-bold text-emerald-600">Enregistré</span>}
              <button type="button" disabled={busy} onClick={() => void saveSettings()} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
                Enregistrer les règles
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold text-dark">Jours fériés</h2>
        <p className="mt-1 text-sm text-muted">Le calendrier tunisien est déjà chargé. Cliquez sur Payé ou Impayé pour le changer. Un jour payé est chômé sans retenue. Un jour impayé reste un férié, avec une journée de salaire retenue.</p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-mid">
            Date
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 block rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
          </label>
          <label className="min-w-[180px] flex-1 text-xs font-bold text-mid">
            Nom
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Fête de l'Indépendance" className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
          </label>
          <label className="text-xs font-bold text-mid">
            Type
            <select value={paid ? "paid" : "unpaid"} onChange={(e) => setPaid(e.target.value === "paid")} className="mt-1 block rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orange-500">
              <option value="paid">Payé</option>
              <option value="unpaid">Impayé</option>
            </select>
          </label>
          <button type="button" disabled={busy || !day || !label.trim()} onClick={() => void add()} className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-40">
            Ajouter
          </button>
        </div>
        <label className="mt-4 block text-xs font-bold text-mid">
          Année affichée
          <select value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm">
            {[...new Set([String(new Date().getFullYear()), ...(holidays || []).map((row) => row.day.slice(0, 4))])].sort().map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {months.map((month) => (
            <div key={month} className="rounded-2xl border border-line p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">{new Date(`${year}-${month}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long" })}</p>
              <ul className="mt-2 space-y-2">
                {visible.filter((row) => row.day.slice(5, 7) === month).map((row) => (
                  <li key={row.id} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-xs font-bold text-dark">{row.day.slice(8, 10)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-dark">{row.label}</span>
                    <button type="button" onClick={() => void switchPaid(row)} className={row.paid ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700" : "shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"}>{row.paid ? "Payé" : "Impayé"}</button>
                    <button type="button" onClick={() => void remove(row.id)} aria-label={`Retirer ${row.label}`} className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {holidays && visible.length === 0 && <p className="mt-3 text-sm text-muted">Aucun jour férié sur {year}.</p>}
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold text-dark">Signature et cachet</h2>
        <p className="mt-1 text-sm text-muted">Ils sont imprimés sur les fiches de paie et les attestations. Une image PNG ou JPEG.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <BrandSlot kind="signature" label="Signature" ready={Boolean(brand?.hasSignature)} tick={brandTick} busy={busy} onDone={(value) => { setBrand(value); setBrandTick((n) => n + 1); }} onError={setError} />
          <BrandSlot kind="stamp" label="Cachet" ready={Boolean(brand?.hasStamp)} tick={brandTick} busy={busy} onDone={(value) => { setBrand(value); setBrandTick((n) => n + 1); }} onError={setError} />
        </div>
      </section>
    </main>
  );
}

function BrandSlot({ kind, label, ready, tick, busy, onDone, onError }: { kind: "signature" | "stamp"; label: string; ready: boolean; tick: number; busy: boolean; onDone: (value: { hasSignature: boolean; hasStamp: boolean }) => void; onError: (value: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [slotError, setSlotError] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(ready);

  useEffect(() => {
    if (!ready) {
      setPreview(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let url = "";
    setLoading(true);
    fetchHrBrandPreview(kind).then((next) => {
      if (cancelled) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      url = next || "";
      setPreview(next);
      setLoading(false);
      if (!next) setSlotError("Le fichier est introuvable sur le serveur.");
    }).catch((err) => {
      if (!cancelled) {
        setLoading(false);
        setSlotError(err instanceof Error ? err.message : "Aperçu impossible.");
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [kind, ready, tick]);

  return (
    <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-bold text-dark">
        {label}
        {preview && <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
      </p>
      {preview ? (
        <img src={preview} alt={label} className="mt-3 h-28 w-full rounded-xl border border-line bg-white object-contain" />
      ) : (
        <p className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-orange-200 bg-white text-xs text-muted">Aucune image</p>
      )}
      <p className="mt-2 text-xs text-muted">{sending ? "Envoi de l'image..." : preview ? "Image enregistrée. Choisir un fichier le remplace." : loading ? "Chargement de l'image..." : "Pas encore déposée."}</p>
      {slotError && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">{slotError}</p>}
      <label className="mt-2 block text-xs">
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy || sending}
          className="block w-full text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setSending(true);
            setSlotError("");
            const reader = new FileReader();
            reader.onload = () => {
              saveHrBrandFile(kind, String(reader.result || ""))
                .then((value) => {
                  onDone(value);
                  if (kind === "signature" ? value.hasSignature : value.hasStamp) setSlotError("");
                  else setSlotError("L'image n'a pas été enregistrée sur le serveur.");
                })
                .catch((err) => {
                  const message = err instanceof Error ? err.message : "Dépôt impossible.";
                  setSlotError(message);
                  onError(message);
                })
                .finally(() => setSending(false));
            };
            reader.onerror = () => {
              setSending(false);
              setSlotError("Lecture du fichier impossible.");
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
    </div>
  );
}
