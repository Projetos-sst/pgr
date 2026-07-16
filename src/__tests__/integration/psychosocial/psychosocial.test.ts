/**
 * Integração do módulo psicossocial (Fase 09) contra Postgres efêmero. Cobre
 * CRUD de campanha + perguntas, regra de ativação, rota pública por token
 * (anônima, campanha fechada/expirada), derivação de riscos e registro no PGR,
 * tudo com isolamento multi-tenant.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const WORKUNIT_A = "11111111-1111-1111-1111-1111111111a1";
const GES_A = "11111111-1111-1111-1111-1111111111a2";
const COMPANY_B = "22222222-2222-2222-2222-222222222222";

async function tokenOf(id: string): Promise<string> {
  const detail = await repo.getCampaignWithQuestions("org_a", id);
  return detail!.campaign.publicToken;
}

(shouldRun ? describe : describe.skip)("psicossocial — campanhas e riscos", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria campanha e isola cross-tenant", async () => {
    const { id } = await repo.createCampaign("org_a", {
      name: "Clima A",
      companyId: COMPANY_A,
      workUnitId: WORKUNIT_A,
      startsAt: null,
      endsAt: null,
    });
    expect(await repo.getCampaignWithQuestions("org_a", id)).not.toBeNull();
    expect(await repo.getCampaignWithQuestions("org_b", id)).toBeNull();
  });

  it("empresa de outro tenant → FK_NOT_FOUND", async () => {
    await expect(
      repo.createCampaign("org_a", {
        name: "X",
        companyId: COMPANY_B,
        workUnitId: WORKUNIT_A,
      }),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });

  it("não ativa sem perguntas; ativa após adicionar; reordena e remove", async () => {
    const { id } = await repo.createCampaign("org_a", {
      name: "Fluxo",
      companyId: COMPANY_A,
      workUnitId: WORKUNIT_A,
    });
    await expect(repo.setCampaignStatus("org_a", id, "active")).rejects.toBeInstanceOf(
      ValidationError,
    );
    const q1 = await repo.addQuestion("org_a", id, {
      text: "Sobrecarga de trabalho?",
      questionType: "likert",
    });
    const q2 = await repo.addQuestion("org_a", id, {
      text: "Apoio da liderança?",
      questionType: "likert",
    });
    expect(await repo.setCampaignStatus("org_a", id, "active")).toBe(true);

    // reordena: q2 sobe
    await repo.reorderQuestion("org_a", id, q2.id, "up");
    const detail = await repo.getCampaignWithQuestions("org_a", id);
    expect(detail!.questions[0].id).toBe(q2.id);

    // perguntas cross-tenant não acessíveis
    expect(
      await repo.updateQuestion("org_b", id, q1.id, {
        text: "hack",
        questionType: "likert",
      }),
    ).toBe(false);
  });

  it("rota pública: resolve ativa, submete anônimo, rejeita fechada/expirada/inválida", async () => {
    const { id } = await repo.createCampaign("org_a", {
      name: "Pública",
      companyId: COMPANY_A,
      workUnitId: WORKUNIT_A,
    });
    const qa = await repo.addQuestion("org_a", id, {
      text: "Estresse?",
      questionType: "likert",
    });
    await repo.setCampaignStatus("org_a", id, "active");
    const token = await tokenOf(id);

    // token inválido
    expect((await repo.resolvePublicCampaign(id, "nope")).kind).toBe("invalid");

    // ativa → ok
    const resolved = await repo.resolvePublicCampaign(id, token);
    expect(resolved.kind).toBe("ok");

    // submissão anônima
    const submit = await repo.submitPublicResponse(id, token, {
      answers: [{ questionId: qa.id, valueInt: 5, valueText: null }],
    });
    expect(submit.kind).toBe("ok");
    const stats = await repo.getCampaignStats("org_a", id);
    expect(stats!.responseCount).toBe(1);

    // fechada → not_open
    await repo.setCampaignStatus("org_a", id, "closed");
    expect((await repo.resolvePublicCampaign(id, token)).kind).toBe("not_open");
  });

  it("deriva riscos e registra no PGR (org correta)", async () => {
    const { id } = await repo.createCampaign("org_a", {
      name: "Derivação",
      companyId: COMPANY_A,
      workUnitId: WORKUNIT_A,
    });
    const q = await repo.addQuestion("org_a", id, {
      text: "Pressão por metas?",
      questionType: "likert",
    });
    await repo.setCampaignStatus("org_a", id, "active");
    const token = await tokenOf(id);
    // 3 respostas altas (média 5 > threshold 3)
    for (let i = 0; i < 3; i++) {
      await repo.submitPublicResponse(id, token, {
        answers: [{ questionId: q.id, valueInt: 5, valueText: null }],
      });
    }

    const derived = await repo.deriveRisksForCampaign("org_a", id);
    expect(derived.length).toBe(1);
    expect(derived[0].factor).toBe("Pressão por metas?");

    // idempotente: re-derivar não duplica
    const again = await repo.deriveRisksForCampaign("org_a", id);
    expect(again.length).toBe(1);

    // registra no inventário/PGR com GES de org_a
    const reg = await repo.registerRiskInPgr("org_a", derived[0].id, GES_A);
    expect(reg!.riskId).toBeDefined();

    // aparece em risks (org_a) com agente psychosocial
    const [risk] = await admin.unsafe(
      `select agent_type, ges_id from public.risks where id = '${reg!.riskId}'`,
    );
    expect(risk.agent_type).toBe("psychosocial");
    expect(risk.ges_id).toBe(GES_A);

    // org_b não vê os riscos derivados de org_a
    expect((await repo.listDerivedRisks("org_b", id)).length).toBe(0);
  });
});
