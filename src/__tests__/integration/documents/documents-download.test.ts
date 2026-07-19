/**
 * Integração de download de documento por URL assinada (US — issue #35) contra
 * Postgres efêmero — Storage MOCKADO. Cobre o caminho feliz (assina o path do
 * tenant certo, TTL 60s) e o isolamento cross-tenant (404, nunca assina nada
 * de outro escritório).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => {
  const actual = jest.requireActual("@/shared/integrations/storage/documents-storage");
  return {
    ...actual,
    getSignedDownloadUrl: jest.fn(),
  };
});

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  getSignedDownloadUrl,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
} from "@/shared/integrations/storage/documents-storage";
import { downloadDocumentAction } from "@/shared/server/actions/documents/download";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const mockedSign = getSignedDownloadUrl as jest.MockedFunction<
  typeof getSignedDownloadUrl
>;

const DOC_A = "aaaaaaaa-dddd-0000-0000-000000000001";
const GROUP_A = "aaaaaaaa-dddd-0000-0000-00000000000a";
const DOC_B = "bbbbbbbb-dddd-0000-0000-000000000001";
const GROUP_B = "bbbbbbbb-dddd-0000-0000-00000000000a";

async function seed(admin: ReturnType<typeof postgres>) {
  await admin.unsafe(`
    insert into public.documents
      (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes) values
      ('${DOC_A}', 'org_a', null, '${GROUP_A}', 'Laudo Ergonômico', 'Laudo', 1, 'org_a/documentos/${GROUP_A}/v1-laudo.pdf', 100);

    insert into public.documents
      (id, org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes) values
      ('${DOC_B}', 'org_b', null, '${GROUP_B}', 'Documento B', 'Laudo', 1, 'org_b/documentos/${GROUP_B}/v1.pdf', 50);
  `);
}

(shouldRun ? describe : describe.skip)(
  "GED — download por URL assinada (issue #35, Storage mockado)",
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
      mockedSign.mockReset();
      mockedSign.mockResolvedValue("https://signed.example/laudo.pdf?token=abc");
    });

    it("caminho feliz: assina o path do documento do tenant certo, com o nome de exibição", async () => {
      asOwner("org_a");
      const result = await downloadDocumentAction(DOC_A);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.url).toBe("https://signed.example/laudo.pdf?token=abc");
        expect(result.data.expiresInSeconds).toBe(SIGNED_DOWNLOAD_URL_TTL_SECONDS);
      }
      expect(mockedSign).toHaveBeenCalledWith(
        `org_a/documentos/${GROUP_A}/v1-laudo.pdf`,
        { downloadName: "Laudo Ergonômico.pdf" },
      );
    });

    it("documento de outro tenant → 404 (nunca assina nada, nunca revela o path)", async () => {
      asOwner("org_a");
      const result = await downloadDocumentAction(DOC_B);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
      expect(mockedSign).not.toHaveBeenCalled();
    });

    it("id inexistente → 404 (nunca assina nada)", async () => {
      asOwner("org_a");
      const result = await downloadDocumentAction("99999999-9999-9999-9999-999999999999");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
      expect(mockedSign).not.toHaveBeenCalled();
    });

    it("isolamento: cada tenant só assina o path do seu próprio documento", async () => {
      asOwner("org_b");
      const result = await downloadDocumentAction(DOC_B);

      expect(result.ok).toBe(true);
      expect(mockedSign).toHaveBeenCalledWith(`org_b/documentos/${GROUP_B}/v1.pdf`, {
        downloadName: "Documento B.pdf",
      });
    });
  },
);
