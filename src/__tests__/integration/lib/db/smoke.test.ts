describe("smoke — Drizzle client connects as app_runtime", () => {
  const integrationUrl = process.env.INTEGRATION_DATABASE_URL;
  const shouldRun =
    !!integrationUrl &&
    integrationUrl.includes(":6543") &&
    integrationUrl.includes("app_runtime");

  (shouldRun ? it : it.skip)(
    "select 1 as ok, current_user as who → app_runtime",
    async () => {
      process.env.DATABASE_URL = integrationUrl!;
      const { db } = await import("@/lib/db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`select 1 as ok, current_user as who`);
      const rows = result as unknown as { ok: number; who: string }[];
      expect(rows[0].ok).toBe(1);
      expect(rows[0].who).toBe("app_runtime");
    },
  );
});
