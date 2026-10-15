import {
  formatPsychosocialFactorCode,
  nextPsychosocialFactorNumber,
  psychosocialFactorStatusLabel,
  psychosocialFactorStatusTone,
  psychosocialRiskFactorInputSchema,
  psychosocialRiskLevelLabel,
  psychosocialRiskLevelTone,
} from "@/shared/domains/psychosocial/risk-factors";

const GES_ID = "11111111-1111-1111-1111-1111111111a2";

describe("psychosocial risk factors — domain", () => {
  describe("nextPsychosocialFactorNumber", () => {
    it("começa em 1 quando não há registros", () => {
      expect(nextPsychosocialFactorNumber(null)).toBe(1);
      expect(nextPsychosocialFactorNumber(undefined)).toBe(1);
    });
    it("incrementa o máximo atual", () => {
      expect(nextPsychosocialFactorNumber(6)).toBe(7);
    });
    it("ignora valores inválidos", () => {
      expect(nextPsychosocialFactorNumber(-3)).toBe(1);
      expect(nextPsychosocialFactorNumber(Number.NaN)).toBe(1);
    });
  });

  describe("formatPsychosocialFactorCode", () => {
    it("formata com 2 dígitos (PS-07)", () => {
      expect(formatPsychosocialFactorCode(7)).toBe("PS-07");
      expect(formatPsychosocialFactorCode(11)).toBe("PS-11");
    });
    it("cresce além de 2 dígitos", () => {
      expect(formatPsychosocialFactorCode(123)).toBe("PS-123");
    });
  });

  describe("rótulos e tons", () => {
    it("nível → rótulo e tom", () => {
      expect(psychosocialRiskLevelLabel("high")).toBe("Alto");
      expect(psychosocialRiskLevelTone("high")).toBe("red");
      expect(psychosocialRiskLevelTone("medium")).toBe("amber");
      expect(psychosocialRiskLevelTone("low")).toBe("green");
    });
    it("situação → rótulo e tom", () => {
      expect(psychosocialFactorStatusLabel("in_action")).toBe("Em ação");
      expect(psychosocialFactorStatusTone("in_action")).toBe("indigo");
      expect(psychosocialFactorStatusTone("controlled")).toBe("neutral");
    });
  });

  describe("psychosocialRiskFactorInputSchema", () => {
    it("status assume 'monitored' por padrão", () => {
      const parsed = psychosocialRiskFactorInputSchema.parse({
        name: "Sobrecarga",
        gesId: GES_ID,
        level: "high",
      });
      expect(parsed.status).toBe("monitored");
    });
    it("rejeita nível inválido", () => {
      const r = psychosocialRiskFactorInputSchema.safeParse({
        name: "X",
        gesId: GES_ID,
        level: "critical",
      });
      expect(r.success).toBe(false);
    });
    it("assessmentMethod vazio vira undefined", () => {
      const parsed = psychosocialRiskFactorInputSchema.parse({
        name: "Sobrecarga",
        gesId: GES_ID,
        level: "low",
        assessmentMethod: "",
      });
      expect(parsed.assessmentMethod).toBeUndefined();
    });
  });
});
