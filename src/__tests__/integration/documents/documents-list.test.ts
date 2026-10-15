/**
 * Integração de listagem do GED (US1, issue #34/#88-fatia 024) contra Postgres
 * efêmero. Cobre agrupamento por versão corrente, KPIs, filtros, escopo de pasta
 * e isolamento cross-tenant. Somente leitura — sem mock de Storage necessário.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { listDocumentsAction } from "@/shared/server/actions/documents/documents";

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS, seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const GROUP_A1 = "aaaaaaaa-0000-0000-0000-000000000001";
const GROUP_A2 = "aaaaaaaa-0000-0000-0000-000000000002";
const GROUP_A3 = "aaaaaaaa-0000-0000-0000-000000000003";
const GROUP_A4 = "aaaaaaaa-0000-0000-0000-000000000004";
const GROUP_A5 = "aaaaaaaa-0000-0000-0000-000000000005";
const GROUP_B1 = "bbbbbbbb-0000-0000-0000-000000000001";
const FOLDER_A_ROOT_CHILD = "aaaaaaaa-1111-0000-0000-000000000001";

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedDocuments(admin: ReturnType<typeof postgres>) {
  const farFuture = isoDateOffset(400); // fora da janela de 30 dias → "ok"
  const past = isoDateOffset(-30); // sempre vencido, independente de "hoje"

  await admin.unsafe(`
    insert into public.folders (id, org_id, parent_id, name) values
      ('${FOLDER_A_ROOT_CHILD}', 'org_a', null, 'Contratos');

    -- Grupo A1: 2 versões (v1, v2) na raiz — só v2 deve aparecer na listagem.
    insert into public.documents
      (org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes, valid_until) values
      ('org_a', null, '${GROUP_A1}', 'Laudo Ergonômico', 'Laudo', 1, 'org_a/documentos/${GROUP_A1}/v1-laudo.pdf', 100, null),
      ('org_a', null, '${GROUP_A1}', 'Laudo Ergonômico', 'Laudo', 2, 'org_a/documentos/${GROUP_A1}/v2-laudo.pdf', 200, '${farFuture}');

    -- Grupo A2: 1 versão, na RAIZ (mesmo escopo de A1), vencido, tipo distinto.
    insert into public.documents
      (org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes, valid_until) values
      ('org_a', null, '${GROUP_A2}', 'Contrato Social', 'Contrato', 1, 'org_a/documentos/${GROUP_A2}/v1-contrato.pdf', 300, '${past}');

    -- Grupo A3: 1 versão, dentro da pasta "Contratos" — só para o teste de escopo.
    insert into public.documents
      (org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes, valid_until) values
      ('org_a', '${FOLDER_A_ROOT_CHILD}', '${GROUP_A3}', 'Nota Fiscal', 'Fatura', 1, 'org_a/documentos/${GROUP_A3}/v1-nf.pdf', 150, null);

    -- Grupo A4: 1 versão vinculada ao PGR A — usado no filtro de GED por relação.
    insert into public.documents
      (org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes, valid_until, related_entity_type, related_entity_id) values
      ('org_a', null, '${GROUP_A4}', 'PGR anexado', 'Programa', 1, 'org_a/documentos/${GROUP_A4}/v1-pgr.pdf', 120, null, 'pgr', '${PGR_IDS.pgrA}');

    -- Grupo A5: vinculado ao PGR A porém DENTRO de uma pasta — a visão por vínculo é
    -- transversal e precisa enxergá-lo mesmo sem navegar até a pasta.
    insert into public.documents
      (org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes, valid_until, related_entity_type, related_entity_id) values
      ('org_a', '${FOLDER_A_ROOT_CHILD}', '${GROUP_A5}', 'ART do PGR', 'ART', 1, 'org_a/documentos/${GROUP_A5}/v1-art.pdf', 90, null, 'pgr', '${PGR_IDS.pgrA}');

    -- Grupo B1: dado de outro tenant — nunca deve aparecer nas consultas de org_a.
    insert into public.documents
      (org_id, folder_id, document_group_id, name, doc_type, version, storage_path, size_bytes, valid_until) values
      ('org_b', null, '${GROUP_B1}', 'Documento B', 'Laudo', 1, 'org_b/documentos/${GROUP_B1}/v1.pdf', 50, null);
  `);
}

(shouldRun ? describe : describe.skip)("GED — listagem (US1)", () => {
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
    await seedDocuments(admin);
    mockedGate.mockReset();
  });

  it("agrupa por documento lógico: só a versão corrente (v2) do grupo A1 aparece", async () => {
    asOwner("org_a");
    const result = await listDocumentsAction();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const groupA1Rows = result.data.rows.filter((r) => r.documentGroupId === GROUP_A1);
    expect(groupA1Rows).toHaveLength(1);
    expect(groupA1Rows[0].version).toBe(2);
    expect(groupA1Rows[0].sizeBytes).toBe(200);
  });

  it("KPIs: conta documentos lógicos (não versões), pastas, vencidos e a vencer", async () => {
    asOwner("org_a");
    const result = await listDocumentsAction();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 4 grupos lógicos em org_a (A1, A2, A3, A4) mesmo com 5 linhas físicas.
    expect(result.data.kpis.documents).toBe(5);
    expect(result.data.kpis.folders).toBe(1);
    expect(result.data.kpis.expired).toBe(1); // A2
  });

  it("escopo de pasta: raiz mostra só documentos com folder_id null", async () => {
    asOwner("org_a");
    const root = await listDocumentsAction({ folderId: null });
    expect(root.ok).toBe(true);
    if (root.ok) {
      expect(root.data.rows.every((r) => r.folderId === null)).toBe(true);
      expect(root.data.rows.some((r) => r.documentGroupId === GROUP_A3)).toBe(false);
    }

    const inFolder = await listDocumentsAction({ folderId: FOLDER_A_ROOT_CHILD });
    expect(inFolder.ok).toBe(true);
    if (inFolder.ok) {
      expect(inFolder.data.rows.map((r) => r.documentGroupId).sort()).toEqual(
        [GROUP_A3, GROUP_A5].sort(),
      );
    }
  });

  it("filtro de busca por nome e por tipo", async () => {
    asOwner("org_a");
    const byName = await listDocumentsAction({ search: "Ergonômico" });
    expect(byName.ok).toBe(true);
    if (byName.ok) {
      expect(byName.data.rows.map((r) => r.documentGroupId)).toEqual([GROUP_A1]);
    }

    const byType = await listDocumentsAction({ docType: "Contrato" });
    expect(byType.ok).toBe(true);
    if (byType.ok) {
      expect(byType.data.rows.map((r) => r.documentGroupId)).toEqual([GROUP_A2]);
    }
  });

  it("filtro de validade: expired isola só documentos vencidos", async () => {
    asOwner("org_a");
    const expired = await listDocumentsAction({ validity: "expired" });
    expect(expired.ok).toBe(true);
    if (expired.ok) {
      expect(expired.data.rows.map((r) => r.documentGroupId)).toEqual([GROUP_A2]);
    }
  });

  it("filtro por vínculo: relatedEntityType/relatedEntityId isola documentos do PGR", async () => {
    asOwner("org_a");
    const linked = await listDocumentsAction({
      relatedEntityType: "pgr",
      relatedEntityId: PGR_IDS.pgrA,
    });
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;

    // A5 está numa pasta e A4 na raiz: a visão por vínculo atravessa a hierarquia.
    // Sem isso o anexo arquivado numa pasta sumia da etapa "Documentos e PDF" do PGR.
    expect(linked.data.rows.map((r) => r.documentGroupId).sort()).toEqual(
      [GROUP_A4, GROUP_A5].sort(),
    );
  });

  it("filtro por vínculo + folderId explícito volta a restringir à pasta", async () => {
    asOwner("org_a");
    const inFolder = await listDocumentsAction({
      relatedEntityType: "pgr",
      relatedEntityId: PGR_IDS.pgrA,
      folderId: FOLDER_A_ROOT_CHILD,
    });
    expect(inFolder.ok).toBe(true);
    if (!inFolder.ok) return;
    expect(inFolder.data.rows.map((r) => r.documentGroupId)).toEqual([GROUP_A5]);
  });

  it("isolamento cross-tenant: org_b nunca vê documentos/pastas/KPIs de org_a", async () => {
    asOwner("org_b");
    const result = await listDocumentsAction();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.rows.every((r) => r.documentGroupId === GROUP_B1)).toBe(true);
    expect(result.data.rows.some((r) => r.documentGroupId === GROUP_A1)).toBe(false);
    expect(result.data.kpis.documents).toBe(1);
    expect(result.data.kpis.folders).toBe(0);
  });
});
