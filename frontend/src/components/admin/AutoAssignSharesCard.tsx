import { fetchAutoAssignShares, saveAutoAssignShares, type AutoAssignMode, type AutoAssignSettings } from "@/lib/auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { AlertTriangle, Ban, CheckCircle2, Percent, RotateCcw, Save, Scale } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Paramètres → répartition des nouveaux arrivants entre les conseillers :
// équitable (par charge) ou par pourcentage (ex. 40 % / 40 % / 20 %).
export default function AutoAssignSharesCard() {
  const [data, setData] = useState<AutoAssignSettings | null>(null);
  const [mode, setMode] = useState<AutoAssignMode>("balanced");
  const [percents, setPercents] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function apply(next: AutoAssignSettings) {
    setData(next);
    setMode(next.mode);
    setPercents(Object.fromEntries(next.shares.map((s) => [s.salesId, s.percent])));
  }

  useEffect(() => {
    fetchAutoAssignShares()
      .then(apply)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger la répartition."));
  }, []);

  const active = useMemo(() => (data?.shares || []).filter((s) => s.isActive), [data]);
  const blocked = useMemo(() => (data?.shares || []).filter((s) => !s.isActive), [data]);
  const total = active.reduce((sum, s) => sum + (percents[s.salesId] || 0), 0);
  const remaining = 100 - total;
  const valid = total === 100;

  const dirty =
    !!data &&
    (mode !== data.mode ||
      (mode === "percentage" && data.shares.some((s) => s.isActive && (percents[s.salesId] ?? 0) !== s.percent)));

  function setPercent(salesId: string, raw: string) {
    const value = raw === "" ? 0 : Math.min(100, Math.max(0, Math.round(Number(raw))));
    setPercents((current) => ({ ...current, [salesId]: Number.isFinite(value) ? value : 0 }));
    setSaved(false);
    setError("");
  }

  // Parts égales ; le reste de la division va aux premiers conseillers (33/33/34).
  function splitEvenly() {
    if (!active.length) return;
    const base = Math.floor(100 / active.length);
    const extra = 100 - base * active.length;
    setPercents((current) => ({ ...current, ...Object.fromEntries(active.map((s, i) => [s.salesId, base + (i < extra ? 1 : 0)])) }));
    setSaved(false);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const next = await saveAutoAssignShares({
        mode,
        shares: active.map((s) => ({ salesId: s.salesId, percent: percents[s.salesId] || 0 }))
      });
      apply(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const modes: { id: AutoAssignMode; icon: typeof Scale; title: string; text: string }[] = [
    { id: "balanced", icon: Scale, title: "Équitable (par charge)", text: "Le nouvel arrivant va au conseiller qui a le moins de monde." },
    { id: "percentage", icon: Percent, title: "Par pourcentage", text: "Vous fixez la part de chaque conseiller, par exemple 40 % / 40 % / 20 %." }
  ];

  return (
    <section className="mt-4 rounded-[24px] border border-line bg-white p-4 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-dark">
        <Percent className="h-5 w-5 text-brand" /> Répartition par pourcentage
      </h2>
      <p className="mt-1 text-xs text-muted">
        Comment répartir les nouveaux arrivants entre les conseillers : les nouveaux contacts WhatsApp (toujours) et les étudiants sans
        conseiller (si l'affectation automatique ci-dessus est activée).
      </p>

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {!data ? (
        !error && <p className="mt-4 text-sm text-muted">Chargement...</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Mode de répartition">
            {modes.map((item) => {
              const selected = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => { setMode(item.id); setSaved(false); setError(""); }}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                    selected ? "border-brand bg-brand-light/50 shadow-[0_0_0_3px_rgba(109,40,217,0.1)]" : "border-line bg-white hover:border-brand/40"
                  )}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", selected ? "bg-brand text-white" : "bg-slate-100 text-muted")}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-dark">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">{item.text}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {mode === "percentage" && (
            <div className="mt-5">
              {!active.length ? (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Aucun conseiller actif : créez ou débloquez un conseiller pour fixer des pourcentages.</p>
              ) : (
                <>
                  <ul className="divide-y divide-line/70 rounded-2xl border border-line">
                    {active.map((s) => {
                      const value = percents[s.salesId] ?? 0;
                      const name = `${s.prenom} ${s.nom}`.trim();
                      return (
                        <li key={s.salesId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                          <div className="flex min-w-0 flex-1 basis-48 items-center gap-2.5">
                            <UserAvatar name={name} size="sm" className="h-8 w-8 shrink-0 text-[10px]" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-dark">{name}</p>
                              <p className="text-[11px] text-muted">
                                A reçu {s.receivedWhatsapp} contact{s.receivedWhatsapp > 1 ? "s" : ""} WhatsApp · {s.receivedStudents} étudiant{s.receivedStudents > 1 ? "s" : ""} depuis ce réglage
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-1 basis-56 items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={value}
                              onChange={(e) => setPercent(s.salesId, e.target.value)}
                              aria-label={`Part de ${name}`}
                              className="h-2 min-w-0 flex-1 cursor-pointer accent-[#6d28d9]"
                            />
                            <label className="flex shrink-0 items-center gap-1">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={100}
                                value={value}
                                onChange={(e) => setPercent(s.salesId, e.target.value)}
                                aria-label={`Pourcentage de ${name}`}
                                // 16 px : évite le zoom automatique d'iOS au toucher du champ.
                                className="w-16 rounded-lg border border-line bg-slate-50 px-2 py-1.5 text-right text-base font-bold text-dark outline-none focus:border-brand"
                              />
                              <span className="text-sm font-bold text-muted">%</span>
                            </label>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Total : doit faire exactement 100 %. */}
                  <div
                    role="status"
                    className={cn(
                      "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm",
                      valid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                    )}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      {valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      Total : {total} %
                    </span>
                    <span className="text-xs">
                      {valid ? "Le total fait 100 %, vous pouvez enregistrer." : remaining > 0 ? `Il reste ${remaining} % à répartir.` : `${-remaining} % de trop.`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className={cn("h-full rounded-full transition-all", valid ? "bg-emerald-500" : total > 100 ? "bg-red-400" : "bg-amber-400")} style={{ width: `${Math.min(total, 100)}%` }} />
                  </div>

                  <button
                    type="button"
                    onClick={splitEvenly}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Parts égales
                  </button>
                </>
              )}

              {blocked.length > 0 && (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted">
                  <Ban className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    Comptes bloqués, qui ne reçoivent rien : {blocked.map((s) => `${s.prenom} ${s.nom}`.trim()).join(", ")}.
                  </span>
                </p>
              )}
              <p className="mt-3 text-[11px] leading-snug text-muted">
                Les pourcentages comptent les <strong>nouveaux arrivants</strong> à partir de l'enregistrement : sur 10 nouveaux, 4 / 4 / 2 pour 40 / 40 / 20. Les compteurs
                repartent de zéro à chaque changement. Si un conseiller est bloqué, les parts des autres sont recalées sur 100 %. Un conseiller ajouté ensuite reçoit
                0 % tant que vous ne lui donnez pas de part.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || (mode === "percentage" && !valid)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Répartition enregistrée
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
