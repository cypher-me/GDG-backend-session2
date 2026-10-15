// src/middleware/authorize.js
// -------------------------------------------------------------
// ROLE-BASED AUTHORIZATION middleware.
//
// COMMANDS YOU RUN (from the project root):
//   pnpm add jsonwebtoken      # already installed with the auth step
//   (no DB work here — authorization only reads the JWT role)
//
// Two concepts, keep them separate:
//   AUTHENTICATION = "who are you?"  -> requireAuth  (already in ./auth.js)
//   AUTHORIZATION = "what may you do?" -> requireRole (THIS file)
//
// We chain them: a route needs BOTH. First prove who you are (requireAuth),
// then check your role (requireRole). Express runs middlewares in order.
// -------------------------------------------------------------

// requireRole is a MIDDLEWARE FACTORY: requireRole("admin") returns a
// middleware that only "admin" may pass. We pass the allowed roles ahead
// of a route:   router.get("/x", requireAuth, requireRole("admin"), handler)
export function requireRole(...allowedRoles) {
  // The function returned below is actual middleware: (req, res, next).
  // It runs AFTER requireAuth, so it can trust req.user.role.
  return function (req, res, next) {
    // requireAuth has already decoded the JWT and set req.user = { id, role }.
    // If req.user doesn't exist, someone forgot to put requireAuth in front.
    if (!req.user) {
      // This "defensive" branch normally never runs (requireAuth would have
      // rejected the request first). It's here in case a route uses
      // requireRole without requireAuth — we still 401 instead of crashing.
      return res.status(401).json({ error: "No user on request — did you forget requireAuth?" });
    }

    // Pull the caller's role off the token. Allowed list is what the route
    // requires. If the caller's role isn't in the list, they're forbidden.
    const callerRole = req.user.role;
    if (!allowedRoles.includes(callerRole)) {
      // 403 Forbidden vs 401 Unauthorized:
      //   - 401 "you aren't logged in / bad credentials"
      //   - 403 "you ARE logged in, but you don't have permission to do this"
      return res.status(403).json({
        error: "Forbidden: requires role " + allowedRoles.join(" or "),
        yourRole: callerRole,
      });
    }

    // Role checks out — hand control to the route handler (or next middleware).
    next();
  };
}
