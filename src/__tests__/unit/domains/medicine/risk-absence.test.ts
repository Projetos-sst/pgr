/**
 * Declaração de inexistência de riscos (NOB-156): quando pode ser feita e quando vale para o ASO.
 * Nunca a partir de cadastro vazio; só na versão vigente da fonte. Fictício.
 */
import {
  applicableRiskAbsence,
  declarationBlocker,
  riskAbsenceInputSchema,
  riskMatchesScope,
  sourceIsLive,
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
    expect(
      applicableRiskAbsence([decl({ jobRole: "auxiliar" })], [live], employee),
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
