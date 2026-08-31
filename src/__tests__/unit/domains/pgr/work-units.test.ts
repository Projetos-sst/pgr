import { workUnitInputSchema } from "@/shared/domains/pgr/work-units";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

describe("workUnitInputSchema (US2)", () => {
  const base = { companyId: COMPANY_ID, name: "Canteiro 1", description: "Obra X" };

  it("aceita entrada mínima válida", () => {
    const parsed = workUnitInputSchema.parse(base);
    expect(parsed.companyId).toBe(COMPANY_ID);
    expect(parsed.name).toBe("Canteiro 1");
  });

  it.each(["name", "description"])("exige %s não-vazio", (field) => {
    expect(() => workUnitInputSchema.parse({ ...base, [field]: "  " })).toThrow();
  });

  it("exige companyId em formato uuid", () => {
    expect(() =>
      workUnitInputSchema.parse({ ...base, companyId: "not-a-uuid" }),
    ).toThrow();
  });

  it("normaliza endereço vazio para undefined", () => {
    expect(workUnitInputSchema.parse({ ...base, city: "" }).city).toBeUndefined();
  });

  it("status ausente assume 'active'; aceita tipo e datas", () => {
    expect(workUnitInputSchema.parse(base).status).toBe("active");
    const parsed = workUnitInputSchema.parse({
      ...base,
      type: "branch",
      status: "closed",
      startDate: "2026-01-01",
      expectedEndDate: "2026-06-30",
    });
    expect(parsed.type).toBe("branch");
    expect(parsed.status).toBe("closed");
    expect(parsed.startDate).toBe("2026-01-01");
  });

  it("datas vazias → undefined; data inválida → erro", () => {
    expect(
      workUnitInputSchema.parse({ ...base, startDate: "" }).startDate,
    ).toBeUndefined();
    expect(() =>
      workUnitInputSchema.parse({ ...base, startDate: "2026-13-45" }),
    ).toThrow();
  });

  it("rejeita tipo/status inválidos", () => {
    expect(() => workUnitInputSchema.parse({ ...base, type: "x" })).toThrow();
    expect(() => workUnitInputSchema.parse({ ...base, status: "x" })).toThrow();
  });
});
