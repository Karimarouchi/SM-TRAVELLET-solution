import {
  assignStudent,
  createSalesAccount,
  deleteSales,
  fetchAssignmentBoard,
  setSalesActive,
  transferSalesWork,
  type AssignmentBoard,
  type BoardSales,
  type BoardStudent
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DragEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Ban, Check, ChevronDown, GraduationCap, MapPin, Plus, Trash2, Unlock, UserRound, Users } from "lucide-react";

/* ─── Menu déroulant personnalisé (remplace le <select> natif, moche) ──── */
function SalesPicker({ candidates, value, onChange }: { candidates: BoardSales[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = candidates.find((c) => c.id === value);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-left text-sm outline-none transition hover:border-brand/50 focus:border-brand"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected && <UserAvatar name={`${selected.prenom} ${selected.nom}`} size="sm" className="h-6 w-6 text-[9px]" />}
          <span className="truncate font-semibold text-dark">
            {selected ? `${selected.prenom} ${selected.nom}` : "Choisir un conseiller"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-brand transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-brand-light/60",
                c.id === value && "bg-brand-light/40"
              )}
            >
              <UserAvatar name={`${c.prenom} ${c.nom}`} size="sm" className="h-7 w-7 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-dark">{c.prenom} {c.nom}</span>
                <span className="block text-[11px] text-muted">{c.students.length} étudiant{c.students.length > 1 ? "s" : ""}</span>
              </span>
              {c.id === value && <Check className="h-4 w-4 shrink-0 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentCard({ student }: { student: BoardStudent }) {
  function onDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData("text/plain", student.id);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <article
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab rounded-2xl border border-line bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg active:cursor-grabbing"
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar name={`${student.prenom} ${student.nom}`} src={student.avatarUrl} size="lg" className="h-8 w-8 text-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-dark">{student.prenom} {student.nom}</p>
          <p className="truncate text-[11px] text-muted">{student.email}</p>
        </div>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-mid">
        <MapPin className="h-3 w-3 shrink-0 text-brand" />
        {[student.city, student.residenceCountry].filter(Boolean).join(" · ") || "Ville non renseignée"}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-mid">
        <GraduationCap className="h-3 w-3 shrink-0 text-brand" />
        {student.targetField || "Formation non renseignée"}
      </p>
      <span
        className={cn(
          "mt-2.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
          student.onboardingCompleted ? "bg-brand-light text-brand" : "bg-slate-100 text-muted"
        )}
      >
        {student.onboardingCompleted ? "Dossier complet" : "En cours"}
      </span>
    </article>
  );
}

function DropColumn({
  title,
  count,
  hint,
  dropId,
  inactive,
  accent,
  loadPercent,
  headerExtra,
  students,
  onDropStudent
}: {
  title: string;
  count: number;
  hint?: string;
  dropId: string;
  inactive?: boolean;
  accent?: "amber" | "brand";
  loadPercent?: number;
  headerExtra?: ReactNode;
  students: BoardStudent[];
  onDropStudent: (studentId: string, salesId: string | null) => void;
}) {
  const [over, setOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    const studentId = event.dataTransfer.getData("text/plain");
    if (studentId) onDropStudent(studentId, dropId === "unassigned" ? null : dropId);
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex min-h-[380px] w-full min-w-[280px] max-w-[380px] flex-1 basis-[300px] flex-col rounded-[24px] border p-4 shadow-sm transition-all duration-200",
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
          {hint ? <p className="mt-1 truncate text-[11px] text-muted">{hint}</p> : null}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className={cn("text-xs font-bold", accent === "amber" ? "text-amber-600" : "text-brand")}>
          {count} étudiant{count > 1 ? "s" : ""}
        </span>
        {headerExtra}
      </div>

      {loadPercent !== undefined && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all duration-500", accent === "amber" ? "bg-amber-400" : "bg-brand")}
            style={{ width: `${Math.min(loadPercent, 100)}%` }}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
        {students.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
        {!students.length && (
          <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line px-3 py-8 text-center text-xs text-muted">
            Glissez une carte ici
          </p>
        )}
      </div>
    </section>
  );
}

/* ─── Modal : transférer tout le travail d'un sales vers un autre ──────── */
function TransferModal({
  from,
  candidates,
  onClose,
  onDone
}: {
  from: BoardSales;
  candidates: BoardSales[];
  onClose: () => void;
  onDone: (toSalesId: string) => Promise<void>;
}) {
  const [toSalesId, setToSalesId] = useState(candidates[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!toSalesId) return;
    setBusy(true);
    setError("");
    try {
      await onDone(toSalesId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
          <ArrowRightLeft className="h-5 w-5 text-brand" /> Transférer & bloquer
        </h3>
        <p className="mt-2 text-xs text-muted">
          Tous les étudiants actuellement suivis par <span className="font-semibold text-dark">{from.prenom} {from.nom}</span> ({from.students.length}) seront transférés au conseiller choisi, puis son compte sera bloqué.
        </p>

        {candidates.length ? (
          <div className="mt-4">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Transférer à</label>
            <SalesPicker candidates={candidates} value={toSalesId} onChange={setToSalesId} />
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Aucun autre conseiller actif disponible pour le transfert.
          </p>
        )}

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted">Annuler</button>
          <button
            type="button"
            disabled={busy || !toSalesId}
            onClick={submit}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Transfert..." : "Transférer & bloquer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAssignment({ onChanged }: { onChanged?: () => void }) {
  const [board, setBoard] = useState<AssignmentBoard | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", password: "", phone: "" });
  const [transferTarget, setTransferTarget] = useState<BoardSales | null>(null);

  async function load() {
    setError("");
    setBoard(await fetchAssignmentBoard());
    onChanged?.();
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger l’affectation."));
  }, []);

  async function onDropStudent(studentId: string, salesId: string | null) {
    setError("");
    try {
      await assignStudent(studentId, salesId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Affectation impossible.");
    }
  }

  async function onToggleSales(salesId: string, isActive: boolean) {
    try {
      await setSalesActive(salesId, isActive);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de changer le statut.");
    }
  }

  async function onDeleteSales(item: BoardSales) {
    const confirmed = window.confirm(
      `Supprimer définitivement le compte de ${item.prenom} ${item.nom} (${item.email}) ?\n\nCette action est irréversible. À réserver aux comptes créés par erreur et jamais utilisés.`
    );
    if (!confirmed) return;
    setError("");
    try {
      await deleteSales(item.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createSalesAccount(form);
      setForm({ prenom: "", nom: "", email: "", password: "", phone: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  const sales = board?.sales || [];
  const maxLoad = Math.max(1, ...sales.map((s) => s.students.length), board?.unassigned.length || 0);

  return (
    <section id="affectation" className="scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Affectation</h2>
          <p className="text-sm text-muted">Glissez les cartes étudiants vers un conseiller.</p>
        </div>
        <span className={cn(
          "rounded-full px-4 py-2 text-xs font-bold",
          board?.autoAssignSales ? "bg-brand-light text-brand" : "bg-slate-100 text-mid"
        )}>
          Répartition auto {board?.autoAssignSales ? "activée" : "arrêtée"} · réglable dans Paramètres
        </span>
      </div>

      <form onSubmit={onCreate} className="rounded-[24px] border border-line bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-brand" />
          <h3 className="font-display text-lg font-bold">Créer un compte conseiller</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <input className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required />
          <input className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
          <input className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          <input className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" type="tel" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </div>
        <button type="submit" disabled={saving} className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-70">
          Créer le compte
        </button>
      </form>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-4 pb-4">
        <DropColumn
          title="Non affectés"
          hint="En attente d'un conseiller"
          count={board?.unassigned.length || 0}
          dropId="unassigned"
          accent="amber"
          loadPercent={((board?.unassigned.length || 0) / maxLoad) * 100}
          students={board?.unassigned || []}
          onDropStudent={onDropStudent}
        />
        {sales.map((item) => (
          <DropColumn
            key={item.id}
            title={`${item.prenom} ${item.nom}`}
            hint={`${item.email} · ${item.phone || "sans téléphone"}`}
            count={item.students.length}
            dropId={item.id}
            inactive={!item.isActive}
            loadPercent={(item.students.length / maxLoad) * 100}
            students={item.students}
            onDropStudent={onDropStudent}
            headerExtra={
              <div className="flex items-center gap-1.5">
                {item.isActive && item.students.length > 0 && (
                  <button
                    type="button"
                    title="Transférer tout le travail à un autre conseiller, puis bloquer ce compte"
                    onClick={() => setTransferTarget(item)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-red-100 hover:text-red-600"
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                  </button>
                )}
                {item.students.length === 0 && (
                  <button
                    type="button"
                    title="Supprimer ce compte (uniquement s'il n'a jamais servi — créé par erreur)"
                    onClick={() => onDeleteSales(item)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleSales(item.id, !item.isActive)}
                  title={item.isActive ? "Bloquer ce compte" : "Débloquer ce compte"}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition",
                    item.isActive ? "bg-brand-light text-brand hover:bg-red-100 hover:text-red-600" : "bg-slate-200 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700"
                  )}
                >
                  {item.isActive ? <Ban className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                  {item.isActive ? "Actif" : "Inactif"}
                </button>
              </div>
            }
          />
        ))}
        {!sales.length && (
          <div className="flex min-h-[200px] w-[300px] shrink-0 items-center justify-center rounded-[24px] border border-dashed border-line bg-white text-sm text-muted">
            <UserRound className="mr-2 h-4 w-4" />
            Aucun conseiller pour le moment
          </div>
        )}
      </div>

      {transferTarget && (
        <TransferModal
          from={transferTarget}
          candidates={sales.filter((s) => s.id !== transferTarget.id && s.isActive)}
          onClose={() => setTransferTarget(null)}
          onDone={async (toSalesId) => {
            await transferSalesWork(transferTarget.id, toSalesId);
            setTransferTarget(null);
            await load();
          }}
        />
      )}
    </section>
  );
}
