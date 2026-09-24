import {
  fetchArchive,
  fetchAdminDashboard,
  fetchArchiveSettings,
  updateArchiveSettings,
  purgeArchive,
  getSession,
  type ArchivedEntry,
  type ArchiveSettings
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Archive,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Search,
  UserRound,
  X,
  CalendarCheck,
  Settings,
  Trash2,
  Save,
  AlertTriangle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 15;

type StatusInfo = { label: string; color: string; dot: string };

function statusInfo(status: string, dossierStage: string | null): StatusInfo {
  if (dossierStage === "COMPLETED" || status === "ACCEPTED") {
    return { label: "Complété", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
  }
  if (status === "CLOSED") {
    return { label: "Clôturé", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
  }
  if (status === "REJECTED") {
    return { label: "Refusé", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" };
  }
  return { label: status, color: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-500" };
}

function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const sz = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-sm";
  if (src) return <img src={src} alt={name} className={cn("rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm", sz)} />;
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full bg-gradient-to-br from-brand to-violet-600 font-bold text-white shrink-0 ring-2 ring-white shadow-sm", sz)}>
      {initials || "?"}
    </span>
  );
}

export default function ArchivePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const session = getSession();
  const role = session?.user.role;
  const isAdmin = role === "ADMIN";

  const [entries, setEntries] = useState<ArchivedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterSales, setFilterSales] = useState("");
  const [page, setPage] = useState(1);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ArchiveSettings>({ enabled: false, days: 30 });
  const [savingSettings, setSavingSettings] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ students: number, files: number } | null>(null);

  // Admin filters data
  const [salesList, setSalesList] = useState<Array<{ id: string; prenom: string; nom: string }>>([]);

  const load = async (params?: { search?: string }) => {
    setLoading(true);
    try {
      const data = await fetchArchive({
        search: params?.search || search || undefined,
        salesId: filterSales || undefined
      });
      setEntries(data.entries);
      setPage(1);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l'archive.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isAdmin) {
      fetchAdminDashboard({}).then((d) => {
        setSalesList(d.filters.sales || []);
      }).catch(() => undefined);
      
      fetchArchiveSettings().then((s) => {
        setSettings(s);
      }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSales]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateArchiveSettings(settings);
      setShowSettings(false);
    } catch (err) {
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleManualPurge = async () => {
    if (!confirm("Voulez-vous vraiment purger les documents des dossiers archivés ? Cette action supprimera définitivement les fichiers physiques correspondants.")) return;
    setPurging(true);
    try {
      const res = await purgeArchive();
      setPurgeResult({ students: res.purgedStudents, files: res.purgedFiles });
      setTimeout(() => setPurgeResult(null), 5000);
    } catch (err) {
      alert("Erreur lors de la purge.");
    } finally {
      setPurging(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      load({ search: searchInput.trim() });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Client-side country filter
  const countries = useMemo(
    () => [...new Set(entries.map((e) => e.countryName))].sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    if (!filterCountry) return entries;
    return entries.filter((e) => e.countryName === filterCountry);
  }, [entries, filterCountry]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const stats = useMemo(() => ({
    total: filtered.length,
    completed: filtered.filter((e) => e.dossierStage === "COMPLETED").length,
    closed: filtered.filter((e) => e.status === "CLOSED").length,
    rejected: filtered.filter((e) => e.status === "REJECTED").length
  }), [filtered]);

  const backHref = role === "ADMIN" ? "/admin" : role === "SALES" ? "/conseiller" : "/rdv";

  if (!session?.user) return null;

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
      {/* ── Hero Banner ─────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0533] via-brand to-violet-600 p-6 sm:p-8 text-white shadow-[0_24px_60px_rgba(109,40,217,.30)]">
        <span className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-8 left-16 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl" />

        <div className="relative">
          <div className="flex justify-between items-center mb-4">
            <button
              type="button"
              onClick={() => navigate(backHref)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/20 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("Retour", "Back")}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/20 transition"
              >
                <Settings className="h-3.5 w-3.5" />
                {t("Réglages de purge", "Purge settings")}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                  <Archive className="h-5 w-5" />
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold">
                  {t("Archive des dossiers", "File Archive")}
                </h1>
              </div>
              <p className="text-sm text-white/80 max-w-lg">
                {isAdmin
                  ? t("Tous les dossiers complétés, clôturés ou refusés.", "All completed, closed, or rejected files.")
                  : t("Vos dossiers complétés, clôturés ou refusés.", "Your completed, closed, or rejected files.")
                }
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-2 text-center">
                <p className="text-2xl font-extrabold">{stats.total}</p>
                <p className="text-[11px] text-white/70">{t("Dossiers", "Files")}</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/30 backdrop-blur px-4 py-2 text-center">
                <p className="text-2xl font-extrabold">{stats.completed}</p>
                <p className="text-[11px] text-white/70">{t("Complétés", "Completed")}</p>
              </div>
              <div className="rounded-2xl bg-slate-500/30 backdrop-blur px-4 py-2 text-center">
                <p className="text-2xl font-extrabold">{stats.closed}</p>
                <p className="text-[11px] text-white/70">{t("Clôturés", "Closed")}</p>
              </div>
              <div className="rounded-2xl bg-red-500/30 backdrop-blur px-4 py-2 text-center">
                <p className="text-2xl font-extrabold">{stats.rejected}</p>
                <p className="text-[11px] text-white/70">{t("Refusés", "Rejected")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────── */}
      <div className="mt-6 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder={t("Rechercher un étudiant…", "Search a student…")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl border border-line bg-white pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); load({ search: "" }); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark transition">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Country filter */}
        <select
          value={filterCountry}
          onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
        >
          <option value="">{t("Tous les pays", "All countries")}</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Sales filter - Admin only */}
        {isAdmin && salesList.length > 0 && (
          <select
            value={filterSales}
            onChange={(e) => setFilterSales(e.target.value)}
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
          >
            <option value="">{t("Tous les conseillers", "All advisors")}</option>
            {salesList.map((s) => (
              <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Error ───────────────────────── */}
      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          <X className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── Table / Content ─────────────── */}
      {loading ? (
        <div className="mt-20 flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="text-sm text-muted">{t("Chargement de l'archive…", "Loading archive…")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-4 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/10">
            <Archive className="h-10 w-10 text-brand/50" />
          </span>
          <p className="font-display text-xl font-bold text-dark">
            {t("Aucun dossier archivé", "No archived files")}
          </p>
          <p className="text-sm text-muted max-w-xs">
            {t(
              "Les dossiers complétés, clôturés ou refusés apparaîtront ici.",
              "Completed, closed, or rejected files will appear here."
            )}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <p className="mb-3 text-xs text-muted font-medium">
            {filtered.length} {t("dossier(s) archivé(s)", "archived file(s)")}
            {filterCountry && ` · ${filterCountry}`}
          </p>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">{t("Étudiant", "Student")}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">{t("Destination", "Destination")}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">{t("Conseiller", "Advisor")}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">{t("RDV", "RDV")}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">{t("Statut", "Status")}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">{t("Date", "Date")}</th>
                  {(role === "ADMIN" || role === "SALES") && (
                    <th className="px-4 py-3"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginated.map((entry) => {
                  const s = statusInfo(entry.status, entry.dossierStage);
                  const date = entry.decisionAt || entry.updatedAt;
                  const dateStr = date ? new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                  return (
                    <tr key={entry.id} className="group hover:bg-slate-50/60 transition-colors">
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={entry.studentName} src={entry.studentAvatarUrl} size="sm" />
                          <div>
                            <p className="font-semibold text-dark">{entry.studentName}</p>
                            <p className="text-[11px] text-muted">{entry.studentEmail}</p>
                            {entry.studentNationality && (
                              <p className="text-[10px] text-muted/70">{entry.studentNationality}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                          <div>
                            <p className="font-semibold text-dark">{entry.countryName}</p>
                            <p className="text-[11px] text-muted">{entry.universityName}</p>
                          </div>
                        </div>
                      </td>

                      {/* Sales */}
                      <td className="px-4 py-3">
                        {entry.salesName ? (
                          <div className="flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                            <span className="text-sm text-dark">{entry.salesName}</span>
                          </div>
                        ) : (
                          <span className="text-muted text-xs italic">—</span>
                        )}
                      </td>

                      {/* RDV */}
                      <td className="px-4 py-3">
                        {entry.rdvName ? (
                          <div className="flex items-center gap-1.5">
                            <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                            <span className="text-sm text-dark">{entry.rdvName}</span>
                          </div>
                        ) : (
                          <span className="text-muted text-xs italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", s.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                          {s.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-sm text-muted tabular-nums whitespace-nowrap">{dateStr}</td>

                      {/* Detail link (Sales/Admin only) */}
                      {(role === "ADMIN" || role === "SALES") && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/conseiller/etudiants/${entry.studentId}`)}
                            className="rounded-lg bg-brand/10 px-3 py-1.5 text-[11px] font-bold text-brand hover:bg-brand hover:text-white transition"
                          >
                            {t("Détail", "Details")}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {paginated.map((entry) => {
              const s = statusInfo(entry.status, entry.dossierStage);
              const date = entry.decisionAt || entry.updatedAt;
              const dateStr = date ? new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
              return (
                <div key={entry.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={entry.studentName} src={entry.studentAvatarUrl} size="sm" />
                      <div>
                        <p className="font-bold text-dark">{entry.studentName}</p>
                        <p className="text-[11px] text-muted">{entry.studentEmail}</p>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0", s.color)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                      {s.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("Pays", "Country")}</p>
                      <p className="font-semibold text-dark">{entry.countryName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("Université", "University")}</p>
                      <p className="text-dark line-clamp-1">{entry.universityName}</p>
                    </div>
                    {entry.salesName && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("Conseiller", "Advisor")}</p>
                        <p className="text-dark">{entry.salesName}</p>
                      </div>
                    )}
                    {entry.rdvName && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">RDV</p>
                        <p className="text-dark">{entry.rdvName}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[11px] text-muted">{dateStr}</p>
                    {(role === "ADMIN" || role === "SALES") && (
                      <button
                        type="button"
                        onClick={() => navigate(`/conseiller/etudiants/${entry.studentId}`)}
                        className="rounded-lg bg-brand/10 px-3 py-1.5 text-[11px] font-bold text-brand hover:bg-brand hover:text-white transition"
                      >
                        {t("Voir le dossier", "View file")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-muted hover:border-brand hover:text-brand disabled:opacity-40 transition shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-muted">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item as number)}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold transition shadow-sm",
                        page === item
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-white text-dark hover:border-brand hover:text-brand"
                      )}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-muted hover:border-brand hover:text-brand disabled:opacity-40 transition shadow-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-dark/60 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h3 className="font-display text-lg font-bold text-dark">{t("Réglages de purge", "Purge settings")}</h3>
              <button onClick={() => setShowSettings(false)} className="rounded-full p-1.5 text-muted hover:bg-slate-100 hover:text-dark transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="mb-4 text-sm text-muted">
                {t("Supprimez physiquement les documents des dossiers archivés (complétés, clôturés ou refusés) pour libérer de l'espace.", "Physically delete documents of archived files (completed, closed, or rejected) to free up space.")}
              </p>
              
              <div className="rounded-2xl border border-line p-4 mb-6">
                <label className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-dark">{t("Purge automatique", "Automatic purge")}</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      settings.enabled ? "bg-brand" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        settings.enabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </label>
                
                <div className={cn("transition-opacity", !settings.enabled && "opacity-50 pointer-events-none")}>
                  <label className="block text-xs font-semibold text-muted mb-1">{t("Délai (en jours) après archivage", "Delay (in days) after archiving")}</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.days}
                    onChange={(e) => setSettings({ ...settings, days: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end mb-8">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-dark px-4 py-2 text-sm font-bold text-white hover:bg-dark/90 disabled:opacity-50 transition"
                >
                  <Save className="h-4 w-4" />
                  {savingSettings ? t("Enregistrement...", "Saving...") : t("Enregistrer", "Save")}
                </button>
              </div>

              <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-700">{t("Purge manuelle immédiate", "Immediate manual purge")}</h4>
                    <p className="mt-1 text-xs text-red-600/80 mb-3">
                      {t("Supprime définitivement tous les documents de tous les dossiers actuellement archivés, sans tenir compte du délai.", "Permanently deletes all documents from all currently archived files, regardless of the delay.")}
                    </p>
                    <button
                      onClick={handleManualPurge}
                      disabled={purging}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {purging ? t("Purge en cours...", "Purging...") : t("Purger tout maintenant", "Purge all now")}
                    </button>
                    {purgeResult && (
                      <p className="mt-2 text-xs font-bold text-emerald-600">
                        {t("Terminé !", "Done !")} {purgeResult.students} {t("étudiant(s)", "student(s)")}, {purgeResult.files} {t("fichier(s) supprimé(s).", "file(s) deleted.")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </main>
  );
}
