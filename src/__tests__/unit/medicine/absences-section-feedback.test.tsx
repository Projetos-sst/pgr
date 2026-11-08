/**
 * NOB-112 (etapa E): afastamentos na ficha do funcionário (registro, retorno, previsão e
 * cancelamento). Erro sem lugar na tela aparece legível (antes sumia), inglês do Zod nunca
 * aparece, FORBIDDEN cru vira permissão e promessa rejeitada vira mensagem genérica, mantendo
 * o que foi digitado. Dados fictícios, sem CID nem atestado.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import {
  AbsencesSection,
  type AbsenceItem,
} from "@/app/(protected)/employees/[id]/_components/absences-section";
import {
  cancelAbsenceAction,
  confirmAbsenceReturnAction,
  createAbsenceAction,
} from "@/shared/server/actions/medicine/absences";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/absences", () => ({
  createAbsenceAction: jest.fn(),
  updateAbsenceEndAction: jest.fn(),
  confirmAbsenceReturnAction: jest.fn(),
  cancelAbsenceAction: jest.fn(),
}));

const EMPLOYEE = "f1111111-1111-4111-8111-111111111111";
const GENERIC = "Não foi possível concluir a operação. Tente novamente.";
const ONGOING: AbsenceItem = {
  id: "a1111111-1111-4111-8111-111111111111",
  cause: "illness",
  workRelation: "not_determined",
  startsOn: "2026-10-01",
  endsOn: null,
  returnedOn: null,
  cancelledAt: null,
  cancelReason: null,
  assessment: {
    status: "ongoing",
    elapsedDays: 10,
    knownDays: null,
    returnExam: {
      state: "monitor",
      reason: "Duração ainda abaixo de 30 dias.",
      mustBeDoneBefore: null,
      recordedOn: null,
      requiresMedicalConfirmation: true,
      reference: "NR-7 7.5.9",
    },
    socialSecurityReferral: null,
  },
};

beforeEach(() => jest.clearAllMocks());

const createButton = () => screen.getByRole("button", { name: "Registrar afastamento" });

describe("registrar afastamento", () => {
  it("chave sem campo (funcionário) vira item legível; erro de data fica no campo", async () => {
    (createAbsenceAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          employeeId: "Funcionário é obrigatório.",
          startsOn: "Data de início inválida.",
        },
      },
    });
    render(<AbsencesSection employeeId={EMPLOYEE} items={[]} loadError={null} />);
    fireEvent.click(createButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Funcionário: Funcionário é obrigatório.",
    );
    expect(screen.getByLabelText(/^Início/)).toHaveAccessibleDescription(
      "Data de início inválida.",
    );
    expect(document.body).not.toHaveTextContent(/employeeId/);
  });

  it("relação com o trabalho sem campo visível (causa 'outro') aparece no resumo", async () => {
    (createAbsenceAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          workRelation: "Para outro motivo, a relação com o trabalho não se aplica.",
        },
      },
    });
    render(<AbsencesSection employeeId={EMPLOYEE} items={[]} loadError={null} />);
    fireEvent.change(screen.getByRole("combobox", { name: /^Causa/ }), {
      target: { value: "other" },
    });
    fireEvent.click(createButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Relação com o trabalho: Para outro motivo, a relação com o trabalho não se aplica.",
    );
  });

  it("promessa rejeitada: mensagem genérica, datas mantidas e botão liberado", async () => {
    (createAbsenceAction as jest.Mock).mockRejectedValue(new Error("deadlock detected"));
    render(<AbsencesSection employeeId={EMPLOYEE} items={[]} loadError={null} />);
    fireEvent.change(screen.getByLabelText(/^Início/), {
      target: { value: "2026-10-01" },
    });
    fireEvent.click(createButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.queryByText(/deadlock/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Início/)).toHaveValue("2026-10-01");
    expect(
      await screen.findByRole("button", { name: "Registrar afastamento" }),
    ).toBeEnabled();
  });
});

describe("ações do afastamento em andamento", () => {
  it("cancelamento: inglês do Zod traduzido; FORBIDDEN cru vira permissão", async () => {
    (cancelAbsenceAction as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { reason: "Invalid input: expected string, received null" },
      },
    });
    render(<AbsencesSection employeeId={EMPLOYEE} items={[ONGOING]} loadError={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar registro" }));
    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Invalid input/);

    (cancelAbsenceAction as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar registro" }));
    expect(
      await screen.findByText("Você não tem permissão para esta operação."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /^Motivo do cancelamento/ }),
    ).not.toHaveAttribute("aria-invalid");
  });

  it("retorno: promessa rejeitada vira mensagem genérica e a data fica", async () => {
    (confirmAbsenceReturnAction as jest.Mock).mockRejectedValue(new Error("boom"));
    render(<AbsencesSection employeeId={EMPLOYEE} items={[ONGOING]} loadError={null} />);
    fireEvent.change(screen.getByLabelText(/^Retorno confirmado em/), {
      target: { value: "2026-10-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retorno" }));

    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Retorno confirmado em/)).toHaveValue("2026-10-20");
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
