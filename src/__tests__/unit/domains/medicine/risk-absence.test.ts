/**
 * Declaração de inexistência de riscos (NOB-156): quando pode ser feita e quando vale para o ASO.
 * Nunca a partir de cadastro vazio; só na versão vigente da fonte. Fictício.
 */
import {
  applicableRiskAbsence,
  declarationBlocker,
  riskAbsenceInputSchema,
  riskAbsenceJobRoleSchema,
  riskAbsenceMismatch,
  riskMatchesScope,
  sourceIsLive,
  type DeclarableSource,
  type RiskAbsenceDeclarationView,
  type RiskAbsenceEmployee,
} from "@/shared/domains/medicine/risk-absence";

const G = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
// Funções cadastradas (ids estáveis) fictícias.
const R_AUX = "33333333-3333-4333-8333-333333333331";
const R_SOLD = "33333333-3333-4333-8333-333333333332";
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
    expect(parsed.jobRoleId).toBeUndefined();
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

  it("função vai pelo id (NOB-112): vazio = grupo todo; id inválido ou texto livre → erro no campo", () => {
    const base = {
      sourceId: S,
      gesId: G,
      justification: "Justificativa técnica fictícia suficiente.",
    };
    expect(riskAbsenceInputSchema.parse({ ...base, jobRoleId: "" }).jobRoleId).toBe(
      undefined,
    );
    expect(riskAbsenceInputSchema.parse({ ...base, jobRoleId: R_AUX }).jobRoleId).toBe(
      R_AUX,
    );
    const fieldOf = (input: Record<string, unknown>) => {
      const result = riskAbsenceInputSchema.safeParse({ ...base, ...input });
      return result.success ? null : result.error.issues.map((i) => i.path.join("."));
    };
    expect(fieldOf({ jobRoleId: "Auxiliar" })).toEqual(["jobRoleId"]);
    // O texto da função não é mais aceito: renomear a função quebrava a declaração.
    const text = riskAbsenceInputSchema.safeParse({ ...base, jobRole: "Auxiliar" });
    expect(text.success).toBe(false);
    expect(text.error?.issues[0]).toMatchObject({
      path: ["jobRole"],
      message: expect.stringMatching(/jobRoleId/),
    });
  });
});

describe("riskAbsenceJobRoleSchema (NOB-112)", () => {
  // Títulos que só mudam a caixa são funções diferentes no cadastro: o id distingue.
  const linked = [
    { jobRoleId: R_AUX, title: "Operador de empilhadeira" },
    { jobRoleId: R_SOLD, title: "OPERADOR DE EMPILHADEIRA" },
  ];
  const parse = (jobRoleId: string | undefined, list = linked) =>
    riskAbsenceJobRoleSchema(list).safeParse({ jobRoleId });

  it("sem id = grupo todo, sem conferência", () => {
    expect(parse(undefined).data).toEqual({ jobRoleId: null, jobRole: "" });
    expect(parse(undefined, []).data).toEqual({ jobRoleId: null, jobRole: "" });
  });

  it("id de função vinculada ao GES → id e título atual (texto histórico)", () => {
    expect(parse(R_AUX).data).toEqual({
      jobRoleId: R_AUX,
      jobRole: "Operador de empilhadeira",
    });
    expect(parse(R_SOLD).data).toEqual({
      jobRoleId: R_SOLD,
      jobRole: "OPERADOR DE EMPILHADEIRA",
    });
  });

  it("id fora das funções do GES (outro GES, empresa ou tenant) → erro no campo jobRoleId", () => {
    const result = parse("33333333-3333-4333-8333-333333333399");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["jobRoleId"],
      message: expect.stringMatching(/não encontrada entre as funções/),
    });
    expect(parse(R_AUX, []).success).toBe(false);
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

describe("applicableRiskAbsence (id da função, NOB-112)", () => {
  const decl = (
    overrides: Partial<RiskAbsenceDeclarationView> = {},
  ): RiskAbsenceDeclarationView => ({
    id: "d1",
    sourceId: S,
    gesId: G,
    exposureGroup: "Administrativo",
    jobRole: "",
    jobRoleId: null,
    currentJobRole: null,
    justification: "x",
    declaredBy: "prof",
    declaredByName: "Profissional Fictícia",
    declaredAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  });
  const auxiliar = { jobRole: "Auxiliar", jobRoleId: R_AUX, currentJobRole: "Auxiliar" };
  const live = {
    id: S,
    title: "PGR",
    version: "1",
    superseded: false,
    freshness: "current" as const,
  };
  const employee: RiskAbsenceEmployee = {
    gesId: G,
    jobRoleId: R_AUX,
    gesJobRoleIds: [R_AUX, R_SOLD],
  };

  it("grupo todo vale para o GES do funcionário, na fonte vigente", () => {
    expect(applicableRiskAbsence([decl()], [live], employee)).toMatchObject({
      declarationId: "d1",
      source: { id: S, title: "PGR", version: "1" },
    });
    expect(
      applicableRiskAbsence([decl({ gesId: "outro" })], [live], employee),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl()], [live], { ...employee, gesId: null }),
    ).toBeNull();
  });

  it("função casa pelo id: renomeada depois da declaração continua valendo, com o título declarado", () => {
    const renamed = decl({ ...auxiliar, currentJobRole: "Auxiliar de escritório" });
    expect(applicableRiskAbsence([renamed], [live], employee)).toMatchObject({
      declarationId: "d1",
      jobRole: "Auxiliar",
    });
  });

  it("outra função, funcionário trocado de função ou função desvinculada do GES → não vale", () => {
    expect(
      applicableRiskAbsence(
        [decl({ jobRole: "Soldador", jobRoleId: R_SOLD })],
        [live],
        employee,
      ),
    ).toBeNull();
    // Mesmo título, outra função cadastrada (id diferente) → não vale.
    expect(
      applicableRiskAbsence(
        [decl({ ...auxiliar, jobRoleId: "33333333-3333-4333-8333-333333333398" })],
        [live],
        employee,
      ),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl(auxiliar)], [live], { ...employee, jobRoleId: R_SOLD }),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl(auxiliar)], [live], { ...employee, jobRoleId: null }),
    ).toBeNull();
    expect(
      applicableRiskAbsence([decl(auxiliar)], [live], {
        ...employee,
        gesJobRoleIds: [R_SOLD],
      }),
    ).toBeNull();
  });

  it("declaração antiga só com texto (sem id) nunca vale, nem com o título idêntico (fail closed)", () => {
    expect(
      applicableRiskAbsence([decl({ jobRole: "Auxiliar" })], [live], employee),
    ).toBeNull();
  });

  it("fonte substituída ou desatualizada → não vale; sem declaração → null (nunca presumida)", () => {
    expect(
      applicableRiskAbsence([decl(auxiliar)], [{ ...live, superseded: true }], employee),
    ).toBeNull();
    expect(
      applicableRiskAbsence(
        [decl(auxiliar)],
        [{ ...live, freshness: "changed" }],
        employee,
      ),
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
        decl({ id: "new", ...auxiliar, declaredAt: "2026-10-05T10:00:00.000Z" }),
      ],
      [live],
      employee,
    );
    expect(result?.declarationId).toBe("new");
  });
});

describe("riskAbsenceMismatch (NOB-112)", () => {
  const live = { id: S, superseded: false, freshness: "current" as const };
  const decl = (
    overrides: Partial<RiskAbsenceDeclarationView>,
  ): RiskAbsenceDeclarationView => ({
    id: "d",
    sourceId: S,
    gesId: G,
    exposureGroup: "Administrativo",
    jobRole: "",
    jobRoleId: null,
    currentJobRole: null,
    justification: "x",
    declaredBy: "prof",
    declaredByName: null,
    declaredAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  });
  const employee: RiskAbsenceEmployee = {
    gesId: G,
    jobRoleId: R_AUX,
    gesJobRoleIds: [R_AUX, R_SOLD],
  };

  it("separa outra função (título atual), legado só com texto e função desvinculada do GES", () => {
    expect(
      riskAbsenceMismatch(
        [
          decl({ jobRole: "Soldador", jobRoleId: R_SOLD, currentJobRole: "Soldador II" }),
          decl({ jobRole: "Op. auxiliar" }),
          decl({ jobRole: "auxiliar" }),
          decl({ jobRole: "Op. auxiliar", id: "dup" }),
        ],
        [live],
        employee,
      ),
    ).toEqual({
      otherJobRoles: ["Soldador II"],
      legacyJobRoles: ["Op. auxiliar", "auxiliar"],
      jobRoleUnlinked: false,
    });
    expect(
      riskAbsenceMismatch(
        [decl({ jobRole: "Auxiliar", jobRoleId: R_AUX, currentJobRole: "Auxiliar" })],
        [live],
        { ...employee, gesJobRoleIds: [R_SOLD] },
      ),
    ).toEqual({ otherJobRoles: [], legacyJobRoles: [], jobRoleUnlinked: true });
  });

  it("ignora o que vale (grupo todo, função do funcionário), outro GES, fonte não vigente e funcionário sem GES", () => {
    const none = { otherJobRoles: [], legacyJobRoles: [], jobRoleUnlinked: false };
    expect(
      riskAbsenceMismatch(
        [
          decl({}),
          decl({ jobRole: "Auxiliar", jobRoleId: R_AUX, currentJobRole: "Auxiliar" }),
          decl({ jobRole: "Outra", gesId: "outro" }),
          decl({ jobRole: "Antiga", sourceId: "substituida" }),
        ],
        [live, { id: "substituida", superseded: true, freshness: "current" }],
        employee,
      ),
    ).toEqual(none);
    expect(
      riskAbsenceMismatch([decl({ jobRole: "Op." })], [live], {
        ...employee,
        gesId: null,
      }),
    ).toEqual(none);
  });
});
