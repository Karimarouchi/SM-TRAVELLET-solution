import type { StudentProfile } from "@/lib/auth";

export const COUNTRIES = ["Tunisie", "Algérie", "Maroc", "France", "Allemagne", "Espagne", "Italie", "Hongrie", "Lituanie", "Canada", "Belgique", "Suisse"];
export const LEVELS = ["Baccalauréat", "Licence", "Master", "Doctorat", "Autre"];
export const TARGET_LEVELS = ["Licence", "Master", "Doctorat", "Prépa / Foundation", "Autre"];
export const INTAKES = ["Septembre 2026", "Février 2027", "Septembre 2027", "Février 2028"];
export const FUNDING = ["Personnel", "Parents", "Bourse", "Prêt étudiant", "Mixte"];
export const LANG_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const FRENCH_TESTS = [
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
export const ENGLISH_TESTS = [
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
export const YES_NO = [
  { value: "yes", label: "Oui" },
  { value: "no", label: "Non" }
];

export type TestLang = "french" | "english";

export type ProfileForm = {
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

export type ProfileField = keyof ProfileForm;
export type FieldErrors = Partial<Record<ProfileField, string>>;

const NAME_LIKE = /^[\p{L}][\p{L} .'-]{1,49}$/u;
const TEXT_LIKE = /^[\p{L}0-9][\p{L}0-9 .,'/()+-]{1,79}$/u;
export const MAX_YEAR = new Date().getFullYear() + 1;

export function profileToForm(profile: StudentProfile | null): ProfileForm {
  const french = profile?.languageTestFrench || "";
  const english = profile?.languageTestEnglish || "";
  const langs: TestLang[] = [];
  if (french) langs.push("french");
  if (english) langs.push("english");
  return {
    phone: profile?.phone || "",
    nationality: profile?.nationality || "Tunisie",
    residenceCountry: profile?.residenceCountry || "Tunisie",
    city: profile?.city || "",
    currentStudyLevel: profile?.currentStudyLevel || "",
    lastDiploma: profile?.lastDiploma || "",
    studyField: profile?.studyField || "",
    currentInstitution: profile?.currentInstitution || "",
    diplomaYear: profile?.diplomaYear ? String(profile.diplomaYear) : "",
    preferredCountries: profile?.preferredCountries || [],
    preferredCity: profile?.preferredCity || "",
    targetLevel: profile?.targetLevel || "",
    targetField: profile?.targetField || "",
    targetIntake: profile?.targetIntake || "",
    targetUniversity: profile?.targetUniversity || "",
    annualBudget: profile?.annualBudget || "",
    fundingMode: profile?.fundingMode || "",
    languageLevelFrench: profile?.languageLevelFrench || "",
    languageLevelEnglish: profile?.languageLevelEnglish || "",
    hasLanguageTest: langs.length > 0,
    languageTestLangs: langs,
    languageTestFrench: french,
    languageTestEnglish: english,
    languageTestFrenchOther: profile?.languageTestFrenchOther || "",
    languageTestEnglishOther: profile?.languageTestEnglishOther || "",
    hasPassport: profile?.hasPassport === true ? "yes" : profile?.hasPassport === false ? "no" : "",
    visaAlreadyRequested: profile?.visaAlreadyRequested === true ? "yes" : profile?.visaAlreadyRequested === false ? "no" : "",
    availableDocuments: profile?.availableDocuments || ""
  };
}

export function formToPayload(form: ProfileForm) {
  return {
    ...form,
    languageTestFrench: form.hasLanguageTest && form.languageTestLangs.includes("french") ? form.languageTestFrench : "",
    languageTestEnglish: form.hasLanguageTest && form.languageTestLangs.includes("english") ? form.languageTestEnglish : "",
    languageTestFrenchOther: form.languageTestFrench === "Autre" ? form.languageTestFrenchOther.trim() : "",
    languageTestEnglishOther: form.languageTestEnglish === "Autre" ? form.languageTestEnglishOther.trim() : "",
    hasPassport: form.hasPassport === "yes",
    visaAlreadyRequested: form.visaAlreadyRequested === "yes"
  };
}

function digitsOf(value: string) {
  return value.replace(/\D/g, "");
}

export function sanitizePhone(value: string) {
  return value.replace(/[^\d+\s().-]/g, "").slice(0, 20);
}

export function validateIdentity(prenom: string, nom: string, dateNaissance: string) {
  const errors: { prenom?: string; nom?: string; dateNaissance?: string } = {};
  if (prenom.trim().length < 2 || prenom.trim().length > 40) errors.prenom = "Le prénom doit contenir entre 2 et 40 caractères.";
  else if (!NAME_LIKE.test(prenom.trim())) errors.prenom = "Le prénom ne doit contenir que des lettres.";
  if (nom.trim().length < 2 || nom.trim().length > 40) errors.nom = "Le nom doit contenir entre 2 et 40 caractères.";
  else if (!NAME_LIKE.test(nom.trim())) errors.nom = "Le nom ne doit contenir que des lettres.";
  const birth = new Date(dateNaissance);
  if (!dateNaissance || Number.isNaN(birth.getTime())) errors.dateNaissance = "La date de naissance est obligatoire.";
  else {
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() - 16);
    if (birth > limit) errors.dateNaissance = "Vous devez avoir au moins 16 ans.";
  }
  return errors;
}

export function validateField(key: ProfileField, form: ProfileForm): string {
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
      if (!TEXT_LIKE.test(text)) return "Le diplôme contient des caractères non autorisés.";
      return "";
    case "studyField":
      if (!text) return "Le domaine d’études est obligatoire.";
      if (!TEXT_LIKE.test(text)) return "Le domaine contient des caractères non autorisés.";
      return "";
    case "currentInstitution":
      if (!text) return "";
      if (!TEXT_LIKE.test(text)) return "L’établissement contient des caractères non autorisés.";
      return "";
    case "diplomaYear":
      if (!text) return "";
      const year = Number(text);
      if (!Number.isInteger(year) || year < 1980 || year > MAX_YEAR) return `L’année doit être entre 1980 et ${MAX_YEAR}.`;
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
      if (!TEXT_LIKE.test(text)) return "La formation contient des caractères non autorisés.";
      return "";
    case "targetIntake":
      return text ? "" : "Choisissez la rentrée souhaitée.";
    case "targetUniversity":
      if (!text) return "";
      if (!TEXT_LIKE.test(text)) return "L’université contient des caractères non autorisés.";
      return "";
    case "annualBudget": {
      if (!text) return "Le budget annuel est obligatoire.";
      const budget = Number(text);
      if (!Number.isFinite(budget) || budget < 500) return "Le budget minimum accepté est de 500 €.";
      if (budget > 200000) return "Le budget maximum accepté est de 200 000 €.";
      return "";
    }
    case "fundingMode":
      return text ? "" : "Choisissez le mode de financement.";
    case "languageLevelFrench":
      return text ? "" : "Choisissez votre niveau de français.";
    case "languageLevelEnglish":
      return text ? "" : "Choisissez votre niveau d’anglais.";
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
      return text.length >= 2 ? "" : "Indiquez le nom du test de français.";
    case "languageTestEnglishOther":
      if (!form.hasLanguageTest || form.languageTestEnglish !== "Autre") return "";
      return text.length >= 2 ? "" : "Indiquez le nom du test d’anglais.";
    case "hasPassport":
      return text ? "" : "Indiquez si le passeport est disponible.";
    case "visaAlreadyRequested":
      return text ? "" : "Indiquez si un visa a déjà été demandé.";
    case "availableDocuments":
      return text.length > 500 ? "500 caractères maximum." : "";
    default:
      return "";
  }
}

export const SECTION_FIELDS: Record<string, ProfileField[]> = {
  identity: ["phone", "nationality", "residenceCountry", "city"],
  school: ["currentStudyLevel", "lastDiploma", "studyField", "currentInstitution", "diplomaYear"],
  project: ["preferredCountries", "preferredCity", "targetLevel", "targetField", "targetIntake", "targetUniversity"],
  budget: [
    "annualBudget",
    "fundingMode",
    "languageLevelFrench",
    "languageLevelEnglish",
    "hasLanguageTest",
    "languageTestLangs",
    "languageTestFrench",
    "languageTestEnglish",
    "languageTestFrenchOther",
    "languageTestEnglishOther",
    "hasPassport",
    "visaAlreadyRequested",
    "availableDocuments"
  ]
};

export function validateSection(id: string, form: ProfileForm): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of SECTION_FIELDS[id] || []) {
    const message = validateField(key, form);
    if (message) errors[key] = message;
  }
  return errors;
}
