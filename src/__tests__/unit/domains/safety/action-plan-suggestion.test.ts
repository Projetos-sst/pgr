import {
  ACTION_PLAN_SUGGESTION_KIND,
  actionPlanSuggestionSchema,
  incidentSuggestionContextSchema,
  parseActionPlanSuggestion,
  riskSuggestionContextSchema,
  sanitizeIncidentSuggestionContext,
  sanitizeRiskSuggestionContext,
} from "@/shared/domains/safety/action-plan-suggestion";

/** Chaves de PII/dado médico que JAMAIS podem sair no input da IA. */
const FORBIDDEN_KEYS = [
  "employeeId",
  "employeeName",
  "fullName",
  "cpf",
  "rg",
  "matricula",
  "hospital",
  "witnesses",
  "investigationNotes",
  "injuryNatureCode",
  "injuryNatureDescription",
  "bodyPartCode",
  "bodyPartDescription",
  "causativeAgentCode",
  "causativeAgentDescription",
  "catNumber",
  "catIssuedAt",
  "orgId",
  "companyId",
  "id",
  "photos",
];

describe("action-plan-suggestion — kind", () => {
  it("usa o kind action_plan_suggestion (zero migration)", () => {
    expect(ACTION_PLAN_SUGGESTION_KIND).toBe("action_plan_suggestion");
  });
});

describe("action-plan-suggestion — allowlist do incidente (P0)", () => {
  const rawIncident = {
    // permitido
    type: "typical",
    category: "with_leave",
    severity: "severe",
    location: "Setor de usinagem",
    description: "Contato com peça em movimento",
    causes: "Proteção removida",
    activityProcedure: "Operação de torno",
    responsibleArea: "Produção",
    environmentalImpact: "nenhum",
    materialLoss: "peça danificada",
    // PROIBIDO (deve sumir)
    employeeId: "11111111-1111-1111-1111-111111111111",
    employeeName: "Fulano de Tal",
    cpf: "12345678901",
    hospital: "Hospital Central",
    witnesses: "Sicrano",
    investigationNotes: "notas médicas detalhadas",
    injuryNatureDescription: "fratura exposta",
    bodyPartDescription: "mão direita",
    causativeAgentDescription: "torno mecânico",
    catNumber: "CAT-999",
    orgId: "org_a",
    companyId: "11111111-1111-1111-1111-111111111111",
    id: "acc-1",
  };

  it("remove TODAS as chaves proibidas do objeto enviado ao provedor", () => {
    const sanitized = sanitizeIncidentSuggestionContext(rawIncident) as Record<
      string,
      unknown
    >;
    for (const key of FORBIDDEN_KEYS) {
      expect(sanitized).not.toHaveProperty(key);
    }
    // Só chaves da allowlist sobrevivem.
    expect(sanitized.kind).toBe("incident");
    expect(sanitized.type).toBe("typical");
    expect(sanitized.location).toBe("Setor de usinagem");
    expect(sanitized.responsibleArea).toBe("Produção");
  });

  it("o schema .strict() rejeita chave proibida injetada", () => {
    expect(
      incidentSuggestionContextSchema.safeParse({
        kind: "incident",
        type: "typical",
        category: "with_leave",
        severity: "minor",
        hospital: "Hospital",
      }).success,
    ).toBe(false);
  });
});

describe("action-plan-suggestion — allowlist do risco (não-PII)", () => {
  it("mantém só campos técnicos + ambiente do GES (títulos de função)", () => {
    const sanitized = sanitizeRiskSuggestionContext({
      agentType: "physical",
      description: "Ruído contínuo",
      hazard: "Ruído",
      sources: "Compressor",
      possibleInjuries: "PAIR",
      gesName: "GES A",
      processDescription: "Usinagem",
      environment: "Galpão; iluminação artificial",
      roleTitles: ["Operador", "Ajudante", ""],
      // proibido
      employeeName: "Fulano",
      cpf: "123",
    }) as Record<string, unknown>;
    expect(sanitized).not.toHaveProperty("employeeName");
    expect(sanitized).not.toHaveProperty("cpf");
    expect(sanitized.agentType).toBe("physical");
    expect(sanitized.roleTitles).toEqual(["Operador", "Ajudante"]);
  });

  it("o schema .strict() rejeita chave extra", () => {
    expect(
      riskSuggestionContextSchema.safeParse({
        kind: "risk",
        agentType: "physical",
        description: "Ruído",
        employeeId: "x",
      }).success,
    ).toBe(false);
  });
});

describe("action-plan-suggestion — output 5W2H", () => {
  const valid = {
    what: "Instalar enclausuramento",
    why: "Reduzir ruído",
    who: "SESMT",
    where: "Usinagem",
    how: "Barreira acústica",
    when: "2026-08-01",
    howMuch: 1500,
    priority: 2,
  };

  it("valida 5W2H completo", () => {
    expect(actionPlanSuggestionSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita opcionais ausentes/nulos", () => {
    const parsed = parseActionPlanSuggestion({
      what: "A",
      why: "B",
      who: "C",
      where: "D",
      how: "E",
      when: null,
      howMuch: null,
      priority: null,
    });
    expect(parsed).not.toBeNull();
  });

  it("rejeita prioridade fora de 1–3", () => {
    expect(actionPlanSuggestionSchema.safeParse({ ...valid, priority: 5 }).success).toBe(
      false,
    );
    expect(actionPlanSuggestionSchema.safeParse({ ...valid, priority: 0 }).success).toBe(
      false,
    );
  });

  it("rejeita campo obrigatório vazio (5W)", () => {
    expect(actionPlanSuggestionSchema.safeParse({ ...valid, what: "" }).success).toBe(
      false,
    );
  });

  it("rejeita chave extra (strict)", () => {
    expect(
      actionPlanSuggestionSchema.safeParse({ ...valid, originId: "x" }).success,
    ).toBe(false);
  });

  it("parse de saída inválida do provedor devolve null (falha controlada)", () => {
    expect(parseActionPlanSuggestion(null)).toBeNull();
    expect(parseActionPlanSuggestion({ what: "só isso" })).toBeNull();
    expect(parseActionPlanSuggestion("texto solto")).toBeNull();
  });

  it("aceita saída aninhada em { plan: {...} }", () => {
    expect(parseActionPlanSuggestion({ plan: valid })).not.toBeNull();
  });
});
