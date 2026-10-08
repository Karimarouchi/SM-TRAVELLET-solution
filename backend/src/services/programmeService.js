const fs = require("fs");
const path = require("path");
const programmeRepo = require("../repositories/programmeRepository");
const countryRepo = require("../repositories/countryRepository");

const PROGRAMME_IMG_DIR = path.join(__dirname, "../../uploads/programmes");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB max

function programmeDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    country: row.country,
    countryId: row.country_id,
    degrees: row.degrees,
    description: row.description,
    imageUrl: row.image_url,
    badge: row.badge,
    statusLabel: row.status_label,
    gradientStyle: row.gradient_style,
    isFeatured: row.is_featured,
    displayOrder: row.display_order,
    details: Array.isArray(row.details) ? row.details : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listAll() {
  const rows = await programmeRepo.findAll();
  return rows.map(programmeDto);
}

async function getById(id) {
  const row = await programmeRepo.findById(id);
  if (!row) {
    const error = new Error("Programme non trouvé.");
    error.status = 404;
    throw error;
  }
  return programmeDto(row);
}

function codeCandidatesFromName(name) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  const base = cleaned.slice(0, 3) || "PAY";
  const candidates = [base];
  for (let i = 2; i <= 20; i += 1) candidates.push(`${base}${i}`);
  return candidates;
}

// Noms anglais ou étrangers rencontrés dans les programmes → nom français de la liste des pays.
const COUNTRY_ALIASES = {
  italia: "Italie", italy: "Italie",
  germany: "Allemagne", deutschland: "Allemagne",
  hungary: "Hongrie", magyarorszag: "Hongrie",
  lithuania: "Lituanie",
  poland: "Pologne",
  slovakia: "Slovaquie",
  romania: "Roumanie",
  malta: "Malte",
  bulgaria: "Bulgarie",
  spain: "Espagne", espana: "Espagne",
  france: "France",
  canada: "Canada"
};

function canonicalCountryName(name) {
  const key = String(name || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return COUNTRY_ALIASES[key] || String(name || "").trim();
}

// Chaque pays d'un programme doit exister dans la table des pays : c'est elle qui alimente les
// Tarifs, les documents et les universités. Au démarrage, on rattache les programmes sans pays
// reconnu (noms anglais, pays ajouté avant la liste...) et on crée les pays manquants.
async function syncProgrammeCountries() {
  const { query } = require("../../db");
  const rows = (await query("SELECT id, country, country_id FROM programmes")).rows;
  let fixed = 0;
  for (const programme of rows) {
    const name = canonicalCountryName(programme.country);
    if (!name) continue;
    const country = await resolveOrCreateCountryByName(name, { reactivate: false });
    if (programme.country_id !== country.id || programme.country !== name) {
      await query("UPDATE programmes SET country_id = $2, country = $3, updated_at = NOW() WHERE id = $1", [programme.id, country.id, name]);
      fixed += 1;
    }
  }
  // Un pays n'existe dans l'application (Tarifs, commissions, listes de choix, pays des
  // Responsables Dossier...) que s'il a au moins un programme : sans programme il est masqué.
  // Garde-fou : tant qu'il n'y a aucun programme (installation neuve avant le seed), rien n'est masqué.
  let hidden = 0;
  if (rows.length > 0) {
    const result = await query(
      `UPDATE countries c SET active = FALSE, updated_at = NOW()
       WHERE c.active = TRUE AND NOT EXISTS (SELECT 1 FROM programmes p WHERE p.country_id = c.id)`
    );
    hidden = result.rowCount;
  }
  return { fixed, hidden };
}

// Résout un pays par nom (source de vérité = table countries). Si le nom ne
// correspond à aucun pays existant, le pays est créé automatiquement (le
// champ "Pays" du formulaire Programme reste un texte libre pour l'Admin ;
// c'est ici, et uniquement ici, que la table countries est tenue à jour).
async function resolveOrCreateCountryByName(name, { reactivate = true } = {}) {
  const { query } = require("../../db");
  const trimmed = canonicalCountryName(name);
  let existing = await countryRepo.findByNameCaseInsensitive(trimmed);
  if (!existing && trimmed !== String(name).trim()) {
    // Le pays existe sous son nom anglais (ex. « Bulgaria ») : on le renomme, sans doublon.
    const legacy = await countryRepo.findByNameCaseInsensitive(String(name).trim());
    if (legacy) {
      await query("UPDATE countries SET name = $2, updated_at = NOW() WHERE id = $1", [legacy.id, trimmed]);
      existing = { ...legacy, name: trimmed };
    }
  }
  if (existing) {
    // Un nouveau programme rend son pays visible partout (Tarifs, documents, universités).
    if (reactivate && existing.active === false) existing = (await countryRepo.setActive(existing.id, true)) || existing;
    return existing;
  }

  const candidates = codeCandidatesFromName(trimmed);
  for (const code of candidates) {
    if (!(await countryRepo.findByCode(code))) {
      const displayOrder = (await countryRepo.maxDisplayOrder()) + 1;
      return countryRepo.create({ code, name: trimmed, displayOrder });
    }
  }
  const error = new Error("Impossible de générer un code pays unique pour ce nom.");
  error.status = 500;
  throw error;
}

async function createProgramme(payload) {
  if (!payload.title || !payload.title.trim()) {
    const error = new Error("Le titre du programme est obligatoire.");
    error.status = 400;
    throw error;
  }
  if (!payload.country || !payload.country.trim()) {
    const error = new Error("Le pays du programme est obligatoire.");
    error.status = 400;
    throw error;
  }
  if (!payload.description || !payload.description.trim()) {
    const error = new Error("La description du programme est obligatoire.");
    error.status = 400;
    throw error;
  }

  const country = await resolveOrCreateCountryByName(payload.country);

  const row = await programmeRepo.create({
    title: payload.title.trim(),
    country: payload.country.trim(),
    countryId: country.id,
    degrees: payload.degrees?.trim() || "Licence / Master",
    description: payload.description.trim(),
    imageUrl: payload.imageUrl?.trim() || "IMAGE/bled/italie.jpg",
    badge: payload.badge?.trim() || "Disponible",
    statusLabel: payload.statusLabel?.trim() || (payload.badge?.includes("Prochainement") || payload.badge === "Planifié" ? "Bientôt ouvert" : "Disponible"),
    gradientStyle: payload.gradientStyle?.trim() || "linear-gradient(135deg,#0f172a 0%,#4c1d95 52%,#1d4ed8 100%)",
    isFeatured: Boolean(payload.isFeatured),
    displayOrder: Number(payload.displayOrder) || 0,
    details: Array.isArray(payload.details) ? payload.details : []
  });

  return programmeDto(row);
}

async function updateProgramme(id, payload) {
  const existing = await programmeRepo.findById(id);
  if (!existing) {
    const error = new Error("Programme introuvable.");
    error.status = 404;
    throw error;
  }

  let countryId = existing.country_id;
  if (payload.country !== undefined && payload.country.trim() !== existing.country) {
    const country = await resolveOrCreateCountryByName(payload.country);
    countryId = country.id;
  }

  const row = await programmeRepo.update(id, {
    title: payload.title !== undefined ? payload.title.trim() : existing.title,
    country: payload.country !== undefined ? payload.country.trim() : existing.country,
    countryId,
    degrees: payload.degrees !== undefined ? payload.degrees.trim() : existing.degrees,
    description: payload.description !== undefined ? payload.description.trim() : existing.description,
    imageUrl: payload.imageUrl !== undefined ? payload.imageUrl.trim() : existing.image_url,
    badge: payload.badge !== undefined ? payload.badge.trim() : existing.badge,
    statusLabel: payload.statusLabel !== undefined ? payload.statusLabel.trim() : existing.status_label,
    gradientStyle: payload.gradientStyle !== undefined ? payload.gradientStyle.trim() : existing.gradient_style,
    isFeatured: payload.isFeatured !== undefined ? Boolean(payload.isFeatured) : existing.is_featured,
    displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : existing.display_order,
    details: payload.details !== undefined ? (Array.isArray(payload.details) ? payload.details : []) : (Array.isArray(existing.details) ? existing.details : [])
  });

  return programmeDto(row);
}

async function removeProgramme(id) {
  const existing = await programmeRepo.findById(id);
  if (!existing) {
    const error = new Error("Programme introuvable.");
    error.status = 404;
    throw error;
  }
  await programmeRepo.remove(id);
  // Plus aucun programme pour ce pays : il disparaît des Tarifs, documents et listes de choix.
  // Il est masqué et non supprimé : prix, documents, universités et dossiers existants sont
  // conservés, et un nouveau programme du même pays le réactive tel quel.
  if (existing.country_id) {
    const { query } = require("../../db");
    const left = await query(
      `SELECT 1 FROM programmes p
       WHERE p.country_id = $1 OR LOWER(p.country) = (SELECT LOWER(name) FROM countries WHERE id = $1)
       LIMIT 1`,
      [existing.country_id]
    );
    if (!left.rowCount) await countryRepo.setActive(existing.country_id, false);
  }
  return { success: true, id };
}

async function saveImage(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    const error = new Error("Aucune image fournie.");
    error.status = 400;
    throw error;
  }

  const match = imageBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
  if (!match) {
    const error = new Error("Format d’image non supporté. (PNG, JPG, WEBP)");
    error.status = 400;
    throw error;
  }

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error("L'image est invalide ou dépasse 5 Mo.");
    error.status = 400;
    throw error;
  }

  fs.mkdirSync(PROGRAMME_IMG_DIR, { recursive: true });
  const filename = `prog_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
  fs.writeFileSync(path.join(PROGRAMME_IMG_DIR, filename), buffer);

  return `/uploads/programmes/${filename}`;
}

module.exports = {
  syncProgrammeCountries,
  listAll,
  getById,
  createProgramme,
  updateProgramme,
  removeProgramme,
  saveImage
};
