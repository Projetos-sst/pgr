import {
  vehicleInputSchema,
  vehicleTypeLabel,
} from "@/shared/domains/inspections/vehicles";

describe("vehicleInputSchema — placa", () => {
  it("aceita placa legado (AAA-0000) e normaliza", () => {
    const r = vehicleInputSchema.safeParse({ plate: "abc-1234", initialKm: "0" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.plate).toBe("ABC1234");
  });

  it("aceita placa Mercosul (AAA0A00)", () => {
    expect(vehicleInputSchema.safeParse({ plate: "ABC1D23" }).success).toBe(true);
  });

  it("rejeita placa inválida", () => {
    expect(vehicleInputSchema.safeParse({ plate: "12345" }).success).toBe(false);
  });

  it("KM inicial negativo → erro; default 0", () => {
    expect(
      vehicleInputSchema.safeParse({ plate: "ABC1234", initialKm: "-5" }).success,
    ).toBe(false);
    const ok = vehicleInputSchema.safeParse({ plate: "ABC1234" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.initialKm).toBe(0);
  });
});

describe("vehicleTypeLabel", () => {
  it("rotula em pt-BR; nulo → —", () => {
    expect(vehicleTypeLabel("truck")).toBe("Caminhão");
    expect(vehicleTypeLabel(null)).toBe("—");
  });
});
