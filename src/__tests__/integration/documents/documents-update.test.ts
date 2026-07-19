/**
 * Integração de edição/versão/mover do GED (US3, fatia 024) contra Postgres
 * efêmero — Storage MOCKADO. Cobre update de metadados, incremento de versão
 * (MAX+1) + histórico preservado, corrida na mesma versão → 409, mover
 * válido/inválido, e 404 cross-tenant em update/version/move.
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
import { putDocumentObject } from "@/shared/integrations/storage/documents-storage";
import {
  addDocumentVersionAction,
  moveDocumentAction,
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

const DOC_A_V1 = "cccccccc-0000-0000-0000-000000000001";
const GROUP_A = "cccccccc-0000-0000-0000-00000000000a";
const FOLDER_A = "cccccccc-1111-0000-0000-000000000001";
const DOC_B_V1 = "dddddddd-0000-0000-0000-000000000001";
const GROUP_B = "dddddddd-0000-0000-0000-00000000000a";

async function seed(admin: ReturnType<typeof postgres>) {
  await admin.unsafe(`
    insert into public.folders (id, org_id, parent_id, name) values
      ('${FOLDER_A}', 'org_a', null, 'Destino');

    insert into public.documents
      (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes) values
      ('${DOC_A_V1}', 'org_a', null, '${GROUP_A}', 'Laudo', 'Laudo', 1, 'org_a/documentos/${GROUP_A}/v1.pdf', 100);

    insert into public.documents
      (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes) values
      ('${DOC_B_V1}', 'org_b', null, '${GROUP_B}', 'Doc B', 'Laudo', 1, 'org_b/documentos/${GROUP_B}/v1.pdf', 50);
  `);
}

function versionFormData(): FormData {
  const fd = new FormData();
  fd.set("file", new File(["novo conteudo"], "v2.pdf", { type: "application/pdf" }));
  return fd;
}

(shouldRun ? describe : describe.skip)(
  "GED — editar/versão/mover (US3, Storage mockado)",
  () => {
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
      mockedPut.mockReset();
      mockedPut.mockImplementation(async (orgId, groupId, version, file) => ({
        storagePath: `${orgId}/documentos/${groupId}/v${version}-${file.name}`,
        sizeBytes: file.size,
      }));
    });

    it("edita metadados (nome/tipo/validade) persiste", async () => {
      asOwner("org_a");
      const result = await updateDocumentAction(DOC_A_V1, {
        name: "Laudo Revisado",
        docType: "Laudo Técnico",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe("Laudo Revisado");
        expect(result.data.docType).toBe("Laudo Técnico");
      }
    });

    it("nova versão: incrementa MAX+1 e preserva a versão anterior (histórico)", async () => {
      asOwner("org_a");
      const result = await addDocumentVersionAction(DOC_A_V1, versionFormData());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.version).toBe(2);

      const rows = await admin<{ version: number }[]>`
      select version from public.documents
      where org_id = 'org_a' and document_group_id = ${GROUP_A}
      order by version`;
      expect(rows.map((r) => r.version)).toEqual([1, 2]);
    });

    it("corrida na mesma versão → 409 DUPLICATE (não perde a versão concorrente)", async () => {
      asOwner("org_a");
      // Simula um segundo writer reivindicando a v2 DURANTE o upload (janela real
      // de corrida do repo: nextVersion é lido antes do upload, o INSERT vem depois).
      mockedPut.mockImplementationOnce(async (orgId, groupId, version, file) => {
        await admin.unsafe(`
        insert into public.documents
          (org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes)
        values ('${orgId}', null, '${groupId}', 'concorrente', 'Laudo', ${version}, 'x', 1)`);
        return {
          storagePath: `${orgId}/x/v${version}-${file.name}`,
          sizeBytes: file.size,
        };
      });

      const result = await addDocumentVersionAction(DOC_A_V1, versionFormData());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("DUPLICATE");

      // a versão do concorrente sobrevive intacta.
      const [row] = await admin<{ name: string }[]>`
      select name from public.documents
      where org_id = 'org_a' and document_group_id = ${GROUP_A} and version = 2`;
      expect(row.name).toBe("concorrente");
    });

    it("move para pasta válida do tenant", async () => {
      asOwner("org_a");
      const result = await moveDocumentAction(DOC_A_V1, { folderId: FOLDER_A });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.folderId).toBe(FOLDER_A);
    });

    it("move para pasta inválida/de outro tenant → 422 FK_NOT_FOUND", async () => {
      asOwner("org_a");
      const result = await moveDocumentAction(DOC_A_V1, {
        folderId: "99999999-9999-9999-9999-999999999999",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
    });

    it("update/versão/mover de documento de outro tenant → 404 (nunca vaza)", async () => {
      asOwner("org_a");

      const updated = await updateDocumentAction(DOC_B_V1, { name: "hackeado" });
      expect(updated.ok).toBe(false);
      if (!updated.ok) expect(updated.error.code).toBe("NOT_FOUND");

      const versioned = await addDocumentVersionAction(DOC_B_V1, versionFormData());
      expect(versioned.ok).toBe(false);
      if (!versioned.ok) expect(versioned.error.code).toBe("NOT_FOUND");

      const moved = await moveDocumentAction(DOC_B_V1, { folderId: null });
      expect(moved.ok).toBe(false);
      if (!moved.ok) expect(moved.error.code).toBe("NOT_FOUND");
    });
  },
);
