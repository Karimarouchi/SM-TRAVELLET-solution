const authService = require("../services/authService");

function handle(res, error) {
  const status = error.status || 400;
  return res.status(status).json({ error: error.message || "Requête invalide." });
}

async function register(req, res) {
  try {
    res.status(201).json(await authService.register(req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function login(req, res) {
  try {
    res.json(await authService.login(req.body.email, req.body.password));
  } catch (error) {
    handle(res, error);
  }
}

async function me(req, res) {
  try {
    res.json(await authService.me(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function logout(_req, res) {
  res.json({ ok: true });
}

async function changePassword(req, res) {
  try {
    res.json(await authService.changePassword(req.auth.sub, req.body.currentPassword, req.body.newPassword));
  } catch (error) {
    handle(res, error);
  }
}

async function forgotPassword(req, res) {
  try {
    res.json(await authService.forgotPassword(req.body.email));
  } catch (error) {
    handle(res, error);
  }
}

async function resetPassword(req, res) {
  try {
    res.json(await authService.resetPassword(req.body.token, req.body.password));
  } catch (error) {
    handle(res, error);
  }
}

async function verifyEmail(req, res) {
  try {
    res.json(await authService.verifyEmail(req.auth.sub, req.body.code));
  } catch (error) {
    handle(res, error);
  }
}

async function resendVerification(req, res) {
  try {
    res.json(await authService.resendVerificationCode(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { register, login, me, logout, changePassword, forgotPassword, resetPassword, verifyEmail, resendVerification };
