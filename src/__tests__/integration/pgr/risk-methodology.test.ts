import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError, NoTenantContextError } from "@/shared/auth/errors";
import {
  getRiskMethodologyAction,
  saveRiskMethodologyAction,
} from "@/shared/server/actions/pgr/risk-methodology";
import { presetFor } from "@/shared/domains/pgr/methodology-presets";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

async function countMethodology(
  admin: ReturnType<typeof postgres>,
  orgId: string,
): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.risk_methodology where org_id = ${orgId}`;
  return row.c;
}

(shouldRun ? describe : describe.skip)("Server Actions — risk_methodology (#76)", () => {
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
    asOwner("org_a");
  });

  it("sem configuração → devolve o padrão derivado (configured:false)", async () => {
    const res = await getRiskMethodologyAction();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.configured).toBe(false);
      expect(res.data.base).toBe("fundacentro");
      expect(res.data.probabilityGrades).toHaveLength(5);
    }
    expect(await countMethodology(admin, "org_a")).toBe(0);
  });

  it("salva (upsert) e passa a devolver configured:true", async () => {
    const save = await saveRiskMethodologyAction(presetFor("aiha"));
    expect(save.ok).toBe(true);

    const res = await getRiskMethodologyAction();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.configured).toBe(true);
      expect(res.data.base).toBe("aiha");
    }
    expect(await countMethodology(admin, "org_a")).toBe(1);
  });

  it("salvar de novo atualiza a MESMA linha (singleton por org)", async () => {
    await saveRiskMethodologyAction(presetFor("aiha"));
    await saveRiskMethodologyAction(presetFor("as_nzs_4360"));

    expect(await countMethodology(admin, "org_a")).toBe(1);
    const res = await getRiskMethodologyAction();
    if (res.ok) expect(res.data.base).toBe("as_nzs_4360");
  });

  it("faixas que não fecham em 25 → VALIDATION", async () => {
    const invalid = presetFor("fundacentro");
    invalid.classificationBands[4].maxLevel = 22;
    const res = await saveRiskMethodologyAction(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(await countMethodology(admin, "org_a")).toBe(0);
  });

  it("isolamento: metodologia de org_a não vaza para org_b", async () => {
    await saveRiskMethodologyAction(presetFor("aiha")); // org_a

    asOwner("org_b");
    const res = await getRiskMethodologyAction();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.configured).toBe(false); // org_b não vê org_a
    expect(await countMethodology(admin, "org_b")).toBe(0);
    expect(await countMethodology(admin, "org_a")).toBe(1);
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await saveRiskMethodologyAction(presetFor("aiha"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });

  it("sem escritório ativo → bloqueado pelo gate", async () => {
    mockedGate.mockRejectedValue(new NoTenantContextError());
    const res = await getRiskMethodologyAction();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NO_TENANT_CONTEXT");
  });
});
