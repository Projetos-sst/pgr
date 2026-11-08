/**
 * NOB-112 (etapa E): formulários do ASO (procedimentos, empresa de origem, conclusão do
 * examinador, ASO assinado, entrega, correção e conferência do comprovante). Erro sem lugar na
 * tela vira item legível (antes sumia), texto padrão do Zod em inglês nunca aparece, permissão
 * segue como mensagem de permissão (a correção da entrega punha a recusa no campo "motivo") e
 * promessa rejeitada vira mensagem genérica, mantendo o que foi digitado. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import {
  CompanyOriginForm,
  ExaminerConclusionForm,
  ProcedureForm,
} from "@/app/(protected)/health-exams/[id]/aso/aso-controls";
import {
  AsoDeliveryForm,
  ReviewAsoEvidenceForm,
  VoidAsoDeliveryForm,
} from "@/app/(protected)/health-exams/[id]/aso/aso-delivery-controls";
import { SignedAsoForm } from "@/app/(protected)/health-exams/[id]/aso/signed-aso-controls";
import {
  addExamProcedureAction,
  confirmExamCompanyOriginAction,
  confirmExaminerConclusionAction,
  registerAsoDeliveryAction,
  registerSignedAsoAction,
  reviewAsoDeliveryEvidenceAction,
  voidAsoDeliveryAction,
} from "@/shared/server/actions/medicine/aso";

/**
 * Envia o formulário do botão de envio sem a validação nativa do navegador (o jsdom, como o
 * navegador, não envia com campo `required` vazio): estes testes conferem a exibição do erro que o
 * servidor devolve. Botão comum (abrir painel, baixar) continua sendo clique.
 */
function press(element: HTMLElement) {
  const button = element as HTMLButtonElement;
  if (button.type === "submit" && button.form) fireEvent.submit(button.form);
  else fireEvent.click(element);
}

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/aso", () => ({
  addExamProcedureAction: jest.fn(),
  removeExamProcedureAction: jest.fn(),
  generateAsoDocumentAction: jest.fn(),
  confirmExamCompanyOriginAction: jest.fn(),
  confirmExaminerConclusionAction: jest.fn(),
  registerSignedAsoAction: jest.fn(),
  getSignedAsoDownloadAction: jest.fn(),
  registerAsoDeliveryAction: jest.fn(),
  voidAsoDeliveryAction: jest.fn(),
  getAsoDeliveryEvidenceAction: jest.fn(),
  reviewAsoDeliveryEvidenceAction: jest.fn(),
}));

const EXAM = "e1111111-1111-4111-8111-111111111111";
const DELIVERY = "d1111111-1111-4111-8111-111111111111";
const GENERIC = "Não foi possível concluir a operação. Tente novamente.";
const ENGLISH = /Invalid input|Invalid option|Too small|Too big|expected string/;

const invalid = (fields: Record<string, string>) => ({
  ok: false,
  error: { code: "VALIDATION", message: "Dados inválidos.", fields },
});
const forbidden = (message: string) => ({
  ok: false,
  error: { code: "FORBIDDEN", message },
});

beforeEach(() => jest.clearAllMocks());

describe("exame complementar realizado", () => {
  it("chave sem campo vira item legível; inglês do Zod nunca aparece", async () => {
    (addExamProcedureAction as jest.Mock).mockResolvedValue(
      invalid({
        _: "Este procedimento já foi registrado para o exame.",
        performedAt: "Invalid input: expected string, received null",
      }),
    );
    render(<ProcedureForm examId={EXAM} />);
    press(screen.getByRole("button", { name: "Registrar exame realizado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este procedimento já foi registrado para o exame.",
    );
    expect(screen.getByLabelText(/^Data de realização/)).toHaveAccessibleDescription(
      "Valor inválido.",
    );
    expect(document.body).not.toHaveTextContent(ENGLISH);
  });

  it("promessa rejeitada: mensagem genérica e código digitado mantido", async () => {
    (addExamProcedureAction as jest.Mock).mockRejectedValue(new Error("Failed query"));
    render(<ProcedureForm examId={EXAM} />);
    fireEvent.change(screen.getByLabelText(/^Código do procedimento/), {
      target: { value: "0281" },
    });
    press(screen.getByRole("button", { name: "Registrar exame realizado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.queryByText(/Failed query/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Código do procedimento/)).toHaveValue("0281");
    expect(
      await screen.findByRole("button", { name: "Registrar exame realizado" }),
    ).toBeEnabled();
  });
});

describe("empresa de origem e conclusão do examinador", () => {
  it("empresa de origem: FORBIDDEN é mensagem de permissão, sem destacar a justificativa", async () => {
    (confirmExamCompanyOriginAction as jest.Mock).mockResolvedValue(
      forbidden("FORBIDDEN"),
    );
    render(<CompanyOriginForm examId={EXAM} />);
    press(screen.getByRole("button", { name: "Confirmar empresa de origem" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );
    expect(
      screen.getByRole("textbox", { name: /^Como foi comprovado/ }),
    ).not.toHaveAttribute("aria-invalid");
  });

  it("conclusão: erro do campo fica no grupo de opções; chave extra vai ao resumo", async () => {
    (confirmExaminerConclusionAction as jest.Mock).mockResolvedValue(
      invalid({
        conclusion: "Informe apto ou inapto.",
        examId: "Exame inválido.",
      }),
    );
    render(<ExaminerConclusionForm examId={EXAM} />);
    press(screen.getByRole("button", { name: "Confirmar como médico examinador" }));

    expect(await screen.findByText("Informe apto ou inapto.")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Conclusão para o ASO" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Informe apto ou inapto.");
    expect(screen.getByRole("alert")).toHaveTextContent("Exame inválido.");
  });
});

describe("ASO assinado", () => {
  it("prévia e motivo de substituição sem campo na tela aparecem no resumo", async () => {
    (registerSignedAsoAction as jest.Mock).mockResolvedValue(
      invalid({
        previewDocumentId: "Informe a prévia do sistema que foi assinada.",
        replaceReason: "Há ASO assinado vigente: informe o motivo da substituição.",
        signerName: "Informe o nome do médico que assinou.",
      }),
    );
    render(<SignedAsoForm examId={EXAM} previews={[]} currentId={null} />);
    press(screen.getByRole("button", { name: "Registrar ASO assinado" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Prévia do sistema que foi assinada: Informe a prévia do sistema que foi assinada.",
    );
    expect(alert).toHaveTextContent(
      "Motivo da substituição: Há ASO assinado vigente: informe o motivo da substituição.",
    );
    expect(screen.getByRole("textbox", { name: /^Médico que assinou/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(document.body).not.toHaveTextContent(/previewDocumentId|replaceReason/);
  });

  it("fluxo do examinador: só a prévia mais recente é oferecida (as antigas ficam no histórico)", () => {
    render(
      <SignedAsoForm
        examId={EXAM}
        previews={[
          { id: "p1111111-1111-4111-8111-111111111111", version: 1 },
          { id: "p2222222-2222-4222-8222-222222222222", version: 2 },
        ]}
        currentId={null}
      />,
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: /^Origem do documento assinado/ }),
      { target: { value: "examiner" } },
    );
    const select = screen.getByRole("combobox", {
      name: /^Prévia do sistema que foi assinada/,
    });
    expect(
      within(select).getByRole("option", { name: "Prévia versão 2 (a mais recente)" }),
    ).toBeInTheDocument();
    expect(
      within(select).queryByRole("option", { name: /Prévia versão 1/ }),
    ).not.toBeInTheDocument();
  });

  it("promessa rejeitada: mensagem genérica e o que foi digitado fica", async () => {
    (registerSignedAsoAction as jest.Mock).mockRejectedValue(
      new Error("payload too large"),
    );
    render(<SignedAsoForm examId={EXAM} previews={[]} currentId={null} />);
    fireEvent.change(screen.getByRole("textbox", { name: /^Médico que assinou/ }), {
      target: { value: "Dr. Fictício" },
    });
    press(screen.getByRole("button", { name: "Registrar ASO assinado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.getByRole("textbox", { name: /^Médico que assinou/ })).toHaveValue(
      "Dr. Fictício",
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("entrega do ASO", () => {
  it("método sem campo visível (entrega não escolhida) aparece no resumo, legível", async () => {
    (registerAsoDeliveryAction as jest.Mock).mockResolvedValue(
      invalid({
        method: "Informe o método da entrega.",
        occurredAt: "Informe data e hora.",
      }),
    );
    render(<AsoDeliveryForm examId={EXAM} />);
    press(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Método: Informe o método da entrega.",
    );
    expect(screen.getByLabelText(/^Data e hora/)).toHaveAttribute("aria-invalid", "true");
  });

  it("correção: FORBIDDEN fica no resumo, nunca como erro do motivo", async () => {
    (voidAsoDeliveryAction as jest.Mock).mockResolvedValue(
      forbidden("Você não tem permissão para corrigir este registro."),
    );
    render(<VoidAsoDeliveryForm examId={EXAM} deliveryId={DELIVERY} />);
    press(screen.getByRole("button", { name: "Corrigir registro" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Motivo da correção/ }), {
      target: { value: "Data registrada errada." },
    });
    press(screen.getByRole("button", { name: "Registrar correção" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para corrigir este registro.",
    );
    const reason = screen.getByRole("textbox", { name: /^Motivo da correção/ });
    expect(reason).not.toHaveAttribute("aria-invalid");
    expect(reason).toHaveValue("Data registrada errada.");
  });

  it("correção: promessa rejeitada vira mensagem genérica e o motivo fica", async () => {
    (voidAsoDeliveryAction as jest.Mock).mockRejectedValue(new Error("timeout"));
    render(<VoidAsoDeliveryForm examId={EXAM} deliveryId={DELIVERY} />);
    press(screen.getByRole("button", { name: "Corrigir registro" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Motivo da correção/ }), {
      target: { value: "Data registrada errada." },
    });
    press(screen.getByRole("button", { name: "Registrar correção" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.getByRole("textbox", { name: /^Motivo da correção/ })).toHaveValue(
      "Data registrada errada.",
    );
  });

  it("conferência do comprovante: erros por campo e inglês do Zod traduzido", async () => {
    (reviewAsoDeliveryEvidenceAction as jest.Mock).mockResolvedValue(
      invalid({
        reference: "Too small: expected string to have >=5 characters",
        result: "Informe o resultado da conferência.",
      }),
    );
    render(
      <ReviewAsoEvidenceForm examId={EXAM} deliveryId={DELIVERY} signedReceipt={false} />,
    );
    press(screen.getByRole("button", { name: "Conferir comprovante" }));
    press(screen.getByRole("button", { name: "Registrar conferência" }));

    expect(
      await screen.findByText("Informe o resultado da conferência."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^O que foi conferido/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(ENGLISH);
    await waitFor(() => expect(reviewAsoDeliveryEvidenceAction).toHaveBeenCalled());
  });
});
