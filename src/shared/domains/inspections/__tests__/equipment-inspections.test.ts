import {
  checklistSchema,
  equipmentInspectionHeaderSchema,
  toEquipmentInspectionListItem,
} from "@/shared/domains/inspections/equipment-inspections";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("equipmentInspectionHeaderSchema", () => {
  it("aceita cabeçalho válido (sem campos veiculares)", () => {
    const parsed = equipmentInspectionHeaderSchema.parse({
      equipmentCatalogId: UUID,
      planId: UUID,
      inspectedAt: "2026-07-15",
      responsible: "Marcos",
    });
    expect(parsed.equipmentCatalogId).toBe(UUID);
    expect(parsed.responsible).toBe("Marcos");
  });

  it("rejeita equipmentCatalogId não-uuid e data inválida", () => {
    expect(() =>
      equipmentInspectionHeaderSchema.parse({
        equipmentCatalogId: "nope",
        planId: UUID,
        inspectedAt: "2026-07-15",
      }),
    ).toThrow();
    expect(() =>
      equipmentInspectionHeaderSchema.parse({
        equipmentCatalogId: UUID,
        planId: UUID,
        inspectedAt: "07-2026",
      }),
    ).toThrow();
  });
});

describe("checklist reutilizado + projeção", () => {
  it("checklist tri-state disponível no módulo de equipamento", () => {
    expect(checklistSchema.parse({}).responses).toEqual([]);
    expect(
      checklistSchema.parse({ responses: [{ planItemId: UUID, value: null }] })
        .responses[0].value,
    ).toBeNull();
  });

  it("projeta linha da listagem de equipamento", () => {
    expect(
      toEquipmentInspectionListItem({
        id: "e1",
        inspectedAt: "2026-07-15",
        status: "in_progress",
        equipmentName: "Betoneira",
        planTitle: "Plano equip",
        responsible: "Léo",
      }),
    ).toEqual({
      id: "e1",
      inspectedAt: "2026-07-15",
      status: "in_progress",
      statusLabel: "Em andamento",
      equipmentName: "Betoneira",
      planTitle: "Plano equip",
      responsible: "Léo",
    });
  });
});
