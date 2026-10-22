import { medicineEmployeesQuerySchema } from "@/shared/domains/medicine/employees";

const COMPANY = "11111111-1111-1111-1111-111111111111";

describe("medicineEmployeesQuerySchema", () => {
  it("aceita companyId válido e deixa o resto opcional", () => {
    const parsed = medicineEmployeesQuerySchema.parse({ companyId: COMPANY });
    expect(parsed).toEqual({ companyId: COMPANY });
  });

  it("companyId ausente → erro com mensagem de UI", () => {
    const result = medicineEmployeesQuerySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe("Selecione uma empresa");
  });

  it("companyId malformado/vazio → erro", () => {
    expect(medicineEmployeesQuerySchema.safeParse({ companyId: "abc" }).success).toBe(
      false,
    );
    expect(medicineEmployeesQuerySchema.safeParse({ companyId: "" }).success).toBe(false);
    expect(
      medicineEmployeesQuerySchema.safeParse({ companyId: `${COMPANY}x` }).success,
    ).toBe(false);
  });

  it("pageSize > 100 recusado; 100 aceito", () => {
    expect(
      medicineEmployeesQuerySchema.safeParse({ companyId: COMPANY, pageSize: 101 })
        .success,
    ).toBe(false);
    expect(
      medicineEmployeesQuerySchema.parse({ companyId: COMPANY, pageSize: 100 }).pageSize,
    ).toBe(100);
  });

  it("page/pageSize precisam ser inteiros positivos (coerce de query string)", () => {
    expect(
      medicineEmployeesQuerySchema.parse({
        companyId: COMPANY,
        page: "2",
        pageSize: "10",
      }),
    ).toMatchObject({ page: 2, pageSize: 10 });
    expect(
      medicineEmployeesQuerySchema.safeParse({ companyId: COMPANY, page: 0 }).success,
    ).toBe(false);
    expect(
      medicineEmployeesQuerySchema.safeParse({ companyId: COMPANY, pageSize: 1.5 })
        .success,
    ).toBe(false);
  });

  it("search vazio/espaços → undefined; com texto → aparado", () => {
    expect(
      medicineEmployeesQuerySchema.parse({ companyId: COMPANY, search: "" }).search,
    ).toBeUndefined();
    expect(
      medicineEmployeesQuerySchema.parse({ companyId: COMPANY, search: "   " }).search,
    ).toBeUndefined();
    expect(
      medicineEmployeesQuerySchema.parse({ companyId: COMPANY, search: "  Ana " }).search,
    ).toBe("Ana");
  });
});
