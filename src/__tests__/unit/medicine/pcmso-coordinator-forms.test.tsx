/**
 * Formulários do coordenador do PCMSO (NOB-121, MED-02): a justificativa da
 * exceção do NR-7 7.5.2 só aparece para médico sem RQE, o aviso de UF ausente
 * aparece antes do envio e os erros do servidor chegam ao campo. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  CloseCoordinatorForm,
  DesignateCoordinatorForm,
} from "@/app/(protected)/companies/[id]/pcmso-coordinator/coordinator-forms";
import {
  closePcmsoCoordinatorAction,
  designatePcmsoCoordinatorAction,
} from "@/shared/server/actions/medicine/pcmso-coordinators";

const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/pcmso-coordinators", () => ({
  designatePcmsoCoordinatorAction: jest.fn(),
  closePcmsoCoordinatorAction: jest.fn(),
}));

const designate = designatePcmsoCoordinatorAction as jest.Mock;
const close = closePcmsoCoordinatorAction as jest.Mock;

const COMPANY_ID = "c1111111-1111-4111-8111-111111111111";
const ASSIGNMENT_ID = "d1111111-1111-4111-8111-111111111111";
const WITH_RQE = {
  id: "b1111111-1111-4111-8111-111111111111",
  label: "Dra. Fictícia — CRM 123/SP",
  hasRqe: true,
  hasUf: true,
};
const WITHOUT_RQE = {
  id: "b2222222-2222-4222-8222-222222222222",
  label: "Dr. Ficcional — CRM 456/MA",
  hasRqe: false,
  hasUf: true,
};
const WITHOUT_UF = {
  id: "b3333333-3333-4333-8333-333333333333",
  label: "Dr. Sem UF — CRM 789",
  hasRqe: true,
  hasUf: false,
};
const OPTIONS = [WITH_RQE, WITHOUT_RQE, WITHOUT_UF];

beforeEach(() => {
  jest.clearAllMocks();
});

function selectMedico(id: string) {
  fireEvent.change(screen.getByRole("combobox", { name: /Médico/ }), {
    target: { value: id },
  });
}

const reasonLabel = /Justificativa da exceção/;

describe("DesignateCoordinatorForm", () => {
  it("sem médicos ativos, o select informa que não há cadastro", () => {
    render(<DesignateCoordinatorForm companyId={COMPANY_ID} options={[]} />);
    expect(
      screen.getByRole("option", { name: "Nenhum médico ativo cadastrado" }),
    ).toBeInTheDocument();
  });

  it("médico com RQE não pede justificativa", () => {
    render(<DesignateCoordinatorForm companyId={COMPANY_ID} options={OPTIONS} />);
    selectMedico(WITH_RQE.id);
    expect(screen.queryByLabelText(reasonLabel)).not.toBeInTheDocument();
  });

  it("médico sem RQE exibe a justificativa do NR-7 7.5.2", () => {
    render(<DesignateCoordinatorForm companyId={COMPANY_ID} options={OPTIONS} />);
    selectMedico(WITHOUT_RQE.id);
    expect(screen.getByLabelText(reasonLabel)).toBeInTheDocument();
  });

  it("médico sem UF exibe o aviso antes do envio", () => {
    render(<DesignateCoordinatorForm companyId={COMPANY_ID} options={OPTIONS} />);
    selectMedico(WITHOUT_UF.id);
    expect(screen.getByRole("alert")).toHaveTextContent(/sem a UF do CRM/);
  });

  it("envia empresa, médico, início e justificativa e atualiza a página", async () => {
    designate.mockResolvedValue({ ok: true, data: {} });
    render(<DesignateCoordinatorForm companyId={COMPANY_ID} options={OPTIONS} />);
    selectMedico(WITHOUT_RQE.id);
    fireEvent.change(screen.getByLabelText(/Início/), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText(reasonLabel), {
      target: { value: "Sem médico do trabalho na localidade." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar designação" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(designate).toHaveBeenCalledWith(COMPANY_ID, {
      medicoId: WITHOUT_RQE.id,
      startsOn: "2026-11-01",
      rqeExceptionReason: "Sem médico do trabalho na localidade.",
    });
  });

  it("erro de campo do servidor aparece no campo, sem atualizar a página", async () => {
    designate.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { rqeExceptionReason: "Justifique a exceção do NR-7 (7.5.2)." },
      },
    });
    render(<DesignateCoordinatorForm companyId={COMPANY_ID} options={OPTIONS} />);
    selectMedico(WITHOUT_RQE.id);
    fireEvent.click(screen.getByRole("button", { name: "Registrar designação" }));

    expect(
      await screen.findByText("Justifique a exceção do NR-7 (7.5.2)."),
    ).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("erro geral do servidor (ex.: sem permissão) aparece como mensagem do formulário", async () => {
    designate.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Apenas o responsável pode designar." },
    });
    render(<DesignateCoordinatorForm companyId={COMPANY_ID} options={OPTIONS} />);
    selectMedico(WITH_RQE.id);
    fireEvent.click(screen.getByRole("button", { name: "Registrar designação" }));

    expect(
      await screen.findByText("Apenas o responsável pode designar."),
    ).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("CloseCoordinatorForm", () => {
  it("envia fim e motivo da designação aberta", async () => {
    close.mockResolvedValue({ ok: true, data: {} });
    render(
      <CloseCoordinatorForm
        companyId={COMPANY_ID}
        assignmentId={ASSIGNMENT_ID}
        startsOn="2026-01-01"
      />,
    );
    fireEvent.change(screen.getByLabelText(/Fim/), { target: { value: "2026-10-31" } });
    fireEvent.change(screen.getByLabelText(/Motivo/), {
      target: { value: "Encerramento do contrato." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar designação" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(close).toHaveBeenCalledWith(COMPANY_ID, ASSIGNMENT_ID, {
      endsOn: "2026-10-31",
      endReason: "Encerramento do contrato.",
    });
  });

  it("erro de campo do servidor aparece no campo", async () => {
    close.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { endsOn: "O fim não pode ser anterior ao início." },
      },
    });
    render(
      <CloseCoordinatorForm
        companyId={COMPANY_ID}
        assignmentId={ASSIGNMENT_ID}
        startsOn="2026-01-01"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Encerrar designação" }));

    expect(
      await screen.findByText("O fim não pode ser anterior ao início."),
    ).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
