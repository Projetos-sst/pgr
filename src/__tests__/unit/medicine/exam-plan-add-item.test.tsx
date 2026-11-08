/**
 * NOB-112 / NOB-150: formulário "Acrescentar exame" do plano de exames. Limpa os campos só depois
 * do sucesso confirmado pelo servidor e avisa com `role="status"`; erro de campo, recusa do
 * servidor (ex.: exame repetido) e falha de rede mantêm o que foi digitado; um segundo envio
 * enquanto o primeiro está pendente é ignorado. Dados fictícios.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ExamPlanPage from "@/app/(protected)/companies/[id]/exam-plan/page";
import { EXAM_PLAN_ITEM_DUPLICATE_MESSAGE } from "@/shared/domains/medicine/exam-plan";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  addExamPlanItemAction,
  getExamPlanAction,
  listExamPlansAction,
} from "@/shared/server/actions/medicine/exam-plans";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
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
const WHY = "Acrescentado pela exposição fictícia descrita no PGR.";

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
  ],
  events: [],
};

const TYPED = {
  exposureGroup: "Produção",
  jobRole: "Operador fictício",
  code: "1057",
  periodicity: "Admissional e a cada dois anos",
  justification: WHY,
};

const add = addExamPlanItemAction as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
  (listExamPlansAction as jest.Mock).mockResolvedValue({ ok: true, data: [PLAN] });
  (getExamPlanAction as jest.Mock).mockResolvedValue({ ok: true, data: PLAN });
});

async function addForm() {
  render(await ExamPlanPage({ params: Promise.resolve({ id: COMPANY }) }));
  const form = screen.getByRole("button", { name: "Acrescentar exame" }).closest("form");
  if (!form) throw new Error("formulário de acréscimo não renderizado");
  return form;
}

const field = (form: HTMLElement, name: string) =>
  form.querySelector(`[name="${name}"]`) as HTMLInputElement;

function type(form: HTMLElement) {
  for (const [name, value] of Object.entries(TYPED))
    fireEvent.change(field(form, name), { target: { value } });
}

function expectTyped(form: HTMLElement) {
  for (const [name, value] of Object.entries(TYPED))
    expect(field(form, name).value).toBe(value);
}

describe("acrescentar exame ao plano: sucesso, erro e envio repetido", () => {
  it("sucesso confirmado pelo servidor limpa os campos e mostra o aviso", async () => {
    add.mockResolvedValue({ ok: true, data: {} });
    const form = await addForm();
    type(form);
    fireEvent.click(within(form).getByRole("button", { name: "Acrescentar exame" }));

    expect(await within(form).findByRole("status")).toHaveTextContent(
      /Exame acrescentado ao plano/,
    );
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(PLAN_ID, { ...TYPED, otherDescription: undefined });
    for (const name of [...Object.keys(TYPED), "otherDescription"])
      expect(field(form, name).value).toBe("");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(within(form).queryByRole("alert")).toBeNull();
  });

  it("erro de validação mantém o que foi digitado e mostra o erro do campo", async () => {
    add.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { code: "Código fora da Tabela 27." },
      },
    });
    const form = await addForm();
    type(form);
    fireEvent.click(within(form).getByRole("button", { name: "Acrescentar exame" }));

    expect(
      await within(form).findByText("Código fora da Tabela 27."),
    ).toBeInTheDocument();
    expectTyped(form);
    expect(within(form).queryByRole("status")).toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("exame repetido: a mensagem clara do servidor aparece e os valores ficam", async () => {
    add.mockResolvedValue({
      ok: false,
      error: { code: "DUPLICATE", message: EXAM_PLAN_ITEM_DUPLICATE_MESSAGE },
    });
    const form = await addForm();
    type(form);
    fireEvent.click(within(form).getByRole("button", { name: "Acrescentar exame" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      EXAM_PLAN_ITEM_DUPLICATE_MESSAGE,
    );
    expectTyped(form);
    expect(within(form).queryByRole("status")).toBeNull();
  });

  it("falha de rede (promessa rejeitada) mostra mensagem genérica, mantém os valores e libera o botão", async () => {
    add.mockRejectedValue(new TypeError("Failed to fetch"));
    const form = await addForm();
    type(form);
    fireEvent.click(within(form).getByRole("button", { name: "Acrescentar exame" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      /Não foi possível concluir agora/,
    );
    expectTyped(form);
    // O fim da transição libera o botão logo depois de a mensagem aparecer.
    expect(
      await within(form).findByRole("button", { name: "Acrescentar exame" }),
    ).toBeEnabled();
    expect(within(form).queryByRole("status")).toBeNull();

    // Depois da falha, um novo envio funciona.
    add.mockResolvedValue({ ok: true, data: {} });
    fireEvent.click(within(form).getByRole("button", { name: "Acrescentar exame" }));
    expect(await within(form).findByRole("status")).toBeInTheDocument();
    expect(add).toHaveBeenCalledTimes(2);
  });

  it("enquanto o envio está pendente, o botão fica desabilitado e um segundo envio é ignorado", async () => {
    let resolve: (value: unknown) => void = () => {};
    add.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const form = await addForm();
    type(form);
    fireEvent.submit(form);
    fireEvent.submit(form);

    const button = within(form).getByRole("button", { name: "Salvando…" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(add).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true, data: {} });
    });
    await waitFor(() => expect(within(form).getByRole("status")).toBeInTheDocument());
    expect(add).toHaveBeenCalledTimes(1);
    expect(field(form, "code").value).toBe("");
  });
});
