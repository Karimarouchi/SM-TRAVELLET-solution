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

// Résout un pays par nom (source de vérité = table countries). Si le nom ne
// correspond à aucun pays existant, le pays est créé automatiquement (le
// champ "Pays" du formulaire Programme reste un texte libre pour l'Admin ;
// c'est ici, et uniquement ici, que la table countries est tenue à jour).
async function resolveOrCreateCountryByName(name) {
  const trimmed = name.trim();
  const existing = await countryRepo.findByNameCaseInsensitive(trimmed);
  if (existing) return existing;

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
  listAll,
  getById,
  createProgramme,
  updateProgramme,
  removeProgramme,
  saveImage
};
