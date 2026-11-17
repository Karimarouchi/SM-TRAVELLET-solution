// Traductions (anglais, arabe) des programmes et des avis du site vitrine, saisies par l'admin.
// Entrée libre venue du navigateur : on ne garde que les langues et les champs prévus, en texte
// borné ; tout champ vide est retiré (il retombe alors sur le français).

const LANGUAGES = ["en", "ar"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function pick(source, fields) {
  const out = {};
  for (const [name, max] of Object.entries(fields)) {
    const value = clean(source?.[name], max);
    if (value) out[name] = value;
  }
  return out;
}

const PROGRAMME_FIELDS = { title: 150, country: 100, degrees: 150, description: 4000, badge: 100, statusLabel: 100 };
const LEVEL_FIELDS = { name: 150, desc: 4000, lang: 150, dates: 200, status: 150, scholarship: 4000 };

function cleanProgrammeTranslations(input) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const lang of LANGUAGES) {
    const source = input[lang];
    if (!source || typeof source !== "object") continue;
    const entry = pick(source, PROGRAMME_FIELDS);
    const levels = {};
    if (source.levels && typeof source.levels === "object") {
      for (const [id, level] of Object.entries(source.levels)) {
        if (!UUID.test(id)) continue;
        const fields = pick(level, LEVEL_FIELDS);
        if (Object.keys(fields).length) levels[id] = fields;
      }
    }
    if (Object.keys(levels).length) entry.levels = levels;
    if (Object.keys(entry).length) result[lang] = entry;
  }
  return result;
}

const AVIS_FIELDS = { content: 4000, programme: 120, author_name: 120 };

function cleanAvisTranslations(input) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const lang of LANGUAGES) {
    const entry = pick(input[lang], AVIS_FIELDS);
    if (Object.keys(entry).length) result[lang] = entry;
  }
  return result;
}

// Un niveau supprimé ne doit pas laisser sa traduction derrière lui.
function keepLevelsOf(translations, levelIds) {
  const keep = new Set(levelIds);
  const out = {};
  for (const [lang, entry] of Object.entries(translations || {})) {
    const next = { ...entry };
    if (next.levels) {
      next.levels = Object.fromEntries(Object.entries(next.levels).filter(([id]) => keep.has(id)));
      if (!Object.keys(next.levels).length) delete next.levels;
    }
    out[lang] = next;
  }
  return out;
}

module.exports = { cleanProgrammeTranslations, cleanAvisTranslations, keepLevelsOf };
