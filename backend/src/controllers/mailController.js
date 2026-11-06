const mailService = require("../services/mailService");

function handle(res, error) {
  res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function status(req, res) {
  try {
    res.json(await mailService.status(req.auth, req.query.mailbox));
  } catch (error) {
    handle(res, error);
  }
}

async function unreadCount(req, res) {
  try {
    res.json(await mailService.unreadCount(req.auth, req.query.mailbox));
  } catch (error) {
    handle(res, error);
  }
}

async function list(req, res) {
  try {
    res.json(await mailService.listMessages(req.auth, { folder: req.query.folder, page: req.query.page, q: req.query.q, mailbox: req.query.mailbox }));
  } catch (error) {
    handle(res, error);
  }
}

async function read(req, res) {
  try {
    res.json(await mailService.getMessage(req.auth, { folder: req.params.folder, uid: req.params.uid, mailbox: req.query.mailbox }));
  } catch (error) {
    handle(res, error);
  }
}

async function attachment(req, res) {
  try {
    const file = await mailService.getAttachment(req.auth, { folder: req.params.folder, uid: req.params.uid, index: req.params.index, mailbox: req.query.mailbox });
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

async function connectMailbox(req, res) {
  try {
    res.json(await mailService.connectMailbox(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function disconnectMailbox(req, res) {
  try {
    res.json(await mailService.disconnectMailbox(req.auth));
  } catch (error) {
    handle(res, error);
  }
}

async function mailboxes(req, res) {
  try {
    res.json(await mailService.listMailboxes());
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { status, unreadCount, list, read, attachment, send, recipients, connectMailbox, disconnectMailbox, mailboxes };
