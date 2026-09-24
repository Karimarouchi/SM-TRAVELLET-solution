const fs = require('fs');
const path = require('path');
const { query } = require('./db');
const programmeService = require('./src/services/programmeService');

async function seed() {
  const htmlPath = path.join(__dirname, '../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract destData from index.html using a simple regex/eval or manual parsing.
  // We know it's a valid JS object literal inside the script tag.
  const match = html.match(/var destData = (\{[\s\S]*?\});\s*var modal = /);
  if (!match) {
    console.error("Could not find destData in index.html");
    process.exit(1);
  }

  let destData;
  try {
    // A bit hacky but works for a one-time seed script
    destData = eval("(" + match[1] + ")");
  } catch (err) {
    console.error("Error parsing destData:", err);
    process.exit(1);
  }

  const defaultKeys = Object.keys(destData);
  console.log(`Found ${defaultKeys.length} default programmes:`, defaultKeys);

  // Check if we already have programmes in the DB
  const existingRows = await query('SELECT count(*) as count FROM programmes');
  if (parseInt(existingRows.rows[0].count) > 0) {
    console.log("Database already has programmes. Emptying the table for a clean seed...");
    await query('TRUNCATE TABLE programmes RESTART IDENTITY');
  }

  let displayOrder = 1;
  for (const key of defaultKeys) {
    const data = destData[key];
    console.log(`Inserting: ${data.title}`);

    // Parse badge to get country and degrees
    // example badge: '🇮🇹 Italie · Licence / Master'
    const parts = data.badge.split('·');
    const countryPart = parts[0].replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim(); // remove emoji
    const degreesPart = parts[1] ? parts[1].trim() : 'Licence / Master';

    // The image path in destData is relative, e.g., 'IMAGE/bled/italie.jpg'
    const payload = {
      title: data.title,
      country: countryPart,
      degrees: degreesPart,
      description: data.programs[0].desc, // Use first program description as the card description
      imageUrl: data.img,
      badge: "Disponible",
      statusLabel: "Disponible",
      gradientStyle: "linear-gradient(135deg,#0f172a 0%,#4c1d95 52%,#1d4ed8 100%)",
      isFeatured: displayOrder <= 3, // first 3 are featured
      displayOrder: displayOrder++,
      details: data.programs // the 'programs' array maps perfectly to our 'details' (ProgrammeDetail[])
    };

    await programmeService.createProgramme(payload);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
