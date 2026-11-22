import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/agents", () => ({
  requestRequiredTrainingSuggestions: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { requestRequiredTrainingSuggestions } from "@/shared/integrations/agents";
import { AI_TRAINING_SUGGESTION_KIND } from "@/shared/domains/pgr/ai-training-suggestion";
import {
  acceptSuggestedTrainings,
  suggestRequiredTrainings,
} from "@/shared/server/actions/pgr/ai-required-trainings";
import { FREE_AI_SUGGESTION_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const mockedGate = jest.mocked(requireOfficeStaff);
const mockedModel = jest.mocked(requestRequiredTrainingSuggestions);

const CATALOG_ID = "11111111-1111-4111-8111-1111111111c9";

const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const edited = {
  name: "NR-35 — Trabalho em Altura revisado",
  referenceNorm: "NR-35",
  periodicity: "biennial",
  workloadHours: 16,
  trainingId: null,
};

async function countUsage(admin: ReturnType<typeof postgres>): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.ai_usage_events
    where org_id = 'org_a' and kind = ${AI_TRAINING_SUGGESTION_KIND}`;
  return row.c;
}

async function countRows(admin: ReturnType<typeof postgres>, orgId: string) {
  const [row] = await admin<{ catalog: number; links: number }[]>`
    select
      (select count(*)::int from public.training_catalog where org_id = ${orgId}) as catalog,
      (select count(*)::int from public.job_role_required_trainings where org_id = ${orgId}) as links`;
  return row;
}

(shouldRun ? describe : describe.skip)("Server Actions — ai-required-trainings", () => {
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
    await admin`insert into public.training_catalog
      (id, org_id, number, name, periodicity, workload_hours, is_active)
      values (${CATALOG_ID}, 'org_a', 1, 'Trabalho em Altura', 'biennial', 8, true)`;
    mockedGate.mockReset();
    mockedModel.mockReset();
    asOwner("org_a");
  });

  it("suggest: casa com o catálogo e registra 1 uso", async () => {
    mockedModel.mockResolvedValue([
      { name: "NR-35 — Trabalho em Altura", periodicity: "biennial", workloadHours: 8 },
      { name: "NR-06 — Uso de EPI", periodicity: "annual", workloadHours: 4 },
    ]);
    const res = await suggestRequiredTrainings(PGR_IDS.jobRoleA);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.suggestions.map((s) => s.trainingId)).toEqual([CATALOG_ID, null]);
    }
    expect(await countUsage(admin)).toBe(1);
  });

  it("suggest: função de outra org → FK_NOT_FOUND, sem chamar a IA nem gastar cota", async () => {
    const res = await suggestRequiredTrainings(PGR_IDS.jobRoleB);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
    expect(mockedModel).not.toHaveBeenCalled();
    expect(await countUsage(admin)).toBe(0);
  });

  it("suggest: cota do plano free estourada → QUOTA_EXCEEDED, sem chamar a IA", async () => {
    await admin.unsafe(
      `insert into public.ai_usage_events (org_id, kind)
       select 'org_a', '${AI_TRAINING_SUGGESTION_KIND}'
       from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
    );
    const res = await suggestRequiredTrainings(PGR_IDS.jobRoleA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
    expect(mockedModel).not.toHaveBeenCalled();
  });

  it("accept: cria o curso editado no catálogo e vincula à função", async () => {
    const res = await acceptSuggestedTrainings(PGR_IDS.jobRoleA, {
      suggestions: [edited],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ linked: 1, createdInCatalog: 1 });
    const [row] = await admin<{ workload_hours: number }[]>`
      select workload_hours from public.training_catalog
      where org_id = 'org_a' and name = ${edited.name}`;
    expect(row.workload_hours).toBe(16);
  });

  it("accept: aceitar duas vezes não duplica curso nem vínculo", async () => {
    const first = await acceptSuggestedTrainings(PGR_IDS.jobRoleA, {
      suggestions: [
        edited,
        { ...edited, name: "Trabalho em Altura", trainingId: CATALOG_ID },
      ],
    });
    expect(first.ok).toBe(true);
    const second = await acceptSuggestedTrainings(PGR_IDS.jobRoleA, {
      suggestions: [
        edited,
        { ...edited, name: "Trabalho em Altura", trainingId: CATALOG_ID },
      ],
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.data).toEqual({ linked: 0, createdInCatalog: 0 });
    expect(await countRows(admin, "org_a")).toEqual({ catalog: 2, links: 2 });
  });

  it("accept: curso inativo de mesmo nome não é reaproveitado e nada é gravado", async () => {
    await admin`update public.training_catalog set is_active = false where id = ${CATALOG_ID}`;
    const res = await acceptSuggestedTrainings(PGR_IDS.jobRoleA, {
      suggestions: [edited, { ...edited, name: "trabalho em altura" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(await countRows(admin, "org_a")).toEqual({ catalog: 1, links: 0 });
  });

  it("accept: função de outra org → FK_NOT_FOUND e nenhum curso criado", async () => {
    const res = await acceptSuggestedTrainings(PGR_IDS.jobRoleB, {
      suggestions: [edited],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
    expect(await countRows(admin, "org_a")).toEqual({ catalog: 1, links: 0 });
  });
});
