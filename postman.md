# Postman / API Test Collection

This describes EVERY feature and route implemented across the project so far,
with ready-to-run curl commands (or Postman requests) to test each one.

## Prerequisites

- Server running: `pnpm dev` (listens on PORT, default 3000)
- Base URL for all examples: `http://localhost:3000`
- Two accounts used below: `alice` (role: user) and `admin1` (role: admin).
  Register them first if they don't exist (register with `role` field).

---

## 1. Project Overview — all features implemented

| # | Feature | Where |
|---|---------|-------|
| 1 | DB connection & startup health check | `src/db.js`, `src/index.js` |
| 2 | Basic user list/create routes | `src/index.js` (`/users`) |
| 3 | User model | `prisma/schema.prisma` |
| 4 | Password hashing & salting (bcrypt) | `src/utils/password.js` |
| 5 | JWT issuing & verification | `src/utils/jwt.js` |
| 6 | Registration + login | `src/routes/auth.js` |
| 7 | Authentication middleware (`requireAuth`) | `src/middleware/auth.js` |
| 8 | Role-based authorization (`requireRole`) | `src/middleware/authorize.js` |
| 9 | Protected task routes + RBAC | `src/routes/tasks.js` |
| 10 | Ownership checks + IDOR demo & fix | `src/routes/idor.js` |

---

## 2. Basic routes (no auth)

```
GET http://localhost:3000/
```
```
GET http://localhost:3000/users
```
```
POST http://localhost:3000/users
Content-Type: application/json
Body: {"username":"demo_user","full_name":"Demo Person","role":"user"}
```
Note: `/users` POST does NOT store a password — use `/api/auth/register`
when you want a proper password-hashed account.

---

## 3. Authentication — register/login (hashing + JWT)

```
POST http://localhost:3000/api/auth/register
Content-Type: application/json
Body: {"username":"alice","email":"alice@example.com","password":"some-pass","full_name":"Alice","role":"user"}
```
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json
Body: {"username":"admin1","email":"admin1@example.com","password":"admin-pass","full_name":"Admin","role":"admin"}
```
Login (returns a JWT — copy the `token` value):
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json
Body: {"username":"alice","password":"some-pass"}
```

In Postman, save the token to a variable so all later requests reuse it:
- After login, run: `pm.collectionVariables.set("alice_token", pm.response.json().token);`
in the Tests tab, or just paste the token into `Authorization: Bearer <token>`.

---

## 4. Authentication middleware — protected route gates

These require a valid `Authorization: Bearer <token>`:

```
# No token            -> 401
GET http://localhost:3000/api/tasks

# Garbage token       -> 401
GET http://localhost:3000/api/tasks
Authorization: Bearer not.a.real.token
```

Proof of auth middleware — the request is blocked BEFORE reaching any handler.

---

## 5. Protected task routes + role-based authorization (RBAC)

All with `Authorization: Bearer <alice_token>` unless stated otherwise:

```
# Alice creates a task
POST http://localhost:3000/api/tasks
Content-Type: application/json
Body: {"title":"Read a chapter","description":"NodeJS","status":"pending"}
```
```
# Alice lists only HER tasks (result is per-caller)
GET http://localhost:3000/api/tasks
```

Role-based tests with `admin1_token` and `alice_token`:

```
# admin-only endpoint: alice (role user) -> 403
GET http://localhost:3000/api/tasks/all
Authorization: Bearer <alice_token>

# admin can see ALL tasks -> 200
GET http://localhost:3000/api/tasks/all
Authorization: Bearer <admin1_token>

# alice cannot DELETE (admin-only) -> 403
DELETE http://localhost:3000/api/tasks/:id
Authorization: Bearer <alice_token>

# admin CAN delete -> 200
DELETE http://localhost:3000/api/tasks/:id
Authorization: Bearer <admin1_token>
```

---

## 6. Ownership checks + IDOR demonstration & fix

Two parallel route sets mounted at `/api/idor`:

- **v1 = VULNERABLE (IDOR)**: trusts the `:id`, no ownership check.
- **v2 = FIXED**: adds the ownership check.

### Demonstrate the IDOR (vulnerable)

```
# 1. Create a task owned by admin1
POST http://localhost:3000/api/tasks
Content-Type: application/json
Body: {"title":"Admin secret task"}
Authorization: Bearer <admin1_token>

# 2. Alice reads admin's task — VULNERABLE route allows it -> 200 (IDOR!)
GET http://localhost:3000/api/idor/v1/tasks/:id
Authorization: Bearer <alice_token>

# 3. Alice edits admin's task — VULNERABLE route -> 200 (data corrupted)
PATCH http://localhost:3000/api/idor/v1/tasks/:id
Content-Type: application/json
Body: {"status":"done"}
Authorization: Bearer <alice_token>
```
This is the attack: the server only checked "is there a valid token?" —
never "does the caller OWN the object referenced by `:id`?"

### Confirm the fix (v2)

```
# 4. Alice tries the SAME read on the FIXED route -> 403
GET http://localhost:3000/api/idor/v2/tasks/:id
Authorization: Bearer <alice_token>

# 5. Alice tries the SAME edit on the FIXED route -> 403
PATCH http://localhost:3000/api/idor/v2/tasks/:id
Content-Type: application/json
Body: {"status":"done"}
Authorization: Bearer <alice_token>   # (typo'd on purpose to test auth — use Bearer)

# 6. admin1 (owner) CAN read/edit on the FIXED route -> 200
GET  http://localhost:3000/api/idor/v2/tasks/:id
PATCH http://localhost:3000/api/idor/v2/tasks/:id
Content-Type: application/json
Body: {"status":"in_progress"}
Authorization: Bearer <admin1_token>
```

Ownership rule used everywhere: owner OR admin.

---

## 7. Expected status codes cheat-sheet

| Code | Meaning |
|------|---------|
| 200 | OK — success |
| 201 | Created (register/login/create task) |
| 400 | Bad input (e.g. missing title) |
| 401 | Unauthorized — no/invalid token, or bad credentials |
| 403 | Forbidden — valid token but insufficient role |
| 404 | Not found |
| 409 | Conflict — duplicate username/email on register |
| 500 | Server error (e.g. DB unreachable) |

---

## 8. Quick full-flow script (copy each line)

```
# in one terminal:
pnpm dev
```
```
# in another terminal:
TOKEN=""
ADMIN=""
# register two users (run once; skip if they already exist)
curl -s -X POST localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"alice","email":"alice@example.com","password":"some-pass","full_name":"Alice","role":"user"}'
curl -s -X POST localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"admin1","email":"admin1@example.com","password":"admin-pass","full_name":"Admin","role":"admin"}'

TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"alice","password":"some-pass"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
ADMIN=$(curl -s -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin1","password":"admin-pass"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "tokens ready: ${TOKEN:0:10} / ${ADMIN:0:10}"

# protected / RBAC
curl -s -i localhost:3000/api/tasks                                   # 401
curl -s localhost:3000/api/tasks -H "Authorization: Bearer ***"       # 200 (own, empty)
curl -s -X POST localhost:3000/api/tasks -H "Authorization: Bearer ***" -H "Content-Type: application/json" -d '{"title":"Read a chapter"}'
curl -s -i localhost:3000/api/tasks/all -H "Authorization: Bearer ***"              # 403
curl -s localhost:3000/api/tasks/all -H "Authorization: Bearer ***"                 # 200 admin

# IDOR demo: admin creates a task, then alice (non-owner) tries to touch it
curl -s -X POST localhost:3000/api/tasks -H "Authorization: Bearer ***" -H "Content-Type: application/json" -d '{"title":"Admin secret"}'   # gives an :id
curl -s localhost:3000/api/idor/v1/tasks/1 -H "Authorization: Bearer ***"     # 200  <- IDOR, leaks
curl -s localhost:3000/api/idor/v2/tasks/1 -H "Authorization: Bearer ***"     # 403  <- fixed
curl -s localhost:3000/api/idor/v2/tasks/1 -H "Authorization: Bearer ***"     # 200  <- owner/admin
```
(Replace the `Bearer ***` placeholders with your captured token. Full-text
versions of every command appear in the sections above with the exact bodies.)

---

## 9. Presentation notes (each route's teaching point)

- `/api/auth/register + login` — bcrypt salting + JWT issue.
- `/api/tasks` GET — object-level scoping (`orderyBy`/`where`) proves per-user visibility.
- `/api/tasks/all` + DELETE — role-based auth, 403 for non-admin.
- `/api/idor/v1/*` — the deliberate vulnerability (IDOR): what happens with no ownership check.
- `/api/idor/v2/*` — the secure pattern: the fix (ownership + optional scoped update).

Everything above reflects the current, verified state of the repo.
