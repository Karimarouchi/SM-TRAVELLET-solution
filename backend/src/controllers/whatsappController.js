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

async function unreadCount(req, res) {
  try {
    res.json({ unread: await whatsappService.unreadCount(req.auth) });
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { listConversations, getMessages, sendMessage, linkStudent, assignOwner, unreadCount };
