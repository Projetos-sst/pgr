/**
 * `HealthExamForm` vindo da ficha (PLAN §3.3): `defaultEmployeeId` pré-seleciona
 * o funcionário e `returnTo` (montado no servidor) vira o destino do Cancelar e
 * do pós-salvar. Sem `returnTo`, volta para `/health-exams`. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

const EMPLOYEES = [
  { id: "a1111111-1111-4111-8111-111111111111", fullName: "Beltrana Fictícia" },
  { id: "a2222222-2222-4222-8222-222222222222", fullName: "Cicrano Ficcional" },
];
const TARGET = EMPLOYEES[1];

beforeEach(() => {
  jest.clearAllMocks();
});

function employeeSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: /Funcionário/ }) as HTMLSelectElement;
}

describe("HealthExamForm — pré-seleção e retorno", () => {
  it("com defaultEmployeeId o select vem pré-selecionado", () => {
    render(
      <HealthExamForm employees={EMPLOYEES} doctors={[]} defaultEmployeeId={TARGET.id} />,
    );
    expect(employeeSelect().value).toBe(TARGET.id);
  });

  it("sem defaultEmployeeId o select vem vazio", () => {
    render(<HealthExamForm employees={EMPLOYEES} doctors={[]} />);
    expect(employeeSelect().value).toBe("");
  });

  it("com returnTo o Cancelar aponta para ele", () => {
    render(
      <HealthExamForm
        employees={EMPLOYEES}
        doctors={[]}
        defaultEmployeeId={TARGET.id}
        returnTo={`/employees/${TARGET.id}`}
      />,
    );
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      `/employees/${TARGET.id}`,
    );
  });

  it("sem returnTo o Cancelar volta para /health-exams", () => {
    render(<HealthExamForm employees={EMPLOYEES} doctors={[]} />);
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/health-exams",
    );
  });

  it("ao salvar com sucesso envia o funcionário pré-selecionado e navega para returnTo", async () => {
    jest
      .mocked(createHealthExamAction)
      .mockResolvedValue({ ok: true, data: { id: "x" } } as never);
    render(
      <HealthExamForm
        employees={EMPLOYEES}
        doctors={[]}
        defaultEmployeeId={TARGET.id}
        returnTo={`/employees/${TARGET.id}`}
      />,
    );
    fireEvent.submit(employeeSelect().closest("form")!);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/employees/${TARGET.id}`));
    expect(createHealthExamAction).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: TARGET.id }),
    );
  });
});
