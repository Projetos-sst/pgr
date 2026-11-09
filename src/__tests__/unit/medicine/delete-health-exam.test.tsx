/**
 * Exclusão do exame: a recusa do servidor (histórico de ASO ou clínico preservado, permissão,
 * exame não encontrado) aparece ao lado do botão — antes era ignorada em silêncio — e a página só
 * é atualizada no sucesso. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DeleteHealthExam } from "@/app/(protected)/health-exams/_components/delete-health-exam";
import { deleteHealthExamAction } from "@/shared/server/actions/pgr/health-exams";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/pgr/health-exams", () => ({
  deleteHealthExamAction: jest.fn(),
}));

const EXAM = "e1111111-1111-4111-8111-111111111111";

let confirmSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);
});
afterEach(() => confirmSpy.mockRestore());

function remove() {
  render(<DeleteHealthExam id={EXAM} />);
  fireEvent.click(screen.getByRole("button", { name: "Remover exame" }));
}

describe("DeleteHealthExam", () => {
  it("IN_USE: mostra o motivo da recusa e não atualiza a página", async () => {
    (deleteHealthExamAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "IN_USE",
        message:
          "Exame com prévia de ASO arquivada não pode ser excluído: o histórico do ASO é preservado.",
      },
    });
    remove();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Exame com prévia de ASO arquivada não pode ser excluído",
    );
    expect(deleteHealthExamAction).toHaveBeenCalledWith(EXAM);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remover exame" })).toBeEnabled();
  });

  it("FORBIDDEN e NOT_FOUND: mensagem legível, nunca o código cru", async () => {
    (deleteHealthExamAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    remove();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );

    (deleteHealthExamAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "NOT_FOUND" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remover exame" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Registro não encontrado."),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("sucesso: atualiza a página, sem mensagem de erro", async () => {
    (deleteHealthExamAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: EXAM },
    });
    remove();

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cancelado na confirmação: nada é enviado", () => {
    confirmSpy.mockImplementation(() => false);
    remove();
    expect(deleteHealthExamAction).not.toHaveBeenCalled();
  });
});
