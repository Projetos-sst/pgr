/**
 * NOB-111 — regras do PGR externo: proveniência, código do agente nocivo informado na origem,
 * situação da fonte derivada dos riscos e rótulo da origem no PCMSO. Fictício.
 */
import { agentCodeOf, buildExamProposal } from "@/shared/domains/medicine/exam-proposal";
import { riskBasisOrigin } from "@/shared/domains/medicine/pcmso-composition";
import {
  medicalSourceInputSchema,
  medicalSourceStatus,
  medicalSourceWarnings,
  riskOriginLabel,
} from "@/shared/domains/medicine/risk-sources";

const external = (o: Record<string, unknown> = {}) => ({
  kind: "external",
  title: "PGR externo fictício",
  version: "Rev. 1",
  reference: "GED: PGR externo fictício rev. 1",
  risks: [{ agentType: "physical", description: "Ruído", exposureGroup: "Produção" }],
  ...o,
});

describe("cadastro do PGR externo", () => {
  it("aceita proveniência e código no formato da Tabela 24; recusa formato, datas incoerentes e referência vazia de sentido", () => {
    expect(
      medicalSourceInputSchema.safeParse(
        external({
          documentDate: "2026-08-01",
          preparedBy: "Eng. Fictício",
          reviewDueOn: "2028-08-01",
          risks: [
            {
              agentType: "physical",
              description: "Ruído",
              exposureGroup: "Produção",
              noxiousAgentCode: "02.01.001",
            },
          ],
        }),
      ).success,
    ).toBe(true);
    for (const bad of [
      external({ reference: "PGR" }),
      external({ documentDate: "01/08/2026" }),
      external({ documentDate: "2026-08-01", reviewDueOn: "2026-07-01" }),
      external({
        risks: [
          {
            agentType: "physical",
            description: "R",
            exposureGroup: "P",
            noxiousAgentCode: "2.1.1",
          },
        ],
      }),
      external({
        risks: [
          {
            agentType: "physical",
            description: "R",
            exposureGroup: "P",
            status: "validated",
          },
        ],
      }),
    ])
      expect(medicalSourceInputSchema.safeParse(bad).success).toBe(false);
  });
});

describe("código do agente nocivo", () => {
  it("o código informado no risco externo vale; sem ele, o do inventário interno; nenhum é inventado", () => {
    const base = { agentType: "physical" as const, description: "R", exposureGroup: "P" };
    expect(agentCodeOf({ ...base, noxiousAgentCode: "02.01.001" })).toBe("02.01.001");
    expect(
      agentCodeOf({
        ...base,
        originalData: { inventory: { noxious_agent_code: "01.18.001" } },
      }),
    ).toBe("01.18.001");
    expect(agentCodeOf(base)).toBeNull();
  });

  it("risco externo validado com código tem sugestão; sem código, o coordenador define", () => {
    const proposal = buildExamProposal([
      {
        id: "s1",
        kind: "external",
        title: "PGR externo",
        version: "1",
        reference: "GED: x",
        freshness: "external_reference",
        superseded: false,
        risks: [
          {
            id: "r1",
            status: "validated",
            content: {
              agentType: "physical",
              description: "Ruído",
              exposureGroup: "Produção",
              noxiousAgentCode: "02.01.001",
            },
          },
          {
            id: "r2",
            status: "validated",
            content: {
              agentType: "ergonomic",
              description: "Postura",
              exposureGroup: "Escritório",
            },
          },
        ],
      },
    ]);
    const prod = proposal.groups.find((g) => g.exposureGroup === "Produção")!;
    expect(prod.suggestions.length).toBeGreaterThan(0);
    const office = proposal.groups.find((g) => g.exposureGroup === "Escritório")!;
    expect(office.suggestions).toHaveLength(0);
    expect(office.withoutRule[0].reason).toMatch(/coordenador define/);
  });
});

describe("situação da fonte e origem", () => {
  it("derivada dos riscos, nunca presumida", () => {
    expect(medicalSourceStatus([], "external_reference")).toBe(
      "registered_without_risks",
    );
    expect(medicalSourceStatus(["validated", "pending"], "external_reference")).toBe(
      "awaiting_validation",
    );
    expect(medicalSourceStatus(["validated", "rejected"], "external_reference")).toBe(
      "validated",
    );
    expect(medicalSourceStatus(["rejected"], "external_reference")).toBe("rejected");
    expect(medicalSourceStatus(["validated"], "superseded")).toBe("superseded");
    expect(medicalSourceStatus(["validated"], "changed")).toBe("origin_changed");
  });

  it("avisos: sem data do documento e data de revisão vencida", () => {
    const w = medicalSourceWarnings(1, 0, "external_reference", {
      documentDate: null,
      reviewDueOn: "2025-01-01",
      today: "2026-11-05",
    });
    expect(w.join(" ")).toMatch(/Data do documento externo não informada/);
    expect(w.join(" ")).toMatch(
      /data de revisão informada no PGR externo \(2025-01-01\)/,
    );
  });

  it("rótulo da origem no PCMSO: interno, externo validado; externo sem risco validado não é 'validado'", () => {
    expect(riskOriginLabel("internal")).toBe("PGR interno");
    expect(riskOriginLabel("external")).toBe("PGR externo validado");
    const src = (origin: string, validatedRisks: number) => ({
      id: origin,
      kind: "external",
      origin,
      title: "t",
      version: "1",
      validatedRisks,
    });
    expect(riskBasisOrigin([src("PGR interno", 2), src("PGR externo validado", 1)])).toBe(
      "PGR interno e PGR externo validado",
    );
    expect(riskBasisOrigin([src("PGR externo sem risco validado", 0)])).toBe(
      "Nenhuma fonte com risco validado",
    );
  });
});
