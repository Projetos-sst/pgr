import { stepsWithError } from "../form-steps";

const STEP_FIELDS = [
  ["fullName", "cpf"],
  ["companyId", "gesId"],
  ["zipCode", "city"],
] as const;

describe("stepsWithError", () => {
  it("não aponta etapa alguma quando não há erro", () => {
    expect(stepsWithError(STEP_FIELDS, {})).toEqual([]);
  });

  it("aponta a etapa do campo com erro", () => {
    expect(stepsWithError(STEP_FIELDS, { companyId: "Empresa é obrigatória" })).toEqual([
      1,
    ]);
  });

  it("aponta todas as etapas afetadas, em ordem", () => {
    const errors = { city: "Cidade inválida", cpf: "CPF deve ter 11 dígitos" };
    expect(stepsWithError(STEP_FIELDS, errors)).toEqual([0, 2]);
  });

  it("reporta a etapa uma única vez quando ela tem vários campos com erro", () => {
    const errors = { fullName: "obrigatório", cpf: "inválido" };
    expect(stepsWithError(STEP_FIELDS, errors)).toEqual([0]);
  });

  it("ignora erro de campo que não pertence a nenhuma etapa", () => {
    // `_` é o erro de formulário inteiro — não deve marcar etapa nenhuma.
    expect(stepsWithError(STEP_FIELDS, { _: "Falha ao salvar" })).toEqual([]);
  });
});
