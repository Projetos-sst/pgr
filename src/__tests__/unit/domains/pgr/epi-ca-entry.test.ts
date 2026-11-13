import { evaluateCaForStockEntry } from "@/shared/domains/pgr/epi-ca-entry";

const TODAY = "2026-11-13";
const EPI = { type: "epi", ca: "12345", caValidUntil: "2027-01-31" } as const;

describe("evaluateCaForStockEntry", () => {
  it("libera a entrada de EPI com CA válido depois de hoje", () => {
    expect(evaluateCaForStockEntry(EPI, TODAY)).toEqual({ allowed: true });
  });

  it("libera a entrada quando o CA vence hoje (dia D inclusive)", () => {
    expect(evaluateCaForStockEntry({ ...EPI, caValidUntil: TODAY }, TODAY)).toEqual({
      allowed: true,
    });
  });

  it("bloqueia a entrada quando o CA venceu ontem, com a data no motivo", () => {
    expect(
      evaluateCaForStockEntry({ ...EPI, caValidUntil: "2026-11-12" }, TODAY),
    ).toEqual({
      allowed: false,
      reason: "ca_expired",
      message:
        "CA 12345 vencido em 12/11/2026. EPI com CA vencido não pode entrar no estoque.",
    });
  });

  it("bloqueia a entrada de EPI sem validade do CA informada", () => {
    expect(evaluateCaForStockEntry({ ...EPI, caValidUntil: null }, TODAY)).toEqual({
      allowed: false,
      reason: "ca_missing",
      message:
        "Informe o CA e a validade do CA no cadastro do EPI antes de registrar a entrada no estoque.",
    });
  });

  it("bloqueia a entrada de EPI sem número do CA, mesmo com validade futura", () => {
    const decision = evaluateCaForStockEntry({ ...EPI, ca: null }, TODAY);
    expect(decision).toMatchObject({ allowed: false, reason: "ca_missing" });
  });

  it("não exige CA de máquina ou equipamento", () => {
    expect(
      evaluateCaForStockEntry({ type: "machine", ca: null, caValidUntil: null }, TODAY),
    ).toEqual({ allowed: true });
  });
});
