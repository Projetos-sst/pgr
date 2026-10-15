jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  generatedDocumentPath: (orgId: string, documentId: string, format: string) =>
    `${orgId}/documentos/generated/${documentId}.${format}`,
  putGeneratedDocument: jest.fn(),
}));
jest.mock("@/shared/server/platform/pgr-docx-core", () => ({
  generatePgrDocx: jest.fn(),
}));

import type postgres from "postgres";

import { enqueuePgrPdf } from "@/shared/db/repositories/pdf-batch";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const d = shouldRun ? describe : describe.skip;

const FOLDER_ID = "55555555-5555-5555-5555-555555555555";
const LOCKED_GROUP_ID = "55555555-5555-5555-5555-5555555555b1";
const LOCKED_DOCUMENT_ID = "55555555-5555-5555-5555-5555555555b2";

type DocumentRow = {
  id: string;
  version: number;
  document_group_id: string;
  folder_id: string | null;
  name: string;
  valid_until: string | null;
};

d("pdf-batch: versões do GED nas gerações do PGR", () => {
  let ownerSql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    ownerSql = adminClient();
    await applyMigrations(ownerSql);
  });

  afterAll(async () => {
    await ownerSql?.end();
  });

  beforeEach(async () => {
    await seedPgrBase(ownerSql);
  });

  it("enfileirar de novo reaproveita o grupo do PGR e herda pasta, nome e validade", async () => {
    const first = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);
    await ownerSql`insert into public.folders (id, org_id, name) values (${FOLDER_ID}, 'org_a', 'Pasta PGR')`;
    await ownerSql`
      update public.documents
      set folder_id = ${FOLDER_ID}, name = 'PGR renomeado no GED', valid_until = '2027-10-01'
      where id = ${first.documentId}`;

    const second = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);

    const rows = await ownerSql<DocumentRow[]>`
      select id, version, document_group_id, folder_id, name, valid_until::text as valid_until
      from public.documents
      where related_entity_id = ${PGR_IDS.pgrA}
      order by version`;
    expect(rows).toHaveLength(2);
    const [v1, v2] = rows;
    expect(v1.id).toBe(first.documentId);
    expect(v2).toEqual({
      id: second.documentId,
      version: 2,
      document_group_id: v1.document_group_id,
      folder_id: FOLDER_ID,
      name: "PGR renomeado no GED",
      valid_until: "2027-10-01",
    });
  });

  it("enfileirar com o PGR travado espera a trava e cria a versão seguinte do grupo gravado", async () => {
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    let releaseLock!: () => void;
    const release = new Promise<void>((resolve) => (releaseLock = resolve));

    const holder = ownerSql.begin(async (tx) => {
      await tx.unsafe("select id from public.pgr where id = $1 for update", [
        PGR_IDS.pgrA,
      ]);
      signalLocked();
      await release;
      await tx.unsafe(
        `insert into public.documents
          (id, org_id, document_group_id, name, doc_type, version, status, storage_path,
           size_bytes, related_entity_type, related_entity_id)
         values ($1, 'org_a', $2, 'PGR v1', 'PGR', 1, 'ready', $3, 10, 'pgr', $4)`,
        [
          LOCKED_DOCUMENT_ID,
          LOCKED_GROUP_ID,
          `org_a/documentos/generated/${LOCKED_DOCUMENT_ID}.pdf`,
          PGR_IDS.pgrA,
        ],
      );
    });

    await locked;
    let settled = false;
    const pending = enqueuePgrPdf("org_a", PGR_IDS.pgrA);
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    const settledWhileLocked = settled;
    releaseLock();
    await holder;
    const enqueued = await pending;

    expect(settledWhileLocked).toBe(false);
    const rows = await ownerSql<
      { id: string; version: number; document_group_id: string }[]
    >`
      select id, version, document_group_id
      from public.documents
      where related_entity_id = ${PGR_IDS.pgrA}
      order by version`;
    expect(rows).toEqual([
      { id: LOCKED_DOCUMENT_ID, version: 1, document_group_id: LOCKED_GROUP_ID },
      { id: enqueued.documentId, version: 2, document_group_id: LOCKED_GROUP_ID },
    ]);
  });
});
