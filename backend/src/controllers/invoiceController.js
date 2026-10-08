const invoiceService = require("../services/invoiceService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function listStudents(_req, res) {
  try {
    res.json({ students: await invoiceService.listStudents() });
  } catch (error) {
    handle(res, error);
  }
}

async function create(req, res) {
  try {
    res.status(201).json(await invoiceService.createInvoice(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

// PDF de la facture (téléchargement) : le numéro de facture sert de nom de fichier.
async function pdf(req, res) {
  try {
    const { invoice } = await invoiceService.loadInvoice(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Facture-${invoice.invoice_number}.pdf"`);
    await invoiceService.renderPdf(req.params.id, res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

module.exports = { listStudents, create, pdf };
