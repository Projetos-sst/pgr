import fs from "node:fs";
import path from "node:path";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TRIGGERS_MIGRATION = "0001_set_updated_at.sql";
const ROLE_MIGRATION = "0002_app_runtime_role.sql";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const db = drizzle(sql);
    const migrationsFolder = path.resolve(process.cwd(), "lib/db/migrations");
    await migrate(db, { migrationsFolder });

    await applySqlFile(sql, migrationsFolder, TRIGGERS_MIGRATION);

    const appPassword = process.env.APP_RUNTIME_DB_PASSWORD;
    if (appPassword) {
      await sql`select set_config('app.app_runtime_password', ${appPassword}, false)`;
      await applySqlFile(sql, migrationsFolder, ROLE_MIGRATION);
    } else {
      console.log(`SKIP — ${ROLE_MIGRATION} (APP_RUNTIME_DB_PASSWORD not set)`);
    }

    console.log("OK — migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function applySqlFile(
  sql: ReturnType<typeof postgres>,
  folder: string,
  file: string,
): Promise<void> {
  const content = fs.readFileSync(path.join(folder, file), "utf8");
  const statements = content
    .split(/--> statement-breakpoint/g)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) await sql.unsafe(stmt);
  console.log(`OK — applied ${file}`);
}

main().catch((err) => {
  console.error("[db-migrate] failed:", err);
  process.exit(1);
});
