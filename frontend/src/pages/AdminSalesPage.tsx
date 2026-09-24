import {
  assignApplicationRdv,
  createRdvAccount,
  fetchAssignmentBoard,
  fetchPublicCountries,
  fetchRdvAssignments,
  fetchRdvStudents,
  fetchRdvUsers,
  fetchUnassignedVisaApplications,
  fetchUserAccess,
  setRdvCountries,
  setUserPermissions,
  setUserRoles,
  type AssignmentBoard,
  type BoardSales,
  type Country,
  type RdvAssignment,
  type RdvStudent,
  type RdvUser,
  type UnassignedVisaApplication
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Coins, GraduationCap, LayoutGrid, List, Mail, MapPinOff, Phone, Plus, ShieldCheck, Trophy, UserCog, Users, Users2, X } from "lucide-react";
import { DragEvent, useEffect, useState } from "react";
import AdminAssignment from "@/pages/AdminAssignment";
import CommissionsPanel from "@/components/admin/CommissionsPanel";

const RDV_STATUS_META: Record<string, { label: string; color: string }> = {
  READY_TO_APPLY: { label: "Prêt à postuler", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  APPLIED: { label: "Déposée", color: "bg-blue-50 text-blue-700 border-blue-200" },
  WAITING_UNIVERSITY_RESPONSE: { label: "En attente de l'université", color: "bg-amber-50 text-amber-700 border-amber-200" },
  INTERVIEW_REQUIRED: { label: "Entretien demandé", color: "bg-violet-50 text-violet-700 border-violet-200" },
  INTERVIEW_SCHEDULED: { label: "Entretien planifié", color: "bg-violet-50 text-violet-700 border-violet-200" },
  INTERVIEW_COMPLETED: { label: "Entretien terminé", color: "bg-violet-50 text-violet-700 border-violet-200" },
  ACCEPTED: { label: "Accepté", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Refusé", color: "bg-red-50 text-red-600 border-red-200" },
  CLOSED: { label: "Clôturé", color: "bg-slate-100 text-slate-500 border-slate-200" }
};

const ADDITIONAL_ROLES = [
  { value: "SALES", label: "Conseiller (Sales)" },
  { value: "RDV", label: "Responsable dossier visa (RDV)" },
  { value: "ADMIN", label: "Administrateur" }
];
const ROLE_LABELS: Record<string, string> = { SALES: "Sales", RDV: "Responsable dossier visa", ADMIN: "Administrateur", STUDENT: "Étudiant" };
const PERMISSIONS = [
  { value: "MANAGE_PROGRAMMES", label: "Gérer les programmes" },
  { value: "MANAGE_COUNTRIES", label: "Gérer les pays, documents et universités" },
  { value: "MANAGE_VISA_DOCUMENTS", label: "Gérer les documents visa par destination" },
  { value: "MANAGE_AVIS", label: "Gérer les avis et témoignages" }
];

/* ─── Modal : rôles additionnels + permissions ─────────────── */
function AccessModal({ userId, name, onClose, onSaved }: { userId: string; name: string; onClose: () => void; onSaved: () => void }) {
  const [baseRole, setBaseRole] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUserAccess(userId)
      .then((access) => {
        setBaseRole(access.baseRole);
        setRoles(access.roles.filter((r) => r !== access.baseRole));
        setPermissions(access.permissions);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur."))
      .finally(() => setLoading(false));
  }, [userId]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await setUserRoles(userId, [baseRole, ...roles]);
      await setUserPermissions(userId, permissions);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-dark">Accès de {name}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
        ) : (
          <>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted">Rôles additionnels</p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">
                <input type="checkbox" checked disabled className="h-4 w-4" /> {ROLE_LABELS[baseRole] || baseRole} <span className="text-[10px] uppercase">(rôle de base)</span>
              </label>
              {ADDITIONAL_ROLES.filter((r) => r.value !== baseRole).map((r) => (
                <label key={r.value} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input type="checkbox" checked={roles.includes(r.value)} onChange={() => toggle(roles, setRoles, r.value)} className="h-4 w-4 accent-brand" />
                  {r.label}
                </label>
              ))}
            </div>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-muted">Permissions additionnelles</p>
            <div className="mt-2 space-y-2">
              {PERMISSIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input type="checkbox" checked={permissions.includes(p.value)} onChange={() => toggle(permissions, setPermissions, p.value)} className="h-4 w-4 accent-brand" />
                  {p.label}
                </label>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={saving || loading} onClick={save} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal : nouveau compte RDV ───────────────────────────── */
function NewRdvModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await createRdvAccount(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-dark">Nouveau compte RDV</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <input type="text" placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
          <input type="text" placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
          <input type="password" placeholder="Mot de passe (8 caractères min.)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" />
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Créer le compte</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Statistiques de performance de l'équipe sales ─────────── */
function SalesStats({ sales }: { sales: BoardSales[] }) {
  const active = sales.filter((s) => s.isActive);
  const totalStudents = sales.reduce((sum, s) => sum + s.students.length, 0);
  const totalCompleted = sales.reduce((sum, s) => sum + s.students.filter((st) => st.onboardingCompleted).length, 0);
  const avgLoad = active.length ? Math.round((totalStudents / active.length) * 10) / 10 : 0;
  const topSales = [...sales].sort((a, b) => b.students.filter((st) => st.onboardingCompleted).length - a.students.filter((st) => st.onboardingCompleted).length)[0];
  const topCompleted = topSales ? topSales.students.filter((st) => st.onboardingCompleted).length : 0;

  const stats = [
    {
      key: "total",
      label: "Étudiants gérés",
      value: totalStudents,
      hint: `Par ${active.length} conseiller${active.length > 1 ? "s" : ""} actif${active.length > 1 ? "s" : ""}`,
      icon: Users,
      color: "from-violet-500 to-purple-600"
    },
    {
      key: "completed",
      label: "Dossiers complets",
      value: totalCompleted,
      hint: totalStudents ? `${Math.round((totalCompleted / totalStudents) * 100)}% de l'ensemble` : "Aucun étudiant",
      icon: GraduationCap,
      color: "from-emerald-500 to-teal-600"
    },
    {
      key: "load",
      label: "Charge moyenne",
      value: avgLoad,
      hint: "Étudiants par conseiller actif",
      icon: Users2,
      color: "from-sky-500 to-blue-600"
    },
    {
      key: "top",
      label: "Meilleur conseiller",
      value: topSales ? `${topSales.prenom} ${topSales.nom}` : "—",
      hint: topSales ? `${topCompleted} dossier${topCompleted > 1 ? "s" : ""} complet${topCompleted > 1 ? "s" : ""}` : "Aucune donnée",
      icon: Trophy,
      color: "from-amber-500 to-orange-600",
      isText: true
    }
  ];

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.key} className="rounded-[20px] border border-line bg-white p-5">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white", stat.color)}>
            <stat.icon className="h-4 w-4" />
          </div>
          <p className={cn("mt-3 font-display font-extrabold text-dark", stat.isText ? "truncate text-lg" : "text-2xl")}>
            {stat.value}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
          <p className="mt-1 text-[11px] text-brand">{stat.hint}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Onglet : Conseillers (stats + liste + attribution) ────── */
function SalesTab({ board, onOpenAccess, onChanged }: { board: AssignmentBoard | null; onOpenAccess: (id: string, name: string) => void; onChanged: () => void }) {
  const sales = board?.sales || [];
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  return (
    <div className="mt-5">
      <SalesStats sales={sales} />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-dark">Liste des conseillers</h2>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              viewMode === "cards" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cartes
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              viewMode === "table" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
            )}
          >
            <List className="h-3.5 w-3.5" /> Tableau
          </button>
        </div>
      </div>

      {!sales.length ? (
        <p className="mt-4 rounded-[20px] border border-dashed border-line bg-white p-8 text-sm text-muted">
          Aucun conseiller pour l'instant.
        </p>
      ) : viewMode === "cards" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sales.map((item) => {
            const completedCount = item.students.filter((s) => s.onboardingCompleted).length;
            return (
              <article key={item.id} className={cn("rounded-[20px] border bg-white p-5", item.isActive ? "border-line" : "border-dashed border-slate-300 opacity-80")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold">{item.prenom} {item.nom}</h3>
                    <p className="text-xs text-muted">{item.jobTitle || "Conseiller"}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", item.isActive ? "bg-brand-light text-brand" : "bg-slate-100 text-muted")}>
                    {item.isActive ? "Actif" : "Inactif"}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-mid"><Mail className="h-3.5 w-3.5 text-brand" /> {item.email}</p>
                <p className="mt-1.5 flex items-center gap-2 text-xs text-mid"><Phone className="h-3.5 w-3.5 text-brand" /> {item.phone || "Non renseigné"}</p>
                <p className="mt-1.5 flex items-center gap-2 text-xs text-mid"><Users className="h-3.5 w-3.5 text-brand" /> {item.students.length} étudiant{item.students.length > 1 ? "s" : ""} · {completedCount} complet{completedCount > 1 ? "s" : ""}</p>
                <button
                  type="button"
                  onClick={() => onOpenAccess(item.id, `${item.prenom} ${item.nom}`)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Gérer les accès
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Conseiller</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden sm:table-cell">Téléphone</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Étudiants</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">Statut</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {sales.map((item) => {
                const completedCount = item.students.filter((s) => s.onboardingCompleted).length;
                return (
                  <tr key={item.id} className="transition hover:bg-brand/5">
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-dark">{item.prenom} {item.nom}</p>
                      <p className="text-[11px] text-muted">{item.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-mid">{item.phone || "—"}</td>
                    <td className="px-4 py-3 text-xs text-mid">{item.students.length} · {completedCount} complet{completedCount > 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", item.isActive ? "bg-brand-light text-brand" : "bg-slate-100 text-muted")}>
                        {item.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenAccess(item.id, `${item.prenom} ${item.nom}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Gérer les accès
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Attribution des étudiants, directement ici ─────────────────── */}
      <div className="mt-8">
        <AdminAssignment onChanged={onChanged} />
      </div>
    </div>
  );
}

/* ─── Attribution des dossiers visa : glisser-déposer, exactement comme
   le tableau d'affectation des Conseillers ─────────────────────────── */
type DraggableVisaCard = { id: string; studentName: string; countryName: string; universityName: string; status?: string };

function RdvStudentCard({ card }: { card: DraggableVisaCard }) {
  const meta = card.status ? (RDV_STATUS_META[card.status] || { label: card.status, color: "bg-slate-100 text-slate-500 border-slate-200" }) : null;

  function onDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData("text/plain", card.id);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <article
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-2xl border border-line bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg active:cursor-grabbing"
    >
      <div className="flex items-center gap-2.5">
        <UserAvatar name={card.studentName} size="lg" className="h-8 w-8 text-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-dark">{card.studentName}</p>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-muted">
            <GraduationCap className="h-3 w-3 shrink-0 text-brand" /> {card.universityName} · {card.countryName}
          </p>
        </div>
      </div>
      {meta && (
        <span className={cn("mt-2.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", meta.color)}>
          {meta.label}
        </span>
      )}
    </article>
  );
}

function RdvDropColumn({
  title,
  cards,
  dropId,
  accent,
  inactive,
  droppable,
  headerExtra,
  onDropCard
}: {
  title: string;
  cards: DraggableVisaCard[];
  dropId: string | null;
  accent?: "amber";
  inactive?: boolean;
  droppable: boolean;
  headerExtra?: React.ReactNode;
  onDropCard: (applicationId: string, rdvUserId: string) => void;
}) {
  const [over, setOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    if (!droppable || !dropId) return;
    const applicationId = event.dataTransfer.getData("text/plain");
    if (applicationId) onDropCard(applicationId, dropId);
  }

  return (
    <section
      onDragOver={(event) => { if (droppable) { event.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex min-h-[320px] w-full min-w-[280px] max-w-[380px] flex-1 basis-[300px] flex-col rounded-[24px] border p-4 shadow-sm transition-all duration-200",
        inactive ? "border-dashed border-slate-300 bg-slate-50 opacity-80" : "border-line bg-white",
        over && "scale-[1.015] border-brand bg-brand-light/40 shadow-xl ring-2 ring-brand/30"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {accent === "amber" ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Users className="h-4 w-4" />
              </span>
            ) : (
              <UserAvatar name={title} size="lg" className="h-8 w-8 text-[11px]" />
            )}
            <h3 className="truncate font-display text-sm font-bold text-dark">{title}</h3>
          </div>
          <p className={cn("mt-1 text-xs font-bold", accent === "amber" ? "text-amber-600" : "text-brand")}>
            {cards.length} dossier{cards.length > 1 ? "s" : ""}
          </p>
        </div>
        {headerExtra}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
        {cards.map((card) => (
          <RdvStudentCard key={card.id} card={card} />
        ))}
        {!cards.length && (
          <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line px-3 py-8 text-center text-xs text-muted">
            {droppable ? "Glissez un dossier ici" : "Aucun dossier"}
          </p>
        )}
      </div>
    </section>
  );
}

function RdvAssignmentBoard({
  rdvUsers,
  studentsByRdv,
  onChanged
}: {
  rdvUsers: RdvUser[];
  studentsByRdv: Record<string, RdvStudent[]>;
  onChanged: () => void;
}) {
  const [unassigned, setUnassigned] = useState<UnassignedVisaApplication[]>([]);
  const [error, setError] = useState("");

  const loadUnassigned = () => {
    fetchUnassignedVisaApplications().then(setUnassigned).catch(() => setUnassigned([]));
  };

  useEffect(() => { loadUnassigned(); }, []);

  async function onDropCard(applicationId: string, rdvUserId: string) {
    setError("");
    try {
      await assignApplicationRdv(applicationId, rdvUserId);
      loadUnassigned();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attribution impossible.");
    }
  }

  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl font-extrabold">Attribution des dossiers visa</h2>
      <p className="text-sm text-muted">Glissez les dossiers acceptés vers un Responsable Visa.</p>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-4 pb-4">
        <RdvDropColumn
          title="Non attribués"
          accent="amber"
          dropId={null}
          droppable={false}
          cards={unassigned.map((a) => ({ id: a.id, studentName: a.studentName, countryName: a.countryName, universityName: a.universityName }))}
          onDropCard={onDropCard}
        />
        {rdvUsers.map((rdv) => (
          <RdvDropColumn
            key={rdv.id}
            title={`${rdv.prenom} ${rdv.nom}`}
            dropId={rdv.id}
            inactive={!rdv.isActive}
            droppable={rdv.isActive}
            cards={(studentsByRdv[rdv.id] || []).map((s) => ({ id: s.id, studentName: s.studentName, countryName: s.countryName, universityName: s.universityName, status: s.status }))}
            onDropCard={onDropCard}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Statistiques de l'équipe RDV ──────────────────────────── */
function RdvStats({
  rdvUsers,
  countries,
  assignments,
  studentsByRdv
}: {
  rdvUsers: RdvUser[];
  countries: Country[];
  assignments: RdvAssignment[];
  studentsByRdv: Record<string, RdvStudent[]>;
}) {
  const active = rdvUsers.filter((r) => r.isActive);
  const allStudents = Object.values(studentsByRdv).flat();
  const inProgress = allStudents.filter((s) => s.status !== "CLOSED").length;
  const covered = new Set(assignments.map((a) => a.countryId));
  const uncoveredCountries = countries.filter((c) => c.active && !covered.has(c.id));
  const topRdv = [...rdvUsers].sort((a, b) => (studentsByRdv[b.id]?.length || 0) - (studentsByRdv[a.id]?.length || 0))[0];
  const topCount = topRdv ? (studentsByRdv[topRdv.id]?.length || 0) : 0;

  const stats = [
    {
      key: "active",
      label: "RDV actifs",
      value: active.length,
      hint: `${rdvUsers.length} compte${rdvUsers.length > 1 ? "s" : ""} au total`,
      icon: UserCog,
      color: "from-violet-500 to-purple-600"
    },
    {
      key: "inprogress",
      label: "Dossiers visa en cours",
      value: inProgress,
      hint: `${allStudents.length} dossier${allStudents.length > 1 ? "s" : ""} suivi${allStudents.length > 1 ? "s" : ""} au total`,
      icon: GraduationCap,
      color: "from-sky-500 to-blue-600"
    },
    {
      key: "top",
      label: "Meilleur RDV",
      value: topRdv ? `${topRdv.prenom} ${topRdv.nom}` : "—",
      hint: topRdv ? `${topCount} dossier${topCount > 1 ? "s" : ""} suivi${topCount > 1 ? "s" : ""}` : "Aucune donnée",
      icon: Trophy,
      color: "from-amber-500 to-orange-600",
      isText: true
    },
    {
      key: "uncovered",
      label: "Pays sans RDV",
      value: uncoveredCountries.length,
      hint: uncoveredCountries.length ? uncoveredCountries.map((c) => c.name).join(", ") : "Toutes les destinations couvertes",
      icon: MapPinOff,
      color: uncoveredCountries.length ? "from-rose-500 to-pink-600" : "from-emerald-500 to-teal-600"
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.key} className="rounded-[20px] border border-line bg-white p-5">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white", stat.color)}>
            <stat.icon className="h-4 w-4" />
          </div>
          <p className={cn("mt-3 font-display font-extrabold text-dark", stat.isText ? "truncate text-lg" : "text-2xl")}>
            {stat.value}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
          <p className="mt-1 truncate text-[11px] text-brand" title={stat.hint}>{stat.hint}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Onglet : Responsables Visa (RDV) ──────────────────────── */
function RdvTab({ onNewRdv, onOpenAccess }: { onNewRdv: () => void; onOpenAccess: (id: string, name: string) => void }) {
  const [rdvUsers, setRdvUsers] = useState<RdvUser[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [assignments, setAssignments] = useState<RdvAssignment[]>([]);
  const [studentsByRdv, setStudentsByRdv] = useState<Record<string, RdvStudent[]>>({});
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const load = async () => {
    try {
      const [users, countryList, assignmentList] = await Promise.all([
        fetchRdvUsers(),
        fetchPublicCountries(),
        fetchRdvAssignments()
      ]);
      setRdvUsers(users);
      setCountries(countryList);
      setAssignments(assignmentList);
      const entries = await Promise.all(users.map(async (u) => [u.id, await fetchRdvStudents(u.id).catch(() => [])] as const));
      setStudentsByRdv(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les Responsables Visa.");
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="mt-5">
      <RdvStats rdvUsers={rdvUsers} countries={countries} assignments={assignments} studentsByRdv={studentsByRdv} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-dark">Liste des Responsables Visa</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "cards" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cartes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "table" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
              )}
            >
              <List className="h-3.5 w-3.5" /> Tableau
            </button>
          </div>
          <button type="button" onClick={onNewRdv} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Nouveau compte RDV
          </button>
        </div>
      </div>

      {!rdvUsers.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-muted">
          Aucun Responsable Dossier Visa pour l'instant. Créez un compte dédié, ou accordez le rôle RDV à un conseiller existant depuis l'onglet Conseillers.
        </p>
      ) : viewMode === "table" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Responsable</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden sm:table-cell">Pays couverts</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Dossiers</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">Statut</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rdvUsers.map((rdv) => {
                const covered = assignments.filter((a) => a.rdvUserId === rdv.id).length;
                const students = studentsByRdv[rdv.id] || [];
                const inProgress = students.filter((s) => s.status !== "CLOSED").length;
                return (
                  <tr key={rdv.id} className="transition hover:bg-brand/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={`${rdv.prenom} ${rdv.nom}`} size="lg" className="h-8 w-8 text-[11px]" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-dark">{rdv.prenom} {rdv.nom}</p>
                          <p className="truncate text-[11px] text-muted">{rdv.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-mid">{covered} pays</td>
                    <td className="px-4 py-3 text-xs text-mid">{students.length} · {inProgress} en cours</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", rdv.isActive ? "bg-brand-light text-brand" : "bg-slate-100 text-muted")}>
                        {rdv.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenAccess(rdv.id, `${rdv.prenom} ${rdv.nom}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Gérer les accès
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {rdvUsers.map((rdv) => {
            const covered = new Set(assignments.filter((a) => a.rdvUserId === rdv.id).map((a) => a.countryId));
            const rdvStudents = studentsByRdv[rdv.id] || [];
            const inProgress = rdvStudents.filter((s) => s.status !== "CLOSED").length;
            return (
              <article key={rdv.id} className={cn("rounded-[20px] border bg-white p-5", rdv.isActive ? "border-line" : "border-dashed border-slate-300 opacity-80")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar name={`${rdv.prenom} ${rdv.nom}`} size="lg" />
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-bold text-dark">{rdv.prenom} {rdv.nom}</h3>
                      <p className="truncate text-xs text-muted">{rdv.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", rdv.isActive ? "bg-brand-light text-brand" : "bg-slate-100 text-muted")}>
                      {rdv.isActive ? "Actif" : "Inactif"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAccess(rdv.id, `${rdv.prenom} ${rdv.nom}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Accès
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted">Pays pris en charge</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {countries.filter((c) => c.active).map((c) => {
                    const active = covered.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={async () => {
                          const next = new Set(covered);
                          if (active) next.delete(c.id); else next.add(c.id);
                          setError("");
                          try {
                            await setRdvCountries(rdv.id, Array.from(next));
                            load();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Erreur.");
                          }
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold transition",
                          active ? "border-brand bg-brand text-white" : "border-line bg-slate-50 text-muted hover:border-brand hover:text-brand"
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 flex items-center gap-2 text-xs text-mid">
                  <GraduationCap className="h-3.5 w-3.5 text-brand" /> {rdvStudents.length} dossier{rdvStudents.length > 1 ? "s" : ""} · {inProgress} en cours
                </p>
              </article>
            );
          })}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <RdvAssignmentBoard rdvUsers={rdvUsers} studentsByRdv={studentsByRdv} onChanged={load} />
    </div>
  );
}

export default function AdminSalesPage() {
  const [tab, setTab] = useState<"sales" | "rdv" | "commissions">("sales");
  const [board, setBoard] = useState<AssignmentBoard | null>(null);
  const [error, setError] = useState("");
  const [accessModal, setAccessModal] = useState<{ id: string; name: string } | null>(null);
  const [newRdvModal, setNewRdvModal] = useState(false);
  const [rdvRefreshKey, setRdvRefreshKey] = useState(0);

  function reload() {
    fetchAssignmentBoard()
      .then(setBoard)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les sales."));
  }

  useEffect(() => { reload(); }, []);

  const TABS = [
    { id: "sales" as const, label: "Conseillers", icon: Users },
    { id: "rdv" as const, label: "Responsables Visa", icon: UserCog },
    { id: "commissions" as const, label: "Commissions", icon: Coins }
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">Espace administrateur</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">Équipe</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/85">
          Conseillers, responsables dossier visa, rôles, permissions et répartition des étudiants.
        </p>

        <div className="relative mt-6 inline-flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition",
                tab === t.id ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {tab === "sales" && <SalesTab board={board} onOpenAccess={(id, name) => setAccessModal({ id, name })} onChanged={reload} />}
      {tab === "rdv" && <RdvTab key={rdvRefreshKey} onNewRdv={() => setNewRdvModal(true)} onOpenAccess={(id, name) => setAccessModal({ id, name })} />}
      {tab === "commissions" && <CommissionsPanel />}

      {accessModal && (
        <AccessModal userId={accessModal.id} name={accessModal.name} onClose={() => setAccessModal(null)} onSaved={reload} />
      )}
      {newRdvModal && (
        <NewRdvModal onClose={() => setNewRdvModal(false)} onCreated={() => { setTab("rdv"); setRdvRefreshKey((k) => k + 1); }} />
      )}
    </main>
  );
}
