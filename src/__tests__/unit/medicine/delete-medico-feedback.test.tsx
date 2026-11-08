/**
 * Exclusão do profissional: a recusa do servidor (examinador de exames registrados → IN_USE)
 * aparece na tela, sem atualizar a lista; sucesso atualiza; cancelar a confirmação não envia.
 * Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DeleteMedico } from "@/app/(protected)/medicos/_components/delete-medico";
import { MEDICO_EXAMINER_IN_USE_MESSAGE } from "@/shared/domains/pgr/medicos";
import { deleteMedicoAction } from "@/shared/server/actions/pgr/medicos";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/pgr/medicos", () => ({
  deleteMedicoAction: jest.fn(),
}));

const remove = deleteMedicoAction as jest.Mock;
const MEDICO = "c1111111-1111-4111-8111-111111111111";

const click = () => fireEvent.click(screen.getByRole("button", { name: "Remover médico" }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("DeleteMedico", () => {
  it("recusa IN_USE do servidor aparece na tela e a lista não é atualizada", async () => {
    remove.mockResolvedValue({
      ok: false,
      error: { code: "IN_USE", message: MEDICO_EXAMINER_IN_USE_MESSAGE },
    });
    render(<DeleteMedico id={MEDICO} />);
    click();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MEDICO_EXAMINER_IN_USE_MESSAGE,
    );
    expect(remove).toHaveBeenCalledWith(MEDICO);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remover médico" })).toBeEnabled();
  });

  it("sucesso atualiza a lista, sem mensagem de erro", async () => {
    remove.mockResolvedValue({ ok: true, data: { id: MEDICO } });
    render(<DeleteMedico id={MEDICO} />);
    click();

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("falha inesperada vira mensagem segura", async () => {
    remove.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
    render(<DeleteMedico id={MEDICO} />);
    click();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir a operação. Tente novamente.",
    );
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });

  it("cancelar a confirmação não envia", () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<DeleteMedico id={MEDICO} />);
    click();
    expect(remove).not.toHaveBeenCalled();
  });
});
