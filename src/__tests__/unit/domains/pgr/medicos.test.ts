import { medicoInputSchema } from "@/shared/domains/pgr/medicos";

describe("medicoInputSchema", () => {
  const base = { name: "Dra. Helena Marques", crm: "CRM 12.345/MA" };

  it("aceita entrada mínima válida (status default active, opcionais undefined)", () => {
    const parsed = medicoInputSchema.parse(base);
    expect(parsed.name).toBe("Dra. Helena Marques");
    expect(parsed.crm).toBe("CRM 12.345/MA");
    expect(parsed.status).toBe("active");
    expect(parsed.specialty).toBeUndefined();
    expect(parsed.clinic).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });

  it("aceita campos opcionais e status inactive", () => {
    const parsed = medicoInputSchema.parse({
      ...base,
      specialty: "Medicina do Trabalho",
      clinic: "Clínica SanaVida",
      phone: "(98) 3232-1010",
      status: "inactive",
    });
    expect(parsed.specialty).toBe("Medicina do Trabalho");
    expect(parsed.clinic).toBe("Clínica SanaVida");
    expect(parsed.phone).toBe("(98) 3232-1010");
    expect(parsed.status).toBe("inactive");
  });

  it("exige nome não-vazio (após trim)", () => {
    expect(() => medicoInputSchema.parse({ ...base, name: "  " })).toThrow();
    expect(() => medicoInputSchema.parse({ crm: base.crm })).toThrow();
  });

  it("exige CRM não-vazio (após trim)", () => {
    expect(() => medicoInputSchema.parse({ ...base, crm: "  " })).toThrow();
    expect(() => medicoInputSchema.parse({ name: base.name })).toThrow();
  });

  it("rejeita status fora de active|inactive", () => {
    expect(() => medicoInputSchema.parse({ ...base, status: "banned" })).toThrow();
  });

  it("trata opcionais vazios/espaços como undefined", () => {
    const parsed = medicoInputSchema.parse({
      ...base,
      specialty: "   ",
      clinic: "",
      phone: "  ",
    });
    expect(parsed.specialty).toBeUndefined();
    expect(parsed.clinic).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });
});
