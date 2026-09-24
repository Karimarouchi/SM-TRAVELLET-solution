function formatPgDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function userDto(user, extras = {}) {
  return {
    id: user.id,
    prenom: user.prenom,
    nom: user.nom,
    email: user.email,
    dateNaissance: formatPgDate(user.date_naissance),
    role: user.role || "STUDENT",
    roles: extras.roles || [user.role || "STUDENT"],
    permissions: extras.permissions || [],
    isActive: user.is_active !== false,
    emailVerified: user.email_verified !== false,
    avatarUrl: user.avatar_url || "",
    ...extras
  };
}

function lockedFieldsFromRow(row) {
  const locked = [];
  if (row.code_country_name) locked.push("preferredCountries");
  if (row.code_prefill_current_study_level) locked.push("currentStudyLevel");
  if (row.code_prefill_target_level) locked.push("targetLevel");
  if (row.code_prefill_phone) locked.push("phone");
  return locked;
}

function studentProfileDto(row) {
  if (!row) return null;
  return {
    phone: row.phone || "",
    nationality: row.nationality || "",
    residenceCountry: row.residence_country || "",
    city: row.city || "",
    currentStudyLevel: row.current_study_level || "",
    lastDiploma: row.last_diploma || "",
    studyField: row.study_field || "",
    currentInstitution: row.current_institution || "",
    diplomaYear: row.diploma_year || "",
    preferredCountries: row.preferred_countries || [],
    preferredCity: row.preferred_city || "",
    targetLevel: row.target_level || "",
    targetField: row.target_field || "",
    targetIntake: row.target_intake || "",
    targetUniversity: row.target_university || "",
    annualBudget: row.annual_budget === null || row.annual_budget === undefined ? "" : String(row.annual_budget),
    fundingMode: row.funding_mode || "",
    languageLevel: row.language_level || "",
    languageLevelFrench: row.language_level_french || "",
    languageLevelEnglish: row.language_level_english || "",
    languageTest: row.language_test || "",
    languageTestFrench: row.language_test_french || "",
    languageTestEnglish: row.language_test_english || "",
    languageTestFrenchOther: row.language_test_french_other || "",
    languageTestEnglishOther: row.language_test_english_other || "",
    hasPassport: row.has_passport,
    visaAlreadyRequested: row.visa_already_requested,
    availableDocuments: row.available_documents || "",
    onboardingCompleted: Boolean(row.onboarding_completed),
    assignedSalesId: row.assigned_sales_id || null,
    assignedSalesName: "",
    lockedFields: lockedFieldsFromRow(row),
    dossierStage: row.dossier_stage || "DOCUMENTS"
  };
}

module.exports = { formatPgDate, userDto, studentProfileDto, lockedFieldsFromRow };
