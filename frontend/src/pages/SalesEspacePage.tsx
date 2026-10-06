import { StageBadge } from "@/components/admin/StudentsPipelineBoard";
import MyCommissionsCard from "@/components/MyCommissionsCard";
import { PassportBadge } from "@/components/PassportBadge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { fetchSalesOverview, formatMoney, getSession, type PipelineStageKey, type SalesAttentionItem, type SalesOverview, type SalesOverviewStudent } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { fetchWhatsAppUnread } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  KeyRound,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
  Trophy,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Filter = "all" | "attention" | "docs" | "payment" | "onboarding" | "application" | "visa" | "done";
type Sort = "priority" | "recent" | "name";

const FAMILIES: Record<Exclude<Filter, "all" | "attention" | "docs" | "payment">, PipelineStageKey[]> = {
  onboarding: ["onboarding", "no_application"],
  application: ["ready_to_apply", "applied", "waiting_response", "interview", "rejected"],
  visa: ["accepted", "visa_preparation", "visa_submitted", "visa_rejected"],
  done: ["completed"]
};

const TONE: Record<SalesAttentionItem["tone"], string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-violet-200 bg-violet-50 text-violet-700"
};

function matchesFilter(student: SalesOverviewStudent, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return student.attention.length > 0;
    case "docs":
      return student.docs.toReview > 0;
    case "payment":
      return Boolean(student.payment?.late);
    default:
      return FAMILIES[filter].includes(student.stage);
  }
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function fullName(student: SalesOverviewStudent) {
  return `${student.prenom} ${student.nom}`.trim();
}

function AttentionChips({ items, limit = 3 }: { items: SalesAttentionItem[]; limit?: number }) {
  if (!items.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.slice(0, limit).map((item) => (
        <span key={item.key} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", TONE[item.tone])}>
          {item.tone === "danger" ? <AlertTriangle className="h-2.5 w-2.5" aria-hidden /> : null}
          {item.text}
        </span>
      ))}
      {items.length > limit && <span className="text-[10px] font-bold text-muted">+{items.length - limit}</span>}
    </span>
  );
}

function PaymentBadge({ payment }: { payment: SalesOverviewStudent["payment"] }) {
  if (!payment) return <span className="text-[11px] text-muted">—</span>;
  if (payment.late) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
        <AlertTriangle className="h-2.5 w-2.5" aria-hidden /> En retard
      </span>
    );
  }
  if (payment.status === "PAID") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-2.5 w-2.5" aria-hidden /> Payé</span>;
  }
  const rest = payment.remaining[0];
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">{payment.status === "PARTIAL" ? "Partiel" : "À payer"}</span>
      {rest && <span className="mt-0.5 text-[10px] text-muted">reste {formatMoney(rest.amount, rest.currency)}</span>}
    </span>
  );
}

function DocsCell({ docs }: { docs: SalesOverviewStudent["docs"] }) {
  if (!docs.toReview && !docs.rejected && !docs.validated) return <span className="text-[11px] text-muted">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {docs.toReview > 0 && <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{docs.toReview} à valider</span>}
      {docs.rejected > 0 && <span className="text-[10px] font-semibold text-red-600">{docs.rejected} refusé{docs.rejected > 1 ? "s" : ""}</span>}
      {docs.validated > 0 && <span className="text-[10px] text-muted">{docs.validated} validé{docs.validated > 1 ? "s" : ""}</span>}
    </span>
  );
}

function RowActions({ student, compact = false }: { student: SalesOverviewStudent; compact?: boolean }) {
  const { t } = useLanguage();
  const wa = whatsappHref(student.phone);
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${fullName(student)}`} title="WhatsApp" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-600 hover:text-white">
          <MessageCircle className="h-4 w-4" aria-hidden />
        </a>
      )}
      <Link to={`/conseiller/etudiants/${student.id}`} className={cn("inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-hover", compact && "px-2.5")}>
        {t("Ouvrir", "Open")} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </span>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick
}: {
  icon: typeof Users;
  label: string;
  value: ReactNode;
  hint: string;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group min-w-0 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        active ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-brand/40"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold leading-none text-dark">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </button>
  );
}

export default function SalesEspacePage() {
  const { t } = useLanguage();
  const session = getSession();
  const [data, setData] = useState<SalesOverview | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("priority");
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchSalesOverview()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger vos étudiants.", "Unable to load your students.")));
    const refresh = () => fetchWhatsAppUnread().then((u) => setUnread(u.unread)).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const students = data?.students || [];
  const urgent = useMemo(() => students.filter((s) => s.attention.length > 0).slice(0, 6), [students]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) => matchesFilter(s, filter) && (!q || `${s.prenom} ${s.nom} ${s.email} ${s.phone}`.toLowerCase().includes(q)));
    if (sort === "recent") return [...list].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (sort === "name") return [...list].sort((a, b) => fullName(a).localeCompare(fullName(b)));
    return list;
  }, [students, filter, search, sort]);

  if (!session?.user) return null;
  const k = data?.kpis;

  const FILTERS: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: t("Tous", "All"), count: students.length },
    { id: "attention", label: t("À traiter", "To handle"), count: k?.needAttention || 0 },
    { id: "onboarding", label: t("Onboarding / sans candidature", "Onboarding / no application"), count: students.filter((s) => matchesFilter(s, "onboarding")).length },
    { id: "application", label: t("Candidature", "Application"), count: students.filter((s) => matchesFilter(s, "application")).length },
    { id: "visa", label: t("Visa", "Visa"), count: students.filter((s) => matchesFilter(s, "visa")).length },
    { id: "done", label: t("Terminés", "Completed"), count: students.filter((s) => matchesFilter(s, "done")).length }
  ];

  const toggle = (next: Filter) => {
    setFilter((current) => (current === next ? "all" : next));
    document.getElementById("mes-etudiants")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm text-white/75">{t("Espace conseiller", "Advisor area")}</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{t("Bonjour", "Hello")}, {session.user.prenom}</h1>
            <p className="mt-2 max-w-xl text-sm text-white/85">
              {!k
                ? t("Chargement de votre journée…", "Loading your day…")
                : k.needAttention
                  ? t(`${k.students} étudiant${k.students > 1 ? "s" : ""} suivis · ${k.needAttention} dossier${k.needAttention > 1 ? "s" : ""} à traiter aujourd'hui.`, `${k.students} students · ${k.needAttention} file(s) to handle today.`)
                  : t(`${k.students} étudiant${k.students > 1 ? "s" : ""} suivis · tout est à jour, bravo !`, `${k.students} students · everything is up to date, well done!`)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/conseiller/codes" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand transition hover:bg-violet-50">
              <KeyRound className="h-4 w-4" aria-hidden /> {t("Générer un code", "Generate a code")}
            </Link>
            <Link to="/whatsapp" className="relative inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/25">
              <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
              {unread > 0 && <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-extrabold text-emerald-950">{unread}</span>}
            </Link>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* ── Indicateurs (cliquables : ils filtrent la liste) ─────────── */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={t("Indicateurs", "Indicators")}>
        <KpiTile icon={ClipboardCheck} label={t("À traiter", "To handle")} value={k?.needAttention ?? "–"} hint={t("dossiers demandant une action", "files needing action")} tone="bg-amber-100 text-amber-600" active={filter === "attention"} onClick={() => toggle("attention")} />
        <KpiTile icon={FileCheck2} label={t("Documents", "Documents")} value={k?.docsToReview ?? "–"} hint={t("à valider", "to review")} tone="bg-sky-100 text-sky-600" active={filter === "docs"} onClick={() => toggle("docs")} />
        <KpiTile icon={Banknote} label={t("Paiements", "Payments")} value={k?.paymentsLate ?? "–"} hint={t("en retard", "overdue")} tone="bg-red-100 text-red-600" active={filter === "payment"} onClick={() => toggle("payment")} />
        <KpiTile icon={GraduationCap} label={t("En cours", "In progress")} value={k?.inProgress ?? "–"} hint={t("candidatures et visas", "applications and visas")} tone="bg-violet-100 text-brand" active={filter === "application"} onClick={() => toggle("application")} />
        <KpiTile icon={Trophy} label={t("Visas obtenus", "Visas granted")} value={k?.visasObtained ?? "–"} hint={t("dossiers terminés", "completed files")} tone="bg-emerald-100 text-emerald-600" active={filter === "done"} onClick={() => toggle("done")} />
      </section>

      {/* ── À traiter maintenant + commissions ──────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="urgent-title" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="urgent-title" className="flex items-center gap-2 font-display text-lg font-bold text-dark">
              <Sparkles className="h-5 w-5 text-brand" aria-hidden /> {t("À traiter maintenant", "To handle now")}
            </h2>
            {k && k.needAttention > urgent.length && (
              <button type="button" onClick={() => toggle("attention")} className="text-xs font-bold text-brand hover:underline">
                {t(`Voir les ${k.needAttention}`, `See all ${k.needAttention}`)}
              </button>
            )}
          </div>
          {!data ? (
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("Chargement…", "Loading…")}</div>
          ) : urgent.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" aria-hidden /></span>
              <div>
                <p className="text-sm font-bold text-emerald-800">{t("Rien d'urgent", "Nothing urgent")}</p>
                <p className="text-xs text-emerald-700">{t("Aucun dossier ne demande d'action pour l'instant.", "No file needs action right now.")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {urgent.map((student) => (
                <div key={student.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-sm transition hover:border-brand/40 sm:flex-nowrap">
                  <UserAvatar name={fullName(student)} src={student.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/conseiller/etudiants/${student.id}`} className="truncate text-sm font-extrabold text-dark hover:text-brand">{fullName(student)}</Link>
                      <StageBadge stage={student.stage} />
                    </div>
                    <div className="mt-1.5"><AttentionChips items={student.attention} /></div>
                  </div>
                  <RowActions student={student} />
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          <MyCommissionsCard />
          <section className="rounded-[20px] border border-line bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-bold text-dark">{t("Où en sont mes étudiants", "Where my students stand")}</h2>
            <div className="mt-3 space-y-2.5">
              {FILTERS.filter((f) => !["all", "attention"].includes(f.id)).map((f) => (
                <button key={f.id} type="button" onClick={() => toggle(f.id)} className="block w-full text-left">
                  <span className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-mid">{f.label}</span>
                    <span className="font-extrabold text-dark">{f.count}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${students.length ? (f.count / students.length) * 100 : 0}%` }} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* ── Mes étudiants ───────────────────────────────────────────── */}
      <section id="mes-etudiants" className="mt-8 scroll-mt-24">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-dark">
          <Users className="h-5 w-5 text-brand" aria-hidden /> {t("Mes étudiants", "My students")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
                filter === f.id ? "border-brand bg-brand text-white" : "border-line bg-white text-mid hover:border-brand/40"
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-[10px]", filter === f.id ? "bg-white/25" : "bg-slate-100 text-muted")}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Rechercher un étudiant, e-mail, téléphone…", "Search a student, email, phone…")}
              className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-sm" role="group" aria-label={t("Trier", "Sort")}>
            {([["priority", t("Priorité", "Priority")], ["recent", t("Récents", "Recent")], ["name", t("Nom", "Name")]] as Array<[Sort, string]>).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setSort(id)} aria-pressed={sort === id} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", sort === id ? "bg-brand text-white shadow" : "text-muted hover:text-dark")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {data && visible.length === 0 && (
          <p className="mt-4 rounded-[20px] border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            {students.length === 0 ? t("Aucun étudiant ne vous est encore affecté.", "No student has been assigned to you yet.") : t("Aucun étudiant ne correspond à ce filtre.", "No student matches this filter.")}
          </p>
        )}

        {visible.length > 0 && (
          <>
            {/* Ordinateur : tableau */}
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-line bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">{t("Étudiant", "Student")}</th>
                    <th className="px-3 py-3">{t("Étape", "Stage")}</th>
                    <th className="px-3 py-3">{t("Documents", "Documents")}</th>
                    <th className="px-3 py-3">{t("Passeport", "Passport")}</th>
                    <th className="px-3 py-3">{t("Paiement", "Payment")}</th>
                    <th className="px-4 py-3 text-right">{t("Actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {visible.map((student) => (
                    <tr key={student.id} className="align-top transition hover:bg-brand/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={fullName(student)} src={student.avatarUrl} size="lg" />
                          <div className="min-w-0">
                            <Link to={`/conseiller/etudiants/${student.id}`} className="block truncate text-sm font-bold text-dark hover:text-brand">{fullName(student)}</Link>
                            <p className="truncate text-[11px] text-muted">{student.preferredCountries.join(", ") || student.email}</p>
                            {student.attention.length > 0 && <div className="mt-1.5"><AttentionChips items={student.attention} limit={2} /></div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StageBadge stage={student.stage} />
                        {student.application && <p className="mt-1 max-w-[180px] truncate text-[11px] text-muted">{student.application.universityName}{student.application.fieldOfStudy ? ` · ${student.application.fieldOfStudy}` : ""}</p>}
                        {student.nextInterviewAt && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700">
                            <CalendarClock className="h-3 w-3" aria-hidden /> {new Date(student.nextInterviewAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3"><DocsCell docs={student.docs} /></td>
                      <td className="px-3 py-3"><PassportBadge status={student.passport.status} expiresOn={student.passport.expiresOn} monthsLeft={student.passport.monthsLeft} /></td>
                      <td className="px-3 py-3"><PaymentBadge payment={student.payment} /></td>
                      <td className="px-4 py-3"><div className="flex justify-end"><RowActions student={student} compact /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Téléphone : cartes */}
            <div className="mt-4 space-y-3 md:hidden">
              {visible.map((student) => (
                <article key={student.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={fullName(student)} src={student.avatarUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/conseiller/etudiants/${student.id}`} className="block truncate text-sm font-extrabold text-dark">{fullName(student)}</Link>
                      <p className="truncate text-[11px] text-muted">{student.preferredCountries.join(", ") || student.email}</p>
                      <div className="mt-2"><StageBadge stage={student.stage} /></div>
                    </div>
                  </div>
                  {student.attention.length > 0 && <div className="mt-3"><AttentionChips items={student.attention} limit={3} /></div>}
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5">
                    <div><p className="text-[10px] font-bold uppercase text-muted">{t("Docs", "Docs")}</p><div className="mt-1"><DocsCell docs={student.docs} /></div></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted">{t("Passeport", "Passport")}</p><div className="mt-1"><PassportBadge status={student.passport.status} monthsLeft={student.passport.monthsLeft} /></div></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted">{t("Paiement", "Payment")}</p><div className="mt-1"><PaymentBadge payment={student.payment} /></div></div>
                  </div>
                  <div className="mt-3 flex justify-end"><RowActions student={student} /></div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
