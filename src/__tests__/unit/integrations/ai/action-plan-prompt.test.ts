import {
  ACTION_PLAN_TOOL_NAME,
  buildActionPlanTool,
  extractActionPlanFromContent,
} from "@/shared/integrations/ai/action-plan-prompt";
import { actionPlanSuggestionSchema } from "@/shared/domains/safety/action-plan-suggestion";

/**
 * Regressão: o **tool schema** enviado ao LLM e o **schema Zod** de saída (`.strict()`) precisam
 * concordar nas chaves. Um descasamento (`how_much` no tool × `howMuch` no Zod) fazia TODA resposta
 * real do provedor falhar o parse → `AI_UNAVAILABLE` permanente. Estes testes travam esse contrato.
 */
describe("action-plan tool ↔ output schema (contrato de chaves)", () => {
  it("as propriedades do tool são aceitas pelo schema de saída (.strict())", () => {
    const props = Object.keys(buildActionPlanTool().input_schema.properties);
    // Um objeto usando exatamente as chaves do tool (com valores válidos) passa no schema.
    const sample: Record<string, unknown> = {
      what: "a",
      why: "b",
      who: "c",
      where: "d",
      how: "e",
      when: "2026-08-01",
      howMuch: 100,
      priority: 2,
    };
    for (const p of props) {
      expect(sample).toHaveProperty(p);
    }
    expect(actionPlanSuggestionSchema.safeParse(sample).success).toBe(true);
  });

  it("bloco tool_use com as chaves do tool parseia verde (howMuch camelCase)", () => {
    const raw = extractActionPlanFromContent([
      {
        type: "tool_use",
        name: ACTION_PLAN_TOOL_NAME,
        input: {
          what: "Instalar barreira",
          why: "Ruído",
          who: "SESMT",
          where: "Usinagem",
          how: "Enclausuramento",
          when: "2026-09-01",
          howMuch: 5000,
          priority: 2,
        },
      },
    ]);
    expect(actionPlanSuggestionSchema.safeParse(raw).success).toBe(true);
  });

  it("normaliza how_much (snake) → howMuch e parseia verde", () => {
    const raw = extractActionPlanFromContent([
      {
        type: "tool_use",
        name: ACTION_PLAN_TOOL_NAME,
        input: {
          what: "a",
          why: "b",
          who: "c",
          where: "d",
          how: "e",
          how_much: 1200,
        },
      },
    ]) as Record<string, unknown>;
    expect(raw).not.toHaveProperty("how_much");
    expect(raw.howMuch).toBe(1200);
    expect(actionPlanSuggestionSchema.safeParse(raw).success).toBe(true);
  });

  it("sem bloco tool_use válido → null", () => {
    expect(extractActionPlanFromContent([{ type: "text" }])).toBeNull();
  });
});
