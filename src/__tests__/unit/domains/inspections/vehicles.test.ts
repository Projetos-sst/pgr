import {
  classifyVehicleInspection,
  inspectionFrequencyLabel,
  toVehicleListItem,
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

describe("vehicleInputSchema — campos do redesign", () => {
  it("aceita renavam, ano, empresa, unidade, plano e frequência", () => {
    const r = vehicleInputSchema.safeParse({
      plate: "ABC1D23",
      renavam: "12345678901",
      year: "2022",
      companyId: "11111111-1111-1111-1111-111111111111",
      workUnitId: "22222222-2222-2222-2222-222222222222",
      inspectionPlanId: "33333333-3333-3333-3333-333333333333",
      inspectionFrequency: "daily",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.year).toBe(2022);
      expect(r.data.inspectionFrequency).toBe("daily");
      expect(r.data.companyId).toBe("11111111-1111-1111-1111-111111111111");
    }
  });

  it("rejeita ano fora do intervalo e frequência inválida", () => {
    expect(vehicleInputSchema.safeParse({ plate: "ABC1234", year: "1800" }).success).toBe(
      false,
    );
    expect(
      vehicleInputSchema.safeParse({ plate: "ABC1234", inspectionFrequency: "hourly" })
        .success,
    ).toBe(false);
  });
});

describe("inspectionFrequencyLabel", () => {
  it("rotula em pt-BR; nulo → —", () => {
    expect(inspectionFrequencyLabel("daily")).toBe("Diária");
    expect(inspectionFrequencyLabel("annual")).toBe("Anual");
    expect(inspectionFrequencyLabel(null)).toBe("—");
  });
});

describe("classifyVehicleInspection (derivação do Status)", () => {
  const today = "2026-06-20";

  it("sem inspeção → none (Sem inspeção)", () => {
    expect(
      classifyVehicleInspection({ lastInspectedAt: null, frequency: "monthly" }, today)
        .status,
    ).toBe("none");
  });

  it("com inspeção e sem frequência → regular (sem vencimento a cobrar)", () => {
    const r = classifyVehicleInspection(
      { lastInspectedAt: "2026-01-01", frequency: null },
      today,
    );
    expect(r.status).toBe("regular");
    expect(r.nextDueAt).toBeNull();
  });

  it("mensal: dentro do prazo → regular; próximo do vencimento → due_soon; vencido → expired", () => {
    // last + 30 dias = próximo vencimento
    expect(
      classifyVehicleInspection(
        { lastInspectedAt: "2026-06-10", frequency: "monthly" },
        today,
      ).status,
    ).toBe("regular"); // vence 2026-07-10, faltam 20 dias
    expect(
      classifyVehicleInspection(
        { lastInspectedAt: "2026-05-25", frequency: "monthly" },
        today,
      ).status,
    ).toBe("due_soon"); // vence 2026-06-24, dentro de 7 dias
    expect(
      classifyVehicleInspection(
        { lastInspectedAt: "2026-04-01", frequency: "monthly" },
        today,
      ).status,
    ).toBe("expired"); // vence 2026-05-01, já passou
  });
});

describe("toVehicleListItem", () => {
  it("deriva companyName e status de inspeção", () => {
    const item = toVehicleListItem(
      {
        id: "v1",
        plate: "ABC1D23",
        brand: "VW",
        model: "Constellation",
        type: "truck",
        year: 2022,
        owner: null,
        initialKm: 0,
        companyName: "Kairós Motores",
        lastInspectedAt: "2026-04-01",
        inspectionFrequency: "monthly",
      },
      "2026-06-20",
    );
    expect(item.companyName).toBe("Kairós Motores");
    expect(item.typeLabel).toBe("Caminhão");
    expect(item.inspectionStatus).toBe("expired");
    expect(item.inspectionStatusLabel).toBe("Vencida");
  });
});
