const fs = require("fs");
const path = require("path");
const students = require("../repositories/studentRepository");
const users = require("../repositories/userRepository");
const sales = require("../repositories/salesRepository");
const settings = require("../repositories/settingsRepository");
const { studentProfileDto, userDto, formatPgDate, lockedFieldsFromRow } = require("../dto/userDto");
const { canAccessStudent } = require("../security/rbac");
const { canViewStudent } = require("../security/studentView");
const countryUniversityService = require("./countryUniversityService");
const notificationService = require("./notificationService");
const autoAssign = require("./autoAssignService");
const passport = require("./passport");
const whatsappService = require("./whatsappService");
const { normalizePhone } = whatsappService;

const AVATAR_DIR = path.join(__dirname, "../../uploads/avatars");
const MAX_AVATAR_BYTES = 600 * 1024;

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
// Tests proposés pour les langues supplémentaires (même fin de liste que le français et l'anglais).
const EXTRA_TESTS = {
  german: {
    label: "Allemand",
    adjective: "d’allemand",
    tests: ["Goethe-Zertifikat A1", "Goethe-Zertifikat A2", "Goethe-Zertifikat B1", "Goethe-Zertifikat B2", "Goethe-Zertifikat C1", "Goethe-Zertifikat C2", "TestDaF", "DSH", "telc Deutsch B1", "telc Deutsch B2", "TestAS", "ÖSD", "Aucun test", "Test prévu / inscription en cours", "Autre"]
  },
  italian: {
    label: "Italien",
    adjective: "d’italien",
    tests: ["CILS B1", "CILS B2", "CILS C1", "CILS C2", "CELI A2", "CELI B1", "CELI B2", "CELI C1", "CELI C2", "PLIDA B1", "PLIDA B2", "PLIDA C1", "PLIDA C2", "Aucun test", "Test prévu / inscription en cours", "Autre"]
  },
  spanish: {
    label: "Espagnol",
    adjective: "d’espagnol",
    tests: ["DELE A1", "DELE A2", "DELE B1", "DELE B2", "DELE C1", "DELE C2", "SIELE", "Aucun test", "Test prévu / inscription en cours", "Autre"]
  }
};

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

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return `${label} est obligatoire.`;
  }
  return null;
}

// Numéro et date d'expiration : lus seulement si l'étudiant a un passeport. La
// présence est exigée dans saveOnboarding (première fin d'onboarding), ici on
// vérifie le FORMAT de ce qui est fourni.
function validatePassport(body) {
  if (body.hasPassport !== true) return { passportNumber: "", passportExpiresOn: "" };
  const fail = (message) => {
    const error = new Error(message);
    error.status = 400;
    return error;
  };
  const number = passport.normalizePassportNumber(body.passportNumber);
  if (number && !passport.isValidPassportNumber(number)) {
    throw fail("Le numéro de passeport doit contenir 5 à 20 lettres ou chiffres.");
  }
  const rawExpiry = String(body.passportExpiresOn || "").trim();
  if (rawExpiry) {
    const expiry = passport.parseExpiry(rawExpiry);
    if (!expiry || !passport.isPlausibleExpiry(expiry)) throw fail("La date d'expiration du passeport est invalide.");
  }
  return { passportNumber: number, passportExpiresOn: rawExpiry };
}

function validateOnboarding(body) {
  const preferredCountries = Array.isArray(body.preferredCountries)
    ? body.preferredCountries.map((item) => String(item).trim()).filter(Boolean)
    : String(body.preferredCountries || "").split(",").map((item) => item.trim()).filter(Boolean);

  const errors = [
    required(body.nationality, "La nationalité"),
    required(body.residenceCountry, "Le pays de résidence"),
    required(body.city, "La ville"),
    required(body.currentStudyLevel, "Le niveau d’études actuel"),
    required(body.lastDiploma, "Le dernier diplôme"),
    required(body.studyField, "Le domaine d’études"),
    preferredCountries.length ? null : "Au moins un pays préféré est obligatoire.",
    required(body.targetLevel, "Le niveau recherché"),
    required(body.targetField, "La formation souhaitée"),
    required(body.targetIntake, "La rentrée souhaitée"),
    required(body.annualBudget, "Le budget annuel estimé"),
    required(body.fundingMode, "Le mode de financement"),
    required(body.languageLevelFrench, "Le niveau de français"),
    required(body.languageLevelEnglish, "Le niveau d’anglais"),
    body.hasPassport === true || body.hasPassport === false ? null : "Indiquez si le passeport est disponible.",
    body.visaAlreadyRequested === true || body.visaAlreadyRequested === false
      ? null
      : "Indiquez si un visa a déjà été demandé."
  ].filter(Boolean);

  if (errors.length) {
    const error = new Error(errors[0]);
    error.status = 400;
    throw error;
  }

  // Le téléphone est saisi à l'inscription : l'onboarding ne le demande plus,
  // il n'est validé ici que s'il est fourni.
  const phoneDigits = String(body.phone || "").replace(/\D/g, "");
  if (body.phone && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
    const error = new Error("Le numéro de téléphone doit contenir entre 8 et 15 chiffres.");
    error.status = 400;
    throw error;
  }

  const city = String(body.city || "").trim();
  if (!/^[\p{L}][\p{L} .'-]{1,49}$/u.test(city)) {
    const error = new Error("La ville ne doit contenir que des lettres.");
    error.status = 400;
    throw error;
  }

  const budget = Number(body.annualBudget);
  if (!Number.isFinite(budget) || budget < 500 || budget > 200000) {
    const error = new Error("Le budget annuel doit être compris entre 500 et 200 000 €.");
    error.status = 400;
    throw error;
  }

  const cefr = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const french = String(body.languageLevelFrench || "").trim();
  const english = String(body.languageLevelEnglish || "").trim();
  if (!cefr.includes(french) || !cefr.includes(english)) {
    const error = new Error("Les niveaux de français et d’anglais doivent être entre A1 et C2.");
    error.status = 400;
    throw error;
  }

  // Allemand, italien, espagnol : facultatifs (vide = aucun niveau), sinon A1 à C2.
  const extraLevels = {};
  for (const [key, label] of [["languageLevelGerman", "allemand"], ["languageLevelItalian", "italien"], ["languageLevelSpanish", "espagnol"]]) {
    const value = String(body[key] || "").trim();
    if (value && !cefr.includes(value)) {
      const error = new Error(`Le niveau d’${label === "allemand" ? "allemand" : label} doit être entre A1 et C2.`);
      error.status = 400;
      throw error;
    }
    extraLevels[key] = value;
  }

  const hasLanguageTest = Boolean(body.hasLanguageTest);
  const langs = Array.isArray(body.languageTestLangs)
    ? body.languageTestLangs.filter((item) => item === "french" || item === "english" || Object.prototype.hasOwnProperty.call(EXTRA_TESTS, item))
    : [];
  const languageTestFrench = String(body.languageTestFrench || "").trim();
  const languageTestEnglish = String(body.languageTestEnglish || "").trim();
  const languageTestFrenchOther = String(body.languageTestFrenchOther || "").trim();
  const languageTestEnglishOther = String(body.languageTestEnglishOther || "").trim();

  if (hasLanguageTest) {
    if (!langs.length) {
      const error = new Error("Choisissez la ou les langues du test.");
      error.status = 400;
      throw error;
    }
    if (langs.includes("french") && !FRENCH_TESTS.includes(languageTestFrench)) {
      const error = new Error("Choisissez le test de français.");
      error.status = 400;
      throw error;
    }
    if (langs.includes("english") && !ENGLISH_TESTS.includes(languageTestEnglish)) {
      const error = new Error("Choisissez le test d’anglais.");
      error.status = 400;
      throw error;
    }
    if (languageTestFrench === "Autre" && languageTestFrenchOther.length < 2) {
      const error = new Error("Précisez le test de français.");
      error.status = 400;
      throw error;
    }
    if (languageTestEnglish === "Autre" && languageTestEnglishOther.length < 2) {
      const error = new Error("Précisez le test d’anglais.");
      error.status = 400;
      throw error;
    }
  }

  // Allemand / italien / espagnol : seuls ceux cochés sont gardés, avec leur test.
  const languageTestsExtra = {};
  for (const [lang, config] of Object.entries(EXTRA_TESTS)) {
    if (!hasLanguageTest || !langs.includes(lang)) continue;
    const raw = (body.languageTestsExtra && body.languageTestsExtra[lang]) || {};
    const test = String(raw.test || "").trim();
    const other = String(raw.other || "").trim();
    if (!config.tests.includes(test)) {
      const error = new Error(`Choisissez le test ${config.adjective}.`);
      error.status = 400;
      throw error;
    }
    if (test === "Autre" && other.length < 2) {
      const error = new Error(`Précisez le test ${config.adjective}.`);
      error.status = 400;
      throw error;
    }
    languageTestsExtra[lang] = { test, other: test === "Autre" ? other.slice(0, 120) : "" };
  }

  const frenchTestLabel = languageTestFrench === "Autre" ? languageTestFrenchOther : languageTestFrench;
  const englishTestLabel = languageTestEnglish === "Autre" ? languageTestEnglishOther : languageTestEnglish;
  const languageTest = hasLanguageTest
    ? [
        langs.includes("french") && frenchTestLabel ? `Français: ${frenchTestLabel}` : "",
        langs.includes("english") && englishTestLabel ? `Anglais: ${englishTestLabel}` : "",
        ...Object.entries(languageTestsExtra).map(([lang, value]) => `${EXTRA_TESTS[lang].label}: ${value.test === "Autre" ? value.other : value.test}`)
      ].filter(Boolean).join(" | ")
    : "";

  let diplomaYear = null;
  if (body.diplomaYear) {
    diplomaYear = Number(body.diplomaYear);
    if (!Number.isInteger(diplomaYear) || diplomaYear < 1980 || diplomaYear > new Date().getFullYear() + 1) {
      const error = new Error("L’année d’obtention du diplôme est invalide.");
      error.status = 400;
      throw error;
    }
  }

  return {
    phone: body.phone ? String(body.phone).trim() : "",
    nationality: String(body.nationality).trim(),
    residenceCountry: String(body.residenceCountry).trim(),
    city: String(body.city).trim(),
    currentStudyLevel: String(body.currentStudyLevel).trim(),
    lastDiploma: String(body.lastDiploma).trim(),
    studyField: String(body.studyField).trim(),
    currentInstitution: String(body.currentInstitution || "").trim(),
    diplomaYear,
    preferredCountries,
    preferredCity: String(body.preferredCity || "").trim(),
    targetLevel: String(body.targetLevel).trim(),
    targetField: String(body.targetField).trim(),
    targetIntake: String(body.targetIntake).trim(),
    targetUniversity: body.targetUniversity
      ? countryUniversityService.sanitizeName(String(body.targetUniversity || "").trim())
      : "",
    annualBudget: budget,
    fundingMode: String(body.fundingMode).trim(),
    languageLevel: `Français ${french} / Anglais ${english}`,
    languageLevelFrench: french,
    languageLevelEnglish: english,
    ...extraLevels,
    languageTest,
    languageTestFrench: hasLanguageTest && langs.includes("french") ? languageTestFrench : "",
    languageTestEnglish: hasLanguageTest && langs.includes("english") ? languageTestEnglish : "",
    languageTestFrenchOther: languageTestFrench === "Autre" ? languageTestFrenchOther : "",
    languageTestEnglishOther: languageTestEnglish === "Autre" ? languageTestEnglishOther : "",
    languageTestsExtra,
    hasPassport: Boolean(body.hasPassport),
    ...validatePassport(body),
    visaAlreadyRequested: Boolean(body.visaAlreadyRequested),
    availableDocuments: String(body.availableDocuments || "").trim()
  };
}

function isAdultEnough(dateNaissance) {
  const birth = new Date(dateNaissance);
  if (Number.isNaN(birth.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 16);
  return birth <= limit;
}

async function updateIdentity(userId, body) {
  const prenom = String(body.prenom || "").trim();
  const nom = String(body.nom || "").trim();
  const dateNaissance = String(body.dateNaissance || "").trim();
  if (prenom.length < 2 || prenom.length > 40) {
    const error = new Error("Le prénom doit contenir entre 2 et 40 caractères.");
    error.status = 400;
    throw error;
  }
  if (nom.length < 2 || nom.length > 40) {
    const error = new Error("Le nom doit contenir entre 2 et 40 caractères.");
    error.status = 400;
    throw error;
  }
  if (!isAdultEnough(dateNaissance)) {
    const error = new Error("Vous devez avoir au moins 16 ans.");
    error.status = 400;
    throw error;
  }
  const user = await users.updateIdentity(userId, { prenom, nom, dateNaissance });
  const profile = studentProfileDto(await students.ensureProfile(userId));
  return { user: userDto(user, { onboardingCompleted: profile.onboardingCompleted }), profile };
}

async function saveAvatar(userId, dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    const error = new Error("Envoie une photo JPG, PNG ou WEBP.");
    error.status = 400;
    throw error;
  }
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) {
    const error = new Error("La photo est vide.");
    error.status = 400;
    throw error;
  }
  if (buffer.length > MAX_AVATAR_BYTES) {
    const error = new Error("La photo ne peut pas dépasser 600 Ko.");
    error.status = 400;
    throw error;
  }
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  const filename = `${userId}.jpg`;
  fs.writeFileSync(path.join(AVATAR_DIR, filename), buffer);
  const avatarUrl = `/uploads/avatars/${filename}`;
  const user = await users.updateAvatar(userId, avatarUrl);
  const profile = studentProfileDto(await students.ensureProfile(userId));
  const dto = userDto(user, { onboardingCompleted: profile.onboardingCompleted });
  dto.avatarUrl = `${avatarUrl}?t=${Date.now()}`;
  return { user: dto, profile };
}

async function getMine(userId) {
  const user = await users.findById(userId);
  const profile = studentProfileDto(await students.ensureProfile(userId));
  return { user: userDto(user, { onboardingCompleted: profile.onboardingCompleted }), profile };
}

async function saveOnboarding(userId, body) {
  const account = await users.findById(userId);
  if (account && account.email_verified === false) {
    const error = new Error("Vérifiez votre adresse email avant de compléter votre dossier.");
    error.status = 403;
    throw error;
  }
  const fields = validateOnboarding(body);
  const existingRow = await students.ensureProfile(userId);
  const locked = lockedFieldsFromRow(existingRow);

  // Passeport : obligatoire à la PREMIÈRE fin d'onboarding. Les étudiants déjà
  // inscrits (avant cette règle) ne sont pas bloqués quand ils modifient leur
  // profil : leurs valeurs existantes sont conservées si le formulaire ne les
  // renvoie pas.
  const firstOnboarding = !existingRow.onboarding_completed;
  if (fields.hasPassport && firstOnboarding && (!fields.passportNumber || !fields.passportExpiresOn)) {
    const error = new Error("Indiquez le numéro de votre passeport et sa date d'expiration.");
    error.status = 400;
    throw error;
  }
  if (fields.hasPassport) {
    if (!fields.passportNumber) fields.passportNumber = existingRow.passport_number || "";
    if (!fields.passportExpiresOn) fields.passportExpiresOn = passport.formatExpiry(existingRow.passport_expires_on);
  }
  const previousExpiry = passport.formatExpiry(existingRow.passport_expires_on);

  // Un champ pré-rempli par un code Sales ne peut pas être modifié par
  // l'étudiant, même si la requête tente de le changer (défense côté
  // serveur, indépendante du verrouillage visuel côté frontend).
  if (locked.includes("preferredCountries")) fields.preferredCountries = existingRow.preferred_countries || [];
  if (locked.includes("currentStudyLevel")) fields.currentStudyLevel = existingRow.current_study_level || "";
  if (locked.includes("targetLevel")) fields.targetLevel = existingRow.target_level || "";
  if (locked.includes("phone") || !fields.phone) fields.phone = existingRow.phone || "";

  // Un numéro n'appartient qu'à un seul étudiant. Vérifié seulement quand il
  // change : un doublon ancien déjà en base ne bloque pas les autres champs.
  const phoneChanged = normalizePhone(fields.phone) !== normalizePhone(existingRow.phone);
  if (phoneChanged && fields.phone && (await students.findStudentIdByPhone(normalizePhone(fields.phone), userId))) {
    const error = new Error("Ce numéro de téléphone est déjà utilisé par un autre compte.");
    error.status = 409;
    throw error;
  }

  let profile = studentProfileDto(await students.updateOnboarding(userId, fields));
  if (!profile.assignedSalesId && (await settings.isAutoAssignEnabled())) {
    // Pourcentages si le mode est activé dans Paramètres, sinon le moins chargé.
    const salesId = await autoAssign.pickOrFallback("students", () => sales.findLeastLoadedActive());
    if (salesId) {
      profile = studentProfileDto(await students.assignSales(userId, salesId));
      await notificationService.notifyStudentAssigned(salesId, userId);
    }
  }
  if (phoneChanged) await whatsappService.linkStudentByPhone(userId, fields.phone);

  // L'université visée dans la fiche devient le premier vœu de candidature.
  await require("./universityChoiceService").ensureInitialChoice(userId).catch(() => undefined);

  // Passeport à renouveler (expiré ou < 24 mois) : l'admin et le conseiller déjà
  // en charge sont prévenus, une seule fois par date saisie. Un conseiller
  // attribué à l'instant (auto-attribution) l'apprend via sa notification
  // d'attribution.
  if (fields.hasPassport && fields.passportExpiresOn && fields.passportExpiresOn !== previousExpiry) {
    await notificationService.notifyPassportRisk(userId, { admins: true, salesId: existingRow.assigned_sales_id || null });
  }
  return { profile, onboardingCompleted: true, assignedSalesId: profile.assignedSalesId || null };
}

function normalizePagination(query) {
  const page = Math.max(1, Number.parseInt(query?.page, 10) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number.parseInt(query?.pageSize, 10) || 50));
  const search = String(query?.search || "").trim();
  return { page, pageSize, search };
}

async function listStudents(auth, query) {
  const pagination = normalizePagination(query);
  let result;
  if (auth.role === "ADMIN") {
    result = await students.listAll(pagination);
  } else if (auth.role === "SALES") {
    result = await students.listForSales(auth.sub, pagination);
  } else {
    const error = new Error("Accès refusé.");
    error.status = 403;
    throw error;
  }
  return {
    students: result.rows.map(mapListRow),
    total: result.total,
    page: pagination.page,
    pageSize: pagination.pageSize
  };
}

function mapListRow(row) {
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    email: row.email,
    dateNaissance: formatPgDate(row.date_naissance),
    onboardingCompleted: Boolean(row.onboarding_completed),
    assignedSalesId: row.assigned_sales_id || null,
    residenceCountry: row.residence_country || "",
    preferredCountries: row.preferred_countries || [],
    targetField: row.target_field || "",
    phone: row.phone || "",
    city: row.city || "",
    currentStudyLevel: row.current_study_level || "",
    avatarUrl: row.avatar_url || ""
  };
}

async function assignSales(auth, studentId, salesId) {
  if (auth.role !== "ADMIN") {
    const error = new Error("Seul un administrateur peut réaffecter un étudiant.");
    error.status = 403;
    throw error;
  }
  const student = await users.findById(studentId);
  if (!student || student.role !== "STUDENT") {
    const error = new Error("Étudiant introuvable.");
    error.status = 404;
    throw error;
  }
  let nextSalesId = null;
  if (salesId) {
    const salesUser = await users.findById(salesId);
    if (!salesUser || salesUser.role !== "SALES") {
      const error = new Error("Conseiller introuvable.");
      error.status = 404;
      throw error;
    }
    nextSalesId = salesUser.id;
  }
  const previous = await students.ensureProfile(studentId);
  const profile = studentProfileDto(await students.assignSales(studentId, nextSalesId));
  if (nextSalesId && nextSalesId !== previous.assigned_sales_id) {
    await notificationService.notifyStudentAssigned(nextSalesId, studentId);
  }
  return { studentId, assignedSalesId: profile.assignedSalesId };
}

async function getDetail(auth, studentUserId) {
  const student = await users.findById(studentUserId);
  if (!student || student.role !== "STUDENT") {
    const error = new Error("Étudiant introuvable.");
    error.status = 404;
    throw error;
  }
  const row = await students.findByUserId(studentUserId);
  if (!(await canViewStudent(auth, studentUserId, row?.assigned_sales_id))) {
    const error = new Error("Vous n’avez pas accès à ce dossier.");
    error.status = 403;
    throw error;
  }
  const profile = studentProfileDto(row);
  if (profile.assignedSalesId) {
    const advisor = await users.findById(profile.assignedSalesId);
    if (advisor) profile.assignedSalesName = `${advisor.prenom} ${advisor.nom}`.trim();
  }
  return { user: userDto(student, { onboardingCompleted: profile.onboardingCompleted }), profile };
}

async function assertCanView(auth, studentUserId) {
  const profile = await students.ensureProfile(studentUserId);
  if (!canAccessStudent(auth, studentUserId, profile.assigned_sales_id)) {
    const error = new Error("Vous n’avez pas accès à ce dossier.");
    error.status = 403;
    throw error;
  }
  return profile;
}

module.exports = { getMine, getDetail, saveOnboarding, updateIdentity, saveAvatar, listStudents, assignSales, assertCanView };
