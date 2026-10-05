import DocumentsSummaryCard from "@/components/DocumentsSummaryCard";
import DossierProgress from "@/components/espace/DossierProgress";
import { buildSteps } from "@/components/espace/dossierSteps";
import ReviewCard from "@/components/espace/ReviewCard";
import { PassportBadge } from "@/components/PassportBadge";
import UniversityChoicesPanel from "@/components/UniversityChoicesPanel";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  fetchMe,
  fetchMyApplications,
  fetchMyDocuments,
  fetchMyPayments,
  fetchMyUniversityChoices,
  fetchMyVisaChecklist,
  formatMoney,
  getSession,
  type StudentDocumentChecklistItem,
  type StudentPaymentsSummary,
  type StudentProfile,
  type UniversityApplication,
  type VisaDocumentChecklistItem
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { monthsLeft as passportMonthsLeft, parseExpiry } from "@/lib/passport";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderOpen,
  GraduationCap,
  MessageSquare,
  Plane,
  Rocket,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

const WHATSAPP_HREF = "https://wa.me/21657031130";

type Tone = "danger" | "warning" | "info";
type Todo = { key: string; tone: Tone; icon: typeof FileText; title: string; text: string; to?: string; href?: string; cta: string };

const TODO_STYLES: Record<Tone, { box: string; icon: string; button: string }> = {
  danger: { box: "border-red-200 bg-red-50/60", icon: "bg-red-100 text-red-600", button: "bg-red-600 hover:bg-red-700" },
  warning: { box: "border-amber-200 bg-amber-50/60", icon: "bg-amber-100 text-amber-700", button: "bg-amber-600 hover:bg-amber-700" },
  info: { box: "border-violet-200 bg-violet-50/60", icon: "bg-violet-100 text-brand", button: "bg-brand hover:bg-brand-hover" }
};

// Indicateur : titre, valeur, détail, barre optionnelle ; cliquable.
function StatTile({
  icon: Icon,
  label,
  to,
  scrollTo,
  children,
  progress,
  accent = "text-brand bg-brand/10"
}: {
  icon: typeof FileText;
  label: string;
  /** Page à ouvrir. */
  to?: string;
  /** Ou zone de cette page vers laquelle défiler (id). */
  scrollTo?: string;
  children: ReactNode;
  progress?: number;
  accent?: string;
}) {
  const className = "group block w-full min-w-0 rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md";
  const Wrapper = ({ children: inner }: { children: ReactNode }) =>
    to ? (
      <Link to={to} className={className}>{inner}</Link>
    ) : (
      <button type="button" className={className} onClick={() => document.getElementById(scrollTo || "")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
        {inner}
      </button>
    );
  return (
    <Wrapper>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      </div>
      <div className="mt-3">{children}</div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
    </Wrapper>
  );
}

export default function EspacePage() {
  const { t } = useLanguage();
  const session = getSession();
  const [profile, setProfile] = useState<StudentProfile | null>(session?.profile || null);
  const [applications, setApplications] = useState<UniversityApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StudentDocumentChecklistItem[]>([]);
  const [visaDocuments, setVisaDocuments] = useState<VisaDocumentChecklistItem[]>([]);
  const [visaCountryName, setVisaCountryName] = useState("");
  const [payments, setPayments] = useState<StudentPaymentsSummary | null>(null);
  const [choiceCount, setChoiceCount] = useState<{ used: number; limit: number } | null>(null);

  const load = () => {
    fetchMe().then((data) => setProfile(data.profile || null)).catch(() => undefined);
    fetchMyApplications().then(setApplications).catch(() => undefined);
    fetchMyDocuments().then(setDocuments).catch(() => undefined);
    fetchMyVisaChecklist()
      .then((data) => {
        setVisaCountryName(data.application?.countryName || "");
        setVisaDocuments(data.checklist);
      })
      .catch(() => undefined);
    fetchMyPayments().then(setPayments).catch(() => undefined);
    fetchMyUniversityChoices().then((data) => setChoiceCount({ used: data.used, limit: data.limit })).catch(() => undefined);
  };

  useEffect(load, []);

  const activeApplications = useMemo(() => applications.filter((a) => a.status !== "CLOSED"), [applications]);
  const shown = activeApplications.length ? activeApplications : applications;
  const selected = shown.find((a) => a.id === selectedId) || shown[0] || null;
  const dossierStage = profile?.dossierStage || "DOCUMENTS";
  const salesName = profile?.assignedSalesName || "";

  const journey = useMemo(() => buildSteps({ dossierStage, application: selected, t }), [dossierStage, selected, t]);

  const docsDone = documents.filter((d) => d.status === "SUBMITTED" || d.status === "VALIDATED").length;
  const docsValidated = documents.filter((d) => d.status === "VALIDATED").length;

  // Paiements : une ligne par monnaie.
  const totals = useMemo(() => {
    const byCurrency = new Map<string, { paid: number; total: number }>();
    for (const plan of payments?.plans || []) {
      const entry = byCurrency.get(plan.currency) || { paid: 0, total: 0 };
      entry.paid += plan.paidTotal;
      entry.total += plan.total;
      byCurrency.set(plan.currency, entry);
    }
    return [...byCurrency.entries()].map(([currency, v]) => ({ currency, ...v }));
  }, [payments]);

  // « À faire maintenant » : les actions utiles, les plus urgentes d'abord.
  const todos = useMemo<Todo[]>(() => {
    const list: Todo[] = [];
    const rejected = documents.filter((d) => d.status === "REJECTED").length;
    const missing = documents.filter((d) => d.required && d.status === "PENDING").length;
    if (rejected) {
      list.push({ key: "docs-rejected", tone: "danger", icon: FileText, title: t(`${rejected} document${rejected > 1 ? "s" : ""} à renvoyer`, `${rejected} document${rejected > 1 ? "s" : ""} to resend`), text: t("Votre conseiller a refusé un document : consultez le motif et déposez-le à nouveau.", "Your advisor rejected a document: check the reason and upload it again."), to: "/documents", cta: t("Renvoyer", "Resend") });
    }
    if (missing) {
      list.push({ key: "docs-missing", tone: "warning", icon: FolderOpen, title: t(`${missing} document${missing > 1 ? "s" : ""} à déposer`, `${missing} document${missing > 1 ? "s" : ""} to upload`), text: t("Un dossier complet permet de postuler plus vite.", "A complete file lets you apply faster."), to: "/documents", cta: t("Déposer", "Upload") });
    }
    const visaToDo = visaDocuments.filter((d) => d.required && (d.status === "PENDING" || d.status === "REJECTED")).length;
    if (visaToDo) {
      list.push({ key: "visa-docs", tone: "warning", icon: Plane, title: t(`${visaToDo} document${visaToDo > 1 ? "s" : ""} visa à fournir`, `${visaToDo} visa document${visaToDo > 1 ? "s" : ""} to provide`), text: t("Ils sont nécessaires avant le dépôt de votre dossier visa.", "They are needed before your visa file is submitted."), to: "/documents?tab=visa", cta: t("Voir", "View") });
    }
    for (const plan of payments?.plans || []) {
      if (!plan.tranche1.complete) {
        list.push({ key: `pay1-${plan.id}`, tone: "warning", icon: Banknote, title: t(`Tranche inscription à régler : ${formatMoney(plan.tranche1.remaining, plan.currency)}`, `Registration instalment due: ${formatMoney(plan.tranche1.remaining, plan.currency)}`), text: t(`${plan.countryName} · à régler auprès de votre conseiller.`, `${plan.countryName} · to be paid to your advisor.`), cta: "" });
      } else if (!plan.tranche2.complete && (dossierStage === "VISA" || selected?.visaStatus)) {
        list.push({ key: `pay2-${plan.id}`, tone: "warning", icon: Banknote, title: t(`Tranche visa à régler : ${formatMoney(plan.tranche2.remaining, plan.currency)}`, `Visa instalment due: ${formatMoney(plan.tranche2.remaining, plan.currency)}`), text: t(`${plan.countryName} · à régler avant le dépôt de votre visa.`, `${plan.countryName} · due before your visa is filed.`), cta: "" });
      }
    }
    const status = profile?.passportStatus;
    if (status === "EXPIRED" || status === "EXPIRING") {
      list.push({ key: "passport", tone: status === "EXPIRED" ? "danger" : "warning", icon: ShieldCheck, title: status === "EXPIRED" ? t("Passeport expiré", "Passport expired") : t("Passeport à renouveler", "Passport to renew"), text: t("Il doit rester au moins 24 mois de validité pour la plupart des démarches.", "Most procedures require at least 24 months of validity."), to: "/profil", cta: t("Mettre à jour", "Update") });
    } else if (status === "UNKNOWN" || (status === "NONE" && profile?.hasPassport === null)) {
      list.push({ key: "passport-info", tone: "info", icon: ShieldCheck, title: t("Renseignez votre passeport", "Add your passport details"), text: t("Numéro et date d'expiration : votre conseiller en a besoin pour votre dossier.", "Number and expiry date: your advisor needs them for your file."), to: "/profil", cta: t("Compléter", "Complete") });
    }
    if (selected?.interviewDate && selected.status === "INTERVIEW_SCHEDULED") {
      const when = new Date(selected.interviewDate);
      if (when.getTime() > Date.now() - 2 * 3600 * 1000) {
        list.push({ key: "interview", tone: "info", icon: CalendarClock, title: t("Entretien programmé", "Interview scheduled"), text: `${selected.universityName} · ${when.toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}`, href: selected.interviewLink || undefined, cta: selected.interviewLink ? t("Rejoindre", "Join") : "" });
      }
    }
    const rank: Record<Tone, number> = { danger: 0, warning: 1, info: 2 };
    return list.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [documents, visaDocuments, payments, profile, selected, dossierStage, t]);

  if (!session?.user) return null;
  const { user } = session;
  const passportDate = profile?.passportExpiresOn ? parseExpiry(profile.passportExpiresOn) : null;
  const progressPct = journey.steps.length ? Math.round((journey.doneCount / journey.steps.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      {/* ── En-tête : accueil + conseiller ───────────────────────────── */}
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="text-sm text-white/75">{t("Espace étudiant", "Student area")}</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
              {t("Bonjour", "Hello")}, {user.prenom}
            </h1>
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold backdrop-blur">
              {journey.tone === "danger" ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> : <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="truncate">{journey.headline}</span>
            </div>
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
                <span>{t("Avancement du dossier", "File progress")}</span>
                <span>{journey.doneCount} / {journey.steps.length}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/12 p-5 backdrop-blur ring-1 ring-white/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{t("Votre conseiller", "Your advisor")}</p>
            <div className="mt-3 flex items-center gap-3">
              {salesName ? (
                <UserAvatar name={salesName} size="md" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20"><UserRound className="h-6 w-6" aria-hidden /></span>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold">{salesName || t("En cours d'attribution", "Being assigned")}</p>
                <p className="text-xs text-white/75">{salesName ? t("Vous accompagne pas à pas", "Guides you step by step") : t("Un conseiller vous sera attribué", "An advisor will be assigned to you")}</p>
              </div>
            </div>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand transition hover:bg-violet-50"
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> {t("Écrire sur WhatsApp", "Message on WhatsApp")}
            </a>
          </div>
        </div>
      </section>

      {/* ── À faire maintenant ───────────────────────────────────────── */}
      <section className="mt-6" aria-labelledby="todo-title">
        <h2 id="todo-title" className="mb-3 font-display text-lg font-bold text-dark">{t("À faire maintenant", "To do now")}</h2>
        {todos.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" aria-hidden /></span>
            <div>
              <p className="text-sm font-bold text-emerald-800">{t("Tout est à jour", "Everything is up to date")}</p>
              <p className="text-xs text-emerald-700">{t("Votre conseiller s'occupe de la suite et vous préviendra.", "Your advisor is handling the next steps and will notify you.")}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {todos.slice(0, 4).map((todo) => {
              const s = TODO_STYLES[todo.tone];
              const Icon = todo.icon;
              const action = todo.cta ? (
                todo.to ? (
                  <Link to={todo.to} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition", s.button)}>
                    {todo.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : (
                  <a href={todo.href} target="_blank" rel="noreferrer" className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition", s.button)}>
                    {todo.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )
              ) : null;
              return (
                <div key={todo.key} className={cn("flex items-center gap-3 rounded-2xl border p-4", s.box)}>
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.icon)}><Icon className="h-5 w-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-dark">{todo.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-mid">{todo.text}</p>
                  </div>
                  {action}
                </div>
              );
            })}
          </div>
        )}
        {todos.length > 4 && <p className="mt-2 text-xs text-muted">{t(`+ ${todos.length - 4} autre(s) action(s) dans votre dossier.`, `+ ${todos.length - 4} more action(s) in your file.`)}</p>}
      </section>

      {/* ── Indicateurs ──────────────────────────────────────────────── */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("Indicateurs du dossier", "File indicators")}>
        <StatTile icon={FolderOpen} label={t("Documents", "Documents")} to="/documents" progress={documents.length ? (docsDone / documents.length) * 100 : 0}>
          <p className="font-display text-2xl font-extrabold text-dark">
            {docsDone}<span className="text-base font-bold text-muted"> / {documents.length}</span>
          </p>
          <p className="text-[11px] text-muted">{documents.length ? t(`déposés · ${docsValidated} validé${docsValidated > 1 ? "s" : ""}`, `uploaded · ${docsValidated} approved`) : t("Aucun document requis", "No document required")}</p>
        </StatTile>
        <StatTile icon={GraduationCap} label={t("Candidatures", "Applications")} scrollTo="candidatures" progress={choiceCount ? (choiceCount.used / choiceCount.limit) * 100 : 0} accent="bg-sky-100 text-sky-600">
          <p className="font-display text-2xl font-extrabold text-dark">
            {choiceCount?.used ?? 0}<span className="text-base font-bold text-muted"> / {choiceCount?.limit ?? 3}</span>
          </p>
          <p className="text-[11px] text-muted">{t("facultés visées", "target programs")}</p>
        </StatTile>
        <StatTile icon={Banknote} label={t("Paiements", "Payments")} scrollTo="paiements" accent="bg-emerald-100 text-emerald-600" progress={totals.length === 1 && totals[0].total ? (totals[0].paid / totals[0].total) * 100 : undefined}>
          {totals.length ? (
            totals.map((row) => (
              <p key={row.currency} className="font-display text-lg font-extrabold leading-tight text-dark">
                {formatMoney(row.paid, row.currency)}<span className="text-xs font-bold text-muted"> / {formatMoney(row.total, row.currency)}</span>
              </p>
            ))
          ) : (
            <p className="font-display text-2xl font-extrabold text-muted">—</p>
          )}
          <p className="text-[11px] text-muted">{totals.length ? t("payés / prix total", "paid / total price") : t("Aucun paiement à suivre", "No payment to track")}</p>
        </StatTile>
        <StatTile icon={ShieldCheck} label={t("Passeport", "Passport")} to="/profil" accent="bg-amber-100 text-amber-600">
          <div className="min-h-[2rem]">
            <PassportBadge status={profile?.passportStatus || "UNKNOWN"} expiresOn={profile?.passportExpiresOn} monthsLeft={passportDate ? passportMonthsLeft(passportDate) : null} />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {passportDate ? t(`Expire le ${passportDate.toLocaleDateString("fr-FR")}`, `Expires ${passportDate.toLocaleDateString("fr-FR")}`) : t("Date non renseignée", "Date not set")}
          </p>
        </StatTile>
      </section>

      {/* ── Contenu principal + colonne latérale ─────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <div id="candidatures" className="scroll-mt-24 [&>section]:mt-0">
            <UniversityChoicesPanel onChanged={load} />
          </div>
          <DossierProgress dossierStage={dossierStage} applications={shown} selectedId={selected?.id || null} onSelect={setSelectedId} onRefresh={load} />
        </div>

        <aside className="min-w-0 space-y-4">
          <section id="paiements" className="scroll-mt-24 rounded-[24px] border border-line bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
              <Banknote className="h-5 w-5 text-brand" aria-hidden /> {t("Mes paiements", "My payments")}
            </h2>
            {!payments?.plans.length ? (
              <p className="mt-2 text-xs leading-relaxed text-muted">{t("Aucun plan de paiement à suivre pour le moment. Vos reçus apparaîtront ici.", "No payment plan to track yet. Your receipts will appear here.")}</p>
            ) : (
              <div className="mt-3 space-y-4">
                {payments.plans.map((plan) => (
                  <div key={plan.id}>
                    <p className="text-sm font-bold text-dark">{plan.countryName} · {formatMoney(plan.total, plan.currency)}</p>
                    <div className="mt-2 space-y-1.5">
                      {([["1", t("Inscription", "Registration"), plan.tranche1], ["2", t("Visa", "Visa"), plan.tranche2]] as const).map(([n, label, tranche]) => (
                        <div key={n} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                          <span className="font-semibold text-mid">{t("Tranche", "Instalment")} {n} · {label}</span>
                          {tranche.complete ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {formatMoney(tranche.due, plan.currency)}</span>
                          ) : (
                            <span className="font-bold text-amber-700">{t("Reste", "Left")} {formatMoney(tranche.remaining, plan.currency)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {payments.payments.length > 0 && (
                  <div className="border-t border-line/70 pt-3">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{t("Derniers reçus", "Latest receipts")}</p>
                    <ul className="space-y-1.5">
                      {payments.payments.slice(0, 3).map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-brand">{p.receiptNumber || "—"}</span>
                          <span className="text-muted">{new Date(p.paidAt).toLocaleDateString("fr-FR")} · {p.methodLabel}</span>
                          <span className="font-bold text-dark">{formatMoney(p.amount, p.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <DocumentsSummaryCard
            icon={FolderOpen}
            title={t("Documents", "Documents")}
            subtitle={t("Checklist des documents requis pour votre inscription.", "Checklist of documents required for your enrollment.")}
            total={documents.length}
            done={docsDone}
            doneLabel={t("déposés", "uploaded")}
            emptyLabel={t("Choisissez un pays préféré dans votre profil pour voir la liste.", "Choose a preferred country in your profile to see the list.")}
            to="/documents"
          />
          {selected?.visaStatus && (
            <DocumentsSummaryCard
              icon={Plane}
              title={t("Documents visa", "Visa documents")}
              subtitle={t(`Documents requis pour votre demande de visa${visaCountryName ? ` · ${visaCountryName}` : ""}.`, `Documents required for your visa application${visaCountryName ? ` · ${visaCountryName}` : ""}.`)}
              total={visaDocuments.length}
              done={visaDocuments.filter((d) => d.status === "VALIDATED").length}
              doneLabel={t("validés", "approved")}
              emptyLabel={t("Aucun document visa requis pour l'instant.", "No visa document required yet.")}
              to="/documents?tab=visa"
            />
          )}

          <section className="rounded-[24px] border border-line bg-white p-2 shadow-sm" aria-label={t("Accès rapides", "Quick links")}>
            {[
              { to: "/profil", icon: UserRound, label: t("Mon profil", "My profile"), text: t("Informations personnelles et projet", "Personal information and project") },
              { to: "/documents", icon: FolderOpen, label: t("Mes documents", "My documents"), text: t("Déposer et suivre mes fichiers", "Upload and track my files") },
              { to: "/accelerateur", icon: Rocket, label: t("Accélérateur", "Accelerator"), text: t("Parcours guidé pour avancer plus vite", "Guided path to move faster") }
            ].map((link) => (
              <Link key={link.to} to={link.to} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-brand/5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><link.icon className="h-[18px] w-[18px]" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-dark">{link.label}</span>
                  <span className="block truncate text-[11px] text-muted">{link.text}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
            ))}
          </section>
        </aside>
      </div>

      <div className="mt-6">
        <ReviewCard />
      </div>
    </main>
  );
}
