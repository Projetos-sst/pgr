import {
  isValidCnpj,
  isValidCnpjChecksum,
  normalizeCnpj,
} from "@/shared/domains/pgr/cnpj";
import { cnpjSchema } from "@/shared/domains/pgr/validation";
import { formatCnpj, maskCnpjInput } from "@/shared/domains/pgr/companies";
import {
  isValidCnpj as lookupValid,
  normalizeCnpj as lookupNormalize,
} from "@/shared/integrations/validation";

describe("NOB-102 shared CNPJ validation", () => {
  it.each([
    "11222333000181",
    "11.222.333/0001-81",
    "12ABC34501DE35",
    "12.abc.345/01de-35",
    "00.000.000/E08G-12",
  ])("accepts official-compatible numeric/alphanumeric input: %s", (value) => {
    expect(isValidCnpj(value)).toBe(true);
    expect(lookupValid(value)).toBe(true);
    expect(cnpjSchema.parse(value)).toBe(normalizeCnpj(value));
    expect(lookupNormalize(value)).toBe(normalizeCnpj(value));
  });
  it.each([
    "00000000000000",
    "11111111111111",
    "12ABC34501DE34",
    "12ABC34501DE3A",
    "!11222333000181",
    "11222333000181!",
    "１２ABC34501DE35",
    "12ABC34501DÉ35",
    "123",
  ])(
    "rejects invalid content rather than silently changing its identity: %s",
    (value) => {
      expect(isValidCnpj(value)).toBe(false);
      expect(lookupValid(value)).toBe(false);
      expect(cnpjSchema.safeParse(value).success).toBe(false);
    },
  );
  it("formats and masks letters without changing numeric output", () => {
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
    expect(maskCnpjInput("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(maskCnpjInput(maskCnpjInput("12abc34501de35"))).toBe("12.ABC.345/01DE-35");
    expect(isValidCnpjChecksum("12ABC34501DE35")).toBe(true);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});
