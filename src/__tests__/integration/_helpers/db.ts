import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

export function requireIntegrationDatabaseUrl(): string {
  const url = process.env.INTEGRATION_DATABASE_URL;
  if (!url) throw new Error("INTEGRATION_DATABASE_URL is not set.");
  return url;
}

export function appRuntimeClient() {
  return postgres(requireIntegrationDatabaseUrl(), { max: 1, prepare: false });
}

export function adminClient() {
  const url =
    process.env.INTEGRATION_DATABASE_URL_ADMIN ?? requireIntegrationDatabaseUrl();
  return postgres(url, { max: 1, prepare: false });
}

export async function truncateAll(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql.unsafe(
    `truncate table public.org_memberships, public.orgs, public.users restart identity cascade;`,
  );
}

export async function setJwtClaims(
  sql: ReturnType<typeof postgres>,
  claims: Record<string, string> | null,
): Promise<void> {
  const value = claims === null ? "" : JSON.stringify(claims);
  await sql`select set_config('request.jwt.claims', ${value}, true)`;
}

export async function withOrgTx<T>(
  sql: ReturnType<typeof postgres>,
  orgId: string,
  fn: (tx: ReturnType<typeof postgres>) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.current_org', ${orgId}, true)`;
    return fn(tx as unknown as ReturnType<typeof postgres>);
  }) as Promise<T>;
}

export async function applyMigrations(sql: ReturnType<typeof postgres>): Promise<void> {
  const folder = path.resolve(process.cwd(), "src/shared/db/migrations");
  const files = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const content = fs.readFileSync(path.join(folder, file), "utf8");
    const statements = content
      .split(/--> statement-breakpoint/g)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) await sql.unsafe(stmt);
  }
}
