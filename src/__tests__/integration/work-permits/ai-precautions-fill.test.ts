import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/agents", () => ({
  requestWorkPermitPrecautionsFill: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import { requestWorkPermitPrecautionsFill } from "@/shared/integrations/agents";
import {
  AI_WORK_PERMIT_PRECAUTIONS_KIND,
  type WorkPermitPrecautionsFillInput,
} from "@/shared/domains/work-permits/ai-precautions-fill";
import { fillWorkPermitPrecautionsAction } from "@/shared/server/actions/work-permits/ai-precautions";
import { FREE_AI_SUGGESTION_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const mockedGate = jest.mocked(requireOfficeStaff);
const mockedModel = jest.mocked(requestWorkPermitPrecautionsFill);

const INPUT: WorkPermitPrecautionsFillInput = {
  type: "height",
  area: "Telhado do galpão 2",
  description: "Troca de telhas",
  precautions: "- Usar cinto paraquedista",
};

async function countUsage(admin: ReturnType<typeof postgres>, orgId: string) {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.ai_usage_events
    where org_id = ${orgId} and kind = ${AI_WORK_PERMIT_PRECAUTIONS_KIND}`;
  return row.c;
}

(shouldRun ? describe : describe.skip)("Server Actions — ai-precautions-fill", () => {
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
    mockedModel.mockReset();
    mockedGate.mockResolvedValue({
      userId: "u",
      tenantId: "org_a",
      plan: "free",
      role: "owner",
    });
  });

  it("devolve só as precauções novas, manda contexto sem pessoa e gasta 1 uso da org da sessão", async () => {
    mockedModel.mockResolvedValue(["Isolar a área abaixo", "usar cinto paraquedista"]);
    const res = await fillWorkPermitPrecautionsAction(INPUT);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.precautions).toEqual(["Isolar a área abaixo"]);
    expect(mockedModel).toHaveBeenCalledWith({
      typeLabel: "Trabalho em altura",
      area: "Telhado do galpão 2",
      description: "Troca de telhas",
      existingPrecautions: ["Usar cinto paraquedista"],
    });
    expect(await countUsage(admin, "org_a")).toBe(1);
    expect(await countUsage(admin, "org_b")).toBe(0);
  });

  it("IA sem precaução nova: lista vazia e não gasta cota", async () => {
    mockedModel.mockResolvedValue([]);
    const res = await fillWorkPermitPrecautionsAction(INPUT);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.precautions).toEqual([]);
    expect(await countUsage(admin, "org_a")).toBe(0);
  });

  it("sem descrição → VALIDATION, sem chamar a IA", async () => {
    const res = await fillWorkPermitPrecautionsAction({ ...INPUT, description: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(mockedModel).not.toHaveBeenCalled();
  });

  it("cota do plano free estourada → QUOTA_EXCEEDED, sem chamar a IA", async () => {
    await admin.unsafe(
      `insert into public.ai_usage_events (org_id, kind)
       select 'org_a', '${AI_WORK_PERMIT_PRECAUTIONS_KIND}'
       from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
    );
    const res = await fillWorkPermitPrecautionsAction(INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
    expect(mockedModel).not.toHaveBeenCalled();
  });

  it("papel client → FORBIDDEN, sem chamar a IA", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await fillWorkPermitPrecautionsAction(INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
    expect(mockedModel).not.toHaveBeenCalled();
  });

  it("não grava permissão de trabalho nenhuma", async () => {
    mockedModel.mockResolvedValue(["Isolar a área abaixo"]);
    const [before] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.work_permits`;
    await fillWorkPermitPrecautionsAction(INPUT);
    const [after] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.work_permits`;
    expect(after.c).toBe(before.c);
  });
});
