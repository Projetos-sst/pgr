import {
  EPI_NEUTRALIZATION_ORDER,
  epiNeutralizationLabel,
  epiNeutralizationSchema,
  epiRiskLinkInputSchema,
  epiRiskLinkUpdateSchema,
} from "@/shared/domains/pgr/epi-risk";

const RISK_ID = "11111111-1111-1111-1111-1111111111d1";
const CATALOG_ID = "11111111-1111-1111-1111-1111111111a7";

describe("domains/pgr/epi-risk", () => {
  describe("epiNeutralizationSchema", () => {
    it("aceita os 3 estados", () => {
      for (const value of EPI_NEUTRALIZATION_ORDER) {
        expect(epiNeutralizationSchema.parse(value)).toBe(value);
      }
    });

    it("rejeita valor fora do enum", () => {
      expect(() => epiNeutralizationSchema.parse("maybe")).toThrow();
    });
  });

  describe("epiNeutralizationLabel", () => {
    it("mapeia para rótulos pt-BR (Sim / Não / Não Aplicável)", () => {
      expect(epiNeutralizationLabel("neutralizes")).toBe("Sim");
      expect(epiNeutralizationLabel("does_not_neutralize")).toBe("Não");
      expect(epiNeutralizationLabel("not_applicable")).toBe("Não Aplicável");
    });
  });

  describe("epiRiskLinkInputSchema", () => {
    it("aceita corpo válido", () => {
      const parsed = epiRiskLinkInputSchema.parse({
        riskId: RISK_ID,
        catalogId: CATALOG_ID,
        neutralization: "neutralizes",
      });
      expect(parsed.neutralization).toBe("neutralizes");
    });

    it("neutralização é obrigatória", () => {
      const result = epiRiskLinkInputSchema.safeParse({
        riskId: RISK_ID,
        catalogId: CATALOG_ID,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.join(".") === "neutralization"),
        ).toBe(true);
      }
    });

    it("rejeita uuid inválido de risco/EPI", () => {
      expect(
        epiRiskLinkInputSchema.safeParse({
          riskId: "nope",
          catalogId: CATALOG_ID,
          neutralization: "neutralizes",
        }).success,
      ).toBe(false);
    });
  });

  describe("epiRiskLinkUpdateSchema", () => {
    it("exige apenas a neutralização", () => {
      expect(epiRiskLinkUpdateSchema.parse({ neutralization: "not_applicable" })).toEqual(
        {
          neutralization: "not_applicable",
        },
      );
    });

    it("rejeita neutralização ausente/inválida", () => {
      expect(epiRiskLinkUpdateSchema.safeParse({}).success).toBe(false);
      expect(epiRiskLinkUpdateSchema.safeParse({ neutralization: "x" }).success).toBe(
        false,
      );
    });
  });
});
