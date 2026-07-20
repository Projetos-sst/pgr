import {
  INSPECTION_STATUS_LABELS,
  checklistSchema,
  inspectionStatusLabel,
  itemResponseSchema,
  toVehicularInspectionListItem,
  vehicularInspectionHeaderSchema,
} from "@/shared/domains/inspections/vehicular-inspections";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("vehicularInspectionHeaderSchema", () => {
  it("aceita cabeçalho válido e coage currentKm", () => {
    const parsed = vehicularInspectionHeaderSchema.parse({
      vehicleId: UUID,
      planId: UUID,
      inspectedAt: "2026-07-15",
      responsible: "João",
      currentKm: "12000",
    });
    expect(parsed.currentKm).toBe(12000);
    expect(parsed.responsible).toBe("João");
  });

  it("rejeita data em formato inválido", () => {
    expect(() =>
      vehicularInspectionHeaderSchema.parse({
        vehicleId: UUID,
        planId: UUID,
        inspectedAt: "15/07/2026",
      }),
    ).toThrow();
  });

  it("rejeita currentKm negativo e vehicleId não-uuid", () => {
    expect(() =>
      vehicularInspectionHeaderSchema.parse({
        vehicleId: UUID,
        planId: UUID,
        inspectedAt: "2026-07-15",
        currentKm: "-5",
      }),
    ).toThrow();
    expect(() =>
      vehicularInspectionHeaderSchema.parse({
        vehicleId: "nope",
        planId: UUID,
        inspectedAt: "2026-07-15",
      }),
    ).toThrow();
  });
});

describe("checklistSchema / itemResponseSchema", () => {
  it("value tri-state: true, false e null", () => {
    for (const value of [true, false, null]) {
      expect(itemResponseSchema.parse({ planItemId: UUID, value }).value).toBe(value);
    }
  });

  it("responses default para lista vazia", () => {
    expect(checklistSchema.parse({}).responses).toEqual([]);
  });
});

describe("labels e projeção", () => {
  it("rótulos de status", () => {
    expect(inspectionStatusLabel("in_progress")).toBe(
      INSPECTION_STATUS_LABELS.in_progress,
    );
    expect(inspectionStatusLabel("completed")).toBe("Concluída");
    expect(inspectionStatusLabel("xyz")).toBe("xyz");
  });

  it("projeta linha da listagem", () => {
    expect(
      toVehicularInspectionListItem({
        id: "i1",
        inspectedAt: "2026-07-15",
        status: "completed",
        vehiclePlate: "ABC1D23",
        planTitle: "Plano",
        responsible: "Ana",
      }),
    ).toEqual({
      id: "i1",
      inspectedAt: "2026-07-15",
      status: "completed",
      statusLabel: "Concluída",
      vehiclePlate: "ABC1D23",
      planTitle: "Plano",
      responsible: "Ana",
    });
  });
});
