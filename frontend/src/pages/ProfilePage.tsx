import { FancySelect } from "@/components/ui/fancy-select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { fetchMe, fetchPublicCountries, fetchPublicUniversities, getSession, mediaUrl, saveOnboarding, updateIdentity, uploadAvatar, type AuthUser, type Country, type PublicUniversity } from "@/lib/auth";
import {
  COUNTRIES,
  ENGLISH_TESTS,
  FRENCH_TESTS,
  FUNDING,
  INTAKES,
  LANG_LEVELS,
  LEVELS,
  MAX_YEAR,
  TARGET_LEVELS,
  YES_NO,
  formToPayload,
  profileToForm,
  sanitizePhone,
  validateIdentity,
  validateSection,
  type FieldErrors,
  type ProfileField,
  type ProfileForm,
  type TestLang
} from "@/lib/student-profile-form";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, ChevronDown, Globe2, GraduationCap, MapPinned, Sparkles, UserRound, Wallet } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import "./profile.css";

type SectionId = "account" | "identity" | "school" | "project" | "budget";

const SECTIONS: Array<{
  id: SectionId;
  title: string;
  text: string;
  icon: typeof UserRound;
  tint: string;
  glow: string;
}> = [
  { id: "account", title: "C’est toi", text: "Prénom, nom et date de naissance", icon: UserRound, tint: "from-violet-500 to-fuchsia-500", glow: "shadow-violet-200" },
  { id: "identity", title: "Où tu vis", text: "Téléphone, pays et ville", icon: MapPinned, tint: "from-sky-500 to-cyan-400", glow: "shadow-sky-200" },
  { id: "school", title: "Ton parcours", text: "Diplômes et études actuelles", icon: GraduationCap, tint: "from-amber-500 to-orange-400", glow: "shadow-amber-200" },
  { id: "project", title: "Le projet", text: "Pays, formation, rentrée", icon: Globe2, tint: "from-emerald-500 to-teal-400", glow: "shadow-emerald-200" },
  { id: "budget", title: "Budget & papiers", text: "Argent, langues, documents", icon: Wallet, tint: "from-rose-500 to-pink-400", glow: "shadow-rose-200" }
];

function Field({
  label,
  required,
  error,
  children
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mid">
        {label}
        {required ? (
          <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand">Obligatoire</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-muted">Facultatif</span>
        )}
      </span>
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400";

function fieldInputClass(hasError?: boolean) {
  return cn(
    inputClass,
    hasError
      ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
      : "border-line focus:border-brand focus:shadow-[0_0_0_4px_rgba(109,40,217,0.12)]"
  );
}

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choisis une image JPG, PNG ou WEBP."));
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const max = 480;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Impossible de lire la photo."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire la photo."));
    };
    image.src = url;
  });
}

function summaryFor(id: SectionId, user: AuthUser, form: ProfileForm) {
  if (id === "account") return user.email;
  if (id === "identity") return [form.city, form.residenceCountry].filter(Boolean).join(" · ") || "À compléter";
  if (id === "school") return [form.studyField, form.currentStudyLevel].filter(Boolean).join(" · ") || "À compléter";
  if (id === "project") return [form.preferredCountries[0], form.targetField].filter(Boolean).join(" · ") || "À compléter";
  if (id === "budget") {
    const budget = form.annualBudget ? `${Number(form.annualBudget).toLocaleString("fr-FR")} €` : "";
    return [budget, form.fundingMode].filter(Boolean).join(" · ") || "À compléter";
  }
  return "";
}

export default function ProfilePage() {
  const initial = getSession();
  const [user, setUser] = useState(initial?.user || null);
  const [form, setForm] = useState<ProfileForm>(() => profileToForm(initial?.profile || null));
  const [prenom, setPrenom] = useState(initial?.user.prenom || "");
  const [nom, setNom] = useState(initial?.user.nom || "");
  const [dateNaissance, setDateNaissance] = useState(initial?.user.dateNaissance || "");
  const [open, setOpen] = useState<SectionId | null>("account");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [idErrors, setIdErrors] = useState<{ prenom?: string; nom?: string; dateNaissance?: string }>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [universities, setUniversities] = useState<PublicUniversity[]>([]);
  const destinations = countries.map((c) => c.name);

  useEffect(() => {
    fetchPublicCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    const ids = countries.filter((c) => form.preferredCountries.includes(c.name)).map((c) => c.id);
    if (!ids.length) {
      setUniversities([]);
      return;
    }
    fetchPublicUniversities(ids).then(setUniversities).catch(() => setUniversities([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.preferredCountries, countries]);

  useEffect(() => {
    fetchMe()
      .then((session) => {
        setUser(session.user);
        setPrenom(session.user.prenom);
        setNom(session.user.nom);
        setDateNaissance(session.user.dateNaissance);
        setForm(profileToForm(session.profile || null));
      })
      .catch(() => undefined);
  }, []);

  function setField<K extends ProfileField>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleCountry(country: string) {
    setForm((current) => ({
      ...current,
      preferredCountries: current.preferredCountries.includes(country)
        ? current.preferredCountries.filter((item) => item !== country)
        : [...current.preferredCountries, country]
    }));
    setErrors((current) => ({ ...current, preferredCountries: undefined }));
  }

  function toggleTestLang(lang: TestLang) {
    setForm((current) => ({
      ...current,
      languageTestLangs: current.languageTestLangs.includes(lang)
        ? current.languageTestLangs.filter((item) => item !== lang)
        : [...current.languageTestLangs, lang]
    }));
    setErrors((current) => ({ ...current, languageTestLangs: undefined }));
  }

  async function onPickPhoto(file?: File | null) {
    if (!file) return;
    setError("");
    setMessage("");
    setPhotoBusy(true);
    try {
      const image = await compressPhoto(file);
      const data = await uploadAvatar(image);
      setUser(data.user);
      setMessage("Photo ajoutée ✨ Elle apparaît dans tes discussions.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer la photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(section: SectionId) {
    setError("");
    setMessage("");
    if (section === "account") {
      const next = validateIdentity(prenom, nom, dateNaissance);
      if (Object.keys(next).length) {
        setIdErrors(next);
        return;
      }
      setIdErrors({});
      setSaving(true);
      try {
        const data = await updateIdentity({ prenom: prenom.trim(), nom: nom.trim(), dateNaissance });
        setUser(data.user);
        setMessage("Profil mis à jour ✨");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d’enregistrer.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextErrors = validateSection(section, form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setError("Corrige les champs en rouge, puis réessaie.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const data = await saveOnboarding(formToPayload(form));
      setForm(profileToForm(data.profile));
      setMessage("C’est enregistré ✨");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <main className="profile-root">
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-20 pt-2">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 text-center"
        >
          <label className="relative mx-auto block h-28 w-28 cursor-pointer">
            <motion.span
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="relative block h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-violet-100 shadow-[0_16px_36px_rgba(109,40,217,.28)]"
            >
              {mediaUrl(user.avatarUrl) ? (
                <img src={mediaUrl(user.avatarUrl)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-3xl font-extrabold text-brand">
                  {`${user.prenom?.[0] || ""}${user.nom?.[0] || ""}`.toUpperCase()}
                </span>
              )}
            </motion.span>
            <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-brand text-white shadow-md">
              <Camera className="h-4 w-4" />
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={photoBusy}
              onChange={(event) => onPickPhoto(event.target.files?.[0])}
            />
          </label>
          <p className="mt-3 text-xs font-semibold text-brand">{photoBusy ? "Photo en cours…" : "Ajoute ta photo"}</p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Ton dossier
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-dark md:text-4xl">
            Salut, {user.prenom}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Ouvre une carte, ferme les autres, édite, enregistre. Simple.
          </p>
        </motion.header>

        <div className="space-y-3">
          {SECTIONS.map((section, index) => {
            const Icon = section.icon;
            const isOpen = open === section.id;
            return (
              <motion.article
                key={section.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, type: "spring", stiffness: 240, damping: 22 }}
                className={cn(
                  "overflow-hidden rounded-[26px] border border-white/80 bg-white/90 shadow-lg backdrop-blur-xl",
                  isOpen && section.glow
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : section.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                >
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md", section.tint)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-extrabold text-dark">{section.title}</span>
                    <span className="block truncate text-xs text-muted">{isOpen ? section.text : summaryFor(section.id, user, form)}</span>
                  </span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="text-brand">
                    <ChevronDown className="h-5 w-5" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key={section.id}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5">
                        {section.id === "account" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Field label="Photo de profil" required>
                                <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-brand/30 bg-brand-light/40 px-4 py-3">
                                  <UserAvatar name={`${prenom} ${nom}`} src={user.avatarUrl} size="lg" />
                                  <span>
                                    <span className="block text-sm font-semibold text-dark">
                                      {user.avatarUrl ? "Changer ma photo" : "Ajouter ma photo"}
                                    </span>
                                    <span className="block text-xs text-muted">Elle s’affiche dans tes discussions avec le conseiller.</span>
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    disabled={photoBusy}
                                    onChange={(event) => onPickPhoto(event.target.files?.[0])}
                                  />
                                </label>
                              </Field>
                            </div>
                            <Field label="Prénom" required error={idErrors.prenom}>
                              <input className={fieldInputClass(Boolean(idErrors.prenom))} value={prenom} maxLength={40} onChange={(e) => setPrenom(e.target.value)} />
                            </Field>
                            <Field label="Nom" required error={idErrors.nom}>
                              <input className={fieldInputClass(Boolean(idErrors.nom))} value={nom} maxLength={40} onChange={(e) => setNom(e.target.value)} />
                            </Field>
                            <Field label="Date de naissance" required error={idErrors.dateNaissance}>
                              <input className={fieldInputClass(Boolean(idErrors.dateNaissance))} type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
                            </Field>
                            <Field label="Email">
                              <input className={`${fieldInputClass()} cursor-not-allowed bg-slate-50 text-muted`} value={user.email} disabled />
                            </Field>
                          </div>
                        )}

                        {section.id === "identity" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Téléphone" required error={errors.phone}>
                              <input className={fieldInputClass(Boolean(errors.phone))} type="tel" maxLength={20} value={form.phone} onChange={(e) => setField("phone", sanitizePhone(e.target.value))} />
                            </Field>
                            <Field label="Nationalité" required error={errors.nationality}>
                              <FancySelect invalid={Boolean(errors.nationality)} value={form.nationality} onChange={(value) => setField("nationality", value)} options={COUNTRIES} />
                            </Field>
                            <Field label="Pays de résidence" required error={errors.residenceCountry}>
                              <FancySelect invalid={Boolean(errors.residenceCountry)} value={form.residenceCountry} onChange={(value) => setField("residenceCountry", value)} options={COUNTRIES} />
                            </Field>
                            <Field label="Ville" required error={errors.city}>
                              <input className={fieldInputClass(Boolean(errors.city))} maxLength={50} value={form.city} onChange={(e) => setField("city", e.target.value)} />
                            </Field>
                          </div>
                        )}

                        {section.id === "school" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Niveau d’études actuel" required error={errors.currentStudyLevel}>
                              <FancySelect invalid={Boolean(errors.currentStudyLevel)} value={form.currentStudyLevel} onChange={(value) => setField("currentStudyLevel", value)} options={LEVELS} placeholder="Choisir un niveau" />
                            </Field>
                            <Field label="Dernier diplôme obtenu" required error={errors.lastDiploma}>
                              <input className={fieldInputClass(Boolean(errors.lastDiploma))} maxLength={80} value={form.lastDiploma} onChange={(e) => setField("lastDiploma", e.target.value)} />
                            </Field>
                            <Field label="Domaine d’études" required error={errors.studyField}>
                              <input className={fieldInputClass(Boolean(errors.studyField))} maxLength={80} value={form.studyField} onChange={(e) => setField("studyField", e.target.value)} />
                            </Field>
                            <Field label="Établissement" error={errors.currentInstitution}>
                              <input className={fieldInputClass(Boolean(errors.currentInstitution))} maxLength={80} value={form.currentInstitution} onChange={(e) => setField("currentInstitution", e.target.value)} />
                            </Field>
                            <Field label="Année d’obtention" error={errors.diplomaYear}>
                              <input className={fieldInputClass(Boolean(errors.diplomaYear))} type="number" min={1980} max={MAX_YEAR} value={form.diplomaYear} onChange={(e) => setField("diplomaYear", e.target.value)} />
                            </Field>
                          </div>
                        )}

                        {section.id === "project" && (
                          <div className="grid gap-3">
                            <Field label="Pays préférés" required error={errors.preferredCountries}>
                              <div className="flex flex-wrap gap-2">
                                {destinations.map((country) => {
                                  const active = form.preferredCountries.includes(country);
                                  return (
                                    <motion.button
                                      key={country}
                                      type="button"
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => toggleCountry(country)}
                                      className={cn(
                                        "rounded-full border px-3 py-1.5 text-xs font-semibold",
                                        active ? "border-brand bg-brand text-white shadow-md shadow-brand/25" : "border-line bg-white text-mid hover:bg-brand-light"
                                      )}
                                    >
                                      {country}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </Field>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Ville préférée" error={errors.preferredCity}>
                                <input className={fieldInputClass(Boolean(errors.preferredCity))} maxLength={50} value={form.preferredCity} onChange={(e) => setField("preferredCity", e.target.value)} />
                              </Field>
                              <Field label="Niveau recherché" required error={errors.targetLevel}>
                                <FancySelect invalid={Boolean(errors.targetLevel)} value={form.targetLevel} onChange={(value) => setField("targetLevel", value)} options={TARGET_LEVELS} placeholder="Choisir" />
                              </Field>
                              <Field label="Formation souhaitée" required error={errors.targetField}>
                                <input className={fieldInputClass(Boolean(errors.targetField))} maxLength={80} value={form.targetField} onChange={(e) => setField("targetField", e.target.value)} />
                              </Field>
                              <Field label="Rentrée souhaitée" required error={errors.targetIntake}>
                                <FancySelect invalid={Boolean(errors.targetIntake)} value={form.targetIntake} onChange={(value) => setField("targetIntake", value)} options={INTAKES} placeholder="Choisir" />
                              </Field>
                              <Field label="Université précise" error={errors.targetUniversity}>
                                <FancySelect
                                  invalid={Boolean(errors.targetUniversity)}
                                  value={form.targetUniversity}
                                  onChange={(value) => setField("targetUniversity", value)}
                                  options={universities.map((u) => ({ value: u.name, label: `${u.name} (${u.countryName})` }))}
                                  placeholder={
                                    !form.preferredCountries.length
                                      ? "Choisissez d'abord un pays préféré"
                                      : universities.length
                                        ? "Choisir une université (optionnel)"
                                        : "Aucune université configurée pour ce pays"
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                        )}

                        {section.id === "budget" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Budget annuel (EUR)" required error={errors.annualBudget}>
                              <input className={fieldInputClass(Boolean(errors.annualBudget))} type="number" min={500} max={200000} value={form.annualBudget} onChange={(e) => setField("annualBudget", e.target.value)} />
                            </Field>
                            <Field label="Mode de financement" required error={errors.fundingMode}>
                              <FancySelect invalid={Boolean(errors.fundingMode)} value={form.fundingMode} onChange={(value) => setField("fundingMode", value)} options={FUNDING} placeholder="Choisir" />
                            </Field>
                            <Field label="Niveau de français" required error={errors.languageLevelFrench}>
                              <FancySelect invalid={Boolean(errors.languageLevelFrench)} value={form.languageLevelFrench} onChange={(value) => setField("languageLevelFrench", value)} options={LANG_LEVELS} />
                            </Field>
                            <Field label="Niveau d’anglais" required error={errors.languageLevelEnglish}>
                              <FancySelect invalid={Boolean(errors.languageLevelEnglish)} value={form.languageLevelEnglish} onChange={(value) => setField("languageLevelEnglish", value)} options={LANG_LEVELS} />
                            </Field>
                            <div className="sm:col-span-2">
                              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 accent-brand"
                                  checked={form.hasLanguageTest}
                                  onChange={(e) => {
                                    setField("hasLanguageTest", e.target.checked);
                                    if (!e.target.checked) {
                                      setField("languageTestLangs", []);
                                      setField("languageTestFrench", "");
                                      setField("languageTestEnglish", "");
                                      setField("languageTestFrenchOther", "");
                                      setField("languageTestEnglishOther", "");
                                    }
                                  }}
                                />
                                <span>
                                  <span className="block text-sm font-semibold">Test de langue déjà passé</span>
                                  <span className="block text-xs text-muted">Coche, puis choisis français et / ou anglais.</span>
                                </span>
                              </label>
                              {form.hasLanguageTest && (
                                <div className="mt-3 grid gap-3">
                                  <Field label="Langue du test" required error={errors.languageTestLangs}>
                                    <div className="flex flex-wrap gap-2">
                                      {([
                                        { id: "french" as const, label: "Français" },
                                        { id: "english" as const, label: "Anglais" }
                                      ]).map((item) => {
                                        const active = form.languageTestLangs.includes(item.id);
                                        return (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => toggleTestLang(item.id)}
                                            className={cn(
                                              "rounded-full border px-4 py-1.5 text-xs font-semibold",
                                              active ? "border-brand bg-brand text-white" : "border-line bg-white text-mid"
                                            )}
                                          >
                                            {item.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </Field>
                                  {form.languageTestLangs.includes("french") && (
                                    <Field label="Test de français" required error={errors.languageTestFrench}>
                                      <FancySelect invalid={Boolean(errors.languageTestFrench)} value={form.languageTestFrench} onChange={(value) => setField("languageTestFrench", value)} options={FRENCH_TESTS} />
                                    </Field>
                                  )}
                                  {form.languageTestFrench === "Autre" && form.languageTestLangs.includes("french") && (
                                    <Field label="Précisez le test" required error={errors.languageTestFrenchOther}>
                                      <input className={fieldInputClass(Boolean(errors.languageTestFrenchOther))} value={form.languageTestFrenchOther} onChange={(e) => setField("languageTestFrenchOther", e.target.value)} />
                                    </Field>
                                  )}
                                  {form.languageTestLangs.includes("english") && (
                                    <Field label="Test d’anglais" required error={errors.languageTestEnglish}>
                                      <FancySelect invalid={Boolean(errors.languageTestEnglish)} value={form.languageTestEnglish} onChange={(value) => setField("languageTestEnglish", value)} options={ENGLISH_TESTS} />
                                    </Field>
                                  )}
                                  {form.languageTestEnglish === "Autre" && form.languageTestLangs.includes("english") && (
                                    <Field label="Précisez le test" required error={errors.languageTestEnglishOther}>
                                      <input className={fieldInputClass(Boolean(errors.languageTestEnglishOther))} value={form.languageTestEnglishOther} onChange={(e) => setField("languageTestEnglishOther", e.target.value)} />
                                    </Field>
                                  )}
                                </div>
                              )}
                            </div>
                            <Field label="Passeport disponible" required error={errors.hasPassport}>
                              <FancySelect invalid={Boolean(errors.hasPassport)} value={form.hasPassport} onChange={(value) => setField("hasPassport", value as ProfileForm["hasPassport"])} options={YES_NO} />
                            </Field>
                            <Field label="Visa déjà demandé" required error={errors.visaAlreadyRequested}>
                              <FancySelect invalid={Boolean(errors.visaAlreadyRequested)} value={form.visaAlreadyRequested} onChange={(value) => setField("visaAlreadyRequested", value as ProfileForm["visaAlreadyRequested"])} options={YES_NO} />
                            </Field>
                            <div className="sm:col-span-2">
                              <Field label="Documents déjà disponibles" error={errors.availableDocuments}>
                                <textarea className={`${fieldInputClass(Boolean(errors.availableDocuments))} min-h-[88px]`} maxLength={500} value={form.availableDocuments} onChange={(e) => setField("availableDocuments", e.target.value)} />
                              </Field>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 flex justify-end">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            disabled={saving}
                            onClick={() => save(section.id)}
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 disabled:opacity-60"
                          >
                            <Check className="h-4 w-4" />
                            {saving ? "Enregistrement..." : "Enregistrer"}
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700"
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
