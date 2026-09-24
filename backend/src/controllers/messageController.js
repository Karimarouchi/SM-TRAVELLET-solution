const messageService = require("../services/messageService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function list(req, res) {
  try {
    res.json({ conversations: await messageService.listConversations(req.auth) });
  } catch (error) {
    handle(res, error);
  }
}

async function unread(req, res) {
  try {
    res.json(await messageService.unread(req.auth));
  } catch (error) {
    handle(res, error);
  }
}

async function getOne(req, res) {
  try {
    res.json(await messageService.getConversation(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function send(req, res) {
  try {
    res.status(201).json(await messageService.sendMessage(req.auth, req.params.id, req.body.body));
  } catch (error) {
    handle(res, error);
  }
}

async function openWithStudent(req, res) {
  try {
    res.json(await messageService.openWithStudent(req.auth, req.params.studentId));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { list, unread, getOne, send, openWithStudent };
