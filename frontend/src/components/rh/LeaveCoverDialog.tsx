import { fetchLeaveCoverOptions, type HrCoverOptions, type HrCoverPlan, type HrCoverScope } from "@/lib/hr";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2, Plus, Search, Trash2, UserRoundCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Row = { id: string; percent: string };
type ScopeState = { rows: Row[]; overrides: Record<string, string> };

const fr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Parts égales, le reste au premier : 3 remplaçants → 34 / 33 / 33.
function evenSplit(rows: Row[]): Row[] {
  const n = rows.length;
  if (!n) return rows;
  const base = Math.floor(100 / n);
  return rows.map((row, index) => ({ ...row, percent: String(base + (index === 0 ? 100 - base * n : 0)) }));
}

// Même règle que le serveur : tranche [from, to) sur 0..99, le dernier va jusqu'à 100.
function targetOf(bucket: number, itemId: string, rows: Row[], overrides: Record<string, string>) {
  const valid = rows.filter((row) => row.id);
  if (!valid.length) return null;
  if (overrides[itemId] && valid.some((row) => row.id === overrides[itemId])) return overrides[itemId];
  let from = 0;
  for (let index = 0; index < valid.length; index += 1) {
    const to = index === valid.length - 1 ? 100 : from + (Number(valid[index].percent) || 0);
    if (bucket >= from && bucket < to) return valid[index].id;
    from = to;
  }
  return valid[0].id;
}

export default function LeaveCoverDialog({
  employeeName,
  userId,
  startOn,
  endOn,
  leaveId,
  mode,
  onConfirm,
  onClose
}: {
  employeeName: string;
  userId: string;
  startOn: string;
  endOn: string;
  leaveId?: string | null;
  /** approve : accepter le congé avec ces remplaçants ; edit : changer les remplaçants d'un congé accepté. */
  mode: "approve" | "edit";
  onConfirm: (plan: HrCoverPlan | undefined) => Promise<void>;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<HrCoverOptions | null>(null);
  const [state, setState] = useState<Partial<Record<HrCoverScope, ScopeState>>>({});
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState<HrCoverScope | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchLeaveCoverOptions(userId, startOn, endOn, leaveId)
      .then(async (data) => {
        if (cancelled) return;
        // Pas de portefeuille à confier (congé passé, ou employé ni conseiller ni Responsable Dossier).
        if (!data.needed && mode === "approve") {
          setBusy(true);
          try {
            await onConfirm(undefined);
            onClose();
          } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Action impossible.");
            setBusy(false);
          }
          return;
        }
        const initial: Partial<Record<HrCoverScope, ScopeState>> = {};
        for (const scope of data.scopes) {
          initial[scope.scope] = scope.current
            ? { rows: scope.current.substitutes.map((row) => ({ id: row.id, percent: String(row.percent) })), overrides: { ...scope.current.overrides } }
            : { rows: [{ id: "", percent: "100" }], overrides: {} };
        }
        setState(initial);
        setOptions(data);
      })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : "Chargement impossible."); });
    return () => { cancelled = true; };
  }, [userId, startOn, endOn, leaveId]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [busy, onClose]);

  const setScope = (scope: HrCoverScope, next: (current: ScopeState) => ScopeState) =>
    setState((all) => ({ ...all, [scope]: next(all[scope] || { rows: [], overrides: {} }) }));

  const scopesWithCandidates = useMemo(
    () => (options?.scopes || []).filter((scope) => scope.candidates.some((c) => !c.unavailable)),
    [options]
  );

  const totals = useMemo(() => {
    const result: Partial<Record<HrCoverScope, number>> = {};
    for (const scope of scopesWithCandidates) {
      result[scope.scope] = (state[scope.scope]?.rows || []).reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
    }
    return result;
  }, [state, scopesWithCandidates]);

  const ready = scopesWithCandidates.every((scope) => {
    const rows = state[scope.scope]?.rows || [];
    return rows.length > 0 && rows.every((row) => row.id && Number.isInteger(Number(row.percent)) && Number(row.percent) >= 1) && totals[scope.scope] === 100
      && new Set(rows.map((row) => row.id)).size === rows.length;
  });

  async function submit() {
    setBusy(true);
    setError("");
    const plan: HrCoverPlan = {};
    for (const scope of scopesWithCandidates) {
      const current = state[scope.scope];
      if (!current) continue;
      const ids = new Set(current.rows.map((row) => row.id));
      plan[scope.scope] = {
        substitutes: current.rows.map((row) => ({ id: row.id, percent: Number(row.percent) })),
        overrides: Object.fromEntries(Object.entries(current.overrides).filter(([, sub]) => ids.has(sub)))
      };
    }
    try {
      await onConfirm(plan);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-cover-title"
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <UserRoundCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="leave-cover-title" className="font-display text-lg font-bold text-dark">
              {mode === "approve" ? "Accepter le congé et choisir les remplaçants" : "Remplaçants du congé"}
            </h3>
            <p className="text-sm font-semibold text-dark">{employeeName}</p>
            <p className="text-xs text-muted">Du {fr(startOn)} au {fr(endOn)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer" className="rounded-full p-1.5 text-muted transition hover:bg-slate-100 hover:text-dark">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadError ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
        ) : !options ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Chargement du portefeuille...</p>
        ) : (
          <>
            <p className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-[13px] leading-snug text-orange-950">
              Pendant ces dates, les remplaçants voient et traitent ses étudiants, ses conversations WhatsApp et ses nouveaux leads.
              Rien n'est déplacé : les commissions restent à {employeeName.split(" ")[0]}, qui garde la lecture seule et retrouve tout à son retour.
            </p>

            {options.scopes.map((scope) => {
              const current = state[scope.scope] || { rows: [], overrides: {} };
              const available = scope.candidates.filter((c) => !c.unavailable);
              const nameOf = (id: string) => scope.candidates.find((c) => c.id === id)?.name || "—";
              const counts = new Map<string, number>();
              for (const item of scope.items) {
                const target = targetOf(item.bucket, item.id, current.rows, current.overrides);
                if (target) counts.set(target, (counts.get(target) || 0) + 1);
              }
              const total = totals[scope.scope] ?? 0;
              const visible = scope.items.filter((item) => !search.trim() || fold(item.name).includes(fold(search.trim())));
              return (
                <section key={scope.scope} className="mt-5 rounded-[20px] border border-line p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-display font-bold text-dark">{scope.label}</h4>
                    <p className="text-xs text-muted">{scope.items.length} dossier{scope.items.length > 1 ? "s" : ""} en cours</p>
                  </div>

                  {available.length === 0 ? (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                      Personne n'est disponible pour remplacer sur ces dates : le congé sera accepté sans remplaçant pour cette partie.
                    </p>
                  ) : (
                    <>
                      <ul className="mt-3 space-y-2">
                        {current.rows.map((row, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <select
                              value={row.id}
                              onChange={(e) => setScope(scope.scope, (s) => ({ ...s, rows: s.rows.map((r, i) => (i === index ? { ...r, id: e.target.value } : r)) }))}
                              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm"
                            >
                              <option value="">Choisir un remplaçant</option>
                              {scope.candidates.map((candidate) => (
                                <option
                                  key={candidate.id}
                                  value={candidate.id}
                                  disabled={Boolean(candidate.unavailable) || current.rows.some((r, i) => i !== index && r.id === candidate.id)}
                                >
                                  {candidate.name}{candidate.unavailable ? ` · ${candidate.unavailable}` : ""}
                                </option>
                              ))}
                            </select>
                            <label className="flex items-center gap-1 text-sm font-semibold text-dark">
                              <input
                                value={row.percent}
                                onChange={(e) => setScope(scope.scope, (s) => ({ ...s, rows: s.rows.map((r, i) => (i === index ? { ...r, percent: e.target.value.replace(/[^\d]/g, "").slice(0, 3) } : r)) }))}
                                inputMode="numeric"
                                aria-label="Pourcentage"
                                className="w-16 rounded-xl border border-line px-2 py-2 text-right text-sm"
                              />
                              %
                            </label>
                            {current.rows.length > 1 && (
                              <button
                                type="button"
                                aria-label="Retirer ce remplaçant"
                                onClick={() => setScope(scope.scope, (s) => ({ ...s, rows: evenSplit(s.rows.filter((_, i) => i !== index)) }))}
                                className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {current.rows.length < available.length ? (
                          <button
                            type="button"
                            onClick={() => setScope(scope.scope, (s) => ({ ...s, rows: evenSplit([...s.rows, { id: "", percent: "0" }]) }))}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-orange-700 hover:bg-orange-50"
                          >
                            <Plus className="h-3.5 w-3.5" /> Ajouter un remplaçant
                          </button>
                        ) : <span />}
                        <span className={cn("text-xs font-bold", total === 100 ? "text-emerald-600" : "text-red-600")}>
                          Total : {total} %{total !== 100 ? " (doit faire 100 %)" : ""}
                        </span>
                      </div>

                      {current.rows.some((row) => row.id) && scope.items.length > 0 && (
                        <p className="mt-3 text-[13px] text-mid">
                          Aujourd'hui :{" "}
                          {current.rows.filter((row) => row.id).map((row) => `${nameOf(row.id)} ${counts.get(row.id) || 0}`).join(" · ")}
                        </p>
                      )}

                      {scope.items.length > 0 && current.rows.filter((row) => row.id).length > 1 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setDetailsOpen(detailsOpen === scope.scope ? null : scope.scope)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-dark"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition", detailsOpen === scope.scope && "rotate-180")} />
                            Choisir étudiant par étudiant
                          </button>
                          {detailsOpen === scope.scope && (
                            <div className="mt-2">
                              <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                                <Search className="h-4 w-4 text-muted" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher" className="min-w-0 flex-1 text-sm outline-none" />
                              </label>
                              <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                                {visible.map((item) => {
                                  const forced = current.overrides[item.id] || "";
                                  const auto = targetOf(item.bucket, item.id, current.rows, {});
                                  return (
                                    <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                                      <span className="min-w-0 truncate text-dark">{item.name}</span>
                                      <select
                                        value={forced}
                                        onChange={(e) => setScope(scope.scope, (s) => {
                                          const overrides = { ...s.overrides };
                                          if (e.target.value) overrides[item.id] = e.target.value;
                                          else delete overrides[item.id];
                                          return { ...s, overrides };
                                        })}
                                        className={cn("shrink-0 rounded-lg border border-line px-2 py-1 text-xs", forced && "border-orange-300 bg-orange-50 font-semibold")}
                                      >
                                        <option value="">Auto ({auto ? nameOf(auto) : "—"})</option>
                                        {current.rows.filter((row) => row.id).map((row) => (
                                          <option key={row.id} value={row.id}>{nameOf(row.id)}</option>
                                        ))}
                                      </select>
                                    </li>
                                  );
                                })}
                                {visible.length === 0 && <li className="px-3 py-2 text-sm text-muted">Aucun résultat.</li>}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })}

            {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-line py-2.5 text-sm font-bold text-mid">Annuler</button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !ready}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-orange-600 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "approve" ? "Accepter le congé" : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
