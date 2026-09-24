const universityRepo = require("../repositories/countryUniversityRepository");
const countryRepo = require("../repositories/countryRepository");

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function dto(row) {
  if (!row) return null;
  return {
    id: row.id,
    countryId: row.country_id,
    name: row.name,
    active: row.active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeName(rawName) {
  const name = String(rawName || "").trim();
  if (!name) throw fail("Le nom de l'université est obligatoire.", 400);
  return name;
}

async function assertCountryExists(countryId) {
  const country = await countryRepo.findById(countryId);
  if (!country) throw fail("Pays introuvable.", 404);
  return country;
}

async function listByCountry(countryId) {
  await assertCountryExists(countryId);
  const rows = await universityRepo.findByCountry(countryId);
  return rows.map(dto);
}

async function listActiveForCountryIds(countryIds) {
  const rows = await universityRepo.findActiveByCountryIds(countryIds);
  return rows.map((row) => ({ id: row.id, countryId: row.country_id, countryName: row.country_name, name: row.name }));
}

async function createUniversity(countryId, payload) {
  await assertCountryExists(countryId);
  const name = normalizeName(payload.name);
  if (await universityRepo.findByCountryAndName(countryId, name)) {
    throw fail("Cette université existe déjà pour ce pays.", 409);
  }
  const row = await universityRepo.create({ countryId, name, displayOrder: Number(payload.displayOrder) || 0 });
  return dto(row);
}

async function updateUniversity(id, payload) {
  const existing = await universityRepo.findById(id);
  if (!existing) throw fail("Université introuvable.", 404);

  const name = payload.name !== undefined ? normalizeName(payload.name) : existing.name;
  if (name !== existing.name) {
    const owner = await universityRepo.findByCountryAndName(existing.country_id, name);
    if (owner && owner.id !== id) throw fail("Cette université existe déjà pour ce pays.", 409);
  }

  const row = await universityRepo.update(id, {
    name,
    displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : existing.display_order
  });
  return dto(row);
}

async function setActive(id, active) {
  const existing = await universityRepo.findById(id);
  if (!existing) throw fail("Université introuvable.", 404);
  const row = await universityRepo.setActive(id, Boolean(active));
  return dto(row);
}

async function removeUniversity(id) {
  const existing = await universityRepo.findById(id);
  if (!existing) throw fail("Université introuvable.", 404);
  await universityRepo.remove(id);
  return { success: true, id };
}

module.exports = {
  listByCountry,
  listActiveForCountryIds,
  createUniversity,
  updateUniversity,
  setActive,
  removeUniversity
};
