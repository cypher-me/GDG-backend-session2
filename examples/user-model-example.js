/**
 * 
 * -------------------------------------------------------------
 * pnpm exec prisma migrate dev --name init
 * node examples/user-model-example.js
 */

/* =====================================================================
 * STEP 1 - DEFINE THE MODEL (this lives in prisma/schema.prisma)
 * =====================================================================
 * The schema is the single source of truth for your data shape.
 * A plain model maps 1:1 to a database table.
 *
 *   model User {
 *     id        Int      @id @default(autoincrement())  // PK, auto-increments
 *     username  String   @unique                       // no two rows share this
 *     email     String   @unique
 *     full_name String?
 *     role      String   @default("user")              // defaults if not supplied
 *     createdAt DateTime @default(now())               // set automatically
 *   }
 *
 * Field pieces explained:
 *   - Type first:  String, Int, Boolean, DateTime, Float, etc.
 *   - @id          marks the primary key.
 *   - @default()   fills the field when you don't provide it.
 *   - @unique      adds a unique constraint/DB index.
 *   - ? (suffix)   makes the field OPTIONAL (nullable). No ? = required.
 *
 * After editing the schema, regenerate the type-safe client:
 *     pnpm exec prisma generate
 * ===================================================================== */

/* =====================================================================
 * STEP 2 - GET A CLIENT (src/db.js)
 * ===================================================================== */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString =
  process.env.DB_SERVICE_URI ||
  `postgresql://${encodeURIComponent(process.env.DB_USER)}:***@${process.env.DB_HOST_NAME}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const adapter = new PrismaPg({
  connectionString,
  ssl: { rejectUnauthorized: false }, // relaxes TLS for self-signed dev DBs
});

// One client for the whole app.
const prisma = new PrismaClient({ adapter });

/* =====================================================================
 * STEP 3 - USE THE MODEL
 * =====================================================================
 * `prisma.user` is auto-generated from your schema. Every method is
 * type-safe (your editor/linter flags typos) and returns a Promise.
 * ===================================================================== */

async function main() {
  // --- CREATE ---------------------------------------------------------
  // `create` inserts one row. Omit fields with defaults/autoincrement.
  const alice = await prisma.user.create({
    data: {
      username: "alice",
      email: "alice@example.com",
      full_name: "Alice Smith",
      // role: omitted -> Prisma fills @default("user")
    },
  });
  console.log("created:", alice);

  // You can also create many rows in one call (single transaction).
  await prisma.user.createMany({
    data: [
      { username: "bob", email: "bob@example.com" },
      { username: "carol", email: "carol@example.com", role: "admin" },
    ],
  });

  // --- READ -----------------------------------------------------------
  // findUnique: fetch by a unique field (@id or @unique). Returns one row or null.
  const user = await prisma.user.findUnique({
    where: { email: "alice@example.com" },
  });

  // findMany: fetch a list, with filters, ordering, paging.
  const admins = await prisma.user.findMany({
    where: { role: "admin" },        // WHERE role = 'admin'
    orderBy: { createdAt: "desc" },  // newest first
    take: 10,                        // LIMIT 10
    select: { username: true, role: true }, // only these columns
  });

  // findFirst: return the first matching row (or null).
  const one = await prisma.user.findFirst({ where: { role: "user" } });

  // count: just the number of matching rows.
  const total = await prisma.user.count({ where: { role: "admin" } });

  // --- UPDATE ---------------------------------------------------------
  const updated = await prisma.user.update({
    where: { id: alice.id },   // locate the row (by unique field)
    data: { full_name: "Alice J. Smith" }, // new values
  });

  // updateMany: update many rows, returns { count }.
  await prisma.user.updateMany({
    where: { role: "user" },
    data: { role: "member" },
  });

  // upsert: update if exists, otherwise create. Atomic.
  await prisma.user.upsert({
    where: { email: "dave@example.com" },
    update: { full_name: "Dave" },
    create: { username: "dave", email: "dave@example.com" },
  });

  // --- DELETE ---------------------------------------------------------
  await prisma.user.delete({ where: { id: alice.id } });
  const delCount = await prisma.user.deleteMany({
    where: { role: "guest" },
  });
  console.log("deleted:", delCount.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Close the pool so the process can exit cleanly.
    await prisma.$disconnect();
  });
