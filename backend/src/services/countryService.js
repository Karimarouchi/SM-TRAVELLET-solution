const countryRepo = require("../repositories/countryRepository");
const userRoleRepo = require("../repositories/userRoleRepository");
const { authRoles } = require("../security/rbac");

function countryDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeCode(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{2,10}$/.test(code)) {
    throw fail("Le code pays est obligatoire (2 à 10 caractères alphanumériques).", 400);
  }
  return code;
}

function normalizeName(rawName) {
  const name = String(rawName || "").trim();
  if (!name) {
    throw fail("Le nom du pays est obligatoire.", 400);
  }
  return name;
}

async function listAll() {
  const rows = await countryRepo.findAll();
  return rows.map(countryDto);
}

// Vue admin filtrée : un RDV sans permission globale (MANAGE_COUNTRIES /
// MANAGE_VISA_DOCUMENTS) ne voit que les pays dont il est responsable —
// sinon (Admin, ou permission globale) il voit tout, comme avant.
async function listForRequester(auth) {
  const roles = authRoles(auth);
  const permissions = Array.isArray(auth?.permissions) ? auth.permissions : [];
  const hasGlobalAccess = roles.includes("ADMIN") || permissions.includes("MANAGE_COUNTRIES") || permissions.includes("MANAGE_VISA_DOCUMENTS");
  if (hasGlobalAccess) return listAll();

  if (roles.includes("RDV")) {
    const countryIds = await userRoleRepo.listCountriesForRdv(auth.sub);
    const rows = await countryRepo.findAll();
    return rows.filter((r) => countryIds.includes(r.id)).map(countryDto);
  }

  return [];
}

async function listActive() {
  const rows = await countryRepo.findAllActive();
  return rows.map(countryDto);
}

async function getById(id) {
  const row = await countryRepo.findById(id);
  if (!row) throw fail("Pays introuvable.", 404);
  return countryDto(row);
}

async function createCountry(payload) {
  const code = normalizeCode(payload.code);
  const name = normalizeName(payload.name);

  if (await countryRepo.findByCode(code)) {
    throw fail("Ce code pays est déjà utilisé.", 409);
  }
  if (await countryRepo.findByName(name)) {
    throw fail("Ce nom de pays est déjà utilisé.", 409);
  }

  const row = await countryRepo.create({
    code,
    name,
    displayOrder: Number(payload.displayOrder) || 0
  });
  return countryDto(row);
}

async function updateCountry(id, payload) {
  const existing = await countryRepo.findById(id);
  if (!existing) throw fail("Pays introuvable.", 404);

  const code = payload.code !== undefined ? normalizeCode(payload.code) : existing.code;
  const name = payload.name !== undefined ? normalizeName(payload.name) : existing.name;

  if (code !== existing.code) {
    const codeOwner = await countryRepo.findByCode(code);
    if (codeOwner && codeOwner.id !== id) throw fail("Ce code pays est déjà utilisé.", 409);
  }
  if (name !== existing.name) {
    const nameOwner = await countryRepo.findByName(name);
    if (nameOwner && nameOwner.id !== id) throw fail("Ce nom de pays est déjà utilisé.", 409);
  }

  const row = await countryRepo.update(id, {
    code,
    name,
    displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : existing.display_order
  });
  return countryDto(row);
}

async function setActive(id, active) {
  const existing = await countryRepo.findById(id);
  if (!existing) throw fail("Pays introuvable.", 404);
  const row = await countryRepo.setActive(id, Boolean(active));
  return countryDto(row);
}

module.exports = {
  listAll,
  listForRequester,
  listActive,
  getById,
  createCountry,
  updateCountry,
  setActive
};
