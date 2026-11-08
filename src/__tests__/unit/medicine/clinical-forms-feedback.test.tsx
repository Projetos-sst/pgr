/**
 * NOB-112 (etapa E): prontuário do exame (observação clínica, restrição ao RH) e área clínica do
 * afastamento. Erro sem lugar na tela aparece legível, inglês do Zod nunca aparece, permissão
 * segue como permissão e promessa rejeitada vira mensagem genérica sem detalhe técnico. O texto
 * clínico digitado continua no campo e nunca é repetido no resumo de erro. Dados fictícios.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { AbsenceClinicalNoteForm } from "@/app/(protected)/absences/[id]/clinical/clinical-note-form";
import {
  ClinicalNoteForm,
  WorkRestrictionForm,
} from "@/app/(protected)/health-exams/[id]/clinical-record/clinical-record-controls";
import { addAbsenceClinicalNoteAction } from "@/shared/server/actions/medicine/absences";
import {
  addClinicalNoteAction,
  recordWorkRestrictionAction,
} from "@/shared/server/actions/medicine/clinical-record";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/clinical-record", () => ({
  addClinicalNoteAction: jest.fn(),
  recordWorkRestrictionAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/absences", () => ({
  addAbsenceClinicalNoteAction: jest.fn(),
}));

const EXAM = "e1111111-1111-4111-8111-111111111111";
const ABSENCE = "a1111111-1111-4111-8111-111111111111";
const GENERIC = "Não foi possível concluir a operação. Tente novamente.";
const NOTE = "Queixa fictícia de lombalgia, sem afastamento.";

beforeEach(() => jest.clearAllMocks());

describe("prontuário do exame", () => {
  it("observação: chave sem campo legível no resumo; texto digitado mantido e fora do resumo", async () => {
    (addClinicalNoteAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { examId: "Exame inválido." },
      },
    });
    render(<ClinicalNoteForm examId={EXAM} />);
    const content = screen.getByRole("textbox", { name: /^Nova observação clínica/ });
    fireEvent.change(content, { target: { value: NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar observação" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Exame inválido.");
    expect(alert).not.toHaveTextContent(NOTE);
    expect(content).toHaveValue(NOTE);
  });

  it("observação: FORBIDDEN cru vira permissão; promessa rejeitada vira genérica", async () => {
    (addClinicalNoteAction as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    render(<ClinicalNoteForm examId={EXAM} />);
    const content = screen.getByRole("textbox", { name: /^Nova observação clínica/ });
    fireEvent.change(content, { target: { value: NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar observação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );
    expect(content).not.toHaveAttribute("aria-invalid");

    (addClinicalNoteAction as jest.Mock).mockRejectedValueOnce(
      new Error(`insert into clinical_notes values ('${NOTE}')`),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Registrar observação" }));
    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(screen.queryByText(/clinical_notes/)).not.toBeInTheDocument();
    expect(content).toHaveValue(NOTE);
  });

  it("restrição: inglês do Zod traduzido e erro da retirada aparece no resumo", async () => {
    (recordWorkRestrictionAction as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { restriction: "Too big: expected string to have <=1000 characters" },
      },
    });
    render(<WorkRestrictionForm examId={EXAM} hasCurrent />);
    fireEvent.click(screen.getByRole("button", { name: "Comunicar restrição" }));
    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Too big/);

    (recordWorkRestrictionAction as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          kind: "Informe se registra uma restrição ou a retirada das restrições.",
        },
      },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /restrições deixaram de valer/ }),
    );
    expect(
      await screen.findByText(
        "Tipo de comunicação: Informe se registra uma restrição ou a retirada das restrições.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Valor inválido.")).not.toBeInTheDocument();
  });
});

describe("área clínica do afastamento", () => {
  it("chave sem campo legível no resumo e erros por campo no lugar", async () => {
    (addAbsenceClinicalNoteAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          _: "Este afastamento foi cancelado.",
          workerAuthorization:
            "O CID só é registrado com a autorização do trabalhador (referência do termo).",
        },
      },
    });
    render(<AbsenceClinicalNoteForm absenceId={ABSENCE} />);
    fireEvent.change(screen.getByLabelText(/^CID-10/), { target: { value: "M54.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este afastamento foi cancelado.",
    );
    expect(screen.getByLabelText(/^Autorização do trabalhador/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/^CID-10/)).toHaveValue("M54.5");
  });

  it("FORBIDDEN fica como permissão; promessa rejeitada vira genérica sem vazar o CID", async () => {
    (addAbsenceClinicalNoteAction as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Somente o coordenador do PCMSO vinculado registra a área clínica.",
      },
    });
    render(<AbsenceClinicalNoteForm absenceId={ABSENCE} />);
    fireEvent.change(screen.getByLabelText(/^CID-10/), { target: { value: "M54.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Somente o coordenador do PCMSO vinculado registra a área clínica.",
    );
    expect(screen.queryByText(/Revise os campos/)).not.toBeInTheDocument();

    (addAbsenceClinicalNoteAction as jest.Mock).mockRejectedValueOnce(
      new Error("cid=M54.5 rejected"),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Registrar" }));
    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(screen.queryByText(/cid=/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^CID-10/)).toHaveValue("M54.5");
  });
});
