/**
 * Documentos complementares da NR-18 e relação derivada de EPIs (#48) contra Postgres
 * efêmero. **Sem migration**: o checklist só agrupa por `doc_type` os anexos que o GED
 * já tem, e a relação de EPIs é leitura derivada do cadastro.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import { getPgrNr18ChecklistAction } from "@/shared/server/actions/pgr/pgr-nr18";
import { getPgrConsolidatedAction } from "@/shared/server/actions/pgr/pgr-consolidated";
import { derivePgrEpiRelation } from "@/shared/domains/pgr/epi-relation";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

const GROUP_ELECTRICAL = "11111111-1111-1111-1111-1111111111d8";
const GROUP_OTHER_TENANT = "22222222-2222-2222-2222-2222222222d8";
const TODAY = "2026-09-27";

/** Insere um documento vigente (v1) do tipo informado, vinculado ao PGR. */
function insertDocSql(opts: {
  id: string;
  orgId: string;
  groupId: string;
  pgrId: string;
  docType: string;
  name: string;
  version?: number;
}) {
  const { id, orgId, groupId, pgrId, docType, name, version = 1 } = opts;
  return `
    insert into public.documents
      (id, org_id, document_group_id, name, doc_type, version, status, storage_path,
       size_bytes, related_entity_type, related_entity_id)
    values
      ('${id}','${orgId}','${groupId}','${name.replace(/'/g, "''")}','${docType.replace(/'/g, "''")}',
       ${version},'ready','${orgId}/doc-${id}.pdf',1024,'pgr','${pgrId}');
  `;
}

(shouldRun ? describe : describe.skip)(
  "NR-18 — checklist e relação de EPIs (#48)",
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
      await seedPgrBase(admin);
      mockedGate.mockReset();
      asOwner("org_a");
    });

    // ── Checklist ───────────────────────────────────────────────────────────
    it("PGR sem anexos: os quatro requisitos aparecem como faltando", async () => {
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrA);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.totalCount).toBe(4);
      expect(result.data.attachedCount).toBe(0);
      expect(result.data.missingCount).toBe(4);
    });

    it("documento com doc_type da NR-18 marca o requisito como anexado", async () => {
      await admin.unsafe(
        insertDocSql({
          id: "11111111-1111-1111-1111-1111111111d9",
          orgId: "org_a",
          groupId: GROUP_ELECTRICAL,
          pgrId: PGR_IDS.pgrA,
          docType: "Projeto elétrico das instalações temporárias",
          name: "Elétrico provisório",
        }),
      );
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrA);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const item = result.data.items.find(
        (i) => i.key === "temporary_electrical_project",
      );
      expect(item?.attached).toBe(true);
      expect(item?.documents[0].name).toBe("Elétrico provisório");
      expect(result.data.attachedCount).toBe(1);
    });

    it("o tipo é o que conta, não o nome do arquivo", async () => {
      await admin.unsafe(
        insertDocSql({
          id: "11111111-1111-1111-1111-1111111111da",
          orgId: "org_a",
          groupId: "11111111-1111-1111-1111-1111111111db",
          pgrId: PGR_IDS.pgrA,
          docType: "ART",
          name: "Projeto de SPIQ.pdf",
        }),
      );
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrA);
      expect(result.ok && result.data.attachedCount).toBe(0);
    });

    it("nova versão do mesmo documento mantém o requisito atendido (uma linha só)", async () => {
      await admin.unsafe(
        insertDocSql({
          id: "11111111-1111-1111-1111-1111111111dc",
          orgId: "org_a",
          groupId: GROUP_ELECTRICAL,
          pgrId: PGR_IDS.pgrA,
          docType: "Projeto elétrico das instalações temporárias",
          name: "Elétrico provisório",
        }) +
          insertDocSql({
            id: "11111111-1111-1111-1111-1111111111dd",
            orgId: "org_a",
            groupId: GROUP_ELECTRICAL,
            pgrId: PGR_IDS.pgrA,
            docType: "Projeto elétrico das instalações temporárias",
            name: "Elétrico provisório rev.2",
            version: 2,
          }),
      );
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrA);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const item = result.data.items.find(
        (i) => i.key === "temporary_electrical_project",
      );
      expect(item?.attached).toBe(true);
      expect(item?.documents).toHaveLength(1);
      expect(item?.documents[0].version).toBe(2);
    });

    it("excluir o grupo devolve o requisito para faltando", async () => {
      await admin.unsafe(
        insertDocSql({
          id: "11111111-1111-1111-1111-1111111111de",
          orgId: "org_a",
          groupId: GROUP_ELECTRICAL,
          pgrId: PGR_IDS.pgrA,
          docType: "Projeto elétrico das instalações temporárias",
          name: "Elétrico provisório",
        }),
      );
      await admin.unsafe(
        `delete from public.documents where document_group_id = '${GROUP_ELECTRICAL}'`,
      );
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrA);
      expect(result.ok && result.data.attachedCount).toBe(0);
    });

    it("documento de outro tenant NUNCA satisfaz o checklist", async () => {
      await admin.unsafe(
        insertDocSql({
          id: "22222222-2222-2222-2222-2222222222d9",
          orgId: "org_b",
          groupId: GROUP_OTHER_TENANT,
          pgrId: PGR_IDS.pgrA, // aponta para o PGR de org_a de propósito
          docType: "Projeto elétrico das instalações temporárias",
          name: "Do outro escritório",
        }),
      );
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrA);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.attachedCount).toBe(0);
      expect(JSON.stringify(result.data)).not.toContain("Do outro escritório");
    });

    it("PGR de outro tenant → NOT_FOUND", async () => {
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrB);
      expect(!result.ok && result.error.code).toBe("NOT_FOUND");
    });

    it("papel client → FORBIDDEN", async () => {
      mockedGate.mockReset();
      mockedGate.mockRejectedValue(new ForbiddenError());
      const result = await getPgrNr18ChecklistAction(PGR_IDS.pgrA);
      expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    });

    // ── Relação de EPIs ─────────────────────────────────────────────────────
    it("relação derivada traz o EPI do cadastro, com CA e especificações reais", async () => {
      await admin.unsafe(`
      update public.epi_catalog
        set ca='12345', ca_valid_until='2027-01-31', manufacturer='Acme EPI',
            norm='ABNT NBR 16077', material='Silicone', size='Único',
            unit_of_measure='par', useful_life_months=12
      where org_id='org_a' and id='${PGR_IDS.epiCatalogA}';
    `);
      const consolidated = await getPgrConsolidatedAction(PGR_IDS.pgrA);
      expect(consolidated.ok).toBe(true);
      if (!consolidated.ok) return;
      const items = derivePgrEpiRelation(consolidated.data, { today: TODAY });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        name: "Capacete CA-123",
        ca: "12345",
        caValidUntil: "2027-01-31",
        manufacturer: "Acme EPI",
        norm: "ABNT NBR 16077",
        material: "Silicone",
        size: "Único",
        unitOfMeasure: "par",
        usefulLifeMonths: 12,
        caStatus: "valid",
      });
      expect(items[0].contexts).toHaveLength(1);
      expect(items[0].gesNames).toEqual(["GES A"]);
    });

    it("um EPI ligado a dois riscos vira uma linha com dois contextos", async () => {
      const risk2 = "11111111-1111-1111-1111-1111111111df";
      await admin.unsafe(`
      insert into public.risks (id, org_id, ges_id, agent_type, description) values
        ('${risk2}','org_a','${PGR_IDS.gesA}','chemical','Poeira de cimento');
      insert into public.epi_risk (org_id, catalog_id, risk_id, neutralization) values
        ('org_a','${PGR_IDS.epiCatalogA}','${risk2}','neutralizes');
    `);
      const consolidated = await getPgrConsolidatedAction(PGR_IDS.pgrA);
      expect(consolidated.ok).toBe(true);
      if (!consolidated.ok) return;
      const items = derivePgrEpiRelation(consolidated.data, { today: TODAY });
      expect(items).toHaveLength(1);
      expect(items[0].contexts.map((c) => c.riskDescription).sort()).toEqual([
        "Poeira de cimento",
        "Ruído contínuo",
      ]);
    });

    it("EPI de outro tenant não entra na relação", async () => {
      const consolidated = await getPgrConsolidatedAction(PGR_IDS.pgrA);
      expect(consolidated.ok).toBe(true);
      if (!consolidated.ok) return;
      const items = derivePgrEpiRelation(consolidated.data, { today: TODAY });
      expect(items.map((i) => i.name)).not.toContain("Betoneira 400L");
    });

    it("PGR sem GES devolve relação vazia", async () => {
      await admin.unsafe(
        `delete from public.pgr_ges where org_id='org_a' and pgr_id='${PGR_IDS.pgrA}'`,
      );
      const consolidated = await getPgrConsolidatedAction(PGR_IDS.pgrA);
      expect(consolidated.ok).toBe(true);
      if (!consolidated.ok) return;
      expect(derivePgrEpiRelation(consolidated.data, { today: TODAY })).toEqual([]);
    });

    it("CA vencido é classificado pela data real do cadastro", async () => {
      await admin.unsafe(`
      update public.epi_catalog set ca='999', ca_valid_until='2020-01-01'
      where org_id='org_a' and id='${PGR_IDS.epiCatalogA}';
    `);
      const consolidated = await getPgrConsolidatedAction(PGR_IDS.pgrA);
      expect(consolidated.ok).toBe(true);
      if (!consolidated.ok) return;
      const [item] = derivePgrEpiRelation(consolidated.data, { today: TODAY });
      expect(item.caStatus).toBe("expired");
    });
  },
);
