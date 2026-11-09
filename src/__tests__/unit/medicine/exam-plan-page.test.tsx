/**
 * Tela do plano de exames (NOB-150): a coordenadora vinculada vê decisões e aprovação; a equipe
 * vê o rascunho sem controles e o aviso do vínculo; aprovado não tem controles. Dados fictícios.
 */
import { render, screen } from "@testing-library/react";

import ExamPlanPage from "@/app/(protected)/companies/[id]/exam-plan/page";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  getExamPlanAction,
  listExamPlansAction,
} from "@/shared/server/actions/medicine/exam-plans";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn().mockResolvedValue({ role: "collaborator" }),
}));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  getCompanyAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/exam-plans", () => ({
  listExamPlansAction: jest.fn(),
  getExamPlanAction: jest.fn(),
  createExamPlanDraftAction: jest.fn(),
  decideExamPlanItemAction: jest.fn(),
  addExamPlanItemAction: jest.fn(),
  approveExamPlanAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const PLAN = {
  id: "p1111111-1111-4111-8111-111111111111",
  companyId: COMPANY,
  version: 1,
  status: "draft" as const,
  approvedAt: null,
  approvalNote: null,
  items: [
    {
      id: "i1111111-1111-4111-8111-111111111111",
      procedureCode: "0281",
      otherDescription: null,
      exposureGroup: "Produção",
      jobRole: "",
      origin: "suggested",
      decision: "kept" as const,
      periodicity: "Anual",
      justification: null,
    },
  ],
  events: [
    {
      id: "e1",
      event: "draft_created",
      actor: "staff",
      createdAt: "2026-11-02T10:00:00.000Z",
    },
  ],
};

const list = listExamPlansAction as jest.Mock;
const get = getExamPlanAction as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
  list.mockResolvedValue({ ok: true, data: [PLAN] });
});

async function renderPage() {
  render(await ExamPlanPage({ params: Promise.resolve({ id: COMPANY }) }));
}

describe("ExamPlanPage", () => {
  it("coordenadora vinculada vê decisão, acréscimo e aprovação", async () => {
    get.mockResolvedValue({ ok: true, data: { ...PLAN, canDecide: true } });
    await renderPage();
    expect(screen.getByText("Audiometria tonal ocupacional")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar decisão" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acrescentar exame" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprovar plano" })).toBeInTheDocument();
  });

  it("equipe sem vínculo vê o rascunho, sem controles, e o aviso", async () => {
    get.mockResolvedValue({ ok: true, data: { ...PLAN, canDecide: false } });
    await renderPage();
    expect(screen.getByRole("note")).toHaveTextContent(/Somente o médico coordenador/);
    expect(
      screen.queryByRole("button", { name: "Aprovar plano" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar decisão" }),
    ).not.toBeInTheDocument();
  });

  it("plano aprovado não tem controles e oferece nova versão", async () => {
    const approved = {
      ...PLAN,
      status: "approved" as const,
      approvedAt: "2026-11-02T12:00:00.000Z",
    };
    list.mockResolvedValue({ ok: true, data: [approved] });
    get.mockResolvedValue({ ok: true, data: { ...approved, canDecide: true } });
    await renderPage();
    expect(screen.getByText(/Versão 1 · Aprovado/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aprovar plano" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preparar rascunho a partir da proposta" }),
    ).toBeInTheDocument();
  });

  it("rascunho sobre riscos que mudaram: sem aprovação, com aviso e novo rascunho; descartado na lista", async () => {
    const discarded = {
      ...PLAN,
      id: "p0000000-0000-4000-8000-000000000000",
      version: 1,
      status: "superseded" as const,
    };
    const stale = { ...PLAN, version: 2 };
    list.mockResolvedValue({ ok: true, data: [stale, discarded] });
    get.mockResolvedValue({
      ok: true,
      data: { ...stale, canDecide: true, basis: "outdated" },
    });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /riscos validados mudaram desde que este rascunho foi preparado/,
    );
    expect(
      screen.queryByRole("button", { name: "Aprovar plano" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preparar rascunho a partir da proposta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Versão 1 · Rascunho descartado/)).toBeInTheDocument();
  });

  it("sem plano, oferece preparar o rascunho; erro do servidor aparece", async () => {
    list.mockResolvedValue({ ok: true, data: [] });
    await renderPage();
    expect(screen.getByText("Nenhum plano preparado ainda.")).toBeInTheDocument();
    list.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Medicina não habilitada para esta empresa." },
    });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Medicina não habilitada");
  });
});
