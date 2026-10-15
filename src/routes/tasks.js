// src/routes/tasks.js
// -------------------------------------------------------------
// PROTECTED task routes + ROLE-BASED authorization, chained onto the auth
// middleware (requireAuth) and the new role middleware (requireRole).
//
// COMMANDS YOU RUN (from the project root):
//   pnpm add jsonwebtoken                      # JWT lib (already installed)
//   pnpm exec prisma db push                   # create the tasks table in DB
//   pnpm dev                                    # start the server
//
// The route table shows how enforce() and authorization combine:
//   Method  Path                Auth?   Role?
//   ------  ------------------  ------  --------------------------------------------------
//   GET     /api/tasks          ✔ jwt   any logged-in user (sees only THEIR tasks)
//   POST    /api/tasks          ✔ jwt   any logged-in user (they own what they create)
//   PATCH   /api/tasks/:id      ✔ jwt   owner OR admin (object-level authorization)
//   GET     /api/tasks/all      ✔ jwt   ADMIN ONLY (role-based authorization)
//   DELETE  /api/tasks/:id      ✔ jwt   ADMIN ONLY (role-based authorization)
// -------------------------------------------------------------

import { Router } from "express";
import prisma from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/authorize.js";

const taskRouter = Router();

/* =====================================================================
 * GET /api/tasks  —  authenticated (any logged-in user; no special role)
 * =====================================================================
 * Because requireAuth runs first, req.user is guaranteed. We return ONLY
 * the caller's own tasks (ownerId === req.user.id), so users can't see
 * each other's to-do lists even though they share one table.
 * ===================================================================== */
taskRouter.get("/", requireAuth, async (req, res) => {
  try {
    // `where: { ownerId }` uses the id from the JWT — this is the "object
    // level authorization" pattern: filter results per user at the query.
    const tasks = await prisma.task.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    // Return just the task fields (no nested owner needed for a user's own list).
    res.json({ count: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================================
 * POST /api/tasks  —  authenticated (create your own task)
 * =====================================================================
 * Expects JSON: { title, description?, status? }
 * The ownerId is taken from the JWT, NOT from the request body — this
 * prevents a user from creating a task "in" someone else's name.
 * ===================================================================== */
taskRouter.post("/", requireAuth, async (req, res) => {
  const { title, description, status } = req.body;

  // Minimal validation, just enough for the example.
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "title (string) is required" });
  }

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        status: status ?? "pending",
        ownerId: req.user.id, // <- from the token, never from the client
      },
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================================
 * GET /api/tasks/all  —  ADMIN ONLY (role-based authorization)
 * =====================================================================
 * requireRole("admin") runs after requireAuth. A non-admin caller gets a
 * 403 before this handler ever executes. We also include the owner's
 * username via `include` so an admin sees who owns each task.
 * ===================================================================== */
taskRouter.get("/all", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { id: true, username: true } } },
    });
    res.json({ count: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================================
 * PATCH /api/tasks/:id  —  owner OR admin (object-level authorization)
 * =====================================================================
 * Middleware can't decide this alone because WHO is allowed depends on
 * the specific task row. So we enforce it INSIDE the handler:
 *   1. find the task,
 *   2. allow if caller is the owner OR an admin (role from JWT),
 *   3. otherwise 403.
 * This is the classic "ownership check" that middleware can't express.
 * ===================================================================== */
taskRouter.patch("/:id", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id); // URL params come in as strings
  const { title, description, status } = req.body;

  try {
    // Fetch the target task so we can read its ownerId. No update yet.
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Object-level authorization: owner, or any admin, may edit this task.
    const isOwner = task.ownerId === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You can only edit your own tasks" });
    }

    // Build an object of ONLY the fields that were provided, then update.
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================================
 * DELETE /api/tasks/:id  —  ADMIN ONLY (role-based authorization)
 * =====================================================================
 * A second illustration of requireRole. Only users whose token claim
 * role === "admin" may delete tasks. Owners (regular users) get a 403.
 * ===================================================================== */
taskRouter.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const taskId = Number(req.params.id);
  try {
    // `deleteMany` lets us scope deletion to the exact row by id.
    const result = await prisma.task.deleteMany({ where: { id: taskId } });
    if (result.count === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ message: "Task deleted", id: taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export the router; index.js mounts it under /api/tasks.
export default taskRouter;
