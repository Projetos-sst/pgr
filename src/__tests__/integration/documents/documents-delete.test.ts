/**
 * Integração de exclusão do GED (US5, fatia 024) contra Postgres efêmero —
 * Storage MOCKADO. Cobre exclusão de grupo com MÚLTIPLAS versões numa transação,
 * remoção de objetos pós-commit (best-effort), falha de Storage não revertendo a
 * exclusão, e 404 cross-tenant.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  putDocumentObject: jest.fn(),
  removeDocumentObject: jest.fn(async () => undefined),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { removeDocumentObject } from "@/shared/integrations/storage/documents-storage";
import { deleteDocumentAction } from "@/shared/server/actions/documents/documents";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const mockedRemove = removeDocumentObject as jest.MockedFunction<
  typeof removeDocumentObject
>;

const GROUP_A = "eeeeeeee-0000-0000-0000-00000000000a";
const DOC_A_V1 = "eeeeeeee-0000-0000-0000-000000000001";
const DOC_A_V2 = "eeeeeeee-0000-0000-0000-000000000002";
const DOC_A_V3 = "eeeeeeee-0000-0000-0000-000000000003";
const GROUP_B = "ffffffff-0000-0000-0000-00000000000a";
const DOC_B_V1 = "ffffffff-0000-0000-0000-000000000001";

async function seed(admin: ReturnType<typeof postgres>) {
  await admin.unsafe(`
    insert into public.documents
      (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes) values
      ('${DOC_A_V1}', 'org_a', null, '${GROUP_A}', 'Laudo', 'Laudo', 1, 'org_a/documentos/${GROUP_A}/v1.pdf', 100),
      ('${DOC_A_V2}', 'org_a', null, '${GROUP_A}', 'Laudo', 'Laudo', 2, 'org_a/documentos/${GROUP_A}/v2.pdf', 120),
      ('${DOC_A_V3}', 'org_a', null, '${GROUP_A}', 'Laudo', 'Laudo', 3, 'org_a/documentos/${GROUP_A}/v3.pdf', 140);

    insert into public.documents
      (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes) values
      ('${DOC_B_V1}', 'org_b', null, '${GROUP_B}', 'Doc B', 'Laudo', 1, 'org_b/documentos/${GROUP_B}/v1.pdf', 50);
  `);
}

async function countGroupRows(admin: ReturnType<typeof postgres>, groupId: string) {
  const [{ c }] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.documents where document_group_id = ${groupId}`;
  return c;
}

(shouldRun ? describe : describe.skip)("GED — excluir (US5, Storage mockado)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await seed(admin);
    mockedGate.mockReset();
    mockedRemove.mockReset();
    mockedRemove.mockResolvedValue(undefined);
  });

  it("exclui TODAS as versões do grupo numa transação e remove os objetos pós-commit", async () => {
    asOwner("org_a");
    const result = await deleteDocumentAction(DOC_A_V1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.groupId).toBe(GROUP_A);
      expect(result.data.deletedVersions).toBe(3);
    }

    expect(await countGroupRows(admin, GROUP_A)).toBe(0);

    expect(mockedRemove).toHaveBeenCalledTimes(3);
    expect(mockedRemove).toHaveBeenCalledWith(`org_a/documentos/${GROUP_A}/v1.pdf`);
    expect(mockedRemove).toHaveBeenCalledWith(`org_a/documentos/${GROUP_A}/v2.pdf`);
    expect(mockedRemove).toHaveBeenCalledWith(`org_a/documentos/${GROUP_A}/v3.pdf`);
  });

  it("qualquer id de versão do grupo apaga o grupo inteiro (não só a versão apontada)", async () => {
    asOwner("org_a");
    const result = await deleteDocumentAction(DOC_A_V2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.deletedVersions).toBe(3);
    expect(await countGroupRows(admin, GROUP_A)).toBe(0);
  });

  it("falha na remoção do Storage NÃO reverte a exclusão do registro (best-effort, logada)", async () => {
    asOwner("org_a");
    mockedRemove.mockRejectedValue(new Error("bucket unreachable"));

    const result = await deleteDocumentAction(DOC_A_V1);
    expect(result.ok).toBe(true); // a operação de negócio é sucesso mesmo com Storage falhando

    // o registro some do banco de qualquer forma — a falha é só do binário.
    expect(await countGroupRows(admin, GROUP_A)).toBe(0);
    expect(mockedRemove).toHaveBeenCalledTimes(3);
  });

  it("excluir documento de outro tenant → 404 (nunca afeta org_b)", async () => {
    asOwner("org_a");
    const result = await deleteDocumentAction(DOC_B_V1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");

    expect(await countGroupRows(admin, GROUP_B)).toBe(1);
    expect(mockedRemove).not.toHaveBeenCalled();
  });
});
