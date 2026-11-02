/**
 * Tela do ASO (NOB-152): com bloqueio na conferência não oferece a prévia; sem bloqueio oferece;
 * a última versão aparece com aviso de prévia, conclusão e assinatura pendente. Fictício.
 */
import { render, screen } from "@testing-library/react";

import AsoPage from "@/app/(protected)/health-exams/[id]/aso/page";
import { asoChecklist, composeAso } from "@/shared/domains/medicine/aso";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  getAsoDocumentAction,
  getAsoReadinessAction,
  listAsoDocumentsAction,
  listExamProceduresAction,
} from "@/shared/server/actions/medicine/aso";

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
jest.mock("@/shared/server/actions/medicine/aso", () => ({
  getAsoReadinessAction: jest.fn(),
  listExamProceduresAction: jest.fn(),
  listAsoDocumentsAction: jest.fn(),
  getAsoDocumentAction: jest.fn(),
  addExamProcedureAction: jest.fn(),
  removeExamProcedureAction: jest.fn(),
  generateAsoDocumentAction: jest.fn(),
}));

const EXAM = "e1111111-1111-4111-8111-111111111111";
const content = composeAso({
  exam: {
    examType: "periodic",
    performedAt: "2026-10-20",
    aptitude: "fit",
    companyId: "c1",
  },
  employee: {
    fullName: "Pessoa Fictícia",
    cpf: "00000000191",
    companyId: "c1",
    jobRole: "Soldador",
    gesId: "g1",
    gesName: "Produção",
  },
  company: { razaoSocial: "Empresa Fictícia", cnpj: "11222333000181" },
  examiner: {
    name: "Dr. Examinador",
    profession: "physician",
    registration: "CRM 1/MA",
    registrationUf: "MA",
  },
  coordinator: null,
  risks: {
    validated: [{ description: "Ruído", agentType: "physical" }],
    pending: 0,
    usableSources: 1,
  },
  procedures: [
    { procedureCode: "0281", otherDescription: null, performedAt: "2026-10-18" },
  ],
  plannedProcedures: null,
});
const DOC = {
  id: "d1",
  version: 1,
  generatedAt: "2026-11-02T10:00:00.000Z",
  contentSha256: "b".repeat(64),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getHealthExamAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { id: EXAM, examType: "periodic", performedAt: "2026-10-20", notes: "sigilo" },
  });
  (listExamProceduresAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
});

async function renderPage() {
  render(await AsoPage({ params: Promise.resolve({ id: EXAM }) }));
}

describe("AsoPage", () => {
  it("com bloqueio, não oferece a prévia e mostra o item pendente", async () => {
    const items = [
      {
        code: "examiner_missing",
        item: "e" as const,
        severity: "blocking" as const,
        message: "Médico examinador não informado no exame.",
        reference: "MED-01",
      },
    ];
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items, checklist: asoChecklist(items) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "A prévia não pode ser gerada: 1",
    );
    expect(screen.getByText(/Bloqueia: Médico examinador/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Gerar prévia do ASO" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("sigilo")).not.toBeInTheDocument();
  });

  it("sem bloqueio, oferece gerar e mostra a última prévia com aviso e assinatura pendente", async () => {
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [], checklist: asoChecklist([]) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [DOC] });
    (getAsoDocumentAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...DOC, content },
    });
    await renderPage();
    expect(
      screen.getByRole("button", { name: "Gerar prévia do ASO" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/PRÉVIA/);
    expect(screen.getByText(/Apto para a função/)).toBeInTheDocument();
    expect(
      screen.getByText(/Assinatura do médico examinador pendente/),
    ).toBeInTheDocument();
    expect(screen.getByText(`SHA-256 ${"b".repeat(64)}`)).toBeInTheDocument();
    expect(screen.queryByText("sigilo")).not.toBeInTheDocument();
  });
});
