/**
 * Declaração de inexistência de riscos (NOB-156): quando pode ser feita e quando vale para o ASO.
 * Nunca a partir de cadastro vazio; só na versão vigente da fonte. Fictício.
 */
import {
  applicableRiskAbsence,
  declarationBlocker,
  riskAbsenceInputSchema,
  riskAbsenceJobRoleSchema,
  riskMatchesScope,
  sourceIsLive,
  unmatchedRiskAbsenceJobRoles,
  type DeclarableSource,
  type RiskAbsenceDeclarationView,
} from "@/shared/domains/medicine/risk-absence";

const G = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const scope = { gesId: G, gesName: "Administrativo", jobRole: "" };

function source(overrides: Partial<DeclarableSource> = {}): DeclarableSource {
  return { superseded: false, freshness: "current", risks: [], ...overrides };
}

describe("riskAbsenceInputSchema", () => {
  it("exige fonte, GES e justificativa de 20+ caracteres; função vazia = grupo todo", () => {
    const parsed = riskAbsenceInputSchema.parse({
      sourceId: S,
      gesId: G,
      justification: "  Justificativa técnica fictícia suficiente.  ",
    });
    expect(parsed.jobRole).toBe("");
    expect(parsed.justification).toBe("Justificativa técnica fictícia suficiente.");
    expect(
      riskAbsenceInputSchema.safeParse({ sourceId: S, gesId: G, justification: "curta" })
        .success,
    ).toBe(false);
    expect(
      riskAbsenceInputSchema.safeParse({
        sourceId: S,
        gesId: G,
        justification: "Justificativa técnica fictícia suficiente.",
        declaredBy: "x",
      }).success,
    ).toBe(false);
  });
});

describe("riskAbsenceJobRoleSchema (NOB-112)", () => {
  const titles = ["Operador de empilhadeira", "OPERADOR DE EMPILHADEIRA", "Auxiliar"];
  const fieldError = (jobRole: string, list: string[] = titles) => {
    const result = riskAbsenceJobRoleSchema(list).safeParse({ jobRole });
    return result.success
      ? null
      : result.error.issues.find((i) => i.path.join(".") === "jobRole")?.message;
  };

  it("vazio = grupo todo, sem conferência", () => {
    expect(fieldError("")).toBeNull();
    expect(fieldError("", [])).toBeNull();
  });

  it("aceita só o título exato de uma função vinculada ao GES", () => {
    expect(fieldError("Operador de empilhadeira")).toBeNull();
    expect(fieldError("OPERADOR DE EMPILHADEIRA")).toBeNull();
    expect(fieldError("Auxiliar")).toBeNull();
  });

  it("abreviação, erro de digitação, outra caixa ou função fora do GES → erro no campo", () => {
    for (const typo of [
      "Op. empilhadeira",
      "Operador de empilhadera",
      "operador de empilhadeira",
      "Soldador",
    ])
      expect(fieldError(typo)).toMatch(/não encontrada entre as funções/);
    expect(fieldError("Auxiliar", [])).toMatch(/não encontrada/);
  });

  it("título repetido entre as funções do GES → ambíguo, recusa", () => {
    expect(fieldError("Auxiliar", ["Auxiliar", "Auxiliar"])).toMatch(/mais de uma função/);
  });
});

describe("riskMatchesScope", () => {
  it("interna casa pelo GES de origem; externa pelo nome; função vazia vale para o grupo", () => {
    const employee = { gesId: G, gesName: "Administrativo", jobRole: "Auxiliar" };
    expect(riskMatchesScope({ exposureGroup: "x", originGesId: G }, employee)).toBe(true);
    expect(riskMatchesScope({ exposureGroup: "x", originGesId: "outro" }, employee)).toBe(
      false,
    );
    expect(riskMatchesScope({ exposureGroup: " administrativo " }, employee)).toBe(true);
    expect(
      riskMatchesScope(
        { exposureGroup: "Administrativo", jobRole: "Soldador" },
        employee,
      ),
    ).toBe(false);
    expect(riskMatchesScope({ exposureGroup: "" }, { ...employee, gesName: "" })).toBe(
      false,
    );
  });
});

describe("declarationBlocker", () => {
  it("fonte vigente sem riscos no escopo → pode declarar", () => {
    expect(declarationBlocker(source(), scope)).toBeNull();
    expect(
      declarationBlocker(source({ freshness: "external_reference" }), scope),
    ).toBeNull();
  });

  it("fonte substituída, mudada ou indisponível → recusa", () => {
    for (const s of [
      source({ superseded: true }),
      source({ freshness: "changed" }),
      source({ freshness: "unavailable" }),
    ])
      expect(declarationBlocker(s, scope)).toMatch(/versão vigente/);
  });

  it("risco pendente ou validado no escopo → recusa; rejeitado não conta", () => {
    const risk = (status: "pending" | "validated" | "rejected", jobRole?: string) => ({
      status,
      content: { exposureGroup: "Administrativo", originGesId: G, jobRole },
    });
    expect(declarationBlocker(source({ risks: [risk("pending")] }), scope)).toMatch(
      /pendentes/,
    );
    expect(declarationBlocker(source({ risks: [risk("validated")] }), scope)).toMatch(
      /validados/,
    );
    expect(declarationBlocker(source({ risks: [risk("rejected")] }), scope)).toBeNull();
    // Grupo todo: risco de qualquer função do grupo impede.
    expect(
      declarationBlocker(source({ risks: [risk("validated", "Soldador")] }), scope),
    ).toMatch(/validados/);
    // Função específica: risco de outra função não impede; risco do grupo todo impede.
    const auxiliar = { ...scope, jobRole: "Auxiliar" };
    expect(
      declarationBlocker(source({ risks: [risk("validated", "Soldador")] }), auxiliar),
    ).toBeNull();
    expect(declarationBlocker(source({ risks: [risk("validated")] }), auxiliar)).toMatch(
      /validados/,
    );
  });
});

describe("applicableRiskAbsence", () => {
  const decl = (
    overrides: Partial<RiskAbsenceDeclarationView> = {},
  ): RiskAbsenceDeclarationView => ({
    id: "d1",
    sourceId: S,
    gesId: G,
    exposureGroup: "Administrativo",
    jobRole: "",
    justification: "x",
    declaredBy: "prof",
    declaredByName: "Profissional Fictícia",
    declaredAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  });
  const live = {
    id: S,
    title: "PGR",
    version: "1",
    superseded: false,
    freshness: "current" as const,
  };
  const employee = { gesId: G, jobRole: "Auxiliar" };

  it("vale para o GES do funcionário, na fonte vigente, para a função dele ou o grupo todo", () => {
    expect(applicableRiskAbsence([decl()], [live], employee)).toMatchObject({
      declarationId: "d1",
      source: { id: S, title: "PGR", version: "1" },
    });
    // Identidade exata do título (NOB-112): outra caixa é outra função no cadastro.
    expect(
      applicableRiskAbsence([decl({ jobRole: "auxiliar" })], [live], employee),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl({ jobRole: "Auxiliar" })], [live], employee),
    ).not.toBeNull();
    expect(
      applicableRiskAbsence([decl({ jobRole: "Soldador" })], [live], employee),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl({ gesId: "outro" })], [live], employee),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl()], [live], { gesId: null, jobRole: null }),
    ).toBeNull();
  });

  it("fonte substituída ou desatualizada → não vale; sem declaração → null (nunca presumida)", () => {
    expect(
      applicableRiskAbsence([decl()], [{ ...live, superseded: true }], employee),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl()], [{ ...live, freshness: "changed" }], employee),
    ).toBeNull();
    expect(applicableRiskAbsence([], [live], employee)).toBeNull();
    expect(sourceIsLive({ superseded: false, freshness: "external_reference" })).toBe(
      true,
    );
  });

  it("a mais recente prevalece", () => {
    const result = applicableRiskAbsence(
      [
        decl({ id: "old" }),
        decl({ id: "new", jobRole: "Auxiliar", declaredAt: "2026-10-05T10:00:00.000Z" }),
      ],
      [live],
      employee,
    );
    expect(result?.declarationId).toBe("new");
  });
});

describe("unmatchedRiskAbsenceJobRoles (NOB-112)", () => {
  const live = { id: S, superseded: false, freshness: "current" as const };
  const decl = (
    jobRole: string,
    overrides: Partial<RiskAbsenceDeclarationView> = {},
  ): RiskAbsenceDeclarationView => ({
    id: jobRole,
    sourceId: S,
    gesId: G,
    exposureGroup: "Administrativo",
    jobRole,
    justification: "x",
    declaredBy: "prof",
    declaredByName: null,
    declaredAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  });
  const employee = { gesId: G, jobRole: "Operador de empilhadeira" };

  it("lista as funções declaradas no GES que não são a função do funcionário (só explicação)", () => {
    expect(
      unmatchedRiskAbsenceJobRoles(
        [
          decl("Op. empilhadeira"),
          decl("operador de empilhadeira"),
          decl("Op. empilhadeira", { id: "dup" }),
        ],
        [live],
        employee,
      ),
    ).toEqual(["Op. empilhadeira", "operador de empilhadeira"]);
  });

  it("ignora grupo todo, função exata, outro GES, fonte não vigente e funcionário sem GES", () => {
    expect(
      unmatchedRiskAbsenceJobRoles(
        [
          decl(""),
          decl("Operador de empilhadeira"),
          decl("Outra", { gesId: "outro" }),
          decl("Antiga", { sourceId: "substituida" }),
        ],
        [live, { id: "substituida", superseded: true, freshness: "current" }],
        employee,
      ),
    ).toEqual([]);
    expect(
      unmatchedRiskAbsenceJobRoles([decl("Op.")], [live], { gesId: null, jobRole: "X" }),
    ).toEqual([]);
  });
});
