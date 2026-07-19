import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

const IDS = {
  folderA: "44444444-4444-4444-4444-4444444444a1",
  groupA: "44444444-4444-4444-4444-4444444444a2",
  pgrA: "44444444-4444-4444-4444-4444444444a3",
} as const;

function insertDocumentSql(overrides: Record<string, string | number | null> = {}) {
  const values: Record<string, string | number | null> = {
    org_id: "org_a",
    folder_id: null,
    document_group_id: IDS.groupA,
    name: "PGR 2026",
    doc_type: "pgr",
    version: 1,
    storage_path: "org_a/pgr-2026-v1.pdf",
    size_bytes: 1024,
    valid_until: null,
    related_entity_type: null,
    related_entity_id: null,
    ...overrides,
  };
  const cols = Object.keys(values).join(", ");
  const vals = Object.values(values)
    .map((v) => (v === null ? "null" : typeof v === "number" ? String(v) : `'${v}'`))
    .join(", ");
  return `insert into public.documents (${cols}) values (${vals})`;
}

(shouldRun ? describe : describe.skip)(
  "US1/US3 — documents: versão por grupo, CHECKs e vínculo polimórfico",
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
      await admin.unsafe(`
        insert into public.orgs (id, plan) values ('org_a','free'), ('org_b','pro');
        insert into public.folders (id, org_id, parent_id, name)
          values ('${IDS.folderA}','org_a',null,'Contratos');
      `);
    });

    it("documento válido com pasta, sem pasta (raiz) e sem validade", async () => {
      await admin.unsafe(insertDocumentSql({ folder_id: IDS.folderA }));
      await admin.unsafe(
        insertDocumentSql({ version: 2, storage_path: "org_a/pgr-2026-v2.pdf" }),
      );
      const rows = await admin<{ folder_id: string | null; valid_until: null }[]>`
        select folder_id, valid_until from public.documents order by version
      `;
      expect(rows).toHaveLength(2);
      expect(rows[0].folder_id).toBe(IDS.folderA);
      expect(rows[1].folder_id).toBeNull();
      expect(rows.every((r) => r.valid_until === null)).toBe(true);
    });

    it("UNIQUE (org_id, grupo, versão): duplicada na mesma org → 23505; em orgs distintas → aceito", async () => {
      await admin.unsafe(insertDocumentSql());
      await expect(admin.unsafe(insertDocumentSql())).rejects.toMatchObject({
        code: "23505",
      });
      await admin.unsafe(
        insertDocumentSql({ org_id: "org_b", storage_path: "org_b/pgr-2026-v1.pdf" }),
      );
      const rows = await admin`select org_id from public.documents`;
      expect(rows).toHaveLength(2);
    });

    it("CHECK version >= 1 → 23514", async () => {
      await expect(admin.unsafe(insertDocumentSql({ version: 0 }))).rejects.toMatchObject(
        { code: "23514" },
      );
    });

    it("CHECK size_bytes >= 0 → 23514; acima de 2^31 aceito (bigint)", async () => {
      await expect(
        admin.unsafe(insertDocumentSql({ size_bytes: -1 })),
      ).rejects.toMatchObject({ code: "23514" });
      const bigSize = 3_000_000_000; // > 2^31-1: estoura integer, cabe em bigint
      await admin.unsafe(insertDocumentSql({ size_bytes: bigSize }));
      const [row] = await admin<{ size_bytes: string }[]>`
        select size_bytes from public.documents
      `;
      expect(Number(row.size_bytes)).toBe(bigSize);
    });

    it("versão corrente do grupo derivável por MAX(version)", async () => {
      await admin.unsafe(insertDocumentSql());
      await admin.unsafe(
        insertDocumentSql({ version: 2, storage_path: "org_a/pgr-2026-v2.pdf" }),
      );
      await admin.unsafe(
        insertDocumentSql({ version: 3, storage_path: "org_a/pgr-2026-v3.pdf" }),
      );
      const [row] = await admin<{ current_version: number }[]>`
        select max(version) as current_version from public.documents
         where org_id = 'org_a' and document_group_id = ${IDS.groupA}
      `;
      expect(row.current_version).toBe(3);
    });

    it("vínculo: sem vínculo OK; completo persistido e consultável por (org, tipo, id)", async () => {
      await admin.unsafe(insertDocumentSql());
      await admin.unsafe(
        insertDocumentSql({
          version: 2,
          storage_path: "org_a/pgr-2026-v2.pdf",
          related_entity_type: "pgr",
          related_entity_id: IDS.pgrA,
        }),
      );
      const rows = await admin<{ version: number }[]>`
        select version from public.documents
         where org_id = 'org_a' and related_entity_type = 'pgr'
           and related_entity_id = ${IDS.pgrA}
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].version).toBe(2);
    });

    it("vínculo pela metade (só tipo OU só id) → rejeitado pelo CHECK (23514)", async () => {
      await expect(
        admin.unsafe(insertDocumentSql({ related_entity_type: "pgr" })),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin.unsafe(insertDocumentSql({ related_entity_id: IDS.pgrA })),
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("documento permanece após sumiço da entidade vinculada (sem FK, nada a cascatear)", async () => {
      await admin.unsafe(
        insertDocumentSql({
          related_entity_type: "pgr",
          related_entity_id: IDS.pgrA,
        }),
      );
      const rows = await admin<{ related_entity_id: string }[]>`
        select related_entity_id from public.documents
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].related_entity_id).toBe(IDS.pgrA);
    });
  },
);
