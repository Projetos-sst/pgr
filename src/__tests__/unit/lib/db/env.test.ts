import { getDatabaseUrl } from "@/lib/db/env";

describe("getDatabaseUrl", () => {
  const ORIGINAL = process.env.DATABASE_URL;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  it("returns the URL when valid", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres.ref:pw@aws-1-us-east-1.pooler.supabase.com:6543/postgres";
    expect(getDatabaseUrl()).toBe(process.env.DATABASE_URL);
  });

  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL is not set/);
  });

  it("throws when URL is malformed", () => {
    process.env.DATABASE_URL = "not-a-url";
    expect(() => getDatabaseUrl()).toThrow(/valid URL/);
  });
});
