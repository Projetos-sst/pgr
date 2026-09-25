/**
 * Integração do histórico de versões do GED (#56) contra Postgres efêmero — Storage MOCKADO
 * (mantendo a classe de erro real). Cobre: listagem com uma vigente, entrada por versão antiga,
 * somente leitura no backend, nova versão herdando da vigente, conflito de upload de mesmo nome,
 * cross-tenant e o backstop de RLS.
 */
import postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => {
  const actual = jest.requireActual("@/shared/integrations/storage/documents-storage");
  return {
    ...actual,
    putDocumentObject: jest.fn(),
    removeDocumentObject: jest.fn(async () => undefined),
  };
});

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  putDocumentObject,
  StorageObjectExistsError,
} from "@/shared/integrations/storage/documents-storage";
import {
  addDocumentVersionAction,
  listDocumentVersionsAction,
  updateDocumentAction,
} from "@/shared/server/actions/documents/documents";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
const mockedPut = putDocumentObject as jest.MockedFunction<typeof putDocumentObject>;

const GROUP = "eeeeeeee-0000-0000-0000-00000000000a";
const V1 = "eeeeeeee-0000-0000-0000-000000000001";
const V2 = "eeeeeeee-0000-0000-0000-000000000002";
const V3 = "eeeeeeee-0000-0000-0000-000000000003";

async function seed(admin: ReturnType<typeof postgres>) {
  // Metadados diferentes por versão, para provar de onde a nova versão herda.
  await admin.unsafe(`
    insert into public.documents
      (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes, valid_until, created_at)
    values
      ('${V1}', 'org_a', null, '${GROUP}', 'Laudo antigo', 'Laudo', 1, 'org_a/documentos/${GROUP}/v1.pdf', 100, '2025-01-01', now() - interval '3 days'),
      ('${V2}', 'org_a', null, '${GROUP}', 'Laudo intermediário', 'Laudo', 2, 'org_a/documentos/${GROUP}/v2.pdf', 200, '2025-06-01', now() - interval '2 days'),
      ('${V3}', 'org_a', null, '${GROUP}', 'Laudo vigente', 'Laudo técnico', 3, 'org_a/documentos/${GROUP}/v3.pdf', 300, '2027-01-01', now() - interval '1 day');
  `);
}

function versionFormData(name = "nova.pdf"): FormData {
  const fd = new FormData();
  fd.set("file", new File(["conteudo"], name, { type: "application/pdf" }));
  return fd;
}

(shouldRun ? describe : describe.skip)("GED — histórico de versões (#56)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await seed(admin);
    mockedGate.mockReset();
    mockedPut.mockReset();
    mockedPut.mockImplementation(async (orgId, groupId, version, file) => ({
      storagePath: `${orgId}/documentos/${groupId}/v${version}-${file.name}`,
      sizeBytes: file.size,
    }));
  });

  it("lista as 3 versões da mais nova para a mais antiga, com exatamente uma vigente", async () => {
    asOwner("org_a");
    const result = await listDocumentVersionsAction(V3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(result.data.filter((v) => v.isCurrent).map((v) => v.id)).toEqual([V3]);
  });

  it("qualquer versão do grupo serve de entrada: pelo id antigo devolve o mesmo histórico", async () => {
    asOwner("org_a");
    const fromOld = await listDocumentVersionsAction(V1);
    expect(fromOld.ok).toBe(true);
    if (!fromOld.ok) return;
    expect(fromOld.data.map((v) => v.id)).toEqual([V3, V2, V1]);
    expect(fromOld.data.find((v) => v.isCurrent)?.id).toBe(V3);
  });

  it("id de outro escritório → NOT_FOUND (nunca vaza o histórico)", async () => {
    asOwner("org_b");
    const result = await listDocumentVersionsAction(V3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("editar versão antiga → DOCUMENT_VERSION_READ_ONLY e a linha fica intacta", async () => {
    const [before] = await admin<{ name: string; updated_at: Date }[]>`
      select name, updated_at from public.documents where id = ${V1}`;

    asOwner("org_a");
    const result = await updateDocumentAction(V1, { name: "Tentativa de reescrever" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_VERSION_READ_ONLY");

    const [after] = await admin<{ name: string; updated_at: Date }[]>`
      select name, updated_at from public.documents where id = ${V1}`;
    expect(after.name).toBe(before.name);
    expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
  });

  it("editar a versão vigente continua funcionando", async () => {
    asOwner("org_a");
    const result = await updateDocumentAction(V3, { name: "Laudo vigente revisado" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Laudo vigente revisado");
  });

  it("nova versão a partir de id antigo herda metadados da VIGENTE e vira v4", async () => {
    asOwner("org_a");
    const result = await addDocumentVersionAction(V1, versionFormData());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe(4);
    expect(result.data.name).toBe("Laudo vigente");
    expect(result.data.docType).toBe("Laudo técnico");
    expect(result.data.validUntil).toBe("2027-01-01");

    // Histórico preservado e a nova versão passa a ser a única vigente.
    const history = await listDocumentVersionsAction(V1);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.data.map((v) => v.version)).toEqual([4, 3, 2, 1]);
    expect(history.data.filter((v) => v.isCurrent).map((v) => v.version)).toEqual([4]);
  });

  it("upload de mesmo nome em corrida (objeto já existe) → DUPLICATE, nada gravado", async () => {
    mockedPut.mockRejectedValueOnce(
      new StorageObjectExistsError(`org_a/documentos/${GROUP}/v4-nova.pdf`),
    );
    asOwner("org_a");
    const result = await addDocumentVersionAction(V3, versionFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE");

    const [{ total }] = await admin<{ total: number }[]>`
      select count(*)::int as total from public.documents where document_group_id = ${GROUP}`;
    expect(total).toBe(3);
  });

  it("RLS: app_runtime sem tenant fixado não enxerga nenhuma versão do grupo", async () => {
    const runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
    try {
      const rows = await runtime`
        select id from public.documents where document_group_id = ${GROUP}`;
      expect(rows).toHaveLength(0);
    } finally {
      await runtime.end({ timeout: 5 });
    }
  });
});
