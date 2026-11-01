import { medicoInputSchema } from "@/shared/domains/pgr/medicos";

describe("medicoInputSchema", () => {
  const base = {
    name: "Dra. Helena Marques",
    crm: "CRM 12.345/MA",
    registrationUf: "MA",
  };

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

  it("padroniza categoria médico e vínculo interno; normaliza a UF", () => {
    const parsed = medicoInputSchema.parse({ ...base, registrationUf: " ma " });
    expect(parsed).toMatchObject({
      profession: "physician",
      affiliation: "internal",
      registrationUf: "MA",
    });
    expect(parsed.rqe).toBeUndefined();
  });

  it("exige UF válida do conselho", () => {
    expect(() => medicoInputSchema.parse({ name: base.name, crm: base.crm })).toThrow();
    expect(() => medicoInputSchema.parse({ ...base, registrationUf: "XX" })).toThrow();
  });

  it("aceita RQE só para médico", () => {
    expect(medicoInputSchema.parse({ ...base, rqe: "901" }).rqe).toBe("901");
    const psychologist = medicoInputSchema.safeParse({
      ...base,
      profession: "psychologist",
      rqe: "901",
    });
    expect(psychologist.success).toBe(false);
    expect(
      medicoInputSchema.parse({
        ...base,
        profession: "psychologist",
        affiliation: "external",
      }),
    ).toMatchObject({ profession: "psychologist", affiliation: "external" });
  });
});
