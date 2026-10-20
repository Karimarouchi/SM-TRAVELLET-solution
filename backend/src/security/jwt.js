const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signToken(user, roles, permissions) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      roles: roles && roles.length ? roles : [user.role],
      permissions: permissions || [],
      email: user.email
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, algorithm: "HS256" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
}

// Lien d'ouverture d'un document (quelques minutes) : clé dérivée, donc jamais utilisable comme session.
const FILE_LINK_SECRET = () => `${env.jwtSecret}:file-link`;

function signFileLink(filename) {
  return jwt.sign({ f: filename }, FILE_LINK_SECRET(), { expiresIn: "5m", algorithm: "HS256" });
}

function verifyFileLink(token) {
  return jwt.verify(token, FILE_LINK_SECRET(), { algorithms: ["HS256"] });
}

module.exports = { signToken, verifyToken, signFileLink, verifyFileLink };
