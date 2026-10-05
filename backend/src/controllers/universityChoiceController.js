const choiceService = require("../services/universityChoiceService");

function handle(res, error, fallback = 500) {
  res.status(error.status || fallback).json({ error: error.message || "Erreur serveur." });
}

async function listMine(req, res) {
  try {
    res.json(await choiceService.listMine(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function listForStudent(req, res) {
  try {
    res.json(await choiceService.listForStudent(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function picker(req, res) {
  try {
    res.json(await choiceService.pickerForCountry(req.params.countryId));
  } catch (error) {
    handle(res, error);
  }
}

async function addMine(req, res) {
  try {
    res.status(201).json(await choiceService.addChoice(req.auth, req.auth.sub, req.body || {}));
  } catch (error) {
    handle(res, error, 400);
  }
}

async function addForStudent(req, res) {
  try {
    res.status(201).json(await choiceService.addChoice(req.auth, req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error, 400);
  }
}

async function remove(req, res) {
  try {
    res.json(await choiceService.removeChoice(req.auth, req.params.id));
  } catch (error) {
    handle(res, error, 400);
  }
}

module.exports = { listMine, listForStudent, picker, addMine, addForStudent, remove };
