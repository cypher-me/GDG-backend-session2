// Prisma 7 CLI config — moves the connection URL out of the schema file and
// into this file so CLI commands like `migrate` / `db push` can reach the DB.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        // Points the CLI at the database. For most dev setups a single service
        // URI is used; fall back to the individual fields if you want to keep
        // them instead.
        url: process.env.DB_SERVICE_URI || process.env.DATABASE_URL,
    },
});
