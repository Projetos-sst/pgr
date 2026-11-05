/**
 * NOB-112 (lote 02B): a decisão de um item do plano de exames é retomada sem perda. Ao reabrir o
 * rascunho, o formulário traz a justificativa já registrada pelo médico; alterar só a
 * periodicidade não apaga a justificativa. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ExamPlanPage from "@/app/(protected)/companies/[id]/exam-plan/page";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  decideExamPlanItemAction,
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
const PLAN_ID = "p1111111-1111-4111-8111-111111111111";
const ADDED_ID = "i2222222-2222-4222-8222-222222222222";
const SAVED_WHY = "Acrescentado pela exposição fictícia descrita no PGR.";

const PLAN = {
  id: PLAN_ID,
  companyId: COMPANY,
  version: 1,
  status: "draft" as const,
  approvedAt: null,
  approvalNote: null,
  canDecide: true,
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
    {
      id: ADDED_ID,
      procedureCode: "1057",
      otherDescription: null,
      exposureGroup: "Produção",
      jobRole: "",
      origin: "added",
      decision: "kept" as const,
      periodicity: "Anual",
      justification: SAVED_WHY,
    },
  ],
  events: [],
};

const decide = decideExamPlanItemAction as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
  (listExamPlansAction as jest.Mock).mockResolvedValue({ ok: true, data: [PLAN] });
  (getExamPlanAction as jest.Mock).mockResolvedValue({ ok: true, data: PLAN });
  decide.mockResolvedValue({ ok: true, data: {} });
});

async function itemOf(code: string) {
  render(await ExamPlanPage({ params: Promise.resolve({ id: COMPANY }) }));
  const item = screen
    .getAllByRole("listitem")
    .find((li) => li.textContent?.includes(code));
  if (!item) throw new Error(`item ${code} não renderizado`);
  return item;
}

const field = (item: HTMLElement, name: string) =>
  item.querySelector(`[name="${name}"]`) as HTMLInputElement;

describe("decisão do item do plano de exames: retomada sem perda", () => {
  it("reabrir o rascunho traz a justificativa já registrada no formulário", async () => {
    const item = await itemOf("1057");
    expect(field(item, "justification").value).toBe(SAVED_WHY);
    expect(field(item, "periodicity").value).toBe("Anual");
  });

  it("alterar só a periodicidade envia a justificativa salva, sem apagá-la", async () => {
    const item = await itemOf("1057");
    fireEvent.change(field(item, "periodicity"), {
      target: { value: "Admissional e a cada dois anos" },
    });
    fireEvent.click(within(item).getByRole("button", { name: "Registrar decisão" }));
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
    expect(decide).toHaveBeenCalledWith(PLAN_ID, ADDED_ID, {
      decision: "kept",
      periodicity: "Admissional e a cada dois anos",
      justification: SAVED_WHY,
    });
  });

  it("o rótulo diz quando a justificativa é obrigatória: exame acrescentado ou retirada", async () => {
    const added = await itemOf("1057");
    expect(added).toHaveTextContent(/obrigatória para exame acrescentado/);
  });

  it("item sugerido sem justificativa abre vazio e o médico pode limpá-la de propósito", async () => {
    const suggested = await itemOf("0281");
    expect(field(suggested, "justification").value).toBe("");
    fireEvent.click(within(suggested).getByRole("button", { name: "Registrar decisão" }));
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
    expect(decide.mock.calls[0][2]).toEqual({
      decision: "kept",
      periodicity: "Anual",
      justification: undefined,
    });
  });
});
