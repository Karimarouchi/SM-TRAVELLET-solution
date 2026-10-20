const leaveCover = require("../services/leaveCover");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Authentification requise." });

  let payload;
  try {
    payload = require("./jwt").verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
  }
  req.auth = payload;
  // Remplacements de congé du jour chargés avant les contrôles d'accès (synchrones) des services.
  return leaveCover.ready().then(() => {
    if (isBlockedDuringLeave(req)) {
      const absence = leaveCover.absenceOf(req.auth.sub);
      const until = new Date(`${absence.endOn}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" });
      return res.status(403).json({ error: `Vous êtes en congé jusqu'au ${until} : vos dossiers sont en lecture seule, vos remplaçants s'en occupent.`, code: "ON_LEAVE" });
    }
    return next();
  });
}

// Pendant un congé avec remplaçants, l'absent garde la lecture mais ne modifie rien,
// sauf son espace RH, son compte et ses notifications. Un admin n'est jamais bloqué.
const LEAVE_WRITABLE_PATHS = [/^\/api\/auth\//, /^\/api\/hr\/me(\/|$)/, /^\/api\/notifications(\/|$)/];

function isBlockedDuringLeave(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  if (authRoles(req.auth).includes("ADMIN")) return false;
  if (!leaveCover.absenceOf(req.auth.sub)) return false;
  const path = String(req.originalUrl || req.url || "").split("?")[0];
  return !LEAVE_WRITABLE_PATHS.some((pattern) => pattern.test(path));
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
  if (roles.includes("SALES") && leaveCover.handles(auth, assignedSalesId, studentUserId, "SALES")) return true;
  return false;
}

// Accès à une candidature universitaire / un dossier visa : Sales assigné à
// l'étudiant OU RDV assigné à cette candidature OU Admin (ou leur remplaçant pendant un congé).
function canAccessApplication(auth, assignedSalesId, assignedRdvId, studentId) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return true;
  if (roles.includes("SALES") && leaveCover.handles(auth, assignedSalesId, studentId, "SALES")) return true;
  if (roles.includes("RDV") && leaveCover.handles(auth, assignedRdvId, studentId, "RDV")) return true;
  return false;
}

// Le conseiller (SALES) ou le Responsable Dossier (RDV) de cette candidature, ou son remplaçant.
function handlesApplication(auth, application, scope) {
  if (!application) return false;
  const owner = scope === "RDV" ? application.assigned_rdv_id : application.sales_id;
  return authRoles(auth).includes(scope) && leaveCover.handles(auth, owner, application.student_id, scope);
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

module.exports = { requireAuth, requireRoles, requirePermission, requireAnyPermission, requireRolesOrPermissions, canAccessStudent, canAccessApplication, handlesApplication, authRoles };
