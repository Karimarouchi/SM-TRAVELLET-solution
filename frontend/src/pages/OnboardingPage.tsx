import { FancySelect } from "@/components/ui/fancy-select";
import { fetchPublicCountries, fetchPublicUniversities, getSession, saveOnboarding, type Country, type PublicUniversity } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Globe2, GraduationCap, Lock, MapPinned, Sparkles, Wallet } from "lucide-react";
import "./onboarding.css";

const COUNTRIES = ["Tunisie", "Algérie", "Maroc", "France", "Allemagne", "Espagne", "Italie", "Hongrie", "Lituanie", "Canada", "Belgique", "Suisse"];
const LEVELS = ["Baccalauréat", "Licence", "Master", "Doctorat", "Autre"];
const TARGET_LEVELS = ["Licence", "Master", "Doctorat", "Prépa / Foundation", "Autre"];
const INTAKES = ["Septembre 2026", "Février 2027", "Septembre 2027", "Février 2028"];
const FUNDING = ["Personnel", "Parents", "Bourse", "Prêt étudiant", "Mixte"];
const LANG_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const FRENCH_TESTS = [
  "TCF Tout Public / TCF TP",
  "TCF sur ordinateur / TCF SO",
  "TCF pour la DAP",
  "DELF A1",
  "DELF A2",
  "DELF B1",
  "DELF B2",
  "DALF C1",
  "DALF C2",
  "TEF",
  "Aucun test",
  "Test prévu / inscription en cours",
  "Autre"
];
const ENGLISH_TESTS = [
  "IELTS Academic",
  "IELTS General Training",
  "IELTS for UKVI Academic",
  "IELTS for UKVI General Training",
  "IELTS Life Skills A1",
  "IELTS Life Skills B1",
  "TOEFL iBT",
  "Cambridge B2 First / FCE",
  "Cambridge C1 Advanced / CAE",
  "Cambridge C2 Proficiency / CPE",
  "Cambridge B1 Preliminary / PET",
  "Cambridge A2 Key / KET",
  "PTE Academic",
  "Duolingo English Test",
  "Aucun test",
  "Test prévu / inscription en cours",
  "Autre"
];
type TestLang = "french" | "english";
const YES_NO = [
  { value: "yes", label: "Oui" },
  { value: "no", label: "Non" }
];

const NAME_LIKE = /^[\p{L}][\p{L} .'-]{1,49}$/u;
const TEXT_LIKE = /^[\p{L}0-9][\p{L}0-9 .,'/()+-]{1,79}$/u;
const MAX_YEAR = new Date().getFullYear() + 1;

type FormState = {
  phone: string;
  nationality: string;
  residenceCountry: string;
  city: string;
  currentStudyLevel: string;
  lastDiploma: string;
  studyField: string;
  currentInstitution: string;
  diplomaYear: string;
  preferredCountries: string[];
  preferredCity: string;
  targetLevel: string;
  targetField: string;
  targetIntake: string;
  targetUniversity: string;
  annualBudget: string;
  fundingMode: string;
  languageLevelFrench: string;
  languageLevelEnglish: string;
  hasLanguageTest: boolean;
  languageTestLangs: TestLang[];
  languageTestFrench: string;
  languageTestEnglish: string;
  languageTestFrenchOther: string;
  languageTestEnglishOther: string;
  hasPassport: "" | "yes" | "no";
  visaAlreadyRequested: "" | "yes" | "no";
  availableDocuments: string;
};

type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY: FormState = {
  phone: "",
  nationality: "Tunisie",
  residenceCountry: "Tunisie",
  city: "",
  currentStudyLevel: "",
  lastDiploma: "",
  studyField: "",
  currentInstitution: "",
  diplomaYear: "",
  preferredCountries: [],
  preferredCity: "",
  targetLevel: "",
  targetField: "",
  targetIntake: "",
  targetUniversity: "",
  annualBudget: "",
  fundingMode: "",
  languageLevelFrench: "",
  languageLevelEnglish: "",
  hasLanguageTest: false,
  languageTestLangs: [],
  languageTestFrench: "",
  languageTestEnglish: "",
  languageTestFrenchOther: "",
  languageTestEnglishOther: "",
  hasPassport: "",
  visaAlreadyRequested: "",
  availableDocuments: ""
};

function digitsOf(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizePhone(value: string) {
  return value.replace(/[^\d+\s().-]/g, "").slice(0, 20);
}

function validateField(key: FieldKey, form: FormState): string {
  const value = form[key];
  const text = typeof value === "string" ? value.trim() : "";

  switch (key) {
    case "phone": {
      if (!text) return "Le téléphone est obligatoire.";
      const digits = digitsOf(text);
      if (digits.length < 8) return "Le numéro doit contenir au moins 8 chiffres.";
      if (digits.length > 15) return "Le numéro ne peut pas dépasser 15 chiffres.";
      return "";
    }
    case "nationality":
      return text ? "" : "La nationalité est obligatoire.";
    case "residenceCountry":
      return text ? "" : "Le pays de résidence est obligatoire.";
    case "city":
      if (!text) return "La ville est obligatoire.";
      if (!NAME_LIKE.test(text)) return "La ville ne doit contenir que des lettres.";
      return "";
    case "currentStudyLevel":
      return text ? "" : "Choisissez votre niveau d’études.";
    case "lastDiploma":
      if (!text) return "Le dernier diplôme est obligatoire.";
      if (text.length < 2) return "Indiquez au moins 2 caractères.";
      if (!TEXT_LIKE.test(text)) return "Le diplôme contient des caractères non autorisés.";
      return "";
    case "studyField":
      if (!text) return "Le domaine d’études est obligatoire.";
      if (text.length < 2) return "Indiquez au moins 2 caractères.";
      if (!TEXT_LIKE.test(text)) return "Le domaine contient des caractères non autorisés.";
      return "";
    case "currentInstitution":
      if (!text) return "";
      if (text.length < 2) return "L’établissement doit contenir au moins 2 caractères.";
      if (!TEXT_LIKE.test(text)) return "L’établissement contient des caractères non autorisés.";
      return "";
    case "diplomaYear":
      if (!text) return "";
      const year = Number(text);
      if (!Number.isInteger(year) || year < 1980 || year > MAX_YEAR) {
        return `L’année doit être entre 1980 et ${MAX_YEAR}.`;
      }
      return "";
    case "preferredCountries":
      return form.preferredCountries.length ? "" : "Choisissez au moins un pays.";
    case "preferredCity":
      if (!text) return "";
      if (!NAME_LIKE.test(text)) return "La ville ne doit contenir que des lettres.";
      return "";
    case "targetLevel":
      return text ? "" : "Choisissez le niveau recherché.";
    case "targetField":
      if (!text) return "La formation souhaitée est obligatoire.";
      if (text.length < 2) return "Indiquez au moins 2 caractères.";
      if (!TEXT_LIKE.test(text)) return "La formation contient des caractères non autorisés.";
      return "";
    case "targetIntake":
      return text ? "" : "Choisissez la rentrée souhaitée.";
    case "targetUniversity":
      if (!text) return "";
      if (text.length < 2) return "L’université doit contenir au moins 2 caractères.";
      if (!TEXT_LIKE.test(text)) return "L’université contient des caractères non autorisés.";
      return "";
    case "annualBudget": {
      if (!text) return "Le budget annuel est obligatoire.";
      const budget = Number(text);
      if (!Number.isFinite(budget) || budget <= 0) return "Le budget doit être un montant positif.";
      if (budget < 500) return "Le budget minimum accepté est de 500 €.";
      if (budget > 200000) return "Le budget maximum accepté est de 200 000 €.";
      return "";
    }
    case "fundingMode":
      return text ? "" : "Choisissez le mode de financement.";
    case "languageLevelFrench":
      return text ? "" : "Choisissez votre niveau de français.";
    case "languageLevelEnglish":
      return text ? "" : "Choisissez votre niveau d’anglais.";
    case "hasLanguageTest":
      return "";
    case "languageTestLangs":
      if (!form.hasLanguageTest) return "";
      return form.languageTestLangs.length ? "" : "Choisissez français et / ou anglais.";
    case "languageTestFrench":
      if (!form.hasLanguageTest || !form.languageTestLangs.includes("french")) return "";
      return text ? "" : "Choisissez le test de français.";
    case "languageTestEnglish":
      if (!form.hasLanguageTest || !form.languageTestLangs.includes("english")) return "";
      return text ? "" : "Choisissez le test d’anglais.";
    case "languageTestFrenchOther":
      if (!form.hasLanguageTest || form.languageTestFrench !== "Autre") return "";
      if (!text) return "Indiquez le nom du test de français.";
      if (text.length < 2) return "Au moins 2 caractères.";
      return "";
    case "languageTestEnglishOther":
      if (!form.hasLanguageTest || form.languageTestEnglish !== "Autre") return "";
      if (!text) return "Indiquez le nom du test d’anglais.";
      if (text.length < 2) return "Au moins 2 caractères.";
      return "";
    case "hasPassport":
      return text ? "" : "Indiquez si le passeport est disponible.";
    case "visaAlreadyRequested":
      return text ? "" : "Indiquez si un visa a déjà été demandé.";
    case "availableDocuments":
      if (text.length > 500) return "500 caractères maximum.";
      return "";
    default:
      return "";
  }
}

const STEP_FIELDS: FieldKey[][] = [
  ["phone", "nationality", "residenceCountry", "city"],
  ["currentStudyLevel", "lastDiploma", "studyField", "currentInstitution", "diplomaYear"],
  ["preferredCountries", "preferredCity", "targetLevel", "targetField", "targetIntake", "targetUniversity"],
  ["annualBudget", "fundingMode", "languageLevelFrench", "languageLevelEnglish", "hasLanguageTest", "languageTestLangs", "languageTestFrench", "languageTestEnglish", "languageTestFrenchOther", "languageTestEnglishOther", "hasPassport", "visaAlreadyRequested", "availableDocuments"]
];

function validateStep(index: number, form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of STEP_FIELDS[index]) {
    const message = validateField(key, form);
    if (message) errors[key] = message;
  }
  return errors;
}

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
    <div className="block text-left">
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
    </div>
  );
}

function LockedValue({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-100 px-3 py-2.5 text-sm text-dark">
      <Lock className="h-3.5 w-3.5 shrink-0 text-muted" />
      <span className="flex-1">{value || "—"}</span>
      <span className="text-[10px] font-semibold text-muted">Renseigné par votre conseiller</span>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border bg-white/90 px-3 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400";

function fieldInputClass(hasError?: boolean) {
  return cn(
    inputClass,
    hasError
      ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
      : "border-line focus:border-brand focus:shadow-[0_0_0_4px_rgba(109,40,217,0.12)]"
  );
}

const STEPS = [
  { title: "Identité et résidence", text: "Comment vous joindre et où vous vivez", icon: MapPinned },
  { title: "Parcours académique", text: "Votre niveau actuel et vos diplômes", icon: GraduationCap },
  { title: "Projet d’études", text: "Pays, formation et rentrée visés", icon: Globe2 },
  { title: "Budget, langue et documents", text: "Préparez l’accompagnement pratique", icon: Wallet }
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [universities, setUniversities] = useState<PublicUniversity[]>([]);
  const lockedFields = new Set(session?.profile?.lockedFields || []);
  const destinations = countries.map((c) => c.name);

  useEffect(() => {
    fetchPublicCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  // Universités disponibles = union des universités des pays préférés
  // actuellement sélectionnés (source de vérité = table country_universities,
  // administrée depuis /admin/programmes).
  useEffect(() => {
    const ids = countries.filter((c) => form.preferredCountries.includes(c.name)).map((c) => c.id);
    if (!ids.length) {
      setUniversities([]);
      return;
    }
    fetchPublicUniversities(ids).then(setUniversities).catch(() => setUniversities([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.preferredCountries, countries]);

  // Pré-remplit les champs déjà renseignés par un code Sales (verrouillés),
  // pour qu'ils ne s'affichent jamais vides à l'ouverture de l'onboarding.
  useEffect(() => {
    const profile = session?.profile;
    if (!profile) return;
    setForm((current) => ({
      ...current,
      phone: profile.phone || current.phone,
      currentStudyLevel: profile.currentStudyLevel || current.currentStudyLevel,
      targetLevel: profile.targetLevel || current.targetLevel,
      preferredCountries: profile.preferredCountries?.length ? profile.preferredCountries : current.preferredCountries
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends FieldKey>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError("");
  }

  function toggleCountry(country: string) {
    setForm((current) => ({
      ...current,
      preferredCountries: current.preferredCountries.includes(country)
        ? current.preferredCountries.filter((item) => item !== country)
        : [...current.preferredCountries, country]
    }));
    setErrors((current) => ({ ...current, preferredCountries: undefined }));
    setFormError("");
  }

  function toggleTestLang(lang: TestLang) {
    setForm((current) => {
      const active = current.languageTestLangs.includes(lang);
      return {
        ...current,
        languageTestLangs: active
          ? current.languageTestLangs.filter((item) => item !== lang)
          : [...current.languageTestLangs, lang],
        languageTestFrench: lang === "french" && active ? "" : current.languageTestFrench,
        languageTestEnglish: lang === "english" && active ? "" : current.languageTestEnglish,
        languageTestFrenchOther: lang === "french" && active ? "" : current.languageTestFrenchOther,
        languageTestEnglishOther: lang === "english" && active ? "" : current.languageTestEnglishOther
      };
    });
    setErrors((current) => ({
      ...current,
      languageTestLangs: undefined,
      languageTestFrench: undefined,
      languageTestEnglish: undefined,
      languageTestFrenchOther: undefined,
      languageTestEnglishOther: undefined
    }));
    setFormError("");
  }

  function goNext() {
    const nextErrors = validateStep(step, form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setFormError("Corrigez les champs indiqués avant de continuer.");
      return;
    }
    setErrors({});
    setFormError("");
    setDirection(1);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrors({});
    setFormError("");
    setDirection(-1);
    setStep((current) => Math.max(0, current - 1));
  }

  async function finish() {
    const nextErrors = validateStep(3, form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setFormError("Corrigez les champs indiqués avant d’enregistrer.");
      return;
    }
    setErrors({});
    setFormError("");
    setLoading(true);
    try {
      await saveOnboarding({
        ...form,
        languageLevelFrench: form.languageLevelFrench,
        languageLevelEnglish: form.languageLevelEnglish,
        hasLanguageTest: form.hasLanguageTest,
        languageTestLangs: form.languageTestLangs,
        languageTestFrench: form.hasLanguageTest && form.languageTestLangs.includes("french") ? form.languageTestFrench : "",
        languageTestEnglish: form.hasLanguageTest && form.languageTestLangs.includes("english") ? form.languageTestEnglish : "",
        languageTestFrenchOther: form.languageTestFrench === "Autre" ? form.languageTestFrenchOther.trim() : "",
        languageTestEnglishOther: form.languageTestEnglish === "Autre" ? form.languageTestEnglishOther.trim() : "",
        hasPassport: form.hasPassport === "yes",
        visaAlreadyRequested: form.visaAlreadyRequested === "yes"
      });
      navigate("/espace");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible d’enregistrer le dossier.");
    } finally {
      setLoading(false);
    }
  }

  if (!session?.user) {
    navigate("/login");
    return null;
  }

  if (session.user.role !== "STUDENT" || session.user.onboardingCompleted) {
    navigate("/espace");
    return null;
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding-root">
      <span className="ob-orb ob-orb-1" />
      <span className="ob-orb ob-orb-2" />
      <span className="ob-orb ob-orb-3" />

      <div className="relative z-10 my-auto w-full max-w-2xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="inline-flex items-center justify-center gap-2 font-caps text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Premier accès
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-white md:text-4xl">
            Complétez votre dossier, {session.user.prenom}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-violet-100/80">
            Une carte à la fois. Suivant pour continuer, Terminer pour enregistrer tout le dossier.
          </p>

          <div className="mx-auto mt-6 flex max-w-md items-center gap-2">
            {STEPS.map((item, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <div key={item.title} className="flex flex-1 items-center gap-2">
                  <motion.span
                    animate={{
                      scale: active ? 1.05 : 1,
                      backgroundColor: done || active ? "#ffffff" : "rgba(255,255,255,0.18)",
                      color: done || active ? "#6d28d9" : "#ddd6fe"
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  >
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </motion.span>
                  {index < STEPS.length - 1 && (
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                      <motion.div
                        className="h-full rounded-full bg-white"
                        animate={{ width: done ? "100%" : "0%" }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            Carte {step + 1} / {STEPS.length} · {current.title}
          </p>
        </motion.div>

        <motion.article
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 overflow-visible rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.28)] backdrop-blur-xl md:p-8"
        >
          <div className="mb-5 flex items-center justify-center gap-3 text-left sm:justify-start">
            <motion.span
              key={current.title}
              initial={{ scale: 0.7, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-brand-light text-brand shadow-inner"
            >
              <Icon className="h-5 w-5" />
            </motion.span>
            <div>
              <h2 className="font-display text-xl font-bold">{current.title}</h2>
              <p className="text-xs text-muted">{current.text}</p>
            </div>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 36 : -36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -36 : 36 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Téléphone" required error={errors.phone}>
                    {lockedFields.has("phone") ? (
                      <LockedValue value={form.phone} />
                    ) : (
                      <input
                        className={fieldInputClass(Boolean(errors.phone))}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={20}
                        value={form.phone}
                        onChange={(e) => set("phone", sanitizePhone(e.target.value))}
                        placeholder="56 819 899"
                      />
                    )}
                  </Field>
                  <Field label="Nationalité" required error={errors.nationality}>
                    <FancySelect invalid={Boolean(errors.nationality)} value={form.nationality} onChange={(value) => set("nationality", value)} options={COUNTRIES} />
                  </Field>
                  <Field label="Pays de résidence" required error={errors.residenceCountry}>
                    <FancySelect invalid={Boolean(errors.residenceCountry)} value={form.residenceCountry} onChange={(value) => set("residenceCountry", value)} options={COUNTRIES} />
                  </Field>
                  <Field label="Ville" required error={errors.city}>
                    <input
                      className={fieldInputClass(Boolean(errors.city))}
                      value={form.city}
                      maxLength={50}
                      onChange={(e) => set("city", e.target.value)}
                      placeholder="Tunis"
                    />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Niveau d’études actuel" required error={errors.currentStudyLevel}>
                    {lockedFields.has("currentStudyLevel") ? (
                      <LockedValue value={form.currentStudyLevel} />
                    ) : (
                      <FancySelect invalid={Boolean(errors.currentStudyLevel)} value={form.currentStudyLevel} onChange={(value) => set("currentStudyLevel", value)} options={LEVELS} placeholder="Choisir un niveau" />
                    )}
                  </Field>
                  <Field label="Dernier diplôme obtenu" required error={errors.lastDiploma}>
                    <input className={fieldInputClass(Boolean(errors.lastDiploma))} maxLength={80} value={form.lastDiploma} onChange={(e) => set("lastDiploma", e.target.value)} placeholder="Bac, Licence..." />
                  </Field>
                  <Field label="Domaine d’études" required error={errors.studyField}>
                    <input className={fieldInputClass(Boolean(errors.studyField))} maxLength={80} value={form.studyField} onChange={(e) => set("studyField", e.target.value)} placeholder="Informatique, Droit..." />
                  </Field>
                  <Field label="Établissement actuel / précédent" error={errors.currentInstitution}>
                    <input className={fieldInputClass(Boolean(errors.currentInstitution))} maxLength={80} value={form.currentInstitution} onChange={(e) => set("currentInstitution", e.target.value)} placeholder="Université / lycée" />
                  </Field>
                  <Field label="Année d’obtention" error={errors.diplomaYear}>
                    <input
                      className={fieldInputClass(Boolean(errors.diplomaYear))}
                      type="number"
                      min={1980}
                      max={MAX_YEAR}
                      step={1}
                      value={form.diplomaYear}
                      onChange={(e) => set("diplomaYear", e.target.value)}
                      placeholder="2024"
                    />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-3">
                  <Field label="Pays préférés" required error={errors.preferredCountries}>
                    {lockedFields.has("preferredCountries") ? (
                      <div className="mt-1">
                        <LockedValue value={form.preferredCountries.join(", ")} />
                      </div>
                    ) : (
                      <div className={cn("mt-1 flex flex-wrap gap-2 rounded-2xl p-1", errors.preferredCountries && "ring-2 ring-red-200")}>
                        {destinations.map((country) => {
                          const active = form.preferredCountries.includes(country);
                          return (
                            <motion.button
                              key={country}
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => toggleCountry(country)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                active
                                  ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                                  : "border-line bg-white text-mid hover:border-brand/40 hover:bg-brand-light"
                              }`}
                            >
                              {country}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Ville préférée" error={errors.preferredCity}>
                      <input className={fieldInputClass(Boolean(errors.preferredCity))} maxLength={50} value={form.preferredCity} onChange={(e) => set("preferredCity", e.target.value)} placeholder="Paris, Berlin..." />
                    </Field>
                    <Field label="Niveau recherché" required error={errors.targetLevel}>
                      {lockedFields.has("targetLevel") ? (
                        <LockedValue value={form.targetLevel} />
                      ) : (
                        <FancySelect invalid={Boolean(errors.targetLevel)} value={form.targetLevel} onChange={(value) => set("targetLevel", value)} options={TARGET_LEVELS} placeholder="Choisir un niveau" />
                      )}
                    </Field>
                    <Field label="Domaine / formation souhaitée" required error={errors.targetField}>
                      <input className={fieldInputClass(Boolean(errors.targetField))} maxLength={80} value={form.targetField} onChange={(e) => set("targetField", e.target.value)} placeholder="Master Data, MBA..." />
                    </Field>
                    <Field label="Rentrée souhaitée" required error={errors.targetIntake}>
                      <FancySelect invalid={Boolean(errors.targetIntake)} value={form.targetIntake} onChange={(value) => set("targetIntake", value)} options={INTAKES} placeholder="Choisir une rentrée" />
                    </Field>
                    <Field label="Université précise" error={errors.targetUniversity}>
                      <FancySelect
                        invalid={Boolean(errors.targetUniversity)}
                        value={form.targetUniversity}
                        onChange={(value) => set("targetUniversity", value)}
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

              {step === 3 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Budget annuel estimé (EUR)" required error={errors.annualBudget}>
                    <input
                      className={fieldInputClass(Boolean(errors.annualBudget))}
                      type="number"
                      min={500}
                      max={200000}
                      step={100}
                      value={form.annualBudget}
                      onChange={(e) => set("annualBudget", e.target.value)}
                      placeholder="8000"
                    />
                  </Field>
                  <Field label="Mode de financement" required error={errors.fundingMode}>
                    <FancySelect invalid={Boolean(errors.fundingMode)} value={form.fundingMode} onChange={(value) => set("fundingMode", value)} options={FUNDING} placeholder="Choisir un financement" />
                  </Field>
                  <Field label="Niveau de français" required error={errors.languageLevelFrench}>
                    <FancySelect invalid={Boolean(errors.languageLevelFrench)} value={form.languageLevelFrench} onChange={(value) => set("languageLevelFrench", value)} options={LANG_LEVELS} placeholder="A1 à C2" />
                  </Field>
                  <Field label="Niveau d’anglais" required error={errors.languageLevelEnglish}>
                    <FancySelect invalid={Boolean(errors.languageLevelEnglish)} value={form.languageLevelEnglish} onChange={(value) => set("languageLevelEnglish", value)} options={LANG_LEVELS} placeholder="A1 à C2" />
                  </Field>
                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white/90 px-4 py-3 transition-colors hover:border-brand/40">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-brand"
                        checked={form.hasLanguageTest}
                        onChange={(e) => {
                          set("hasLanguageTest", e.target.checked);
                          if (!e.target.checked) {
                            set("languageTestLangs", []);
                            set("languageTestFrench", "");
                            set("languageTestEnglish", "");
                            set("languageTestFrenchOther", "");
                            set("languageTestEnglishOther", "");
                          }
                        }}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-dark">Test de langue déjà passé</span>
                        <span className="block text-xs text-muted">Cochez, choisissez français et / ou anglais, puis le test.</span>
                      </span>
                    </label>
                    <AnimatePresence>
                      {form.hasLanguageTest && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                        >
                          <div className="mt-3 grid gap-3">
                            <Field label="Langue du test" required error={errors.languageTestLangs}>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { id: "french" as const, label: "Français" },
                                  { id: "english" as const, label: "Anglais" }
                                ]).map((item) => {
                                  const active = form.languageTestLangs.includes(item.id);
                                  return (
                                    <motion.button
                                      key={item.id}
                                      type="button"
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => toggleTestLang(item.id)}
                                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                                        active
                                          ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                                          : "border-line bg-white text-mid hover:border-brand/40 hover:bg-brand-light"
                                      }`}
                                    >
                                      {item.label}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </Field>

                            {form.languageTestLangs.includes("french") && (
                              <>
                                <Field label="Test de français" required error={errors.languageTestFrench}>
                                  <FancySelect
                                    invalid={Boolean(errors.languageTestFrench)}
                                    value={form.languageTestFrench}
                                    onChange={(value) => {
                                      set("languageTestFrench", value);
                                      if (value !== "Autre") set("languageTestFrenchOther", "");
                                    }}
                                    options={FRENCH_TESTS}
                                    placeholder="Choisir un test français"
                                  />
                                </Field>
                                {form.languageTestFrench === "Autre" && (
                                  <Field label="Précisez le test de français" required error={errors.languageTestFrenchOther}>
                                    <input
                                      className={fieldInputClass(Boolean(errors.languageTestFrenchOther))}
                                      maxLength={80}
                                      value={form.languageTestFrenchOther}
                                      onChange={(e) => set("languageTestFrenchOther", e.target.value)}
                                      placeholder="Nom du test"
                                    />
                                  </Field>
                                )}
                              </>
                            )}

                            {form.languageTestLangs.includes("english") && (
                              <>
                                <Field label="Test d’anglais" required error={errors.languageTestEnglish}>
                                  <FancySelect
                                    invalid={Boolean(errors.languageTestEnglish)}
                                    value={form.languageTestEnglish}
                                    onChange={(value) => {
                                      set("languageTestEnglish", value);
                                      if (value !== "Autre") set("languageTestEnglishOther", "");
                                    }}
                                    options={ENGLISH_TESTS}
                                    placeholder="Choisir un test anglais"
                                  />
                                </Field>
                                {form.languageTestEnglish === "Autre" && (
                                  <Field label="Précisez le test d’anglais" required error={errors.languageTestEnglishOther}>
                                    <input
                                      className={fieldInputClass(Boolean(errors.languageTestEnglishOther))}
                                      maxLength={80}
                                      value={form.languageTestEnglishOther}
                                      onChange={(e) => set("languageTestEnglishOther", e.target.value)}
                                      placeholder="Name of the test"
                                    />
                                  </Field>
                                )}
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Field label="Passeport disponible" required error={errors.hasPassport}>
                    <FancySelect
                      invalid={Boolean(errors.hasPassport)}
                      value={form.hasPassport}
                      onChange={(value) => set("hasPassport", value as FormState["hasPassport"])}
                      options={YES_NO}
                      placeholder="Oui / Non"
                    />
                  </Field>
                  <Field label="Visa déjà demandé" required error={errors.visaAlreadyRequested}>
                    <FancySelect
                      invalid={Boolean(errors.visaAlreadyRequested)}
                      value={form.visaAlreadyRequested}
                      onChange={(value) => set("visaAlreadyRequested", value as FormState["visaAlreadyRequested"])}
                      options={YES_NO}
                      placeholder="Oui / Non"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Documents déjà disponibles" error={errors.availableDocuments}>
                      <textarea
                        className={`${fieldInputClass(Boolean(errors.availableDocuments))} min-h-[88px]`}
                        maxLength={500}
                        value={form.availableDocuments}
                        onChange={(e) => set("availableDocuments", e.target.value)}
                        placeholder="Passeport, relevés, diplôme..."
                      />
                    </Field>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {formError && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {formError}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <motion.button
              type="button"
              whileHover={step === 0 ? undefined : { scale: 1.02 }}
              whileTap={step === 0 ? undefined : { scale: 0.98 }}
              onClick={goBack}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-full border-2 border-line px-5 py-2.5 text-sm font-semibold text-mid disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </motion.button>

            {isLast ? (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={finish}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-dark px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/30 disabled:opacity-70"
              >
                {loading ? "Enregistrement..." : "Terminer"}
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={goNext}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-dark px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/30"
              >
                Suivant
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </motion.article>
      </div>
    </div>
  );
}
