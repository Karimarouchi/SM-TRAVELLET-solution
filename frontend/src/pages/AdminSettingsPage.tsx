import { fetchAdminSettings, updateAdminSettings, type AdminSettings, type StalledAlertFrequency } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, KeyRound, Mail, Save, Settings as SettingsIcon, ShieldCheck, Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import BackupPanel from "@/components/admin/BackupPanel";
import GoogleCalendarCard from "@/components/admin/GoogleCalendarCard";
import AutoAssignSharesCard from "@/components/admin/AutoAssignSharesCard";


const FREQUENCIES: { id: StalledAlertFrequency; label: string; hint: string }[] = [
  { id: "once", label: "Une seule fois", hint: "Un email au franchissement du seuil, jamais renvoyé ensuite." },
  { id: "daily", label: "Rappel quotidien", hint: "Un email chaque jour tant que le dossier reste bloqué." },
  { id: "weekly", label: "Rappel hebdomadaire", hint: "Un email toutes les semaines tant que le dossier reste bloqué." }
];

const WEEKDAYS = [
  { id: 1, label: "Lundi" },
  { id: 2, label: "Mardi" },
  { id: 3, label: "Mercredi" },
  { id: 4, label: "Jeudi" },
  { id: 5, label: "Vendredi" },
  { id: 6, label: "Samedi" },
  { id: 7, label: "Dimanche" }
];

const SMTP_PRESETS = [
  { id: "gmail", label: "Gmail", host: "smtp.gmail.com", port: 465 },
  { id: "hostinger", label: "Hostinger", host: "smtp.hostinger.com", port: 465 },
  { id: "ovh", label: "OVH", host: "ssl0.ovh.net", port: 465 }
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [form, setForm] = useState({ stalledAlertDays: "30", stalledAlertFrequency: "once" as StalledAlertFrequency, stalledAlertEmail: "" });
  const [senderForm, setSenderForm] = useState({ emailFromName: "", emailFromAddress: "", emailAppPassword: "", emailSmtpHost: "", emailSmtpPort: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [senderSaving, setSenderSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [senderSaved, setSenderSaved] = useState(false);
  const [workForm, setWorkForm] = useState({ workDays: [1, 2, 3, 4, 5] as number[], workStart: "09:00", workEnd: "18:00" });
  const [workSaving, setWorkSaving] = useState(false);
  const [workSaved, setWorkSaved] = useState(false);

  useEffect(() => {
    fetchAdminSettings()
      .then((data) => {
        setSettings(data);
        setForm({
          stalledAlertDays: String(data.stalledAlertDays),
          stalledAlertFrequency: data.stalledAlertFrequency,
          stalledAlertEmail: data.stalledAlertEmail
        });
        setSenderForm({
          emailFromName: data.emailFromName,
          emailFromAddress: data.emailFromAddress,
          emailAppPassword: "",
          emailSmtpHost: data.emailSmtpHost || "",
          emailSmtpPort: data.emailSmtpPort ? String(data.emailSmtpPort) : ""
        });
        setWorkForm({
          workDays: data.workDays?.length ? data.workDays : [1, 2, 3, 4, 5],
          workStart: data.workStart || "09:00",
          workEnd: data.workEnd || "18:00"
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les paramètres."))
      .finally(() => setLoading(false));
  }, []);

  async function toggleAutoAssign(enabled: boolean) {
    if (!settings) return;
    setError("");
    try {
      const updated = await updateAdminSettings({ autoAssignSales: enabled });
      setSettings(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier ce réglage.");
    }
  }

  async function saveStalledAlert() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const days = parseInt(form.stalledAlertDays, 10);
      if (!Number.isInteger(days) || days < 1) throw new Error("Le seuil doit être un nombre de jours positif.");
      const updated = await updateAdminSettings({
        stalledAlertDays: days,
        stalledAlertFrequency: form.stalledAlertFrequency,
        stalledAlertEmail: form.stalledAlertEmail.trim()
      });
      setSettings(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSender() {
    setSenderSaving(true);
    setError("");
    setSenderSaved(false);
    try {
      const updated = await updateAdminSettings({
        emailFromName: senderForm.emailFromName.trim(),
        emailFromAddress: senderForm.emailFromAddress.trim(),
        emailSmtpHost: senderForm.emailSmtpHost,
        emailSmtpPort: senderForm.emailSmtpPort ? Number(senderForm.emailSmtpPort) : null,
        ...(senderForm.emailAppPassword ? { emailAppPassword: senderForm.emailAppPassword } : {})
      });
      setSettings(updated);
      setSenderForm((prev) => ({ ...prev, emailAppPassword: "" }));
      setSenderSaved(true);
      window.setTimeout(() => setSenderSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSenderSaving(false);
    }
  }

  async function saveWorkHours() {
    setWorkSaving(true);
    setError("");
    setWorkSaved(false);
    try {
      if (!workForm.workDays.length) throw new Error("Choisissez au moins un jour ouvré.");
      const updated = await updateAdminSettings({
        workDays: workForm.workDays,
        workStart: workForm.workStart,
        workEnd: workForm.workEnd
      });
      setSettings(updated);
      setWorkSaved(true);
      window.setTimeout(() => setWorkSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setWorkSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 pb-16">
      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 sm:p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">Espace administrateur</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold">
          <SettingsIcon className="h-7 w-7" /> Paramètres
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85">
          Réglages globaux de la plateforme : répartition automatique des sales et alertes de suivi des dossiers.
        </p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Chargement...</p>
      ) : (
        <>
          {/* ── Affectation automatique ──────────────────────────────────── */}
          <section className="mt-6 rounded-[24px] border border-line bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-xl font-bold text-dark">
                  <Users2 className="h-5 w-5 text-brand" /> Affectation automatique des sales
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Quand un étudiant sans conseiller termine son onboarding, il est affecté automatiquement à un conseiller (le moins chargé, ou selon les pourcentages ci-dessous).
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleAutoAssign(!settings?.autoAssignSales)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-bold transition",
                  settings?.autoAssignSales ? "bg-brand text-white" : "border border-line bg-white text-mid"
                )}
              >
                {settings?.autoAssignSales ? "Activée" : "Désactivée"}
              </button>
            </div>
          </section>

          {/* ── Répartition par pourcentage ──────────────────────────────── */}
          <AutoAssignSharesCard />

          {/* ── Expéditeur des emails ────────────────────────────────────── */}
          <section className="mt-4 rounded-[24px] border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-dark">
              <Mail className="h-5 w-5 text-brand" /> Expéditeur des emails
            </h2>
            <p className="mt-1 text-xs text-muted">
              Nom, adresse, serveur et mot de passe utilisés pour envoyer tous les emails de la plateforme (vérification de compte, entretiens, rendez-vous visa, alertes...).
              Changer l'adresse ne fonctionne que si le serveur et le mot de passe correspondent à cette adresse.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Nom affiché</label>
                <input
                  type="text"
                  placeholder="SM Travel"
                  value={senderForm.emailFromName}
                  onChange={(e) => setSenderForm({ ...senderForm, emailFromName: e.target.value })}
                  className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Adresse d'expédition</label>
                <input
                  type="email"
                  placeholder="contact@sm-travel.fr"
                  value={senderForm.emailFromAddress}
                  onChange={(e) => setSenderForm({ ...senderForm, emailFromAddress: e.target.value })}
                  className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Serveur d'envoi</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {SMTP_PRESETS.map((preset) => {
                  // Serveur jamais choisi : déduit de l'adresse (@gmail.com → Gmail), comme le fait le serveur.
                  const effectiveHost =
                    senderForm.emailSmtpHost || (/@(gmail|googlemail)\.com$/i.test(senderForm.emailFromAddress.trim()) ? "smtp.gmail.com" : "");
                  const active = preset.host === effectiveHost;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSenderForm({ ...senderForm, emailSmtpHost: preset.host, emailSmtpPort: String(preset.port) })}
                      aria-pressed={active}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition",
                        active ? "border-brand bg-brand-light/50 shadow-[0_0_0_3px_rgba(109,40,217,0.1)]" : "border-line bg-white hover:border-brand/40"
                      )}
                    >
                      <span className="block text-sm font-bold text-dark">{preset.label}</span>
                      <span className="block truncate text-[11px] text-muted">{preset.host}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Choisissez le fournisseur de l'adresse d'expédition : adresse en @gmail.com → Gmail ; adresse de votre nom de domaine
                créée chez Hostinger (ex. services@smtravel.fr) → Hostinger.
                {senderForm.emailSmtpHost && !SMTP_PRESETS.some((p) => p.host === senderForm.emailSmtpHost) && (
                  <> Serveur actuel : <strong>{senderForm.emailSmtpHost}</strong>.</>
                )}
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                <KeyRound className="h-3 w-3" /> Mot de passe du compte mail
              </label>
              <input
                type="password"
                placeholder={settings?.emailHasAppPassword ? "•••••••••••••• (déjà enregistré)" : "Mot de passe d'application"}
                value={senderForm.emailAppPassword}
                onChange={(e) => setSenderForm({ ...senderForm, emailAppPassword: e.target.value })}
                className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand"
                autoComplete="new-password"
              />
              {settings?.emailHasAppPassword && !senderForm.emailAppPassword && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-600">
                  <ShieldCheck className="h-3 w-3" /> Un mot de passe est déjà enregistré. Laissez ce champ vide pour le conserver, ou saisissez-en un nouveau pour le remplacer.
                </p>
              )}
            </div>

            <p className="mt-3 text-[11px] text-muted">
              <strong>Gmail</strong> : saisissez un « mot de passe d'application » (généré dans les paramètres de sécurité du compte Google), pas
              le mot de passe habituel. <strong>Hostinger</strong> : saisissez le mot de passe de la boîte mail. La connexion est testée à
              l'enregistrement : si le couple adresse / serveur / mot de passe est faux, rien n'est enregistré et le motif s'affiche.
              Laissez les champs vides pour utiliser la configuration par défaut du serveur.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                disabled={senderSaving}
                onClick={saveSender}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {senderSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
              {senderSaved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Réglages enregistrés
                </span>
              )}
            </div>
          </section>

          {/* ── Google Calendar : liens Meet automatiques ────────────────── */}
          <GoogleCalendarCard />

          {/* ── Alerte dossier bloqué ────────────────────────────────────── */}
          <section className="mt-4 rounded-[24px] border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-dark">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Alerte "Sans candidature"
            </h2>
            <p className="mt-1 text-xs text-muted">
              Si un étudiant reste bloqué sur l'étape "Sans candidature" (onboarding terminé, aucune candidature créée) au-delà du seuil ci-dessous,
              un email est envoyé à l'adresse admin et au conseiller assigné.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Seuil (en jours)</label>
                <input
                  type="number"
                  min={1}
                  value={form.stalledAlertDays}
                  onChange={(e) => setForm({ ...form, stalledAlertDays: e.target.value })}
                  className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Email admin à prévenir</label>
                <input
                  type="email"
                  placeholder="alertes@sm-travel.fr"
                  value={form.stalledAlertEmail}
                  onChange={(e) => setForm({ ...form, stalledAlertEmail: e.target.value })}
                  className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-muted">Fréquence de rappel</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {FREQUENCIES.map((freq) => (
                  <button
                    key={freq.id}
                    type="button"
                    onClick={() => setForm({ ...form, stalledAlertFrequency: freq.id })}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      form.stalledAlertFrequency === freq.id ? "border-brand bg-brand/5" : "border-line bg-white hover:border-brand/40"
                    )}
                  >
                    <p className={cn("text-sm font-bold", form.stalledAlertFrequency === freq.id ? "text-brand" : "text-dark")}>{freq.label}</p>
                    <p className="mt-1 text-[11px] text-muted">{freq.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={saveStalledAlert}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Réglages enregistrés
                </span>
              )}
            </div>
          </section>

          <section className="mt-4 rounded-[24px] border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-dark">
              <Clock className="h-5 w-5 text-brand" /> Horaires de travail
            </h2>
            <p className="mt-1 text-xs text-muted">
              Les statistiques du Dashboard et des pages employés ne comptent que ces jours et ces heures (fuseau Africa/Tunis). Les nuits et jours non cochés sont exclus des durées. Un dossier est « à mi-parcours » quand il attend depuis plus de deux journées de travail : ce seuil est calculé automatiquement.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const on = workForm.workDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setWorkForm((prev) => ({
                      ...prev,
                      workDays: on ? prev.workDays.filter((d) => d !== day.id) : [...prev.workDays, day.id].sort((a, b) => a - b)
                    }))}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-bold", on ? "bg-brand text-white" : "border border-line text-muted")}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Début</label>
                <input type="time" value={workForm.workStart} onChange={(e) => setWorkForm({ ...workForm, workStart: e.target.value })} className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Fin</label>
                <input type="time" value={workForm.workEnd} onChange={(e) => setWorkForm({ ...workForm, workEnd: e.target.value })} className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button type="button" disabled={workSaving} onClick={saveWorkHours} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                <Save className="h-4 w-4" /> {workSaving ? "Enregistrement..." : "Enregistrer les horaires"}
              </button>
              {workSaved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Horaires enregistrés
                </span>
              )}
            </div>
          </section>

          {/* ── Sauvegarde de secours ────────────────────────────────────── */}
          <div className="mt-4">
            <BackupPanel />
          </div>
        </>
      )}
    </main>
  );
}
