/**
 * Integração de upload/criação do GED (US2, fatia 024) contra Postgres efêmero —
 * Storage MOCKADO (contrato exige: nunca bater no provedor real em teste).
 * Cobre partição por tenant, tipo/tamanho inválido (nada gravado), pasta inválida
 * (422 FK_NOT_FOUND), compensação de órfão e vínculo polimórfico.
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
import {
  putDocumentObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import { createDocumentAction } from "@/shared/server/actions/documents/documents";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const mockedPut = putDocumentObject as jest.MockedFunction<typeof putDocumentObject>;
const mockedRemove = removeDocumentObject as jest.MockedFunction<
  typeof removeDocumentObject
>;

function fakePdf(name = "laudo.pdf"): File {
  return new File(["conteudo"], name, { type: "application/pdf" });
}

function formDataFor(
  overrides: Record<string, string> = {},
  file: File | null = fakePdf(),
) {
  const fd = new FormData();
  if (file) fd.set("file", file);
  fd.set("name", overrides.name ?? "Laudo Ergonômico");
  fd.set("docType", overrides.docType ?? "Laudo");
  if (overrides.validUntil !== undefined) fd.set("validUntil", overrides.validUntil);
  if (overrides.folderId !== undefined) fd.set("folderId", overrides.folderId);
  if (overrides.relatedEntityType !== undefined)
    fd.set("relatedEntityType", overrides.relatedEntityType);
  if (overrides.relatedEntityId !== undefined)
    fd.set("relatedEntityId", overrides.relatedEntityId);
  return fd;
}

async function countDocuments(admin: ReturnType<typeof postgres>, orgId: string) {
  const [{ c }] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.documents where org_id = ${orgId}`;
  return c;
}

(shouldRun ? describe : describe.skip)(
  "GED — upload/criação (US2, Storage mockado)",
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
      mockedGate.mockReset();
      mockedPut.mockReset();
      mockedRemove.mockReset();
      mockedRemove.mockResolvedValue(undefined);
      mockedPut.mockImplementation(async (orgId, groupId, version, file) => ({
        storagePath: `${orgId}/documentos/${groupId}/v${version}-${file.name}`,
        sizeBytes: file.size,
      }));
    });

    it("upload válido: grava objeto (mock) particionado por org + registra v1/novo grupo", async () => {
      asOwner("org_a");
      const result = await createDocumentAction(formDataFor());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.version).toBe(1);
      expect(mockedPut).toHaveBeenCalledWith(
        "org_a",
        expect.any(String),
        1,
        expect.any(File),
      );
      expect(result.data.storagePath.startsWith("org_a/documentos/")).toBe(true);
      expect(await countDocuments(admin, "org_a")).toBe(1);
    });

    it("tipo de arquivo inválido: rejeita ANTES do upload — nada gravado", async () => {
      asOwner("org_a");
      const badFile = new File(["x"], "virus.exe", { type: "application/x-msdownload" });
      const result = await createDocumentAction(formDataFor({}, badFile));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION");

      expect(mockedPut).not.toHaveBeenCalled();
      expect(await countDocuments(admin, "org_a")).toBe(0);
    });

    it("tamanho acima do teto (25 MB): rejeita ANTES do upload — nada gravado", async () => {
      asOwner("org_a");
      const big = new File([new Uint8Array(1)], "grande.pdf", {
        type: "application/pdf",
      });
      Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
      const result = await createDocumentAction(formDataFor({}, big));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION");
      expect(mockedPut).not.toHaveBeenCalled();
    });

    it("pasta de outro tenant → 422 FK_NOT_FOUND (bloqueado antes do upload)", async () => {
      asOwner("org_a");
      // Nenhuma pasta seedada; qualquer UUID de pasta é cross-tenant/inexistente.
      const result = await createDocumentAction(
        formDataFor({ folderId: "99999999-9999-9999-9999-999999999999" }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
      expect(mockedPut).not.toHaveBeenCalled();
    });

    it("falha após o upload (INSERT rejeitado) → compensa removendo o objeto e não deixa órfão", async () => {
      asOwner("org_a");
      // size_bytes negativo viola o CHECK do banco (documents_size_bytes_check) —
      // upload "sucede" (mock), mas o INSERT real falha, forçando a compensação.
      mockedPut.mockResolvedValueOnce({
        storagePath: "org_a/documentos/x/v1-a.pdf",
        sizeBytes: -1,
      });

      const result = await createDocumentAction(formDataFor());
      expect(result.ok).toBe(false);

      expect(mockedRemove).toHaveBeenCalledWith("org_a/documentos/x/v1-a.pdf");
      expect(await countDocuments(admin, "org_a")).toBe(0);
    });

    it("vínculo polimórfico completo (pgr) é persistido", async () => {
      asOwner("org_a");
      const result = await createDocumentAction(
        formDataFor({ relatedEntityType: "pgr", relatedEntityId: PGR_IDS.pgrA }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.relatedEntityType).toBe("pgr");
        expect(result.data.relatedEntityId).toBe(PGR_IDS.pgrA);
      }
    });

    it("vínculo polimórfico ausente (nem tipo nem id) é aceito — documento sem vínculo", async () => {
      asOwner("org_a");
      const result = await createDocumentAction(formDataFor());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.relatedEntityType).toBeNull();
        expect(result.data.relatedEntityId).toBeNull();
      }
    });

    it("isolamento: objeto particiona pelo org_id da SESSÃO, não de input do cliente", async () => {
      asOwner("org_b");
      const result = await createDocumentAction(formDataFor());
      expect(result.ok).toBe(true);
      expect(mockedPut).toHaveBeenCalledWith(
        "org_b",
        expect.any(String),
        1,
        expect.any(File),
      );
      expect(await countDocuments(admin, "org_a")).toBe(0);
      expect(await countDocuments(admin, "org_b")).toBe(1);
    });
  },
);
