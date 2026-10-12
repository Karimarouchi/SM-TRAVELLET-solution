const mailService = require("../services/mailService");

function handle(res, error) {
  res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function status(req, res) {
  try {
    res.json(await mailService.status());
  } catch (error) {
    handle(res, error);
  }
}

async function unreadCount(req, res) {
  try {
    res.json(await mailService.unreadCount());
  } catch (error) {
    handle(res, error);
  }
}

async function list(req, res) {
  try {
    res.json(await mailService.listMessages({ folder: req.query.folder, page: req.query.page, q: req.query.q }));
  } catch (error) {
    handle(res, error);
  }
}

async function read(req, res) {
  try {
    res.json(await mailService.getMessage({ folder: req.params.folder, uid: req.params.uid }));
  } catch (error) {
    handle(res, error);
  }
}

async function attachment(req, res) {
  try {
    const file = await mailService.getAttachment({ folder: req.params.folder, uid: req.params.uid, index: req.params.index });
    // Toujours en téléchargement : jamais affiché dans le navigateur (HTML, SVG…).
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file.content);
  } catch (error) {
    handle(res, error);
  }
}

async function recipients(req, res) {
  try {
    res.json(await mailService.searchRecipients(req.auth, req.query.q));
  } catch (error) {
    handle(res, error);
  }
}

async function send(req, res) {
  try {
    res.status(201).json(await mailService.send(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { status, unreadCount, list, read, attachment, send, recipients };
