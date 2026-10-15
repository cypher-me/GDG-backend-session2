// src/utils/jwt.js
// -------------------------------------------------------------
// Illustrates issuing and verifying JWTs with the `jsonwebtoken` library.
//
// COMMANDS YOU RUN:
//   pnpm add jsonwebtoken           # install the JWT library
//
// What is a JWT (JSON Web Token)?
//   A self-contained, signed token:  header.payload.signature
//   - header:     algorithm + token type metadata
//   - payload:    our claims (things we assert about the user), e.g. { sub, role }
//   - signature:  signs header+payload with a SECRET so the token can't be
//                 tampered with. Whoever has the secret can verify it.
//
// Signing vs encryption: a JWT is signed, NOT encrypted. Anyone with the
// token can READ the payload (so never put secrets in it — only non-sensitive
// data like user id + role). The signature is what proves the payload wasn't
// altered. We verify the signature with the secret.
// -------------------------------------------------------------

import jwt from "jsonwebtoken";

// The secret signs and verifies tokens. In a real app this MUST come from
// an env var — never hardcode it. (We fall back to a dev default here.)
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// How long the token stays valid before it must be refreshed.
const expiresIn = "2h";

// ISSUE a token for a user — called at LOGIN.
// `payload` = what we bake into the token (ours: user id + role + username).
export function signToken(user) {
  // body = our "claims". `sub` (subject) is the convention for the user id.
  const payload = {
    sub: user.id,            // subject = who the token belongs to
    username: user.username, // handy so protected routes don't re-query
    role: user.role,         // role claim for authorization
  };

  // jwt.sign(payload, secret, options) returns the full token string.
  // The expiresIn option adds an `exp` claim automatically.
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// VERIFY a token — called in protected route or middleware.
// Throws if invalid/expired, otherwise returns the decoded payload.
export function verifyToken(token) {
  // jwt.verify checks the signature and the exp claim, throws on bad input.
  return jwt.verify(token, JWT_SECRET);
}
