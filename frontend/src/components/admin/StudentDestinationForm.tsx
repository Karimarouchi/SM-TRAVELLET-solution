import { FancySelect } from "@/components/ui/fancy-select";
import { fetchCountryPricing, fetchPublicCountries, formatMoney, setStudentDestination, type Country, type CountryPricing, type StudentProfile } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function StudentDestinationForm({
  studentId,
  profile,
  onSaved
}: {
  studentId: string;
  profile: StudentProfile;
  onSaved: (profile: StudentProfile) => void;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState("");
  const [levelId, setLevelId] = useState(profile.targetLevelId || "");
  const [pricing, setPricing] = useState<CountryPricing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPublicCountries().then((list) => {
      setCountries(list.filter((country) => country.active));
      const current = list.find((country) => country.name === profile.preferredCountries[0]);
      if (current) setCountryId(current.id);
    }).catch(() => setCountries([]));
  }, [profile.preferredCountries]);

  useEffect(() => {
    if (!countryId) {
      setPricing(null);
      return;
    }
    fetchCountryPricing(countryId).then(setPricing).catch(() => setPricing(null));
  }, [countryId]);

  const levels = pricing?.levels || [];
  const tariff = levels.length ? levels.find((level) => level.levelId === levelId) : pricing?.configured ? pricing : null;

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await setStudentDestination(studentId, { countryId, levelId: levelId || undefined });
      onSaved(next.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col-span-2 rounded-2xl border border-violet-100 bg-violet-50/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Changer le pays et le niveau</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">L'argent déjà encaissé reste. Le reste à payer est recalculé sur le nouveau tarif.</p>
      <div className="mt-3 grid gap-2">
        <FancySelect
          value={countryId}
          onChange={(id) => {
            setCountryId(id);
            setLevelId("");
            setSaved(false);
          }}
          options={countries.map((country) => ({ value: country.id, label: country.name }))}
          placeholder="Pays"
        />
        {levels.length > 0 && (
          <FancySelect
            value={levelId}
            onChange={(id) => {
              setLevelId(id);
              setSaved(false);
            }}
            options={levels.map((level) => ({ value: level.levelId, label: level.levelName }))}
            placeholder="Niveau"
          />
        )}
      </div>
      {tariff && tariff.tranche1 !== null && tariff.tranche2 !== null && (
        <p className="mt-2 text-xs font-semibold text-dark">
          Nouveau tarif : inscription {formatMoney(tariff.tranche1, tariff.currency)} · visa {formatMoney(tariff.tranche2, tariff.currency)}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && <p className="mt-2 text-xs font-bold text-emerald-600">Destination mise à jour.</p>}
      <button type="button" disabled={busy || !countryId || (levels.length > 0 && !levelId)} onClick={save} className="mt-3 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
        {busy ? "Enregistrement…" : "Enregistrer la destination"}
      </button>
    </div>
  );
}
