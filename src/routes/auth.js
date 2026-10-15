// src/routes/auth.js
// -------------------------------------------------------------
// Authentication routes: registration and login.
//
// COMMANDS YOU RUN (from the project root):
//   pnpm add bcrypt jsonwebtoken    # install hashing + JWT libraries
//
// This file demonstrates:
//   - bcrypt:  hashing passwords before storage (register)
//   - jsonwebtoken: signing a token after successful login
// -------------------------------------------------------------

import { Router } from "express";
import prisma from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";

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
    // Hash the password before storing it.
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        full_name,
        role,
      },
    });

    // Never return the password, even plaintext, back to the client.
    // Issue a JWT for the newly registered user.
    const token = signToken(newUser);
    res.status(201).json({
      token,
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

    // Verify the supplied password against the stored hash.
    const passwordMatches = await verifyPassword(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Success — issue a JWT and return it with user info.
    const token = signToken(user);
    res.json({
      token,
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
