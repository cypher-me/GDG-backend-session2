// src/routes/idor.js
// -------------------------------------------------------------
// OWNERSHIP CHECKS + IDOR (Insecure Direct Object Reference)
//
// COMMANDS YOU RUN (from the project root):
//   pnpm add jsonwebtoken       # JWT lib (already installed)
//   pnpm exec prisma db push    # ensure the tasks table exists
//   pnpm dev                    # start the server
//
// WHAT THIS FILE IS ABOUT
// -----------------------
// IDOR (Insecure Direct Object Reference) is a broken-access-control bug:
//   - The client passes a direct object id (e.g. task id) in the URL.
//   - The server TRUSTS that id and acts on it — WITHOUT checking whether
//     the logged-in user actually OWNS that object.
//   - Attacker logs in as user A, calls /tasks/5 (which belongs to user B),
//     and the server happily returns/modifies B's task.
//
// This file shows BOTH sides of the coin for the SAME task routes:
//   - "v1" = the VULNERABLE version (IDOR present) — do NOT ship this.
//   - "v2" = the FIXED version (ownership check added) — the pattern to use.
//
// Mounted at /api/idor, so you can hit both side by side:
//   Method  URL                                            Behavior
//   ------  --------------------------------------------   -------------------------------------
//   GET     /api/idor/v1/tasks/:id   (VULNERABLE)          any logged-in user can read ANY task
//   PATCH   /api/idor/v1/tasks/:id   (VULNERABLE)          any logged-in user can edit ANY task
//   GET     /api/idor/v2/tasks/:id   (FIXED)               only owner (or admin) can read
//   PATCH   /api/idor/v2/tasks/:id   (FIXED)               only owner (or admin) can edit
// -------------------------------------------------------------

import { Router } from "express";
import prisma from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const idorRouter = Router();

// =====================================================================
//  PART 1 — the VULNERABLE (IDOR) version. Study how it's wrong.
// =====================================================================

/* ---------------------------------------------------------------------
 * GET /api/idor/v1/tasks/:id  —  VULNERABLE
 * Only requireAuth: proves the caller is LOGGED IN, nothing more.
 * The :id in the URL is used directly. There is NO check that this task
 * belongs to the caller. -> IDOR. Any authenticated user reads any task.
 * --------------------------------------------------------------------- */
idorRouter.get("/v1/tasks/:id", requireAuth, async (req, res) => {
  // `req.params.id` is the direct object reference from the URL.
  const taskId = Number(req.params.id);

  try {
    // No `where: { ownerId: req.user.id }` — we fetch the task purely by id.
    // If task #17 belongs to Bob, ALICE can GET it by guessing/scanning ids.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    // THE BUG: we never compared task.ownerId with req.user.id.
    // Whether the caller owns it or not, we return it.
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------------------
 * PATCH /api/idor/v1/tasks/:id  —  VULNERABLE (same flaw)
 * The caller can MODIFY anyone's task, because the handler only checks
 * that a token is present (requireAuth) — never that the task is theirs.
 * This is how an attacker defaces or corrupts another user's data.
 * --------------------------------------------------------------------- */
idorRouter.patch("/v1/tasks/:id", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  const { title, status } = req.body;

  try {
    // A `where: { id }` update with no ownership constraint.
    // THERE IS NO `ownerId` SCOPE and no fetch-then-compare.
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { title, status },
    });
    res.json(updated);
  } catch (err) {
    // The catch also hides the case where the caller hacked the row:
    // a 500/404 here doesn't reveal the attack, so it silently "succeeds" conceptually.
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
//  PART 2 — the FIXED version. Ownership check added.
// =====================================================================

/* ---------------------------------------------------------------------
 * GET /api/idor/v2/tasks/:id  —  FIXED
 * Same route name as v1, but now we FETCH the task FIRST, then compare
 * task.ownerId with req.user.id. If they differ, the caller can't have it.
 * --------------------------------------------------------------------- */
idorRouter.get("/v2/tasks/:id", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // THE FIX (ownership check):
    // Only the task's OWNER, or an admin (role from the JWT), may view it.
    const isOwner = task.ownerId === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      // 403: we deliberately make it ambiguous vs 404 so we don't confirm
      // the object exists — but "Forbidden" is fine for a teaching example.
      return res.status(403).json({ error: "You are not allowed to view this task" });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------------------
 * PATCH /api/idor/v2/tasks/:id  —  FIXED
 * Same ownership check, then (optionally) scope the update by ownerId too
 * so even a race between fetch and update can't be abused.
 * --------------------------------------------------------------------- */
idorRouter.patch("/v2/tasks/:id", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  const { title, status, description } = req.body;

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // THE FIX (ownership check before any write).
    const isOwner = task.ownerId === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You are not allowed to edit this task" });
    }

    // BELT-AND-SUSPENDERS: even the UPDATE is scoped to the owner.
    // `updateMany` with `where: { id, ownerId }` updates the row ONLY IF the
    // caller still owns it — protecting against a theoretical shrink between
    // the find and the update (TOCTOU, "time-of-check to time-of-use").
    const data = {};
    if (title !== undefined) data.title = title;
    if (status !== undefined) data.status = status;
    if (description !== undefined) data.description = description;

    const result = await prisma.task.updateMany({
      where: { id: taskId, ownerId: isAdmin ? undefined : req.user.id },
      data,
    });

    // updateMany returns a count (0 = nothing matched). If admin, we allow
    // ownerId undefined (any owner) — admins act on whatever task.
    if (result.count === 0 && !isAdmin) {
      return res.status(404).json({ error: "Task not found or not yours to edit" });
    }
    res.json({ message: "Task updated", id: taskId, updatedFields: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export the router; index.js mounts it under /api/idor.
export default idorRouter;
