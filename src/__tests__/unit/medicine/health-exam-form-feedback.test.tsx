/**
 * `HealthExamForm` (NOB-112, etapa E): erro de chave sem campo na tela aparece legível no resumo
 * (antes o resumo dizia "Revise os campos destacados." sem nenhum campo destacado), inglês do Zod
 * nunca aparece e promessa rejeitada vira mensagem genérica, mantendo o que foi digitado.
 * Dados fictícios.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { HealthExamForm } from "@/app/(protected)/health-exams/_components/health-exam-form";
import { createHealthExamAction } from "@/shared/server/actions/pgr/health-exams";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/pgr/health-exams", () => ({
  createHealthExamAction: jest.fn(),
  updateHealthExamAction: jest.fn(),
}));

const EMPLOYEE = { id: "a1111111-1111-4111-8111-111111111111", fullName: "Beltrana Fictícia" };

beforeEach(() => jest.clearAllMocks());

const form = () => document.querySelector("form")!;
const field = (name: string) =>
  form().querySelector(`[name="${name}"]`) as HTMLInputElement;
function renderNew() {
  render(
    <HealthExamForm employees={[EMPLOYEE]} doctors={[]} defaultEmployeeId={EMPLOYEE.id} />,
  );
}

describe("HealthExamForm: retorno de erro", () => {
  it("chave sem campo na tela vira item legível; inglês do Zod traduzido", async () => {
    jest.mocked(createHealthExamAction).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          clinicalNotes: "Observações clínicas não ficam mais no cadastro do exame.",
          aptitude: "Invalid option: expected one of \"fit\"|\"unfit\"",
        },
      },
    });
    renderNew();
    fireEvent.submit(form());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Observações clínicas: Observações clínicas não ficam mais no cadastro do exame.",
    );
    expect(screen.getByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Invalid option|clinicalNotes/);
  });

  it("promessa rejeitada: mensagem genérica, valores mantidos e sem navegar", async () => {
    jest.mocked(createHealthExamAction).mockRejectedValue(new Error("Failed query: insert"));
    renderNew();
    fireEvent.change(field("certificatePath"), { target: { value: "/docs/aso.pdf" } });
    fireEvent.submit(form());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir a operação. Tente novamente.",
    );
    expect(screen.queryByText(/Failed query/)).not.toBeInTheDocument();
    expect(field("certificatePath").value).toBe("/docs/aso.pdf");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
