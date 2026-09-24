function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Authentification requise." });

  try {
    const payload = require("./jwt").verifyToken(token);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
  }
}

function authRoles(auth) {
  // req.auth.roles est signé pour tout nouveau token (Phase A) ; fallback
  // défensif sur role singulier pour ne jamais planter sur un cas imprévu.
  return Array.isArray(auth?.roles) && auth.roles.length ? auth.roles : [auth?.role].filter(Boolean);
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth || !authRoles(req.auth).some((r) => roles.includes(r))) {
      return res.status(403).json({ error: "Accès refusé pour ce rôle." });
    }
    return next();
  };
}

function canAccessStudent(auth, studentUserId, assignedSalesId) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return true;
  if (roles.includes("STUDENT") && auth.sub === studentUserId) return true;
  if (roles.includes("SALES") && assignedSalesId === auth.sub) return true;
  return false;
}

// Accès à une candidature universitaire / un dossier visa : Sales assigné à
// l'étudiant OU RDV assigné à cette candidature OU Admin.
function canAccessApplication(auth, assignedSalesId, assignedRdvId) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return true;
  if (roles.includes("SALES") && assignedSalesId === auth.sub) return true;
  if (roles.includes("RDV") && assignedRdvId === auth.sub) return true;
  return false;
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Authentification requise." });
    if (authRoles(req.auth).includes("ADMIN")) return next();
    const permissions = Array.isArray(req.auth.permissions) ? req.auth.permissions : [];
    if (!permissions.includes(permission)) {
      return res.status(403).json({ error: "Permission refusée pour cette action." });
    }
    return next();
  };
}

// Accès accordé si le rôle de l'utilisateur figure dans `roles`, OU s'il a
// une des permissions listées (ADMIN passe toujours). Le contrôle fin
// (ex: un RDV limité à SES pays) se fait ensuite côté service.
function requireRolesOrPermissions(roles, permissions) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Authentification requise." });
    const userRoles = authRoles(req.auth);
    if (userRoles.includes("ADMIN")) return next();
    if (roles.some((r) => userRoles.includes(r))) return next();
    const granted = Array.isArray(req.auth.permissions) ? req.auth.permissions : [];
    if (permissions.some((p) => granted.includes(p))) return next();
    return res.status(403).json({ error: "Permission refusée pour cette action." });
  };
}

function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Authentification requise." });
    if (authRoles(req.auth).includes("ADMIN")) return next();
    const granted = Array.isArray(req.auth.permissions) ? req.auth.permissions : [];
    if (!permissions.some((p) => granted.includes(p))) {
      return res.status(403).json({ error: "Permission refusée pour cette action." });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRoles, requirePermission, requireAnyPermission, requireRolesOrPermissions, canAccessStudent, canAccessApplication, authRoles };
