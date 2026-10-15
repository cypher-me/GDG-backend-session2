// db.js
// Sets up the Prisma client using the connection details from the .env file.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// Build a full connection string from the existing settings — DB_SERVICE_URI
// when present, otherwise assembled from the individual host/port/name fields.

// let connectionString = process.env.DB_SERVICE_URI || "";
const connectionString =
  process.env.DB_SERVICE_URI ||
  `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

if (!connectionString) {
    const host = process.env.DB_HOST_NAME || process.env.DB_HOST || "";
    const user = process.env.DB_USER || "";
    const password = process.env.DB_PASSWORD || "";
    const database = process.env.DB_NAME || "";
    const port = process.env.DB_PORT || "5432";
    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// Some hosted Postgres (e.g. Neon/Supabase dev tiers) connect over SSL but
// present a self-signed certificate. Append sslmode=no-verify (TLS without CA
// verification) so the sample actually connects — remove this for production
// and use the provided CA cert instead.
if (!/\?/.test(connectionString)) {
    connectionString += "?sslmode=no-verify";
} else if (!/sslmode=/.test(connectionString)) {
    connectionString += "&sslmode=no-verify";
}

// Prisma 7 uses a driver adapter which takes the connection string directly
// (the client no longer reads a DATABASE_URL env var for the schema).

// const adapter = new PrismaPg(connectionString);

const adapter = new PrismaPg({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Create the client. `new PrismaClient()` is inexpensive, so a single shared
// instance is exported and reused by the whole app.
const prisma = new PrismaClient({ adapter });

// A tiny helper to test that we can actually reach the database.
// The server calls this once on startup and logs the result.
export async function testConnection() {
    // `$queryRaw` runs a raw SQL query against the remote database.
    const [row] = await prisma.$queryRaw`SELECT NOW() AS now, current_database() AS db`;
    return row;
}

// Export the client so other files (routes etc.) can run their own queries.
export default prisma;
