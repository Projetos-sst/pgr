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

  it("proíbe inventar especificidade sem tolher o risco típico da atividade", () => {
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/Não invente especificidade/);
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/riscos típicos/);
  });

  /**
   * Um GES só com nome ("Técnicos de Manutenção Elétrica") rendia lista vazia, que na tela
   * é indistinguível de falha. O nome e os títulos de função são dado que o usuário
   * escreveu — evidência, não suposição.
   */
  it("trata nome do GES e títulos de função como evidência válida", () => {
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/evidência técnica válida/);
  });

  it("mantém a lista vazia como saída legítima, mas só sem atividade inferível", () => {
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/Só devolva lista vazia/);
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

describe("buildRiskSuggestionPrompt com foco (preenchimento de 1 risco)", () => {
  it("sem foco não pede risco único nem detalha risco", () => {
    const prompt = buildRiskSuggestionPrompt(CTX);
    expect(prompt).not.toMatch(/exatamente 1 risco/);
    expect(prompt).not.toMatch(/Detalhe somente este risco/);
  });

  it("com foco vazio pede exatamente 1 risco, sem bloco de detalhe", () => {
    const prompt = buildRiskSuggestionPrompt(CTX, {});
    expect(prompt).toMatch(/exatamente 1 risco/);
    expect(prompt).not.toMatch(/Detalhe somente este risco/);
  });

  it("com foco inclui o que o usuário digitou", () => {
    const prompt = buildRiskSuggestionPrompt(CTX, {
      agentType: "physical",
      hazard: "Ruído contínuo",
      description: "Ruído da serra circular",
    });
    expect(prompt).toMatch(/Detalhe somente este risco/);
    expect(prompt).toContain("Físico");
    expect(prompt).toContain("Ruído contínuo");
    expect(prompt).toContain("Ruído da serra circular");
    expect(prompt).toMatch(/exatamente 1 risco/);
  });

  it("com foco continua sem dados de funcionários", () => {
    expect(buildRiskSuggestionPrompt(CTX, { description: "Ruído" })).not.toMatch(
      /CPF|funcion[aá]rio/i,
    );
  });
});

describe("RISK_SUGGESTION_INSTRUCTIONS — preenchimento completo", () => {
  it("pede propagação, possíveis lesões e tempo de exposição do enum", () => {
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/propaga/i);
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/lesões/i);
    expect(RISK_SUGGESTION_INSTRUCTIONS).toContain("intermittent");
    expect(RISK_SUGGESTION_INSTRUCTIONS).toContain("gt_7h");
  });

  it("proíbe preencher medição, unidade e código eSocial", () => {
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/concentração/i);
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/unidade de medida/i);
    expect(RISK_SUGGESTION_INSTRUCTIONS).toMatch(/eSocial/);
  });
});

describe("riskSuggestionOutputSchema — campos novos", () => {
  it("aceita propagação, lesões e tempo de exposição opcionais", () => {
    const parsed = riskSuggestionOutputSchema.safeParse({
      risks: [
        {
          agentType: "physical",
          description: "Ruído",
          propagation: "Via aérea",
          possibleInjuries: "PAIR",
          exposureTime: "habitual",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("agente devolve os campos novos no domínio", () => {
    const [risk] = new RiskSuggestionAgent().parseOutput({
      risks: [
        {
          agentType: "physical",
          description: "Ruído",
          propagation: "Via aérea",
          possibleInjuries: "PAIR",
          exposureTime: "intermitente",
        },
      ],
    });
    expect(risk).toEqual({
      agentType: "physical",
      description: "Ruído",
      propagation: "Via aérea",
      possibleInjuries: "PAIR",
      exposureTime: "intermittent",
    });
  });

  it("buildPrompt do agente usa o foco quando presente", () => {
    const agent = new RiskSuggestionAgent();
    expect(agent.buildPrompt(CTX)).not.toMatch(/exatamente 1 risco/);
    expect(agent.buildPrompt({ ...CTX, focus: { description: "Ruído" } })).toMatch(
      /exatamente 1 risco/,
    );
  });
});
