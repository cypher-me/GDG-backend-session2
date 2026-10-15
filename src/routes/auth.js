// Authentication routes: registration and login.
//
// Mounted at /api/auth (see index.js), so:
//   POST /api/auth/register   -> create a new account
//   POST /api/auth/login      -> verify credentials
// -------------------------------------------------------------

import { Router } from "express";
// `Router` is a mini-Express app you can attach routes to and then
// mount onto the main app with a URL prefix (here /api/auth).

import prisma from "../db.js";

// Create the router. All routes registered on it get the /api/auth prefix.
const authRouter = Router();

/* =====================================================================
 * REGISTER — POST /api/auth/register
 * =====================================================================
 * Expects JSON: { username, email, password, full_name?, role? }
 * Creates a new user row and returns the created user (without its password).
 * ===================================================================== */
authRouter.post("/register", async (req, res) => {
  // Pull the fields the client sent in the JSON body.
  // express.json() in index.js already parsed the body for us.
  const { username, email, password, full_name, role } = req.body;

  try {
    // TODO(security): hash `password` before storing it.
    // prisma.user.create adds one row and returns it.
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password,
        full_name, // optional — will be null if not supplied
        role,      // optional — falls back to schema default "user"
      },
    });

    // Never return the password, even plaintext, back to the client.
    res.status(201).json({
      message: "User registered successfully",
      // `select` limits which fields come back from the created row.
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
      },
    });
  } catch (err) {
    // Common causes: duplicate username/email (unique constraint),
    // or a missing required field. Prisma wraps DB errors; the code
    // P2002 = "unique constraint failed".
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================================
 * LOGIN — POST /api/auth/login
 * =====================================================================
 * Expects JSON: { username, email?, password }
 * Finds the user by username OR email, checks the password, and
 * returns the user if it matches.
 * ===================================================================== */
authRouter.post("/login", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Find the account. `findFirst` locates the first matching row —
    // handy when the identifier could be a username OR an email.
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username || undefined },
          { email: email || undefined },
        ],
      },
    });

    // No account with those details -> generic "invalid credentials".
    // (We keep the message vague so we don't leak which usernames exist.)
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // TODO(security): compare against the hashed password here instead.
    // For now the plaintext comparison mirrors what was stored at register.
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Success — respond without exposing the stored password.
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export the router; index.js mounts it under /api/auth.
export default authRouter;
