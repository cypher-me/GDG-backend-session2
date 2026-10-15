// src/middleware/auth.js
// -------------------------------------------------------------
// Middleware that PROTECTS a route — verifies the JWT the client sends.
//
// HOW THE CLIENT SENDS IT:
//   Authorization: Bearer <token>
// This is the HTTP convention for sending a token. We extract it from the
// header, verify it, and only let the request through if it's valid.
//
// COMMANDS YOU RUN:
//   (none extra — uses jwt.js from the previous step)
// -------------------------------------------------------------

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Express middleware signature: (req, res, next).
// Call `next()` to continue to the route, or end the request with an error.
export function requireAuth(req, res, next) {
  // 1) Read the Authorization header, if any.
  const authHeader = req.headers.authorization;

  // Typical value: "Bearer eyJhbGciOi...". Split on the space so we can pull
  // the token off the end. If the header is missing, `parts[1]` is undefined.
  const parts = authHeader ? authHeader.split(" ") : [];
  const token = parts[1];

  // 1b) No token -> 401 Unauthorized, stop the request here.
  if (!token) {
    return res.status(401).json({ error: "Authentication token required" });
  }

  try {
    // 2) Verify the token's signature + expiry.
    // Throws on tampering/expiry, in which case we jump to the catch below.
    const payload = jwt.verify(token, JWT_SECRET);

    // 3) Attach the decoded user to `req` so the route can read it.
    // `req.user` is then available inside the protected handler.
    req.user = {
      id: payload.sub,        // user id we baked in at sign time
      username: payload.username,
      role: payload.role,
    };

    // 4) All good — pass control to the actual route handler.
    next();
  } catch (err) {
    // Invalid signature, expired, or malformed -> reject.
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
