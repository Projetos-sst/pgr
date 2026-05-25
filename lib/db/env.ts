export function getRuntimeDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set.");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  if (parsed.port !== "6543") {
    throw new Error(
      `DATABASE_URL MUST use the Supavisor pooler (port 6543). Got port=${parsed.port}.`,
    );
  }
  if (parsed.username !== "app_runtime") {
    throw new Error(
      `DATABASE_URL MUST authenticate as 'app_runtime'. Got user=${parsed.username}.`,
    );
  }
  return raw;
}
