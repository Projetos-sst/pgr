import fs from "node:fs";
import path from "node:path";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
dotenv.config();

// Idempotent SQL files kept OUT of Drizzle's journal so they don't fight the
// snapshot tracker on every `db:generate` (they touch objects Drizzle doesn't
// model: triggers, functions, roles, grants).
const CUSTOM_SQL_FILES = ["0001_set_updated_at.sql", "0002_app_runtime_role.sql"];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set.");
  const parsed = new URL(url);
  if (parsed.port !== "5432") {
    throw new Error(`DATABASE_URL_UNPOOLED MUST use port 5432, got ${parsed.port}.`);
  }
  if (parsed.username !== "postgres") {
    throw new Error(
      `DATABASE_URL_UNPOOLED MUST authenticate as 'postgres', got ${parsed.username}.`,
    );
  }

  const appPassword = process.env.APP_RUNTIME_DB_PASSWORD;
  if (!appPassword) throw new Error("APP_RUNTIME_DB_PASSWORD is not set.");

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    // GUC consumed by 0002_app_runtime_role.sql via current_setting(...).
    await sql`select set_config('app.app_runtime_password', ${appPassword}, false)`;

    const db = drizzle(sql);
    const migrationsFolder = path.resolve(process.cwd(), "lib/db/migrations");
    await migrate(db, { migrationsFolder });

    for (const file of CUSTOM_SQL_FILES) {
      const content = fs.readFileSync(path.join(migrationsFolder, file), "utf8");
      const statements = content
        .split(/--> statement-breakpoint/g)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) await sql.unsafe(stmt);
      console.log(`OK — applied ${file}`);
    }

    console.log("OK — migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db-migrate] failed:", err);
  process.exit(1);
});
