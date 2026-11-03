/**
 * `HealthExamForm` — Lote 02A (NOB-112): aviso imediato de vencimento anterior à
 * realização, limites, funcionário fixo na edição, erros junto aos campos sem
 * código técnico e preservação do que foi digitado. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { HealthExamForm } from "@/app/(protected)/health-exams/_components/health-exam-form";
import {
  createHealthExamAction,
  updateHealthExamAction,
} from "@/shared/server/actions/pgr/health-exams";

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/pgr/health-exams", () => ({
  createHealthExamAction: jest.fn(),
  updateHealthExamAction: jest.fn(),
}));

const EMPLOYEE = {
  id: "a1111111-1111-4111-8111-111111111111",
  fullName: "Beltrana Fictícia",
};
const OTHER = {
  id: "a2222222-2222-4222-8222-222222222222",
  fullName: "Cicrano Ficcional",
};
const EXAM_ID = "e1111111-1111-4111-8111-111111111111";

const INITIAL = {
  employeeId: EMPLOYEE.id,
  doctorId: null,
  examType: "periodic",
  performedAt: "2026-01-14",
  validUntil: "2027-01-14",
  aptitude: "fit",
  certificatePath: null,
};

beforeEach(() => jest.clearAllMocks());

function form(): HTMLFormElement {
  return document.querySelector("form")!;
}
function field(name: string): HTMLInputElement {
  return form().querySelector(`[name="${name}"]`) as HTMLInputElement;
}
function renderNew() {
  return render(
    <HealthExamForm
      employees={[EMPLOYEE]}
      doctors={[]}
      defaultEmployeeId={EMPLOYEE.id}
    />,
  );
}

describe("HealthExamForm — validações do Lote 02A", () => {
  it("vencimento anterior à realização → aviso no campo, sem chamar o servidor", () => {
    renderNew();
    fireEvent.change(field("performedAt"), { target: { value: "2026-03-10" } });
    fireEvent.change(field("validUntil"), { target: { value: "2026-03-09" } });
    fireEvent.submit(form());
    expect(screen.getByText("Vencimento anterior à realização.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Revise os campos destacados.");
    expect(createHealthExamAction).not.toHaveBeenCalled();
    // O que foi digitado continua no formulário.
    expect(field("validUntil").value).toBe("2026-03-09");
    expect(field("performedAt").value).toBe("2026-03-10");
  });

  it("vencimento igual à realização segue para o servidor e mostra o salvamento", async () => {
    jest
      .mocked(createHealthExamAction)
      .mockResolvedValue({ ok: true, data: {} } as never);
    renderNew();
    fireEvent.change(field("performedAt"), { target: { value: "2026-03-10" } });
    fireEvent.change(field("validUntil"), { target: { value: "2026-03-10" } });
    fireEvent.submit(form());
    await waitFor(() => expect(createHealthExamAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Exame salvo");
  });

  it("NOB-155: o cadastro não tem campo de observações clínicas", () => {
    renderNew();
    expect(form().querySelector('[name="notes"]')).toBeNull();
  });

  it("caminho do ASO acima de 500 caracteres → aviso no campo", () => {
    renderNew();
    fireEvent.change(field("certificatePath"), { target: { value: "p".repeat(501) } });
    fireEvent.submit(form());
    expect(
      screen.getByText("Caminho do ASO: máximo de 500 caracteres."),
    ).toBeInTheDocument();
    expect(createHealthExamAction).not.toHaveBeenCalled();
  });

  it("orienta que observações clínicas ficam no prontuário do médico", () => {
    render(<HealthExamForm employees={[EMPLOYEE]} doctors={[]} />);
    expect(
      screen.getByText(/Observações clínicas não ficam no cadastro do exame/),
    ).toBeInTheDocument();
  });

  it("edição: funcionário só para leitura, sem select, e o id original é enviado", async () => {
    jest
      .mocked(updateHealthExamAction)
      .mockResolvedValue({ ok: true, data: {} } as never);
    render(
      <HealthExamForm
        id={EXAM_ID}
        initial={INITIAL}
        employees={[EMPLOYEE, OTHER]}
        doctors={[]}
        lockedEmployee={EMPLOYEE}
      />,
    );
    expect(screen.queryByRole("combobox", { name: /Funcionário/ })).toBeNull();
    const locked = screen.getByRole("textbox", {
      name: /Funcionário/,
    }) as HTMLInputElement;
    expect(locked.readOnly).toBe(true);
    expect(locked.value).toBe(EMPLOYEE.fullName);
    fireEvent.submit(form());
    await waitFor(() =>
      expect(updateHealthExamAction).toHaveBeenCalledWith(
        EXAM_ID,
        expect.objectContaining({ employeeId: EMPLOYEE.id }),
      ),
    );
  });

  it("erro de campo do servidor aparece junto ao campo e preserva o digitado", async () => {
    jest.mocked(createHealthExamAction).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { examType: "Tipo de exame inválido" },
      },
    });
    renderNew();
    fireEvent.change(field("certificatePath"), { target: { value: "/docs/aso.pdf" } });
    fireEvent.submit(form());
    expect(await screen.findByText("Tipo de exame inválido")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Revise os campos destacados.");
    expect(field("certificatePath").value).toBe("/docs/aso.pdf");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("FORBIDDEN do servidor vira frase legível, nunca o código", async () => {
    jest.mocked(createHealthExamAction).mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    renderNew();
    fireEvent.submit(form());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/FORBIDDEN/);
    expect(alert).toHaveTextContent(/permissão/);
  });
});
