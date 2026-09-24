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

module.exports = { signToken, verifyToken };
