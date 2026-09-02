import {
  ACTION_PLAN_INSTRUCTIONS,
  actionPlanOutputSchema,
  buildActionPlanPrompt,
} from "@/shared/integrations/agents/action-plan/prompt";
import { ActionPlanAgent } from "@/shared/integrations/agents/action-plan/agent";
import { actionPlanSuggestionSchema } from "@/shared/domains/safety/action-plan-suggestion";

const agent = new ActionPlanAgent();

/**
 * Regressão: o **schema enviado ao modelo** e o **schema Zod de saída** (`.strict()`)
 * precisam concordar nas chaves. Um descasamento (`how_much` num, `howMuch` no outro)
 * fazia TODA resposta real do provedor falhar o parse → `AI_UNAVAILABLE` permanente.
 */
describe("contrato de chaves: schema do agente ↔ schema do domínio", () => {
  it("uma saída com exatamente as chaves do agente passa no schema .strict()", () => {
    const sample = {
      what: "a",
      why: "b",
      who: "c",
      where: "d",
      how: "e",
      when: "2026-08-01",
      howMuch: 100,
      priority: 2,
    };
    expect(Object.keys(actionPlanOutputSchema.shape).sort()).toEqual(
      Object.keys(sample).sort(),
    );
    expect(actionPlanSuggestionSchema.safeParse(agent.parseOutput(sample)).success).toBe(
      true,
    );
  });

  it("normaliza how_much (snake) → howMuch e parseia verde", () => {
    const raw = agent.parseOutput({
      what: "a",
      why: "b",
      who: "c",
      where: "d",
      how: "e",
      how_much: 1200,
    } as never) as Record<string, unknown>;
    expect(raw).not.toHaveProperty("how_much");
    expect(raw.howMuch).toBe(1200);
    expect(actionPlanSuggestionSchema.safeParse(raw).success).toBe(true);
  });

  /**
   * Regressão de respostas reais: o modelo expressa "sem valor" de três jeitos, e cada um
   * derrubava um plano bom. `when: ""` reprova em `z.iso.date()`; `howMuch: ""` era pior,
   * porque a coerção numérica o transformava num custo de R$ 0 silenciosamente errado.
   */
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string vazia", ""],
    ["só espaços", "   "],
  ])("campo opcional como %s vira chave ausente, não erro", (_rotulo, vazio) => {
    const raw = agent.parseOutput({
      what: "a",
      why: "b",
      who: "c",
      where: "d",
      how: "e",
      when: vazio,
      howMuch: vazio,
      priority: vazio,
    } as never) as Record<string, unknown>;

    expect(Object.keys(raw)).toEqual(["what", "why", "who", "where", "how"]);
    const parsed = actionPlanSuggestionSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    // Nunca inventa R$ 0: sem custo informado, o campo não existe.
    expect(parsed.success && parsed.data.howMuch).toBeUndefined();
  });

  it("o schema do agente aceita null nos opcionais (é como o modelo diz 'nenhum')", () => {
    const parsed = actionPlanOutputSchema.safeParse({
      what: "a",
      why: "b",
      who: "c",
      where: "d",
      how: "e",
      when: null,
      howMuch: null,
      priority: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("custo em texto sobrevive à coerção do domínio", () => {
    const raw = agent.parseOutput({
      what: "a",
      why: "b",
      who: "c",
      where: "d",
      how: "e",
      howMuch: "1500",
      priority: "3",
    });
    const parsed = actionPlanSuggestionSchema.safeParse(raw);
    expect(parsed.success && parsed.data.howMuch).toBe(1500);
    expect(parsed.success && parsed.data.priority).toBe(3);
  });
});

describe("buildActionPlanPrompt", () => {
  it("origem risco: usa só os campos técnicos do risco", () => {
    const prompt = buildActionPlanPrompt({
      kind: "risk",
      agentType: "physical",
      description: "Ruído contínuo",
      hazard: "Ruído",
      sources: "Serra circular",
      possibleInjuries: null,
      gesName: "Marcenaria",
      processDescription: null,
      environment: null,
      roleTitles: ["Marceneiro"],
    } as never);
    expect(prompt).toContain("Ruído contínuo");
    expect(prompt).toContain("Marceneiro");
    expect(prompt).not.toContain("Possíveis lesões");
  });

  it("origem incidente: usa a versão anônima, sem PII", () => {
    const prompt = buildActionPlanPrompt({
      kind: "incident",
      type: "accident",
      category: "típico",
      severity: "moderada",
      location: "Expedição",
      description: "Queda de carga",
      causes: "Sobrecarga da empilhadeira",
      activityProcedure: null,
      responsibleArea: "Logística",
      environmentalImpact: null,
      materialLoss: null,
    } as never);
    expect(prompt).toContain("Queda de carga");
    expect(prompt).not.toMatch(/CPF|nome|hospital|testemunha/i);
  });
});

describe("ACTION_PLAN_INSTRUCTIONS", () => {
  it("ancora na NR-01 e na hierarquia de controle", () => {
    expect(ACTION_PLAN_INSTRUCTIONS).toContain("NR-01");
    expect(ACTION_PLAN_INSTRUCTIONS).toMatch(/hierarquia de controle/i);
  });

  it("proíbe PII e nome de pessoa em 'Quem'", () => {
    expect(ACTION_PLAN_INSTRUCTIONS).toMatch(/NUNCA cite nome de pessoa/);
    expect(ACTION_PLAN_INSTRUCTIONS).toContain("CPF");
  });
});
