/**
 * Tela do prontuário (NOB-155): o médico autorizado vê as observações e os formulários; owner e
 * colaborador veem só o aviso de acesso restrito, sem conteúdo. Dados fictícios.
 */
import { render, screen } from "@testing-library/react";

import ClinicalRecordPage from "@/app/(protected)/health-exams/[id]/clinical-record/page";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  listWorkRestrictionsAction,
  readClinicalRecordAction,
} from "@/shared/server/actions/medicine/clinical-record";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn().mockResolvedValue({ role: "collaborator" }),
}));
jest.mock("@/shared/server/actions/pgr/health-exams", () => ({
  getHealthExamAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/clinical-record", () => ({
  readClinicalRecordAction: jest.fn(),
  listWorkRestrictionsAction: jest.fn(),
  addClinicalNoteAction: jest.fn(),
  recordWorkRestrictionAction: jest.fn(),
}));

const EXAM = "e1111111-1111-4111-8111-111111111111";

beforeEach(() => {
  jest.clearAllMocks();
  (getHealthExamAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { id: EXAM, examType: "periodic", performedAt: "2026-10-20" },
  });
});

async function renderPage() {
  render(await ClinicalRecordPage({ params: Promise.resolve({ id: EXAM }) }));
}

describe("ClinicalRecordPage", () => {
  it("sem vínculo autorizado: aviso de acesso restrito e nenhum formulário", async () => {
    (readClinicalRecordAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "x" },
    });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso restrito");
    expect(screen.queryByLabelText(/Nova observação clínica/)).not.toBeInTheDocument();
    expect(listWorkRestrictionsAction).not.toHaveBeenCalled();
  });

  it("médico autorizado: observações com origem, restrição vigente e formulários", async () => {
    (readClinicalRecordAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        basis: "examiner",
        notes: [
          {
            id: "n2",
            origin: "clinician",
            content: "Observação fictícia do examinador.",
            authorName: "Dr. Examinador Fictício",
            authorRegistration: "70002",
            recordedAt: "2026-10-21T10:00:00.000Z",
          },
          {
            id: "n1",
            origin: "legacy_exam_notes",
            content: "Nota antiga fictícia.",
            authorName: null,
            authorRegistration: null,
            recordedAt: "2026-01-02T10:00:00.000Z",
          },
        ],
      },
    });
    (listWorkRestrictionsAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "r1",
          kind: "restriction",
          restriction: "Não levantar cargas acima de 10 kg.",
          authorName: "Dr. Examinador Fictício",
          recordedAt: "2026-10-21T10:00:00.000Z",
        },
      ],
    });
    await renderPage();
    expect(screen.getByRole("note")).toHaveTextContent("médico examinador");
    expect(screen.getByText("Observação fictícia do examinador.")).toBeInTheDocument();
    expect(screen.getByText(/Migrada das antigas observações/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Não levantar cargas acima de 10 kg.",
    );
    expect(screen.getByLabelText(/Nova observação clínica/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Restrição comunicada ao RH/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /restrições deixaram de valer/ }),
    ).toBeInTheDocument();
  });
});
