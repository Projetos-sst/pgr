import {
  employeeInputSchema,
  toEmployeeListItem,
} from "@/shared/domains/pgr/employees";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

describe("employeeInputSchema (US5)", () => {
  const base = { companyId: COMPANY_ID, fullName: "Maria", cpf: "123.456.789-01" };

  it("aceita entrada mínima e normaliza CPF para dígitos", () => {
    const parsed = employeeInputSchema.parse(base);
    expect(parsed.cpf).toBe("12345678901");
    expect(parsed.fullName).toBe("Maria");
  });

  it("rejeita CPF com formato inválido", () => {
    expect(() => employeeInputSchema.parse({ ...base, cpf: "123" })).toThrow();
  });

  it("exige nome completo e empresa", () => {
    expect(() => employeeInputSchema.parse({ ...base, fullName: " " })).toThrow();
    expect(() => employeeInputSchema.parse({ fullName: "X", cpf: base.cpf })).toThrow();
  });

  it("GES e função são opcionais (vazio → undefined)", () => {
    const parsed = employeeInputSchema.parse({ ...base, gesId: "", jobRoleId: "" });
    expect(parsed.gesId).toBeUndefined();
    expect(parsed.jobRoleId).toBeUndefined();
  });

  it("rejeita enum fora do conjunto", () => {
    expect(() => employeeInputSchema.parse({ ...base, sex: "other" })).toThrow();
    expect(() => employeeInputSchema.parse({ ...base, status: "retired" })).toThrow();
  });

  it("aceita enum vazio como undefined", () => {
    expect(employeeInputSchema.parse({ ...base, sex: "" }).sex).toBeUndefined();
  });
});

describe("toEmployeeListItem", () => {
  it("projeta as colunas da lista", () => {
    const item = {
      id: "e1",
      fullName: "Maria",
      status: "active",
      companyName: "Acme",
      gesName: null,
    };
    expect(toEmployeeListItem(item)).toEqual(item);
  });
});
