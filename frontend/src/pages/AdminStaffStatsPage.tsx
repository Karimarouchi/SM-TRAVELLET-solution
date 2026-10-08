import { fetchUserPerformance, type StaffDetail, type PerfContactItem, type PerfDossierItem, type PerformancePeriod, type StaffPerformance, type PerfWorkHours } from "@/lib/auth";
import { formatWhatsAppPhone } from "@/lib/whatsapp";
import { UserAvatar } from "@/components/ui/user-avatar";
import StaffCommissionsBlock from "@/components/admin/StaffCommissionsBlock";
import StaffTimeDetail from "@/components/admin/StaffTimeDetail";
import { PERIOD_OPTIONS, PeriodSelector, StatTile, WhatsAppFunnelBars, WorkHoursNote, convertedHint, durationHint, percent, plural } from "@/components/admin/performance-ui";
import { AlertTriangle, ArrowLeft, FileCheck2, KeyRound, Mail, MessageCircle, Phone, Plane } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

function shortDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Block({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-[24px] border border-line bg-white p-4 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">{icon} {title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Liste détaillée (conversations ou dossiers), vide = message rassurant.
function DetailList({ title, empty, children, count }: { title: string; empty: string; children: ReactNode; count: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold text-dark">
        {count > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />}
        {title} <span className="text-muted">({count})</span>
      </p>
      {count ? <ul className="mt-2 max-h-72 divide-y divide-line/60 overflow-y-auto">{children}</ul> : <p className="mt-2 text-xs text-muted">{empty}</p>}
    </div>
  );
}

function ContactRow({ item, right }: { item: PerfContactItem; right: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-xs">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-dark">{item.name}</span>
        <span className="block text-[11px] text-muted">{formatWhatsAppPhone(item.phone)}</span>
      </span>
      <span className="shrink-0 text-right text-[11px] text-muted">{right}</span>
    </li>
  );
}

function DossierRow({ item }: { item: PerfDossierItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-xs">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-dark">{item.name}</span>
        <span className="block truncate text-[11px] text-muted">{item.step}</span>
      </span>
      <span className="shrink-0 font-bold text-amber-700">{item.waitingLabel}</span>
    </li>
  );
}

function SalesSection({ user }: { user: StaffPerformance }) {
  const s = user.sales!;
  const wa = s.whatsapp;
  const lists = s.lists;
  return (
    <>
      <Block icon={<MessageCircle className="h-5 w-5 text-emerald-600" />} title="WhatsApp" subtitle="Conversations dont ce conseiller est responsable.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid grid-cols-2 gap-3 self-start">
            <StatTile label="1re réponse" value={wa.firstReply.label} hint={durationHint(wa.firstReply, "conversation")} />
            <StatTile label="Temps de réponse" value={wa.reply.label} hint={durationHint(wa.reply, "réponse")} />
            <StatTile label="Taux d'aboutissement" value={percent(wa.conversionRate)} hint={convertedHint(wa.converted, wa.answered)} />
            <StatTile label="En attente" value={wa.pendingNow} hint="attendent une réponse maintenant" tone={wa.pendingNow ? "warning" : "default"} />
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Entonnoir</p>
            <div className="mt-3">
              <WhatsAppFunnelBars funnel={wa} />
            </div>
          </div>
        </div>
        {lists && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DetailList title="En attente de réponse" count={lists.pending.length} empty="Aucune conversation en attente.">
              {lists.pending.map((item) => (
                <ContactRow key={item.contactId} item={item} right={`attend depuis ${item.waitingLabel}`} />
              ))}
            </DetailList>
            <DetailList title="Non abouties (ni code, ni inscription)" count={lists.notConverted.length} empty="Toutes les conversations répondues ont abouti.">
              {lists.notConverted.map((item) => (
                <ContactRow key={item.contactId} item={item} right={shortDate(item.lastMessageAt)} />
              ))}
            </DetailList>
            <DetailList title="Jamais répondues" count={lists.unanswered.length} empty="Le conseiller a répondu à tous ses contacts.">
              {lists.unanswered.map((item) => (
                <ContactRow key={item.contactId} item={item} right={shortDate(item.lastMessageAt)} />
              ))}
            </DetailList>
          </div>
        )}
      </Block>

      <Block icon={<FileCheck2 className="h-5 w-5 text-brand" />} title="Dossiers et délais" subtitle="Du premier accès de l'étudiant jusqu'à la transmission au Responsable Visa.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Étudiants suivis" value={s.students} hint="actuellement à sa charge" />
          <StatTile label="Vérif. d'un document" value={s.documentReview.label} hint={`${plural(s.documentsValidated, "validé")} · ${plural(s.documentsRejected, "refusé")}`} />
          <StatTile label="Dossier → Resp. Dossier" value={s.handoff.label} hint={`de l'inscription à la transmission, ${durationHint(s.handoff, "dossier")}`} />
          <StatTile label="Acceptation → docs visa" value={s.acceptedToVisaDocs.label} hint={`retour au Responsable Dossier après acceptation, ${durationHint(s.acceptedToVisaDocs, "dossier")}`} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Codes créés" value={s.codes.created} hint={`dont ${plural(s.codes.sentOnWhatsapp, "envoyé")} par WhatsApp`} />
          <StatTile label="Codes utilisés" value={s.codes.used} hint="étudiants inscrits avec un de ses codes" />
          <StatTile label="À mi-parcours" value={s.halfwayDossiers} hint="dossiers qui n'avancent plus" tone={s.halfwayDossiers ? "warning" : "default"} />
        </div>
        {lists && (
          <div className="mt-4">
            <DetailList title="Dossiers à mi-parcours" count={lists.halfway.length} empty="Aucun dossier bloqué.">
              {lists.halfway.map((item, i) => (
                <DossierRow key={i} item={item} />
              ))}
            </DetailList>
          </div>
        )}
      </Block>
    </>
  );
}

function RdvSection({ user }: { user: StaffPerformance }) {
  const r = user.rdv!;
  return (
    <Block icon={<Plane className="h-5 w-5 text-brand" />} title="Responsable Visa" subtitle="Candidatures universitaires et dossiers visa qui lui sont attribués.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Dossiers en cours" value={r.dossiers} hint="attribués actuellement" />
        <StatTile label="Prêt → déposé" value={r.readyToApplied.label} hint={`dépôt de la candidature, ${durationHint(r.readyToApplied, "dossier")}`} />
        <StatTile label="Déposé → décision" value={r.appliedToDecision.label} hint={`réponse de l'université, ${durationHint(r.appliedToDecision, "dossier")}`} />
        <StatTile label="Docs visa → dépôt" value={r.visaDocsToSubmit.label} hint={`dépôt du visa, ${durationHint(r.visaDocsToSubmit, "dossier")}`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Acceptation université" value={percent(r.acceptanceRate)} hint={`${plural(r.accepted, "acceptée")} · ${plural(r.rejected, "refusée")}`} />
        <StatTile label="Visas obtenus" value={percent(r.visaAcceptanceRate)} hint={`${plural(r.visaAccepted, "obtenu")} · ${plural(r.visaRejected, "refusé")}`} />
        <StatTile label="À mi-parcours" value={r.halfwayDossiers} hint="dossiers qui n'avancent plus" tone={r.halfwayDossiers ? "warning" : "default"} />
      </div>
      {r.lists && (
        <div className="mt-4">
          <DetailList title="Dossiers à mi-parcours" count={r.lists.halfway.length} empty="Aucun dossier bloqué.">
            {r.lists.halfway.map((item, i) => (
              <DossierRow key={i} item={item} />
            ))}
          </DetailList>
        </div>
      )}
    </Block>
  );
}

export default function AdminStaffStatsPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("period") as PerformancePeriod | null;
  const [period, setPeriod] = useState<PerformancePeriod>(PERIOD_OPTIONS.some((p) => p.id === initial) ? initial! : "30");
  const [user, setUser] = useState<StaffPerformance | null>(null);
  const [workHours, setWorkHours] = useState<PerfWorkHours | null>(null);
  const [detail, setDetail] = useState<StaffDetail>({});
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetchUserPerformance(id, period)
      .then((data) => {
        setUser(data.user);
        setWorkHours(data.workHours);
        setDetail(data.detail || {});
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les statistiques."));
  }, [id, period]);

  function changePeriod(next: PerformancePeriod) {
    setPeriod(next);
    setSearchParams({ period: next }, { replace: true });
  }

  const roleLabels = (user?.roles || []).filter((r) => r === "SALES" || r === "RDV").map((r) => (r === "SALES" ? "Conseiller" : "Responsable Visa"));

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <Link to="/admin/users?tab=conseillers" className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-mid shadow-sm transition hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Utilisateurs
      </Link>

      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <p className="text-sm text-white/80">Statistiques de l'employé</p>
        {user ? (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <UserAvatar name={`${user.prenom} ${user.nom}`} size="lg" className="h-14 w-14 text-base ring-2 ring-white/40" />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{user.prenom} {user.nom}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85">
                <span>{roleLabels.join(" · ")}</span>
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
                {user.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {user.phone}</span>}
                {!user.isActive && <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold">Compte bloqué</span>}
              </p>
            </div>
          </div>
        ) : (
          <h1 className="mt-1 font-display text-2xl font-extrabold">{error ? "Introuvable" : "Chargement..."}</h1>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector value={period} onChange={changePeriod} />
        {workHours && (
          <div className="max-w-md">
            <WorkHoursNote workHours={workHours} />
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {user && (user.sales || user.rdv) && <StaffCommissionsBlock userId={user.id} name={`${user.prenom} ${user.nom}`.trim()} />}

      {user && workHours && (user.sales || user.rdv) && (
        <>
          {user.sales && <StaffTimeDetail key={`${user.id}-sales`} detail={detail} kind="sales" workHours={workHours} />}
          {user.rdv && <StaffTimeDetail key={`${user.id}-rdv`} detail={detail} kind="rdv" workHours={workHours} />}
        </>
      )}
      {user?.sales && <SalesSection user={user} />}
      {user?.rdv && <RdvSection user={user} />}
      {user && !user.sales && !user.rdv && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted"><KeyRound className="h-4 w-4" /> Aucune statistique pour ce rôle.</p>
      )}
    </main>
  );
}
