const documentRepo = require("../repositories/documentRequirementRepository");
const countryRepo = require("../repositories/countryRepository");
const userRoleRepo = require("../repositories/userRoleRepository");
const { authRoles } = require("../security/rbac");

const ACCEPTED_FILE_TYPES = ["IMAGE", "PDF", "IMAGE_PDF"];
const CATEGORIES = ["DOSSIER", "VISA"];

function documentDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    countryId: row.country_id,
    name: row.name,
    description: row.description,
    required: row.required,
    active: row.active,
    displayOrder: row.display_order,
    acceptedFileTypes: row.accepted_file_types,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeName(rawName) {
  const name = String(rawName || "").trim();
  if (!name) throw fail("Le nom du document est obligatoire.", 400);
  return name;
}

function normalizeAcceptedFileTypes(raw) {
  if (raw === undefined) return "IMAGE_PDF";
  if (!ACCEPTED_FILE_TYPES.includes(raw)) {
    throw fail("Type de fichier accepté invalide (IMAGE, PDF ou IMAGE_PDF).", 400);
  }
  return raw;
}

function normalizeCategory(raw) {
  if (raw === undefined) return "DOSSIER";
  if (!CATEGORIES.includes(raw)) throw fail("Catégorie de document invalide (DOSSIER ou VISA).", 400);
  return raw;
}

// Gérer les documents du dossier universitaire nécessite MANAGE_COUNTRIES ;
// gérer les documents visa peut se faire de trois façons : la permission
// MANAGE_VISA_DOCUMENTS (tous pays, utile notamment pour les pays sans RDV
// configuré), ou automatiquement pour un RDV sur les pays dont il est déjà
// spécialisé (aucune permission supplémentaire à accorder dans ce cas).
async function assertPermission(auth, category, countryId) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  const permissions = Array.isArray(auth?.permissions) ? auth.permissions : [];
  if (permissions.includes("MANAGE_COUNTRIES")) return;
  if (category === "VISA") {
    if (permissions.includes("MANAGE_VISA_DOCUMENTS")) return;
    if (roles.includes("RDV") && countryId) {
      const assignedCountries = await userRoleRepo.listCountriesForRdv(auth.sub);
      if (assignedCountries.includes(countryId)) return;
    }
  }
  throw fail("Permission refusée pour cette action.", 403);
}

async function assertCountryExists(countryId) {
  const country = await countryRepo.findById(countryId);
  if (!country) throw fail("Pays introuvable.", 404);
  return country;
}

async function listByCountry(countryId) {
  await assertCountryExists(countryId);
  const rows = await documentRepo.findByCountry(countryId);
  return rows.map(documentDto);
}

async function createDocument(auth, countryId, payload) {
  await assertCountryExists(countryId);
  const name = normalizeName(payload.name);
  const category = normalizeCategory(payload.category);
  await assertPermission(auth, category, countryId);

  if (await documentRepo.findByCountryAndName(countryId, name, category)) {
    throw fail("Un document requis avec ce nom existe déjà pour ce pays.", 409);
  }

  const row = await documentRepo.create({
    countryId,
    name,
    description: payload.description ? String(payload.description).trim() : null,
    required: payload.required !== undefined ? Boolean(payload.required) : true,
    displayOrder: Number(payload.displayOrder) || 0,
    acceptedFileTypes: normalizeAcceptedFileTypes(payload.acceptedFileTypes),
    category
  });
  return documentDto(row);
}

async function updateDocument(auth, id, payload) {
  const existing = await documentRepo.findById(id);
  if (!existing) throw fail("Document requis introuvable.", 404);

  const category = payload.category !== undefined ? normalizeCategory(payload.category) : existing.category;
  await assertPermission(auth, existing.category, existing.country_id);
  if (category !== existing.category) await assertPermission(auth, category, existing.country_id);

  const name = payload.name !== undefined ? normalizeName(payload.name) : existing.name;

  if (name !== existing.name || category !== existing.category) {
    const owner = await documentRepo.findByCountryAndName(existing.country_id, name, category);
    if (owner && owner.id !== id) throw fail("Un document requis avec ce nom existe déjà pour ce pays.", 409);
  }

  const row = await documentRepo.update(id, {
    name,
    description: payload.description !== undefined ? (payload.description ? String(payload.description).trim() : null) : existing.description,
    required: payload.required !== undefined ? Boolean(payload.required) : existing.required,
    displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : existing.display_order,
    acceptedFileTypes: payload.acceptedFileTypes !== undefined ? normalizeAcceptedFileTypes(payload.acceptedFileTypes) : existing.accepted_file_types,
    category
  });
  return documentDto(row);
}

async function setActive(auth, id, active) {
  const existing = await documentRepo.findById(id);
  if (!existing) throw fail("Document requis introuvable.", 404);
  await assertPermission(auth, existing.category, existing.country_id);
  const row = await documentRepo.setActive(id, Boolean(active));
  return documentDto(row);
}

async function removeDocument(auth, id) {
  const existing = await documentRepo.findById(id);
  if (!existing) throw fail("Document requis introuvable.", 404);
  await assertPermission(auth, existing.category, existing.country_id);

  const usageCount = await documentRepo.countStudentDocuments(id);
  if (usageCount > 0) {
    throw fail(
      "Ce document est déjà référencé par des dossiers étudiants : désactivez-le au lieu de le supprimer.",
      409
    );
  }

  await documentRepo.remove(id);
  return { success: true, id };
}

module.exports = {
  listByCountry,
  createDocument,
  updateDocument,
  setActive,
  removeDocument
};
