import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/agents", () => ({
  requestEpiRiskFill: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { requestEpiRiskFill } from "@/shared/integrations/agents";
import { AI_EPI_RISK_FILL_KIND } from "@/shared/domains/pgr/ai-epi-risk-fill";
import {
  acceptRiskEpiFillAction,
  fillRiskEpisAction,
} from "@/shared/server/actions/pgr/ai-epi-risk-fill";
import { FREE_AI_SUGGESTION_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const mockedGate = jest.mocked(requireOfficeStaff);
const mockedModel = jest.mocked(requestEpiRiskFill);

const PLUG_ID = "11111111-1111-4111-8111-1111111111e1";

const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

async function countUsage(admin: ReturnType<typeof postgres>): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.ai_usage_events
    where org_id = 'org_a' and kind = ${AI_EPI_RISK_FILL_KIND}`;
  return row.c;
}

async function linksOfRiskA(admin: ReturnType<typeof postgres>) {
  return admin<{ catalog_id: string; neutralization: string }[]>`
    select catalog_id, neutralization from public.epi_risk
    where risk_id = ${PGR_IDS.riskA} order by catalog_id`;
}

(shouldRun ? describe : describe.skip)(
  "Server Actions — preenchimento de EPIs do risco",
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
      await admin.unsafe(`
      insert into public.epi_catalog (id, org_id, type, category_id, name, ca, ca_valid_until)
      values ('${PLUG_ID}','org_a','epi','${PGR_IDS.categoryA}','Protetor auricular plug','456','2099-12-31')`);
      mockedGate.mockReset();
      mockedModel.mockReset();
      asOwner("org_a");
    });

    it("fill: envia só o catálogo ainda não vinculado, descarta id inventado e registra 1 uso", async () => {
      mockedModel.mockResolvedValue([
        {
          catalogId: PLUG_ID,
          neutralization: "neutralizes",
          rationale: "Atenua o ruído",
        },
        { catalogId: "inventado", neutralization: "neutralizes" },
        { catalogId: PGR_IDS.epiCatalogA, neutralization: "neutralizes" },
      ]);
      const res = await fillRiskEpisAction(PGR_IDS.riskA);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.links).toEqual([
          {
            catalogId: PLUG_ID,
            neutralization: "neutralizes",
            rationale: "Atenua o ruído",
            name: "Protetor auricular plug",
            ca: "456",
          },
        ]);
      }
      const sent = mockedModel.mock.calls[0]?.[0];
      expect(sent?.catalog.map((c) => c.catalogId)).toEqual([PLUG_ID]);
      expect(sent?.description).toBe("Ruído contínuo");
      expect(await countUsage(admin)).toBe(1);
    });

    it("fill: risco de outra org → FK_NOT_FOUND, sem chamar a IA nem gastar cota", async () => {
      const res = await fillRiskEpisAction(PGR_IDS.riskB);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
      expect(mockedModel).not.toHaveBeenCalled();
      expect(await countUsage(admin)).toBe(0);
    });

    it("fill: cota do plano free estourada → QUOTA_EXCEEDED, sem chamar a IA", async () => {
      await admin.unsafe(
        `insert into public.ai_usage_events (org_id, kind)
       select 'org_a', '${AI_EPI_RISK_FILL_KIND}'
       from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
      );
      const res = await fillRiskEpisAction(PGR_IDS.riskA);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
      expect(mockedModel).not.toHaveBeenCalled();
    });

    it("fill: sem EPI disponível no catálogo → VALIDATION, sem chamar a IA", async () => {
      await admin`delete from public.epi_catalog where id = ${PLUG_ID}`;
      const res = await fillRiskEpisAction(PGR_IDS.riskA);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("VALIDATION");
      expect(mockedModel).not.toHaveBeenCalled();
    });

    it("accept: grava a neutralização editada e pula o EPI já vinculado", async () => {
      const res = await acceptRiskEpiFillAction(PGR_IDS.riskA, {
        links: [
          { catalogId: PLUG_ID, neutralization: "does_not_neutralize" },
          { catalogId: PGR_IDS.epiCatalogA, neutralization: "not_applicable" },
        ],
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual({ created: 1, skipped: 1 });
      expect(await linksOfRiskA(admin)).toEqual([
        { catalog_id: PGR_IDS.epiCatalogA, neutralization: "neutralizes" },
        { catalog_id: PLUG_ID, neutralization: "does_not_neutralize" },
      ]);
    });

    it("accept: risco de outra org → FK_NOT_FOUND e nada gravado", async () => {
      const res = await acceptRiskEpiFillAction(PGR_IDS.riskB, {
        links: [{ catalogId: PLUG_ID, neutralization: "neutralizes" }],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
      expect(await linksOfRiskA(admin)).toHaveLength(1);
    });
  },
);
