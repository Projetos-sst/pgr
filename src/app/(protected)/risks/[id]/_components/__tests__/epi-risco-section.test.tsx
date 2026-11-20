jest.mock("@/shared/server/actions/pgr/epi-risk", () => ({
  listRiskEpisAction: jest.fn(),
  listAvailableEpisForRiskAction: jest.fn(),
  addRiskEpiAction: jest.fn(),
  updateRiskEpiAction: jest.fn(),
  removeRiskEpiAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/ai-epi-risk-fill", () => ({
  fillRiskEpisAction: jest.fn(),
  acceptRiskEpiFillAction: jest.fn(),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  listAvailableEpisForRiskAction,
  listRiskEpisAction,
} from "@/shared/server/actions/pgr/epi-risk";
import {
  acceptRiskEpiFillAction,
  fillRiskEpisAction,
} from "@/shared/server/actions/pgr/ai-epi-risk-fill";
import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";

import { EpiRiscoSection } from "../epi-risco-section";

const RISK_ID = "11111111-1111-4111-8111-1111111111d1";
const PLUG = "11111111-1111-4111-8111-1111111111e1";
const LUVA = "11111111-1111-4111-8111-1111111111e2";

const mockedLinked = jest.mocked(listRiskEpisAction);
const mockedAvailable = jest.mocked(listAvailableEpisForRiskAction);
const mockedFill = jest.mocked(fillRiskEpisAction);
const mockedAccept = jest.mocked(acceptRiskEpiFillAction);

function withCatalog() {
  mockedLinked.mockResolvedValue({ ok: true, data: [] });
  mockedAvailable.mockResolvedValue({
    ok: true,
    data: [
      { catalogId: PLUG, name: "Protetor auricular plug", ca: "456" },
      { catalogId: LUVA, name: "Luva nitrílica", ca: null },
    ],
  });
}

function okFill() {
  mockedFill.mockResolvedValue({
    ok: true,
    data: {
      links: [
        {
          catalogId: PLUG,
          neutralization: "neutralizes",
          rationale: "Atenua o ruído",
          name: "Protetor auricular plug",
          ca: "456",
        },
        {
          catalogId: LUVA,
          neutralization: "not_applicable",
          name: "Luva nitrílica",
          ca: null,
        },
      ],
    },
  });
}

async function fillButton() {
  const button = await screen.findByRole("button", { name: "Preencher com IA pgr-e" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await fillButton());
  return screen.findByRole("group", { name: "EPI 1" });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
  jest.clearAllMocks();
});

describe("EpiRiscoSection — preenchimento de EPIs pela IA", () => {
  it("desabilita a IA e pede cadastro quando o catálogo não tem EPI", async () => {
    mockedLinked.mockResolvedValue({ ok: true, data: [] });
    mockedAvailable.mockResolvedValue({ ok: true, data: [] });
    render(<EpiRiscoSection riskId={RISK_ID} />);

    expect(await screen.findByText(/Cadastre EPIs no catálogo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preencher com IA pgr-e" })).toBeDisabled();
  });

  it("mostra o aviso antes de preencher e só chama a IA depois do aceite", async () => {
    localStorage.clear();
    withCatalog();
    okFill();
    const user = userEvent.setup();
    render(<EpiRiscoSection riskId={RISK_ID} />);

    await user.click(await fillButton());
    expect(mockedFill).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));
    expect(await screen.findByRole("group", { name: "EPI 1" })).toBeInTheDocument();
    expect(mockedFill).toHaveBeenCalledWith(RISK_ID);
  });

  it("abre cada EPI com a neutralização editável e marcada como da IA", async () => {
    withCatalog();
    okFill();
    const user = userEvent.setup();
    render(<EpiRiscoSection riskId={RISK_ID} />);

    const first = await generate(user);
    expect(within(first).getByText("Protetor auricular plug")).toBeInTheDocument();
    expect(within(first).getByText(/CA 456/)).toBeInTheDocument();
    expect(within(first).getByLabelText(/Neutraliza os Riscos/)).toHaveValue(
      "neutralizes",
    );
    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(2);
  });

  it("só grava depois da confirmação, com a neutralização editada e sem os removidos", async () => {
    withCatalog();
    okFill();
    mockedAccept.mockResolvedValue({ ok: true, data: { created: 1, skipped: 0 } });
    const user = userEvent.setup();
    render(<EpiRiscoSection riskId={RISK_ID} />);

    const first = await generate(user);
    await user.selectOptions(
      within(first).getByLabelText(/Neutraliza os Riscos/),
      "does_not_neutralize",
    );
    await user.click(
      within(screen.getByRole("group", { name: "EPI 2" })).getByRole("button", {
        name: "Remover",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar EPIs" }));
    expect(mockedAccept).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));

    await waitFor(() => expect(mockedAccept).toHaveBeenCalledTimes(1));
    expect(mockedAccept).toHaveBeenCalledWith(RISK_ID, {
      links: [{ catalogId: PLUG, neutralization: "does_not_neutralize" }],
    });
    expect(await screen.findByText(/1 EPI\(s\) vinculado\(s\)/)).toBeInTheDocument();
  });

  it("voltar e revisar não grava nada", async () => {
    withCatalog();
    okFill();
    const user = userEvent.setup();
    render(<EpiRiscoSection riskId={RISK_ID} />);

    await generate(user);
    await user.click(screen.getByRole("button", { name: "Salvar EPIs" }));
    await user.click(screen.getByRole("button", { name: "Voltar e revisar" }));
    expect(mockedAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "EPI 1" })).toBeInTheDocument();
  });

  it("explica quando a cota acabou", async () => {
    withCatalog();
    mockedFill.mockResolvedValue({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "erro cru" },
    });
    const user = userEvent.setup();
    render(<EpiRiscoSection riskId={RISK_ID} />);

    await user.click(await fillButton());
    expect(await screen.findByText(/limite mensal/)).toBeInTheDocument();
    expect(screen.queryByText("erro cru")).not.toBeInTheDocument();
  });

  it("usa os campos do design system, sem select solto", async () => {
    withCatalog();
    const { container } = render(<EpiRiscoSection riskId={RISK_ID} />);
    await fillButton();
    expect(container.querySelector("select:not(.appearance-none)")).toBeNull();
    expect(screen.getByLabelText(/Adicionar EPI/)).toBeInTheDocument();
  });
});
