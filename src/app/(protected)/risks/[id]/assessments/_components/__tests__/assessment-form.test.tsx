jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/pgr/risk-assessments", () => ({
  createRiskAssessmentAction: jest.fn(),
  updateRiskAssessmentAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/ai-risk-assessment-fill", () => ({
  fillRiskAssessmentAction: jest.fn(),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRiskAssessmentAction } from "@/shared/server/actions/pgr/risk-assessments";
import { fillRiskAssessmentAction } from "@/shared/server/actions/pgr/ai-risk-assessment-fill";
import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";
import type { FilledRiskAssessment } from "@/shared/domains/pgr/ai-risk-assessment-fill";

import { AssessmentForm } from "../assessment-form";

const RISK_ID = "11111111-1111-4111-8111-111111111111";
const BADGE = "Preenchido pela IA pgr-e";

const mockedFill = jest.mocked(fillRiskAssessmentAction);
const mockedCreate = jest.mocked(createRiskAssessmentAction);

function renderForm(nr09Eligible = true) {
  return render(
    <AssessmentForm
      riskId={RISK_ID}
      bands={[{ classification: "moderate", maxLevel: 25 }]}
      configured
      initial={{ assessedAt: "2026-11-20" }}
      nr09Eligible={nr09Eligible}
    />,
  );
}

function aiFilled(assessment: FilledRiskAssessment) {
  mockedFill.mockResolvedValue({ ok: true, data: { assessment } });
}

const qualitative: FilledRiskAssessment = {
  criterion: "qualitative",
  probability: 4,
  severity: 3,
  evaluationMethod: null,
  justification: "Exposição habitual ao ruído da prensa.",
};

async function fillWithAi() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
  await waitFor(() => expect(screen.getByLabelText(/Probabilidade/)).toHaveValue("4"));
  return user;
}

describe("AssessmentForm — preencher com a IA pgr-e", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    mockedFill.mockReset();
    mockedCreate.mockReset();
    mockedCreate.mockResolvedValue({
      ok: false,
      error: { code: "X", message: "falhou" },
    });
  });

  it("mostra o aviso obrigatório antes de gerar quando ele não foi dispensado", async () => {
    localStorage.clear();
    aiFilled(qualitative);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));

    expect(mockedFill).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));
    await waitFor(() => expect(mockedFill).toHaveBeenCalledWith(RISK_ID));
  });

  it("preenche critério, probabilidade e severidade, marca cada um e mostra a justificativa", async () => {
    aiFilled(qualitative);
    renderForm();

    await fillWithAi();

    expect(screen.getByLabelText(/Critério/)).toHaveValue("qualitative");
    expect(screen.getByLabelText(/Severidade/)).toHaveValue("3");
    expect(screen.getAllByText(BADGE)).toHaveLength(3);
    expect(screen.getByText(/Exposição habitual ao ruído da prensa/)).toBeInTheDocument();
  });

  it("no quantitativo preenche o método, mas nunca valor medido, limite nem conclusão", async () => {
    aiFilled({ ...qualitative, criterion: "quantitative", evaluationMethod: "NHO-01" });
    renderForm();

    await fillWithAi();

    expect(screen.getByLabelText(/Método de avaliação/)).toHaveValue("NHO-01");
    expect(screen.getByLabelText(/Valor medido/)).toHaveValue("");
    expect(screen.getByLabelText(/Limite de tolerância \(valor\)/)).toHaveValue("");
    expect(screen.getByLabelText(/Conclusão/)).toHaveValue("");
    expect(screen.getAllByText(BADGE)).toHaveLength(4);
  });

  it("tira a marca da IA do campo que o usuário editou", async () => {
    aiFilled(qualitative);
    renderForm();

    const user = await fillWithAi();
    await user.selectOptions(screen.getByLabelText(/Severidade/), "5");

    expect(screen.getAllByText(BADGE)).toHaveLength(2);
  });

  it("pede confirmação antes de salvar o que a IA preencheu e salva os valores revisados", async () => {
    aiFilled(qualitative);
    renderForm();

    const user = await fillWithAi();
    await user.selectOptions(screen.getByLabelText(/Severidade/), "5");
    await user.click(screen.getByRole("button", { name: "Criar avaliação" }));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Confirmar conteúdo preenchido pela IA pgr-e"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate).toHaveBeenCalledWith(
      RISK_ID,
      expect.objectContaining({
        criterion: "qualitative",
        probability: "4",
        severity: "5",
      }),
    );
  });

  it("salva direto quando nada foi preenchido pela IA", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Criar avaliação" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText("Confirmar conteúdo preenchido pela IA pgr-e"),
    ).not.toBeInTheDocument();
  });

  it("explica a cota mensal estourada", async () => {
    mockedFill.mockResolvedValue({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "cru" },
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));

    expect(await screen.findByText(/limite mensal/)).toBeInTheDocument();
  });

  it("avisa quando a IA não devolve avaliação", async () => {
    mockedFill.mockResolvedValue({ ok: true, data: { assessment: null } });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));

    expect(await screen.findByText(/não conseguiu preencher/)).toBeInTheDocument();
  });

  it("não usa campo nativo fora do design system", () => {
    const { container } = renderForm();
    expect(container.querySelectorAll("select:not(.appearance-none)")).toHaveLength(0);
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
  });
});
