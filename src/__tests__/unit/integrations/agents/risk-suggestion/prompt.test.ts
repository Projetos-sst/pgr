import {
  RISK_SUGGESTION_INSTRUCTIONS,
  buildRiskSuggestionPrompt,
  riskSuggestionOutputSchema,
} from "@/shared/integrations/agents/risk-suggestion/prompt";
import { RiskSuggestionAgent } from "@/shared/integrations/agents/risk-suggestion/agent";
import type { GesRiskContext } from "@/shared/domains/pgr/ai-risk-suggestion";

const CTX: GesRiskContext = {
  name: "Marcenaria",
  processDescription: "Corte e lixamento de peças de madeira",
  constructionType: "Alvenaria",
  ceilingHeight: "4.5",
  floor: "Concreto",
  roof: "Telha metálica",
  lighting: "Natural + artificial",
  ventilation: "Exaustão local",
  otherCharacteristics: null,
  roles: [{ title: "Marceneiro", workerCount: 3 }],
};

describe("buildRiskSuggestionPrompt", () => {
  it("inclui os campos do GES e os títulos das funções", () => {
    const prompt = buildRiskSuggestionPrompt(CTX);
    expect(prompt).toContain("Marcenaria");
    expect(prompt).toContain("Corte e lixamento de peças de madeira");
    expect(prompt).toContain("Marceneiro");
    expect(prompt).toContain("Exaustão local");
  });

  it("omite as linhas de campos ausentes (null)", () => {
    expect(buildRiskSuggestionPrompt(CTX)).not.toContain("Outras características");
  });

  it("não introduz PII (o contexto não tem funcionários/CPF)", () => {
    expect(buildRiskSuggestionPrompt(CTX)).not.toMatch(/CPF|funcion[aá]rio/i);
  });

  it("sem funções → 'não informadas'", () => {
    expect(buildRiskSuggestionPrompt({ ...CTX, roles: [] })).toContain("não informadas");
  });
});

describe("RISK_SUGGESTION_INSTRUCTIONS", () => {
  it("ancora o agente na NR-01 e no conjunto fechado de grupos de agente", () => {
    expect(RISK_SUGGESTION_INSTRUCTIONS).toContain("NR-01");
    expect(RISK_SUGGESTION_INSTRUCTIONS).toContain("physical");
    expect(RISK_SUGGESTION_INSTRUCTIONS).toContain("psychosocial");
  });

  it("proíbe inventar risco e permite explicitamente a lista vazia", () => {
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/Lista vazia é uma resposta correta/);
  });
});

/**
 * O schema enviado ao modelo é tolerante de propósito: quem reprova item inválido é o
 * domínio, em `parseOutput`. Um schema estrito aqui derrubaria o lote inteiro por causa
 * de um item ruim — o oposto do que a feature precisa.
 */
describe("riskSuggestionOutputSchema", () => {
  it("aceita item com grupo de agente fora do enum (a triagem é do domínio)", () => {
    const parsed = riskSuggestionOutputSchema.safeParse({
      risks: [{ agentType: "inventado", description: "x" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("aceita lista vazia", () => {
    expect(riskSuggestionOutputSchema.safeParse({ risks: [] }).success).toBe(true);
  });

  it("rejeita resposta sem o envelope esperado", () => {
    expect(riskSuggestionOutputSchema.safeParse({ outra: [] }).success).toBe(false);
  });
});

describe("RiskSuggestionAgent.parseOutput", () => {
  const agent = new RiskSuggestionAgent();

  it("descarta item inválido sem derrubar os válidos", () => {
    const out = agent.parseOutput({
      risks: [
        { agentType: "physical", description: "Ruído" },
        { agentType: "inventado", description: "descartado" },
        { agentType: "chemical", description: "Poeira", sources: "Lixadeira" },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.agentType)).toEqual(["physical", "chemical"]);
  });

  it("lista vazia do modelo → lista vazia (contexto vago não vira invenção)", () => {
    expect(agent.parseOutput({ risks: [] })).toEqual([]);
  });
});
