import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  putDocumentObject: jest.fn(),
  removeDocumentObject: jest.fn(async () => undefined),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { putDocumentObject } from "@/shared/integrations/storage/documents-storage";
import {
  createDocumentAction,
  getDocumentAction,
  listDocumentsAction,
  listDocumentVersionsAction,
  updateDocumentAction,
} from "@/shared/server/actions/documents/documents";
import { GET } from "@/app/api/v1/documents/[id]/route";
import { GET as LIST } from "@/app/api/v1/documents/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { ACCESS_IDS as X, seedAccessScopeFixtures } from "../_helpers/access-scope-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const MACHINE_A = "44444444-4444-4444-4444-4444444444a1";
const MACHINE_A2 = "44444444-4444-4444-4444-4444444444a2";
const MACHINE_B = "44444444-4444-4444-4444-4444444444b1";
const UNKNOWN = "99999999-9999-9999-9999-999999999999";

const mockedGate = jest.mocked(requireOfficeStaff);
const mockedPut = jest.mocked(putDocumentObject);

function signIn(tenantId: string, userId: string, role: "owner" | "collaborator") {
  mockedGate.mockResolvedValue({ userId, tenantId, plan: "free", role });
}

function attachment(machineId: string, docType = "Manual"): FormData {
  const form = new FormData();
  form.set("file", new File(["conteudo"], "arquivo.pdf", { type: "application/pdf" }));
  form.set("name", `Anexo ${docType}`);
  form.set("docType", docType);
  form.set("relatedEntityType", "machine_installation");
  form.set("relatedEntityId", machineId);
  return form;
}

async function attach(machineId: string, docType = "Manual"): Promise<string> {
  const created = await createDocumentAction(attachment(machineId, docType));
  if (!created.ok) return `falhou: ${created.error.code}`;
  return created.data.id;
}

async function attachedTo(machineId: string): Promise<string[]> {
  const listed = await listDocumentsAction({
    relatedEntityType: "machine_installation",
    relatedEntityId: machineId,
  });
  return listed.ok ? listed.data.rows.map((row) => row.id) : [listed.error.code];
}

function restRequest(url: string, user: string, role: string, tenant = "org_a") {
  return new NextRequest(url, {
    headers: { "x-dev-tenant": tenant, "x-dev-user": user, "x-dev-role": role },
  });
}

(enabled ? describe : describe.skip)("anexos de máquina no GED", () => {
  let admin: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
  });

  afterAll(async () => {
    process.env = originalEnv;
    await admin?.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await seedAccessScopeFixtures(admin);
    await admin.unsafe(`
      insert into public.machine_installations
        (id, org_id, company_id, work_unit_id, catalog_id, catalog_name, mode, quantity,
         description, created_by, updated_by)
      values
        ('${MACHINE_A}','org_a','${I.companyA}','${I.workUnitA}','${I.epiCatalogA}','Máquina A','group',1,'Fictícia','seed','seed'),
        ('${MACHINE_A2}','org_a','${X.companyA2}','${X.workUnitA2}','${I.epiCatalogA}','Máquina A2','group',1,'Fictícia','seed','seed'),
        ('${MACHINE_B}','org_b','${I.companyB}','${I.workUnitB}','${I.epiCatalogB}','Máquina B','group',1,'Fictícia','seed','seed');
      insert into public.member_access_scopes
        (org_id, user_id, company_id, work_unit_id, area, granted_by)
      values ('org_a','${X.scoped}','${I.companyA}',null,'safety','${X.owner}');
    `);
    mockedGate.mockReset();
    mockedPut.mockReset();
    mockedPut.mockImplementation(async (orgId, groupId, version, file) => ({
      storagePath: `${orgId}/documentos/${groupId}/v${version}-${file.name}`,
      sizeBytes: file.size,
    }));
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    signIn("org_a", X.owner, "owner");
  });

  it("anexo de tipo confirmado aparece só na máquina em que foi anexado", async () => {
    const manual = await attach(MACHINE_A, "Manual");
    const laudo = await attach(MACHINE_A2, "Laudo NR 12 - Apreciação de Riscos");

    expect(await attachedTo(MACHINE_A)).toEqual([manual]);
    expect(await attachedTo(MACHINE_A2)).toEqual([laudo]);
  });

  it("tipo fora da lista confirmada é recusado antes do upload", async () => {
    const refused = await createDocumentAction(attachment(MACHINE_A, "Contrato"));

    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe("VALIDATION");
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it("máquina de outro escritório ou inexistente não recebe anexo", async () => {
    expect(await attach(MACHINE_B)).toBe("falhou: FK_NOT_FOUND");
    expect(await attach(UNKNOWN)).toBe("falhou: FK_NOT_FOUND");
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it("documento existente não pode ser religado à máquina de outro escritório", async () => {
    const manual = await attach(MACHINE_A);
    const relinked = await updateDocumentAction(manual, {
      docType: "Manual",
      relatedEntityType: "machine_installation",
      relatedEntityId: MACHINE_B,
    });

    expect(!relinked.ok && relinked.error.code).toBe("FK_NOT_FOUND");
    expect(await attachedTo(MACHINE_A)).toEqual([manual]);
  });

  it("outro escritório não lê o anexo nem por acesso direto", async () => {
    const manual = await attach(MACHINE_A);
    signIn("org_b", "user-b", "owner");

    const direct = await getDocumentAction(manual);
    expect(!direct.ok && direct.error.code).toBe("NOT_FOUND");
    expect(await attachedTo(MACHINE_A)).toEqual([]);
  });

  it("colaborador com escopo só enxerga anexos das máquinas da empresa concedida", async () => {
    const own = await attach(MACHINE_A);
    const other = await attach(MACHINE_A2);
    signIn("org_a", X.scoped, "collaborator");

    expect(await attachedTo(MACHINE_A)).toEqual([own]);
    expect(await attachedTo(MACHINE_A2)).toEqual([]);

    const visible = await getDocumentAction(own);
    expect(visible.ok).toBe(true);

    const direct = await getDocumentAction(other);
    expect(!direct.ok && direct.error.code).toBe("NOT_FOUND");
    const versions = await listDocumentVersionsAction(other);
    expect(!versions.ok && versions.error.code).toBe("NOT_FOUND");
    expect(await attach(MACHINE_A2)).toBe("falhou: FK_NOT_FOUND");
  });

  it("REST responde 404 no acesso direto ao anexo de empresa fora do escopo", async () => {
    const own = await attach(MACHINE_A);
    const other = await attach(MACHINE_A2);
    const asScoped = (id: string) =>
      GET(
        restRequest(`http://localhost/api/v1/documents/${id}`, X.scoped, "collaborator"),
        {
          params: Promise.resolve({ id }),
        },
      );

    expect((await asScoped(own)).status).toBe(200);
    expect((await asScoped(other)).status).toBe(404);

    const listed = await LIST(
      restRequest(
        `http://localhost/api/v1/documents?relatedEntityType=machine_installation&relatedEntityId=${MACHINE_A2}`,
        X.scoped,
        "collaborator",
      ),
    );
    expect((await listed.json()).total).toBe(0);
  });

  it("documentos sem vínculo com máquina continuam visíveis para o colaborador com escopo", async () => {
    const form = attachment(I.pgrA, "ART");
    form.set("relatedEntityType", "pgr");
    const pgrDocument = await createDocumentAction(form);
    signIn("org_a", X.scoped, "collaborator");

    const direct = await getDocumentAction(
      pgrDocument.ok ? pgrDocument.data.id : UNKNOWN,
    );
    expect(direct.ok).toBe(true);
  });
});
