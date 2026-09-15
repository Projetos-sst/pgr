import {
  checkFrequencyLabel,
  esocialConfigInputSchema,
  esocialEnvironmentLabel,
} from "@/shared/domains/esocial/config";

describe("esocial config — domain", () => {
  describe("esocialEnvironmentLabel", () => {
    it("rotula ambientes", () => {
      expect(esocialEnvironmentLabel("production")).toBe("Produção");
      expect(esocialEnvironmentLabel("homologation")).toBe("Homologação");
    });
  });

  describe("checkFrequencyLabel", () => {
    it("formata horas e dias", () => {
      expect(checkFrequencyLabel(1)).toBe("A cada 1 hora");
      expect(checkFrequencyLabel(6)).toBe("A cada 6 horas");
      expect(checkFrequencyLabel(24)).toBe("A cada 24 horas (diário)");
      expect(checkFrequencyLabel(48)).toBe("A cada 2 dias");
    });
  });

  describe("esocialConfigInputSchema", () => {
    it("aceita config mínima e aplica defaults", () => {
      const parsed = esocialConfigInputSchema.parse({ environment: "production" });
      expect(parsed.environment).toBe("production");
      expect(parsed.autoSend).toBe(false);
      expect(parsed.enabledEvents).toEqual([]);
    });

    it("filtra códigos de evento inválidos e mantém os válidos", () => {
      const parsed = esocialConfigInputSchema.parse({
        environment: "homologation",
        enabledEvents: ["S-2210", "S-9999", "S-2240"],
      });
      expect(parsed.enabledEvents).toEqual(["S-2210", "S-2240"]);
    });

    it("coage frequência e rejeita valores inválidos", () => {
      const ok = esocialConfigInputSchema.parse({
        environment: "production",
        checkFrequencyHours: "12",
      });
      expect(ok.checkFrequencyHours).toBe(12);

      const zero = esocialConfigInputSchema.safeParse({
        environment: "production",
        checkFrequencyHours: 0,
      });
      expect(zero.success).toBe(false);

      const tooBig = esocialConfigInputSchema.safeParse({
        environment: "production",
        checkFrequencyHours: 1000,
      });
      expect(tooBig.success).toBe(false);
    });

    it("rejeita ambiente fora do enum", () => {
      const r = esocialConfigInputSchema.safeParse({ environment: "staging" });
      expect(r.success).toBe(false);
    });

    it("string vazia em campos opcionais vira undefined", () => {
      const parsed = esocialConfigInputSchema.parse({
        environment: "production",
        employerCnpj: "",
        certificateName: "",
        certificateExpiresAt: "",
      });
      expect(parsed.employerCnpj).toBeUndefined();
      expect(parsed.certificateName).toBeUndefined();
      expect(parsed.certificateExpiresAt).toBeUndefined();
    });
  });
});
