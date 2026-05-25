import { getRuntimeDatabaseUrl } from "@/lib/db/env";

describe("getRuntimeDatabaseUrl", () => {
  const ORIGINAL = process.env.DATABASE_URL;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  it("returns the URL when pooler (6543) + app_runtime user", () => {
    process.env.DATABASE_URL =
      "postgresql://app_runtime:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    expect(getRuntimeDatabaseUrl()).toBe(process.env.DATABASE_URL);
  });

  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => getRuntimeDatabaseUrl()).toThrow(/DATABASE_URL is not set/);
  });

  it("throws when port is not 6543 (direct connection should use UNPOOLED)", () => {
    process.env.DATABASE_URL =
      "postgresql://app_runtime:secret@db.example.supabase.co:5432/postgres";
    expect(() => getRuntimeDatabaseUrl()).toThrow(/port 6543/);
  });

  it("throws when user is not app_runtime", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
    expect(() => getRuntimeDatabaseUrl()).toThrow(/app_runtime/);
  });

  it("throws when URL is malformed", () => {
    process.env.DATABASE_URL = "not-a-url";
    expect(() => getRuntimeDatabaseUrl()).toThrow(/valid URL/);
  });
});
