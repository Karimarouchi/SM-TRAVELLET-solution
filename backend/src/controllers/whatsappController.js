const whatsappService = require("../services/whatsappService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function listConversations(req, res) {
  try {
    res.json({ conversations: await whatsappService.listConversations(req.auth, req.query.search) });
  } catch (error) {
    handle(res, error);
  }
}

async function getMessages(req, res) {
  try {
    res.json(await whatsappService.getMessages(req.auth, req.params.contactId, {
      before: req.query.before,
      limit: req.query.limit
    }));
  } catch (error) {
    handle(res, error);
  }
}

async function sendMessage(req, res) {
  try {
    res.status(201).json(await whatsappService.sendText(req.auth, req.params.contactId, req.body?.text));
  } catch (error) {
    handle(res, error);
  }
}

async function sendMedia(req, res) {
  try {
    const { file, filename, caption } = req.body || {};
    res.status(201).json(await whatsappService.sendMedia(req.auth, req.params.contactId, { file, filename, caption }));
  } catch (error) {
    handle(res, error);
  }
}

async function getMedia(req, res) {
  try {
    const media = await whatsappService.getMedia(req.auth, req.params.contactId, req.params.messageId);
    const inline = /^(image|audio|video)\//.test(media.mime || "");
    res.setHeader("Content-Type", media.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(media.name)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(media.absolutePath);
  } catch (error) {
    handle(res, error);
  }
}

async function hideMessage(req, res) {
  try {
    res.json(await whatsappService.hideMessage(req.auth, req.params.contactId, req.params.messageId));
  } catch (error) {
    handle(res, error);
  }
}

async function linkStudent(req, res) {
  try {
    const studentId = req.body?.studentId;
    if (studentId === undefined) return handle(res, Object.assign(new Error("studentId est requis (ou null pour délier)."), { status: 400 }));
    res.json(await whatsappService.linkStudent(req.auth, req.params.contactId, studentId));
  } catch (error) {
    handle(res, error);
  }
}

async function assignOwner(req, res) {
  try {
    const salesId = req.body?.salesId;
    if (salesId === undefined) return handle(res, Object.assign(new Error("salesId est requis (ou null)."), { status: 400 }));
    res.json(await whatsappService.assignOwner(req.auth, req.params.contactId, salesId));
  } catch (error) {
    handle(res, error);
  }
}

async function setMuted(req, res) {
  try {
    if (typeof req.body?.muted !== "boolean") return handle(res, Object.assign(new Error("muted (true/false) est requis."), { status: 400 }));
    res.json(await whatsappService.setMuted(req.auth, req.params.contactId, req.body.muted));
  } catch (error) {
    handle(res, error);
  }
}

async function setBlocked(req, res) {
  try {
    if (typeof req.body?.blocked !== "boolean") return handle(res, Object.assign(new Error("blocked (true/false) est requis."), { status: 400 }));
    res.json(await whatsappService.setBlocked(req.auth, req.params.contactId, req.body.blocked));
  } catch (error) {
    handle(res, error);
  }
}

async function diagnostic(req, res) {
  try {
    res.json(await whatsappService.diagnostic(req.auth));
  } catch (error) {
    handle(res, error);
  }
}

async function unreadCount(req, res) {
  try {
    res.json(await whatsappService.unreadCount(req.auth));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { listConversations, getMessages, sendMessage, hideMessage, sendMedia, getMedia, diagnostic, setMuted, setBlocked, linkStudent, assignOwner, unreadCount };
