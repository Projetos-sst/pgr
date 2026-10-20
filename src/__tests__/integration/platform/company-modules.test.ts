import type postgres from "postgres";
import fs from "node:fs";
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const runtimeUrl = process.env.INTEGRATION_APP_RUNTIME_URL;
const enabled = !!runtimeUrl && !!process.env.INTEGRATION_DATABASE_URL;

(enabled ? describe : describe.skip)("company module RLS", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    const postgresFactory = (await import("postgres")).default;
    runtime = postgresFactory(runtimeUrl!, { max: 1, prepare: false });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
  });
  it("backfills both services and migration history for existing companies", async () => {
    await admin`truncate company_modules, company_module_events`;
    const migration = fs.readFileSync(
      "src/shared/db/migrations/0053_company_module_access.sql",
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim().startsWith("INSERT INTO public.company_module"))
        await admin.unsafe(statement);
    }
    expect(await admin`select * from company_modules where enabled = true`).toHaveLength(
      4,
    );
    const events = await admin`select * from company_module_events`;
    expect(events).toHaveLength(4);
    expect(events.every((row) => row.changed_by === "migration:0053")).toBe(true);
  });
  afterAll(async () => {
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });

  it("denies new companies by default without changing shared identities", async () => {
    const [company] =
      await admin`insert into companies (org_id, razao_social) values ('org_a','New') returning id`;
    const rows = await withOrgTx(
      runtime,
      "org_a",
      (tx) => tx`select * from company_modules where company_id = ${company.id}`,
    );
    expect(rows).toHaveLength(0);
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) => tx`insert into pgr (org_id,company_id) values ('org_a',${company.id})`,
      ),
    ).rejects.toThrow();
    const common = await withOrgTx(
      runtime,
      "org_a",
      (tx) => tx`select id from companies where id = ${company.id}`,
    );
    expect(common).toHaveLength(1);
  });
  it("revokes PGR and children but keeps Medicine independent", async () => {
    await admin`update company_modules set enabled = false where company_id = ${I.companyA} and module = 'pgr'`;
    for (const table of ["pgr", "pgr_ges", "pgr_revisions"]) {
      const rows = await withOrgTx(runtime, "org_a", (tx) =>
        tx.unsafe(`select * from ${table}`),
      );
      expect(rows).toHaveLength(0);
    }
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) =>
          tx`insert into health_exams (org_id,employee_id,exam_type,performed_at,aptitude) values ('org_a',${I.employeeA},'admissional','2026-01-01','fit')`,
      ),
    ).resolves.toBeDefined();
  });
  it("revokes Medicine without hiding PGR or deleting exams", async () => {
    await admin`insert into health_exams (org_id,employee_id,exam_type,performed_at,aptitude) values ('org_a',${I.employeeA},'admissional','2026-01-01','fit')`;
    await admin`update company_modules set enabled = false where company_id = ${I.companyA} and module = 'medicine'`;
    expect(
      await withOrgTx(runtime, "org_a", (tx) => tx`select * from health_exams`),
    ).toHaveLength(0);
    expect(await withOrgTx(runtime, "org_a", (tx) => tx`select * from pgr`)).toHaveLength(
      1,
    );
    expect(await admin`select * from health_exams`).toHaveLength(1);
  });
  it("isolates entitlements and prevents mismatched company/tenant references", async () => {
    const rows = await withOrgTx(
      runtime,
      "org_a",
      (tx) => tx`select * from company_modules`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.org_id === "org_a")).toBe(true);
    await expect(
      admin`insert into company_modules (org_id,company_id,module,enabled) values ('org_b',${I.companyA},'pgr',true)`,
    ).rejects.toThrow();
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) => tx`update company_module_events set reason = 'tampered'`,
      ),
    ).rejects.toThrow();
  });
});
