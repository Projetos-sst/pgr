import {
  employeeInputSchema,
  maskCpfInput,
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

describe("maskCpfInput", () => {
  it("retorna string vazia para entrada vazia", () => {
    expect(maskCpfInput("")).toBe("");
  });

  it("retorna apenas dígitos para 0-3 dígitos", () => {
    expect(maskCpfInput("1")).toBe("1");
    expect(maskCpfInput("12")).toBe("12");
    expect(maskCpfInput("123")).toBe("123");
  });

  it("aplica máscara 000.000 para 4-6 dígitos", () => {
    expect(maskCpfInput("1234")).toBe("123.4");
    expect(maskCpfInput("12345")).toBe("123.45");
    expect(maskCpfInput("123456")).toBe("123.456");
  });

  it("aplica máscara 000.000.000 para 7-9 dígitos", () => {
    expect(maskCpfInput("1234567")).toBe("123.456.7");
    expect(maskCpfInput("12345678")).toBe("123.456.78");
    expect(maskCpfInput("123456789")).toBe("123.456.789");
  });

  it("aplica máscara 000.000.000-00 para 10-11 dígitos", () => {
    expect(maskCpfInput("1234567890")).toBe("123.456.789-0");
    expect(maskCpfInput("12345678901")).toBe("123.456.789-01");
  });

  it("remove caracteres não-dígitos", () => {
    expect(maskCpfInput("123.456.789-01")).toBe("123.456.789-01");
    expect(maskCpfInput("123-456-789-01")).toBe("123.456.789-01");
    expect(maskCpfInput("123abc456def789ghi01")).toBe("123.456.789-01");
  });

  it("trunca valores acima de 11 dígitos", () => {
    expect(maskCpfInput("123456789012")).toBe("123.456.789-01");
    expect(maskCpfInput("1234567890123")).toBe("123.456.789-01");
  });

  it("é idempotente (aplicar 2x produz mesmo resultado)", () => {
    const valor = "12345678901";
    const primeira = maskCpfInput(valor);
    const segunda = maskCpfInput(primeira);
    expect(primeira).toBe(segunda);
    expect(segunda).toBe("123.456.789-01");
  });
});
