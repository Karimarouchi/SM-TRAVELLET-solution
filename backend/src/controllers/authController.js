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

async function logout(req, res) {
  try {
    // Fin d'une connexion « en tant que » : ce n'est pas l'employé qui se déconnecte, pas de pointage.
    if (req.auth?.sub && req.auth.role !== "STUDENT" && !req.auth.impersonatedBy) {
      await require("../repositories/hrAttendanceRepository").record(req.auth.sub, "LOGOUT");
    }
  } catch (error) {
    require("../logger").error("Pointage de déconnexion impossible", { message: error.message });
  }
  res.json({ ok: true });
}

async function changePassword(req, res) {
  if (req.auth.impersonatedBy) {
    return res.status(403).json({ error: "Connecté en tant que cet employé : son mot de passe et son e-mail se changent depuis la fiche Accès de l'administrateur." });
  }
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

async function verifyResetCode(req, res) {
  try {
    res.json(await authService.verifyResetCode(req.body.email, req.body.code));
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

async function changeEmail(req, res) {
  if (req.auth.impersonatedBy) {
    return res.status(403).json({ error: "Connecté en tant que cet employé : son mot de passe et son e-mail se changent depuis la fiche Accès de l'administrateur." });
  }
  try {
    res.json(await authService.changeEmail(req.auth.sub, req.body.currentPassword, req.body.email));
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

module.exports = { register, login, me, logout, changePassword, changeEmail, forgotPassword, verifyResetCode, resetPassword, verifyEmail, resendVerification };
