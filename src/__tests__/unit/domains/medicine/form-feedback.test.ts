/**
 * Retorno de erro dos formulários da Medicina (NOB-112): erro de campo vai ao campo ou à seção,
 * o que não tem lugar vira item legível (nunca caminho cru nem texto padrão do Zod em inglês) e
 * erro sem campos (permissão, sessão, regra) segue como mensagem do formulário.
 */
import {
  compactRows,
  formFeedback,
  parseFieldPath,
  pathDescriber,
  readableMessage,
  remapListIndexes,
  unexpectedFormFeedback,
} from "@/shared/domains/medicine/form-feedback";

const describe_ = pathDescriber({
  fields: { participants: "Participantes", "identity.fullName": "Nome completo" },
  lists: {
    participants: { item: "Participante", fields: { role: "função", name: "nome" } },
  },
});

describe("formFeedback", () => {
  it("erros com lugar na tela ficam no campo, com resumo genérico", () => {
    expect(
      formFeedback(
        {
          code: "VALIDATION",
          message: "Dados inválidos.",
          fields: { participants: "Informe ao menos uma função representada." },
        },
        { slots: ["participants"], describe: describe_ },
      ),
    ).toEqual({
      formError: "Revise os campos destacados.",
      details: [],
      fields: { participants: "Informe ao menos uma função representada." },
    });
  });

  it("erros sem lugar viram itens legíveis, sem o caminho cru", () => {
    const fb = formFeedback(
      {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          occurredOn: "Data inválida.",
          "participants.1.name": "Máximo de 120 caracteres.",
          "identity.fullName": "Informe o nome completo do profissional.",
          "checklist.x": "Confirme o item.",
        },
      },
      { slots: ["occurredOn"], describe: describe_ },
    );
    expect(fb.fields).toEqual({ occurredOn: "Data inválida." });
    expect(fb.formError).toBe("Revise os campos destacados e os pontos abaixo.");
    expect(fb.details).toEqual([
      "Participante 2 — nome: Máximo de 120 caracteres.",
      "Nome completo: Informe o nome completo do profissional.",
      "Confirme o item.",
    ]);
    expect(fb.details.join(" ")).not.toMatch(/participants\.|identity\.|checklist\./);
  });

  it("só erros sem lugar: resumo pede para revisar os pontos listados", () => {
    const fb = formFeedback(
      {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { _: "Entrada inválida." },
      },
      { slots: [] },
    );
    expect(fb.formError).toBe("Revise os pontos abaixo.");
    expect(fb.details).toEqual(["Entrada inválida."]);
  });

  it("texto padrão do Zod em inglês nunca chega à tela", () => {
    const fb = formFeedback(
      {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          reason: "Too small: expected string to have >=1 characters",
          kind: "Invalid input",
          extra: 'Unrecognized key: "cpf"',
        },
      },
      { slots: ["reason"] },
    );
    expect(fb.fields.reason).toBe("Valor inválido.");
    expect(fb.details).toEqual(["Valor inválido."]);
    expect(JSON.stringify(fb)).not.toMatch(/Too small|Invalid input|Unrecognized/);
  });

  it("FORBIDDEN mantém a mensagem de permissão, sem virar validação", () => {
    const fb = formFeedback(
      { code: "FORBIDDEN", message: "Somente o médico responsável pode finalizar." },
      { slots: ["note"] },
    );
    expect(fb).toEqual({
      formError: "Somente o médico responsável pode finalizar.",
      details: [],
      fields: {},
    });
  });

  it("mensagem que é só código troca pelo texto do código; código desconhecido → genérico", () => {
    expect(
      formFeedback({ code: "FORBIDDEN", message: "FORBIDDEN" }, { slots: [] }).formError,
    ).toBe("Você não tem permissão para esta operação.");
    expect(formFeedback({ code: "BOOM", message: "" }, { slots: [] }).formError).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });

  it("falha inesperada: mensagem segura e sem detalhe", () => {
    expect(unexpectedFormFeedback()).toEqual({
      formError: "Não foi possível concluir a operação. Tente novamente.",
      details: [],
      fields: {},
    });
  });
});

describe("caminhos e listas", () => {
  it("parseFieldPath separa índices", () => {
    expect(parseFieldPath("participants.1.role")).toEqual(["participants", 1, "role"]);
    expect(parseFieldPath("_")).toEqual([]);
  });

  it("pathDescriber rotula item de lista, item inteiro e chave sem rótulo", () => {
    expect(describe_(["participants", 0, "role"])).toBe("Participante 1 — função");
    expect(describe_(["participants", 2])).toBe("Participante 3");
    expect(describe_(["participants"])).toBe("Participantes");
    expect(describe_(["requestId"])).toBeNull();
  });

  it("compactRows tira só as linhas em branco e guarda o índice da tela", () => {
    expect(compactRows(["", "a", "", "b"], (v) => !v)).toEqual({
      values: ["a", "b"],
      indexes: [1, 3],
    });
  });

  it("remapListIndexes devolve o erro à linha da tela", () => {
    expect(
      remapListIndexes(
        { "participants.0.role": "A", "participants.1": "B", participants: "C", x: "D" },
        "participants",
        [1, 3],
      ),
    ).toEqual({
      "participants.1.role": "A",
      "participants.3": "B",
      participants: "C",
      x: "D",
    });
    expect(remapListIndexes(undefined, "participants", [])).toBeUndefined();
  });

  it("readableMessage mantém frase em PT", () => {
    expect(readableMessage("Selecione a função do participante.", "x")).toBe(
      "Selecione a função do participante.",
    );
  });
});
