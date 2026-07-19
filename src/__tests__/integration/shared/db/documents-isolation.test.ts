import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "../../_helpers/db";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

type OrgRow = { org_id: string };

const IDS = {
  folderA: "55555555-5555-5555-5555-5555555555a1",
  folderB: "55555555-5555-5555-5555-5555555555b1",
  groupA: "55555555-5555-5555-5555-5555555555a2",
  groupB: "55555555-5555-5555-5555-5555555555b2",
} as const;

const TABLES = ["folders", "documents", "jobs"] as const;

const CROSS_TENANT_INSERTS: Record<(typeof TABLES)[number], string> = {
  folders: `insert into public.folders (org_id, parent_id, name)
    values ('org_b', null, 'Invasora')`,
  documents: `insert into public.documents
    (org_id, document_group_id, name, doc_type, storage_path, size_bytes)
    values ('org_b','${IDS.groupB}','X','pgr','org_b/x.pdf',1)`,
  jobs: `insert into public.jobs (org_id, job_type) values ('org_b','pdf_batch')`,
};

(shouldRun ? describe : describe.skip)(
  "US1/US2 — folders/documents/jobs isolation (RLS backstop por org_id)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
    });

    afterAll(async () => {
      await runtime.end({ timeout: 5 });
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await admin.unsafe(`truncate table public.orgs restart identity cascade;`);
      await admin.unsafe(`
        insert into public.orgs (id, plan) values ('org_a','free'), ('org_b','pro');

        insert into public.folders (id, org_id, parent_id, name) values
          ('${IDS.folderA}','org_a',null,'Raiz A'),
          ('${IDS.folderB}','org_b',null,'Raiz B');

        insert into public.documents
          (org_id, folder_id, document_group_id, name, doc_type, storage_path, size_bytes) values
          ('org_a','${IDS.folderA}','${IDS.groupA}','Doc A','pgr','org_a/a.pdf',10),
          ('org_b','${IDS.folderB}','${IDS.groupB}','Doc B','pgr','org_b/b.pdf',20);

        insert into public.jobs (org_id, job_type) values
          ('org_a','pdf_batch'), ('org_b','pdf_batch');
      `);
    });

    describe.each(TABLES)("%s", (table) => {
      it("tenant A fixado, select SEM where → só linhas de A", async () => {
        const rows = await withOrgTx(
          runtime,
          "org_a",
          (tx) => tx<OrgRow[]>`select org_id from public.${tx(table)}`,
        );
        expect(rows).toHaveLength(1);
        expect(rows.every((r) => r.org_id === "org_a")).toBe(true);
      });

      it("sem tenant fixado (query bare) → 0 linhas", async () => {
        const rows = await runtime<OrgRow[]>`select org_id from public.${runtime(table)}`;
        expect(rows).toHaveLength(0);
      });

      it("tenant inexistente → 0 linhas", async () => {
        const rows = await withOrgTx(
          runtime,
          "org_nope",
          (tx) => tx<OrgRow[]>`select org_id from public.${tx(table)}`,
        );
        expect(rows).toHaveLength(0);
      });

      it("escrita marcada para B com tenant A ativo → rejeitada pelo WITH CHECK", async () => {
        await expect(
          withOrgTx(runtime, "org_a", (tx) => tx.unsafe(CROSS_TENANT_INSERTS[table])),
        ).rejects.toThrow();
      });

      it("UPDATE de linha de B com tenant A ativo → 0 linhas afetadas", async () => {
        const result = await withOrgTx(runtime, "org_a", (tx) =>
          tx.unsafe(`update public.${table} set updated_at = now()
            where org_id = 'org_b'`),
        );
        expect((result as unknown as { count: number }).count).toBe(0);
      });
    });
  },
);
