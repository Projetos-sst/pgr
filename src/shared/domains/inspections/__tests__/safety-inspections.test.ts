import {
  inspectionCategoryLabel,
  occurrenceSeverityLabel,
  occurrencesSchema,
  safetyInspectionHeaderSchema,
  toSafetyInspectionListItem,
} from "@/shared/domains/inspections/safety-inspections";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("safetyInspectionHeaderSchema", () => {
  it("aceita cabeçalho válido; planned coage; company opcional", () => {
    const parsed = safetyInspectionHeaderSchema.parse({
      category: "safety",
      inspectedAt: "2026-07-15",
      planned: "on",
      area: "Almoxarifado",
    });
    expect(parsed.planned).toBe(true);
    expect(parsed.companyId).toBeUndefined();
  });

  it("aceita companyId null e rejeita categoria inválida", () => {
    expect(
      safetyInspectionHeaderSchema.parse({
        category: "environment",
        inspectedAt: "2026-07-15",
        companyId: null,
      }).companyId,
    ).toBeNull();
    expect(() =>
      safetyInspectionHeaderSchema.parse({ category: "xyz", inspectedAt: "2026-07-15" }),
    ).toThrow();
  });
});

describe("occurrencesSchema", () => {
  it("severidade tri-opções + null; exige descrição", () => {
    const parsed = occurrencesSchema.parse({
      occurrences: [
        { description: "Piso escorregadio", severity: "high" },
        { description: "Sinalização", severity: null },
        { description: "Sem severidade" },
      ],
    });
    expect(parsed.occurrences).toHaveLength(3);
    expect(parsed.occurrences[1].severity).toBeNull();
    expect(parsed.occurrences[2].severity).toBeNull();
    expect(() =>
      occurrencesSchema.parse({ occurrences: [{ description: "  ", severity: "low" }] }),
    ).toThrow();
  });
});

describe("labels e projeção", () => {
  it("rótulos de categoria e severidade", () => {
    expect(inspectionCategoryLabel("health")).toBe("Saúde");
    expect(inspectionCategoryLabel(null)).toBe("—");
    expect(occurrenceSeverityLabel("medium")).toBe("Média");
    expect(occurrenceSeverityLabel(null)).toBe("—");
  });

  it("projeta linha da listagem", () => {
    expect(
      toSafetyInspectionListItem({
        id: "s1",
        inspectedAt: "2026-07-15",
        status: "completed",
        category: "safety",
        area: "Pátio",
        companyName: "ACME",
        occurrenceCount: 2,
      }),
    ).toMatchObject({
      id: "s1",
      statusLabel: "Concluída",
      categoryLabel: "Segurança",
      occurrenceCount: 2,
    });
  });
});

describe("registro do target de assinatura", () => {
  it("inspection está no registry de assinaturas", async () => {
    const { isSignatureTargetType, getPayloadSchema } =
      await import("@/shared/domains/signatures/contract");
    expect(isSignatureTargetType("inspection")).toBe(true);
    const schema = getPayloadSchema("inspection");
    const parsed = schema.parse({ title: "Inspeção" }) as { title: string };
    expect(parsed.title).toBe("Inspeção");
    void UUID;
  });
});
