/**
 * Integração da avaliação ergonômica NR-17 (#40) contra Postgres efêmero: CRUD,
 * histórico 1:N com vigência determinística, cascade ao excluir o risco, RLS da
 * tabela nova, isolamento cross-tenant, gate de papel e as regras de vínculo com
 * campanha psicossocial (mesmo tenant, mesma unidade, encerrada).
 */
import postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  createErgonomicEvaluationAction,
  deleteErgonomicEvaluationAction,
  getCurrentErgonomicEvaluationAction,
  getErgonomicEvaluationAction,
  listErgonomicEvaluationsAction,
  listLinkableCampaignsAction,
  updateErgonomicEvaluationAction,
} from "@/shared/server/actions/pgr/ergonomic-evaluations";
import type { ErgonomicEvaluationInput } from "@/shared/domains/pgr/ergonomics";

import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

/** Campanhas psicossociais criadas só por esta suíte. */
const CAMPAIGN_CLOSED_A = "11111111-1111-1111-1111-1111111111c1";
const CAMPAIGN_ACTIVE_A = "11111111-1111-1111-1111-1111111111c2";
const CAMPAIGN_OTHER_UNIT_A = "11111111-1111-1111-1111-1111111111c3";
const CAMPAIGN_B = "22222222-2222-2222-2222-2222222222c4";
/** Segunda unidade + GES do org_a, para provar a checagem de contexto. */
const WORK_UNIT_A2 = "11111111-1111-1111-1111-1111111111c5";

function input(
  overrides: Partial<ErgonomicEvaluationInput> = {},
): ErgonomicEvaluationInput {
  return {
    assessedAt: "2026-09-20",
    responsible: "Ergonomista responsável",
    method: "AEP — inspeção do posto de trabalho",
    posture: "inadequate",
    postureNotes: "Bancada abaixo da altura do cotovelo",
    movements: "adequate",
    physicalLoad: "not_applicable",
    notes: "Avaliação preliminar do posto de montagem.",
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("NR-17 — avaliação ergonômica (#40)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    // Conexão como `app_runtime` (RLS ENFORCED) — `appRuntimeClient()` aponta para
    // INTEGRATION_DATABASE_URL, que nesta suíte pode ser o superusuário.
    runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin.unsafe(`
      insert into public.work_units (id, org_id, company_id, name, description) values
        ('${WORK_UNIT_A2}','org_a','${PGR_IDS.companyA}','WU A2','desc');

      insert into public.psychosocial_campaigns
        (id, org_id, company_id, work_unit_id, name, status, public_token, starts_at, ends_at) values
        ('${CAMPAIGN_CLOSED_A}','org_a','${PGR_IDS.companyA}','${PGR_IDS.workUnitA}','Clima 2026','closed','tok-closed-a','2026-01-01','2026-03-31'),
        ('${CAMPAIGN_ACTIVE_A}','org_a','${PGR_IDS.companyA}','${PGR_IDS.workUnitA}','Clima em andamento','active','tok-active-a',null,null),
        ('${CAMPAIGN_OTHER_UNIT_A}','org_a','${PGR_IDS.companyA}','${WORK_UNIT_A2}','Clima outra unidade','closed','tok-other-unit-a',null,null),
        ('${CAMPAIGN_B}','org_b','${PGR_IDS.companyB}','${PGR_IDS.workUnitB}','Clima B','closed','tok-closed-b',null,null);
    `);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  // ── CRUD ────────────────────────────────────────────────────────────────
  it("cria, lê, atualiza e exclui uma avaliação", async () => {
    const created = await createErgonomicEvaluationAction(PGR_IDS.riskA, input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.riskId).toBe(PGR_IDS.riskA);
    expect(created.data.posture).toBe("inadequate");
    expect(created.data.postureNotes).toBe("Bancada abaixo da altura do cotovelo");
    expect(created.data.physicalLoad).toBe("not_applicable");
    // Dimensões não informadas ficam NULL — "não avaliado", jamais "adequado".
    expect(created.data.mentalLoad).toBeNull();
    expect(created.data.workOrganization).toBeNull();
    expect(created.data.physicalEnvironment).toBeNull();

    const fetched = await getErgonomicEvaluationAction(created.data.id);
    expect(fetched.ok && fetched.data.method).toBe("AEP — inspeção do posto de trabalho");

    const updated = await updateErgonomicEvaluationAction(
      PGR_IDS.riskA,
      created.data.id,
      input({ posture: "adequate", postureNotes: "", mentalLoad: "inadequate" }),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.posture).toBe("adequate");
    // Apagar a observação na edição limpa a coluna (não mantém o valor antigo).
    expect(updated.data.postureNotes).toBeNull();
    expect(updated.data.mentalLoad).toBe("inadequate");

    const removed = await deleteErgonomicEvaluationAction(PGR_IDS.riskA, created.data.id);
    expect(removed.ok).toBe(true);
    const after = await getErgonomicEvaluationAction(created.data.id);
    expect(!after.ok && after.error.code).toBe("NOT_FOUND");
  });

  it("aceita avaliação parcial (só a data) — nenhuma dimensão é obrigatória", async () => {
    const created = await createErgonomicEvaluationAction(PGR_IDS.riskA, {
      assessedAt: "2026-09-21",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.posture).toBeNull();
    expect(created.data.responsible).toBeNull();
    expect(created.data.method).toBeNull();
  });

  it("recusa data ausente ou adequação fora do enum (VALIDATION)", async () => {
    const noDate = await createErgonomicEvaluationAction(PGR_IDS.riskA, {
      assessedAt: "",
    } as ErgonomicEvaluationInput);
    expect(!noDate.ok && noDate.error.code).toBe("VALIDATION");

    const badEnum = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ posture: "otimo" } as unknown as Partial<ErgonomicEvaluationInput>),
    );
    expect(!badEnum.ok && badEnum.error.code).toBe("VALIDATION");
  });

  // ── Histórico e vigência ────────────────────────────────────────────────
  it("mantém histórico 1:N e elege a mais recente como vigente", async () => {
    const first = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ assessedAt: "2026-01-10", responsible: "Primeira" }),
    );
    const second = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ assessedAt: "2026-06-01", responsible: "Segunda" }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const list = await listErgonomicEvaluationsAction(PGR_IDS.riskA);
    expect(list.ok && list.data.total).toBe(2);
    if (!list.ok) return;
    expect(list.data.rows[0].id).toBe(second.data.id);
    expect(list.data.rows[1].id).toBe(first.data.id);

    const current = await getCurrentErgonomicEvaluationAction(PGR_IDS.riskA);
    expect(current.ok && current.data?.id).toBe(second.data.id);

    // A antiga continua intacta — nada foi sobrescrito para "versionar".
    const old = await getErgonomicEvaluationAction(first.data.id);
    expect(old.ok && old.data.responsible).toBe("Primeira");
  });

  it("empate de data desempata pela criação mais recente", async () => {
    const first = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ assessedAt: "2026-06-01", responsible: "Manhã" }),
    );
    const second = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ assessedAt: "2026-06-01", responsible: "Tarde" }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok) return;
    const current = await getCurrentErgonomicEvaluationAction(PGR_IDS.riskA);
    expect(current.ok && current.data?.responsible).toBe("Tarde");
  });

  it("risco sem avaliação devolve vigente nula (estado honesto)", async () => {
    const current = await getCurrentErgonomicEvaluationAction(PGR_IDS.riskA);
    expect(current.ok && current.data).toBeNull();
  });

  it("excluir o risco leva as avaliações junto (cascade)", async () => {
    const created = await createErgonomicEvaluationAction(PGR_IDS.riskA, input());
    expect(created.ok).toBe(true);
    await admin.unsafe(`delete from public.risks where id = '${PGR_IDS.riskA}'`);
    const [{ count }] = await admin.unsafe(
      `select count(*)::int as count from public.ergonomic_evaluations`,
    );
    expect(count).toBe(0);
  });

  // ── Isolamento ──────────────────────────────────────────────────────────
  it("criar em risco de outro tenant → FK_NOT_FOUND", async () => {
    const result = await createErgonomicEvaluationAction(PGR_IDS.riskB, input());
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
    const [{ count }] = await admin.unsafe(
      `select count(*)::int as count from public.ergonomic_evaluations`,
    );
    expect(count).toBe(0);
  });

  it("ler/editar/excluir avaliação de outro tenant → NOT_FOUND", async () => {
    const created = await createErgonomicEvaluationAction(PGR_IDS.riskA, input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    asOwner("org_b");
    const read = await getErgonomicEvaluationAction(created.data.id);
    expect(!read.ok && read.error.code).toBe("NOT_FOUND");
    const updated = await updateErgonomicEvaluationAction(
      PGR_IDS.riskB,
      created.data.id,
      input(),
    );
    expect(!updated.ok && updated.error.code).toBe("NOT_FOUND");
    const removed = await deleteErgonomicEvaluationAction(PGR_IDS.riskB, created.data.id);
    expect(!removed.ok && removed.error.code).toBe("NOT_FOUND");
  });

  it("RLS: app_runtime no org_b não enxerga avaliação do org_a", async () => {
    const created = await createErgonomicEvaluationAction(PGR_IDS.riskA, input());
    expect(created.ok).toBe(true);

    const mine = await withOrgTx(
      runtime,
      "org_a",
      (tx) => tx`select id from public.ergonomic_evaluations`,
    );
    expect(mine).toHaveLength(1);

    const theirs = await withOrgTx(
      runtime,
      "org_b",
      (tx) => tx`select id from public.ergonomic_evaluations`,
    );
    expect(theirs).toHaveLength(0);
  });

  it("papel client → FORBIDDEN na escrita", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await createErgonomicEvaluationAction(PGR_IDS.riskA, input());
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    const [{ count }] = await admin.unsafe(
      `select count(*)::int as count from public.ergonomic_evaluations`,
    );
    expect(count).toBe(0);
  });

  // ── Campanha psicossocial (Q3 = A) ──────────────────────────────────────
  it("vincula campanha encerrada da mesma unidade", async () => {
    const created = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ psychosocialCampaignId: CAMPAIGN_CLOSED_A }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.psychosocialCampaignId).toBe(CAMPAIGN_CLOSED_A);
  });

  it("recusa campanha de outro tenant (FK_NOT_FOUND) e não persiste vínculo", async () => {
    const result = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ psychosocialCampaignId: CAMPAIGN_B }),
    );
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
    const [{ count }] = await admin.unsafe(
      `select count(*)::int as count from public.ergonomic_evaluations`,
    );
    expect(count).toBe(0);
  });

  it("recusa campanha de outra unidade (contexto incompatível)", async () => {
    const result = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ psychosocialCampaignId: CAMPAIGN_OTHER_UNIT_A }),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
    expect(!result.ok && result.error.message).toMatch(/outra unidade/i);
  });

  it("recusa campanha que ainda não foi encerrada", async () => {
    const result = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ psychosocialCampaignId: CAMPAIGN_ACTIVE_A }),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
    expect(!result.ok && result.error.message).toMatch(/encerrada/i);
  });

  it("a mesma regra vale na edição", async () => {
    const created = await createErgonomicEvaluationAction(PGR_IDS.riskA, input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = await updateErgonomicEvaluationAction(
      PGR_IDS.riskA,
      created.data.id,
      input({ psychosocialCampaignId: CAMPAIGN_B }),
    );
    expect(!updated.ok && updated.error.code).toBe("FK_NOT_FOUND");
  });

  it("só oferece campanhas encerradas da unidade do GES do risco", async () => {
    const result = await listLinkableCampaignsAction(PGR_IDS.riskA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((c) => c.id)).toEqual([CAMPAIGN_CLOSED_A]);
  });

  it("excluir a campanha vinculada não apaga a avaliação (SET NULL)", async () => {
    const created = await createErgonomicEvaluationAction(
      PGR_IDS.riskA,
      input({ psychosocialCampaignId: CAMPAIGN_CLOSED_A }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await admin.unsafe(
      `delete from public.psychosocial_campaigns where id = '${CAMPAIGN_CLOSED_A}'`,
    );
    const after = await getErgonomicEvaluationAction(created.data.id);
    expect(after.ok).toBe(true);
    expect(after.ok && after.data.psychosocialCampaignId).toBeNull();
  });
});
