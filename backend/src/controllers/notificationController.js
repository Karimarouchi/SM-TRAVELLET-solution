const notificationService = require("../services/notificationService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function list(req, res) {
  try {
    res.json(await notificationService.list(req.auth, req.query));
  } catch (error) {
    handle(res, error);
  }
}

async function unreadCount(req, res) {
  try {
    res.json({ unread: await notificationService.unreadCount(req.auth) });
  } catch (error) {
    handle(res, error);
  }
}

async function markRead(req, res) {
  try {
    await notificationService.markRead(req.auth, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    handle(res, error);
  }
}

async function markAllRead(req, res) {
  try {
    await notificationService.markAllRead(req.auth);
    res.json({ ok: true });
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { list, unreadCount, markRead, markAllRead };
