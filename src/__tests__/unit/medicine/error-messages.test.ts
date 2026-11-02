import {
  healthExamFormFeedback,
  medicineErrorLabel,
} from "@/shared/domains/medicine/error-messages";

describe("medicineErrorLabel", () => {
  it("troca o código do contrato por rótulo legível", () => {
    expect(medicineErrorLabel("FORBIDDEN")).toBe("Acesso não permitido");
    expect(medicineErrorLabel("VALIDATION")).toBe("Dados inválidos");
    expect(medicineErrorLabel("NOT_FOUND")).toBe("Não encontrado");
    expect(medicineErrorLabel("ALGO_NOVO")).toBe("Erro inesperado");
  });
});

describe("healthExamFormFeedback", () => {
  it("erros de campo ficam nos campos, com resumo genérico", () => {
    expect(
      healthExamFormFeedback({
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { validUntil: "Vencimento anterior à realização." },
      }),
    ).toEqual({
      formError: "Revise os campos destacados.",
      fields: { validUntil: "Vencimento anterior à realização." },
    });
  });

  it("FORBIDDEN do papel nunca mostra o código cru", () => {
    const fb = healthExamFormFeedback({ code: "FORBIDDEN", message: "FORBIDDEN" });
    expect(fb.formError).not.toMatch(/FORBIDDEN/);
    expect(fb.formError).toMatch(/permissão/);
  });

  it("FORBIDDEN do módulo desligado explica a Medicina", () => {
    const fb = healthExamFormFeedback({
      code: "FORBIDDEN",
      message: "Serviço não habilitado para esta empresa.",
    });
    expect(fb.formError).toMatch(/Medicina do Trabalho não está habilitada/);
  });

  it("NOT_FOUND → frase sobre o exame, sem código", () => {
    const fb = healthExamFormFeedback({ code: "NOT_FOUND", message: "NOT_FOUND" });
    expect(fb.formError).toBe(
      "Exame não encontrado neste escritório. Ele pode ter sido removido.",
    );
  });

  it("regra do servidor em PT passa como está (troca de funcionário, referência)", () => {
    expect(
      healthExamFormFeedback({
        code: "VALIDATION",
        message: "O funcionário de um exame já registrado não pode ser alterado.",
      }).formError,
    ).toBe("O funcionário de um exame já registrado não pode ser alterado.");
    expect(
      healthExamFormFeedback({
        code: "FK_NOT_FOUND",
        message: "Médico não encontrado neste escritório.",
      }).formError,
    ).toBe("Médico não encontrado neste escritório.");
  });

  it("mensagem com cara de código ou código desconhecido → texto genérico", () => {
    expect(
      healthExamFormFeedback({ code: "FK_NOT_FOUND", message: "FK_NOT_FOUND" }).formError,
    ).toBe("Funcionário ou médico não encontrado neste escritório.");
    expect(
      healthExamFormFeedback({ code: "UNKNOWN", message: "Erro inesperado." }).formError,
    ).toBe("Não foi possível salvar o exame. Tente novamente.");
  });
});
