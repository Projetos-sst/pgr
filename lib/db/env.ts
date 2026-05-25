export function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  try {
    new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  return raw;
}
