import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

const IDS = {
  rootA: "33333333-3333-3333-3333-3333333333a1",
  contratosA: "33333333-3333-3333-3333-3333333333a2",
  ano2026A: "33333333-3333-3333-3333-3333333333a3",
  docA: "33333333-3333-3333-3333-3333333333a4",
} as const;

(shouldRun ? describe : describe.skip)(
  "US1 — folders: hierarquia, unicidade de irmãs e RESTRICT",
  () => {
    let admin: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
    });

    afterAll(async () => {
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await admin.unsafe(`truncate table public.orgs restart identity cascade;`);
      await admin.unsafe(
        `insert into public.orgs (id, plan) values ('org_a','free'), ('org_b','pro');`,
      );
    });

    it("cadeia Raiz → Contratos → 2026 é navegável até a raiz por parent_id", async () => {
      await admin.unsafe(`
        insert into public.folders (id, org_id, parent_id, name) values
          ('${IDS.rootA}','org_a',null,'Raiz'),
          ('${IDS.contratosA}','org_a','${IDS.rootA}','Contratos'),
          ('${IDS.ano2026A}','org_a','${IDS.contratosA}','2026');
      `);
      const chain = await admin<{ name: string; depth: number }[]>`
        with recursive up as (
          select id, parent_id, name, 0 as depth
            from public.folders where id = ${IDS.ano2026A}
          union all
          select f.id, f.parent_id, f.name, up.depth + 1
            from public.folders f join up on f.id = up.parent_id
        )
        select name, depth from up order by depth
      `;
      expect(chain.map((r) => r.name)).toEqual(["2026", "Contratos", "Raiz"]);
      expect(chain).toHaveLength(3);
    });

    it("irmã duplicada na mesma pasta/mesma org → 23505", async () => {
      await admin.unsafe(`
        insert into public.folders (id, org_id, parent_id, name) values
          ('${IDS.rootA}','org_a',null,'Raiz'),
          ('${IDS.contratosA}','org_a','${IDS.rootA}','Contratos');
      `);
      await expect(
        admin.unsafe(
          `insert into public.folders (org_id, parent_id, name)
             values ('org_a','${IDS.rootA}','Contratos')`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
    });

    it("DUAS pastas raiz de mesmo nome na mesma org → 23505 (NULLS NOT DISTINCT)", async () => {
      await admin.unsafe(
        `insert into public.folders (org_id, parent_id, name) values ('org_a',null,'Geral')`,
      );
      await expect(
        admin.unsafe(
          `insert into public.folders (org_id, parent_id, name) values ('org_a',null,'Geral')`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
    });

    it("mesmo nome (incl. raiz) em orgs distintas → aceito", async () => {
      await admin.unsafe(
        `insert into public.folders (org_id, parent_id, name) values ('org_a',null,'Geral')`,
      );
      await admin.unsafe(
        `insert into public.folders (org_id, parent_id, name) values ('org_b',null,'Geral')`,
      );
      const rows = await admin<{ org_id: string }[]>`
        select org_id from public.folders where name = 'Geral' order by org_id
      `;
      expect(rows.map((r) => r.org_id)).toEqual(["org_a", "org_b"]);
    });

    // SQLSTATE do RESTRICT varia por versão do PG: 23001 (restrict_violation,
    // PG>=18) ou 23503 (foreign_key_violation, versões anteriores).
    const RESTRICT_CODES = expect.stringMatching(/^(23001|23503)$/);

    it("DELETE de pasta com subpasta → RESTRICT (23001/23503)", async () => {
      await admin.unsafe(`
        insert into public.folders (id, org_id, parent_id, name) values
          ('${IDS.rootA}','org_a',null,'Raiz'),
          ('${IDS.contratosA}','org_a','${IDS.rootA}','Contratos');
      `);
      await expect(
        admin.unsafe(`delete from public.folders where id = '${IDS.rootA}'`),
      ).rejects.toMatchObject({ code: RESTRICT_CODES });
    });

    it("DELETE de pasta com documento → RESTRICT (23001/23503)", async () => {
      await admin.unsafe(`
        insert into public.folders (id, org_id, parent_id, name)
          values ('${IDS.rootA}','org_a',null,'Raiz');
        insert into public.documents
          (id, org_id, folder_id, document_group_id, name, doc_type, storage_path, size_bytes)
          values ('${IDS.docA}','org_a','${IDS.rootA}','${IDS.docA}','PGR 2026','pgr','org_a/pgr-2026.pdf',1024);
      `);
      await expect(
        admin.unsafe(`delete from public.folders where id = '${IDS.rootA}'`),
      ).rejects.toMatchObject({ code: RESTRICT_CODES });
    });

    it("DELETE de pasta vazia → aceito", async () => {
      await admin.unsafe(
        `insert into public.folders (id, org_id, parent_id, name)
           values ('${IDS.rootA}','org_a',null,'Raiz')`,
      );
      await admin.unsafe(`delete from public.folders where id = '${IDS.rootA}'`);
      const rows = await admin`select id from public.folders`;
      expect(rows).toHaveLength(0);
    });
  },
);
