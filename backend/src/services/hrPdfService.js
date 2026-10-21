const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const PDFDocument = require("pdfkit");

const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo-sm-travel.png");
const AGENCY = {
  company: "SM services & consulting",
  brand: "SM Travel",
  legalForm: "SARL",
  taxId: "1915331L",
  address: "4 Bis Rue du Mali, 4e étage, bureau n°4, Jeanne d’Arc, Tunis 1002, Tunisie",
  phone: "+216 56 819 899",
  email: "services@smtravel.fr",
  website: "www.smtravel.fr"
};
const BRAND = "#6d28d9";
const BRAND_SOFT = "#ede9fe";
const BRAND_LINE = "#ddd6fe";
const INK = "#1c1917";
const GREY = "#64748b";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const ROLE_LABELS = { ADMIN: "administrateur", SALES: "conseiller", RDV: "responsable dossier" };

function money(amount) {
  const [int, dec] = (Math.round(Number(amount) * 1000) / 1000).toFixed(3).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} DT`;
}

function frDate(iso) {
  if (!iso) return "";
  const [year, month, day] = String(iso).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function frLongDate(iso) {
  if (!iso) return "";
  const [year, month, day] = String(iso).slice(0, 10).split("-");
  const number = Number(day);
  return `${number === 1 ? "1er" : String(number)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function roleLabel(roles) {
  return (roles || []).map((role) => ROLE_LABELS[role] || role).join(", ");
}

function header(doc, title) {
  const left = 48;
  if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, left, 36, { fit: [92, 42] });
  doc.font("Helvetica-Bold").fontSize(16).fillColor(BRAND).text(title, 160, 42, { width: 380, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(GREY).text(`${AGENCY.brand} · ${AGENCY.company}`, 160, 64, { width: 380, align: "right" });
  doc.moveTo(left, 96).lineTo(547, 96).lineWidth(1.2).strokeColor(BRAND).stroke();
}

function payslipHeader(doc) {
  const left = 48;
  const right = 547;
  const ink = "#111111";
  if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, right - 92, 34, { fit: [92, 61] });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(13).text("SM SERVICES & CONSULTING SARL", left, 36, { width: 390, lineBreak: false });
  doc.font("Helvetica").fontSize(10).fillColor("#444444").text("Agence de services et conseil", left, 54, { width: 390, lineBreak: false });
  doc.text("04 Rue Mali etage 4, Hedi Chaker, Bab El Bhar, Tunis,1002.", left, 68, { width: 390, lineBreak: false });
  doc.text(`MF ${AGENCY.taxId} · ${AGENCY.phone} · ${AGENCY.email}`, left, 82, { width: 390, lineBreak: false });
  const generatedOn = `Tunis, le ${frLongDate(todayIso())}`;
  doc.font("Helvetica").fontSize(11).fillColor(ink);
  doc.text(generatedOn, right - doc.widthOfString(generatedOn), 108, { lineBreak: false });
  const title = "FICHE DE PAIE";
  doc.font("Helvetica-Bold").fontSize(16).text(title, left, 132, { width: right - left, align: "center", lineBreak: false });
  const titleWidth = doc.widthOfString(title);
  const titleX = left + (right - left - titleWidth) / 2;
  doc.moveTo(titleX, 152).lineTo(titleX + titleWidth, 152).lineWidth(0.9).strokeColor(ink).stroke();
  return 170;
}

function footer(doc) {
  const previous = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const y = doc.page.height - 58;
  doc.moveTo(48, y).lineTo(547, y).lineWidth(0.6).strokeColor(BRAND_LINE).stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(
    `${AGENCY.company} (${AGENCY.legalForm}) · MF ${AGENCY.taxId} · ${AGENCY.phone} · ${AGENCY.email}`,
    48,
    y + 6,
    { width: 499, align: "center", height: 12, lineBreak: false }
  );
  doc.text(AGENCY.address, 48, y + 18, { width: 499, align: "center", height: 12, lineBreak: false });
  doc.page.margins.bottom = previous;
}

const trimCache = new Map();
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([name, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function decodeRgba(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (buffer[24] !== 8 || buffer[25] !== 6 || buffer[28] !== 0 || width < 1 || height < 1 || width > 4000 || height > 4000) return null;
  let offset = 8;
  const parts = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") parts.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = y * (stride + 1) + 1;
    const dest = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[dest + x - 4] : 0;
      const up = y > 0 ? pixels[dest - stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[dest - stride + x - 4] : 0;
      const value = raw[row + x];
      if (filter === 1) pixels[dest + x] = (value + left) & 255;
      else if (filter === 2) pixels[dest + x] = (value + up) & 255;
      else if (filter === 3) pixels[dest + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        pixels[dest + x] = (value + predictor) & 255;
      } else pixels[dest + x] = value;
    }
  }
  return { width, height, pixels };
}

function encodeRgba(pixels, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    if (marker >= 0xc0 && marker <= 0xc2) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (width < 1 || height < 1 || width > 8000 || height > 8000) return null;
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

function trimmedImage(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const mtime = fs.statSync(filePath).mtimeMs;
  const cached = trimCache.get(filePath);
  if (cached && cached.mtime === mtime) return cached.image;
  const raw = fs.readFileSync(filePath);
  const jpeg = jpegSize(raw);
  if (jpeg) {
    const image = { buffer: raw, width: jpeg.width, height: jpeg.height };
    trimCache.set(filePath, { mtime, image });
    return image;
  }
  const decoded = decodeRgba(raw);
  if (!decoded) return null;
  const { width, height, pixels } = decoded;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y += 1) {
    pixels.copy(cropped, y * cropW * 4, ((minY + y) * width + minX) * 4, ((minY + y) * width + maxX + 1) * 4);
  }
  const image = { buffer: encodeRgba(cropped, cropW, cropH), width: cropW, height: cropH };
  trimCache.set(filePath, { mtime, image });
  return image;
}

function sealMetrics(signaturePath, stampPath) {
  const signature = trimmedImage(signaturePath);
  const stamp = trimmedImage(stampPath);
  const maxStampWidth = 108;
  const maxStampHeight = 50;
  const stampScale = stamp ? Math.min(maxStampWidth / stamp.width, maxStampHeight / stamp.height) : 0;
  const stampWidth = stamp ? stamp.width * stampScale : 0;
  const stampHeight = stamp ? stamp.height * stampScale : 0;
  const signHeight = 58;
  const signWidth = signature ? signHeight * signature.width / signature.height : 0;
  const overlap = signature && stamp ? Math.min(signWidth * 0.7, stampWidth * 0.66) : 0;
  return {
    signature,
    stamp,
    stampHeight,
    signHeight,
    stampWidth,
    signWidth,
    overlap,
    blockWidth: signWidth + stampWidth - overlap,
    height: Math.max(stamp ? stampHeight : 0, signature ? signHeight : 0)
  };
}

function drawSeal(doc, x, top, metrics) {
  const { signature, stamp, stampHeight, signHeight, stampWidth, signWidth, overlap } = metrics;
  if (stamp) doc.image(stamp.buffer, x + (signature ? signWidth - overlap : 0), top, { width: stampWidth, height: stampHeight });
  if (signature) doc.image(signature.buffer, x, top + (stamp ? (stampHeight - signHeight) / 2 : 0), { width: signWidth, height: signHeight });
}

function signs(doc, y, signaturePath, stampPath) {
  const metrics = sealMetrics(signaturePath, stampPath);
  if (!metrics.blockWidth) return;
  drawSeal(doc, 547 - metrics.blockWidth, y, metrics);
}

function line(doc, y, label, amount, options = {}) {
  doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.bold ? 11 : 10).fillColor(options.muted ? GREY : INK);
  doc.text(label, 56, y, { width: 320 });
  doc.text(money(amount), 380, y, { width: 150, align: "right" });
  return y + (options.bold ? 22 : 18);
}

function caption(doc, y, text) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(GREY).text(text, 56, y, { width: 320, characterSpacing: 0.6 });
  return y + 16;
}

function payslipLines(doc, slip, y) {
  const lines = slip.lines;
  const taken = lines.presenceAdjustment !== null && lines.presenceAdjustment !== undefined
    ? Number(lines.presenceAdjustment)
    : Number(lines.absenceDeduction) + Number(lines.latenessDeduction);
  const included = Number(lines.includedCommissions || 0);
  const gross = Number(lines.baseSalary) + Number(lines.bonus) + Number(lines.paidLeave) + included;
  const deductions = taken + Number(lines.unpaidHolidayDeduction) + Number(lines.advance);
  y = caption(doc, y, "GAINS");
  y = line(doc, y, "Salaire de base", lines.baseSalary);
  doc.font("Helvetica").fontSize(8).fillColor(GREY).text("Congés acceptés et jours fériés payés inclus.", 56, y - 6, { width: 320 });
  y += 10;
  y = line(doc, y, "Primes", lines.bonus);
  if (lines.paidLeave) y = line(doc, y, "Solde de congés versé", lines.paidLeave);
  if (included) y = line(doc, y, "Commissions sur ventes", included);
  y = line(doc, y, "Salaire brut", gross, { bold: true });
  y += 6;
  y = caption(doc, y, "RETENUES");
  if (lines.presenceAdjustment !== null && lines.presenceAdjustment !== undefined) {
    y = line(doc, y, "Retenue de présence saisie", -taken);
  } else {
    y = line(doc, y, `Retenue d'absence · ${slip.absenceDays || 0} jour(s) validé(s)`, -lines.absenceDeduction);
    y = line(doc, y, `Retenue de retard · ${slip.latenessMinutes || 0} min validée(s)`, -lines.latenessDeduction);
  }
  if (lines.unpaidHolidayDeduction) y = line(doc, y, "Jours fériés impayés", -lines.unpaidHolidayDeduction);
  y = line(doc, y, "Avance versée", -lines.advance);
  y = line(doc, y, "Total des retenues", -deductions, { bold: true });
  y += 8;
  doc.roundedRect(48, y, 499, 36, 8).fillColor(BRAND).fill();
  doc.font("Helvetica").fontSize(9).fillColor(BRAND_SOFT).text("NET À PAYER", 64, y + 12);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#ffffff").text(money(lines.net), 300, y + 10, { width: 228, align: "right" });
  y += 48;
  const unpaid = lines.unpaidCommissions === undefined || lines.unpaidCommissions === null
    ? Math.max(0, Number(lines.commissions || 0) - included)
    : Number(lines.unpaidCommissions);
  y = line(doc, y, "Commissions Finance, hors fiche", unpaid, { muted: true });
  y = line(doc, y, "Solde d'avances encore dû", lines.advanceBalance || 0, { muted: true });
  return y;
}

function centeredText(doc, text, y, size, font, color) {
  doc.font(font).fontSize(size).fillColor(color);
  const width = doc.widthOfString(text);
  doc.text(text, 48 + (499 - width) / 2, y, { lineBreak: false });
  return y + size + 7;
}

function employeeBlock(doc, slip, y) {
  const name = `${slip.prenom || ""} ${slip.nom || ""}`.trim();
  if (name) y = centeredText(doc, name, y, 14, "Helvetica-Bold", INK);
  const month = monthLabel(slip.month);
  if (month) y = centeredText(doc, month.charAt(0).toUpperCase() + month.slice(1), y, 11, "Helvetica", INK);
  const role = [slip.jobTitle, slip.contractType].filter(Boolean).join(" · ");
  if (role) y = centeredText(doc, role, y, 10, "Helvetica", "#444444");
  const facts = [
    slip.cin ? `CIN ${slip.cin}` : "",
    (slip.cnss || slip.cnssNumber) ? `CNSS ${slip.cnss || slip.cnssNumber}` : "",
    slip.matricule ? `Matricule ${slip.matricule}` : ""
  ].filter(Boolean);
  if (facts.length) y = centeredText(doc, facts.join("   ·   "), y, 10, "Helvetica", GREY);
  if (slip.hiredOn) y = centeredText(doc, `Embauché le ${frLongDate(slip.hiredOn)}`, y, 10, "Helvetica", GREY);
  return y + 8;
}

function identityLine(slip) {
  return [
    monthLabel(slip.month),
    slip.cin ? `CIN ${slip.cin}` : "",
    (slip.cnss || slip.cnssNumber) ? `CNSS ${slip.cnss || slip.cnssNumber}` : "",
    slip.hiredOn ? `embauché le ${frDate(slip.hiredOn)}` : ""
  ].filter(Boolean).join(" · ");
}

function drawPayslipPage(doc, slip) {
  const top = employeeBlock(doc, slip, payslipHeader(doc));
  const y = payslipLines(doc, slip, top);
  if (slip.note) doc.font("Helvetica").fontSize(9).fillColor(GREY).text(slip.note, 48, y + 4, { width: 280 });
  signs(doc, y + 4, slip.signaturePath, slip.stampPath);
  footer(doc);
}

function renderPayslip(slip, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Fiche de paie ${slip.month}`, Author: AGENCY.company } });
  doc.pipe(stream);
  drawPayslipPage(doc, slip);
  doc.end();
}

function attestationText(data) {
  const who = `${data.prenom} ${data.nom}`;
  const cin = data.cin ? `, titulaire de la CIN n° ${data.cin}` : "";
  const job = roleLabel(data.roles);
  const contract = data.contractType ? ` sous contrat ${data.contractType}` : "";
  const since = ` depuis le ${frDate(data.hiredOn)}`;
  if (data.type === "work") {
    return `${AGENCY.company}, agissant sous la marque ${AGENCY.brand}, atteste que ${who}${cin} est employé(e) en qualité de ${job}${contract}${since}. La présente attestation est délivrée pour servir et valoir ce que de droit.`;
  }
  if (data.type === "salary") {
    return `${AGENCY.company}, agissant sous la marque ${AGENCY.brand}, atteste que ${who}${cin}, employé(e) en qualité de ${job}${contract}${since}, perçoit un salaire de base mensuel de ${money(data.baseSalary)}. La présente attestation est délivrée pour servir et valoir ce que de droit.`;
  }
  return `${AGENCY.company}, agissant sous la marque ${AGENCY.brand}, atteste que ${who}${cin} a été employé(e) en qualité de ${job}${contract} du ${frDate(data.hiredOn)} au ${frDate(data.contractEndsOn)}. La présente attestation est délivrée pour servir et valoir ce que de droit.`;
}

const TITLES = { work: "Attestation de travail", salary: "Attestation de salaire", end: "Attestation de fin de contrat" };
const FILENAMES = { work: "Attestation-travail", salary: "Attestation-salaire", end: "Attestation-fin-de-contrat" };

function drawLetterAttestation(doc, data, title, afterEmployment) {
  const ink = "#111111";
  const left = 72;
  const right = 524;
  const width = right - left;
  if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, 432, 73, { fit: [92, 61] });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(13).text("SM SERVICES & CONSULTING SARL", left, 73, { width: 340, lineBreak: false });
  doc.font("Helvetica").fontSize(10).fillColor("#444444").text("Agence de services et conseil", left, 90, { width: 340, lineBreak: false });
  doc.text("04 Rue Mali etage 4, Hedi Chaker, Bab El Bhar, Tunis,1002.", left, 102, { width: 360, lineBreak: false });
  doc.fillColor(ink).font("Helvetica").fontSize(11).text(`Tunis, le ${frLongDate(todayIso())}`, 300, 150, { width: right - 300, align: "right", lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(16).text(title, left, 193, { width, align: "center", lineBreak: false });
  const titleWidth = doc.widthOfString(title);
  const titleX = left + (width - titleWidth) / 2;
  doc.moveTo(titleX, 212).lineTo(titleX + titleWidth, 212).lineWidth(0.9).strokeColor(ink).stroke();
  doc.fillColor(ink).font("Helvetica").fontSize(12);
  doc.text("Je soussigné, le Directeur de la société ", left, 242, { continued: true, lineBreak: false });
  doc.font("Helvetica-Bold").text("SM SERVICES & CONSULTING SARL,", { lineBreak: false });
  doc.font("Helvetica").text("atteste par la présente que :", left, 262, { width, lineBreak: false });
  const name = `${data.prenom || ""} ${String(data.nom || "").toUpperCase()}`.trim();
  doc.font("Helvetica-Bold").fontSize(14).text(name, left, 301, { width, align: "center", lineBreak: false });
  let y = 327;
  if (data.cin) {
    doc.font("Helvetica").fontSize(11).text(`CIN n° ${data.cin}`, left, 320, { width, align: "center", lineBreak: false });
    y = 344;
  }
  const job = data.jobTitle || roleLabel(data.roles) || "Employé";
  doc.font("Helvetica").fontSize(12).text("est employé(e) au sein de notre société en qualité d'", left, y, { continued: true, lineBreak: false });
  doc.font("Helvetica-Bold").text(job, { continued: true, lineBreak: false });
  doc.font("Helvetica").text(", et ce", { lineBreak: false });
  y += 21;
  doc.text("depuis le ", left, y, { continued: true, lineBreak: false });
  doc.font("Helvetica-Bold").text(`${frLongDate(data.hiredOn)}.`, { lineBreak: false });
  y += 30;
  y = afterEmployment(doc, data, left, width, y);
  doc.font("Helvetica").fontSize(12).fillColor(ink).text("Cette attestation est délivrée à l'intéressé(e) à sa demande et pour servir et valoir ce", left, y, { width, lineBreak: false });
  doc.text("que de droit.", left, y + 21, { width, lineBreak: false });
  const company = "SM SERVICES & CONSULTING SARL";
  doc.font("Helvetica").fontSize(12).fillColor(ink).text("Le Directeur,", right - 230, 476, { width: 230, align: "right", lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(12);
  const companyWidth = doc.widthOfString(company);
  const companyX = right - companyWidth;
  doc.text(company, companyX, 498, { lineBreak: false });
  const metrics = sealMetrics(data.signaturePath, data.stampPath);
  if (metrics.blockWidth) {
    let blockX = companyX + (companyWidth - metrics.blockWidth) / 2;
    if (blockX < left) blockX = left;
    if (blockX + metrics.blockWidth > right) blockX = right - metrics.blockWidth;
    drawSeal(doc, blockX, 520, metrics);
  }
}

function drawWorkAttestation(doc, data) {
  drawLetterAttestation(doc, { ...data, cin: "" }, "ATTESTATION DE TRAVAIL", (_doc, _person, _left, _width, y) => y);
}

function drawSalaryAttestation(doc, data) {
  drawLetterAttestation(doc, data, "ATTESTATION DE SALAIRE", (page, person, left, width, y) => {
    page.font("Helvetica").fontSize(12).fillColor("#111111").text("Le salaire de base mensuel est de ", left, y, { continued: true, lineBreak: false });
    page.font("Helvetica-Bold").text(`${money(person.baseSalary)}.`, { lineBreak: false });
    return y + 36;
  });
}

function renderAttestation(data, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: TITLES[data.type], Author: AGENCY.company } });
  doc.pipe(stream);
  if (data.type === "work") drawWorkAttestation(doc, data);
  else if (data.type === "salary") drawSalaryAttestation(doc, data);
  else {
    header(doc, TITLES[data.type]);
    doc.font("Helvetica").fontSize(12).fillColor(INK).text(attestationText(data), 48, 150, { width: 499, align: "justify", lineGap: 6 });
    doc.font("Helvetica").fontSize(10).fillColor(GREY).text(`Fait à Tunis, le ${frDate(todayIso())}`, 48, 340);
    signs(doc, 390, data.signaturePath, data.stampPath);
    footer(doc);
  }
  doc.end();
}

function renderAccountant(slip, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Éléments de paie ${slip.month}`, Author: AGENCY.company } });
  doc.pipe(stream);
  header(doc, "Éléments de paie");
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(`${slip.prenom} ${slip.nom}`, 48, 112);
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text(identityLine(slip), 48, 130, { width: 499 });
  doc.font("Helvetica").fontSize(8).fillColor(GREY).text("Document à transmettre au comptable pour préparer le bulletin.", 48, 148, { width: 499 });
  const y = payslipLines(doc, slip, 172);
  if (slip.note) doc.font("Helvetica").fontSize(9).fillColor(GREY).text(slip.note, 48, y + 4, { width: 499 });
  footer(doc);
  doc.end();
}

function drawBulletinPage(doc, slip) {
  const top = employeeBlock(doc, slip, payslipHeader(doc));
  const bulletin = slip.bulletin;
  let y = top;
  y = line(doc, y, "Salaire de base", bulletin.baseSalary);
  y = line(doc, y, `Jours de présence (${bulletin.presenceDays})`, bulletin.presenceAmount);
  y = line(doc, y, `Jours de congé (${bulletin.leaveDays})`, bulletin.leaveAmount);
  y = line(doc, y, "Indemnité de transport", bulletin.transport);
  y = line(doc, y, "Prime de présence", bulletin.presenceBonus);
  y = line(doc, y, "Indemnité de fonction", bulletin.functionAllowance);
  y = line(doc, y, "Prime de responsabilité", bulletin.responsibilityBonus);
  y = line(doc, y, "Brut", bulletin.gross, { bold: true });
  y += 6;
  y = line(doc, y, "CNSS", -bulletin.cnssDeduction);
  y = line(doc, y, "Salaire imposable", bulletin.taxable);
  y = line(doc, y, "Impôt (IRPP)", -bulletin.irpp);
  y = line(doc, y, "Contribution sociale de solidarité", -bulletin.css);
  y += 8;
  doc.roundedRect(48, y, 499, 36, 8).fillColor(BRAND).fill();
  doc.font("Helvetica").fontSize(9).fillColor(BRAND_SOFT).text("NET À PAYER", 64, y + 12);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#ffffff").text(money(bulletin.netToPay), 300, y + 10, { width: 228, align: "right" });
  signs(doc, y + 52, slip.signaturePath, slip.stampPath);
  footer(doc);
}

function renderBulletin(slip, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Fiche de paie ${slip.month}`, Author: AGENCY.company } });
  doc.pipe(stream);
  drawBulletinPage(doc, slip);
  doc.end();
}

function renderFiches(pages, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Fiches de paie", Author: AGENCY.company } });
  doc.pipe(stream);
  pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    if (page.kind === "bulletin") drawBulletinPage(doc, page);
    else drawPayslipPage(doc, page);
  });
  doc.end();
}

module.exports = { renderPayslip, renderAccountant, renderBulletin, renderFiches, renderAttestation, TITLES, FILENAMES };
