import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
dotenv.config();

const DROP_STATEMENTS = [
  "drop table if exists public.org_memberships cascade;",
  "drop table if exists public.orgs cascade;",
  "drop table if exists public.users cascade;",
  "drop function if exists public.set_updated_at() cascade;",
  "drop role if exists app_runtime;",
  "drop schema if exists drizzle cascade;",
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db-reset-dev.ts MUST NOT run in production");
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    for (const stmt of DROP_STATEMENTS) await sql.unsafe(stmt);
    console.log("OK — dev DB reset.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db-reset-dev] failed:", err);
  process.exit(1);
});
