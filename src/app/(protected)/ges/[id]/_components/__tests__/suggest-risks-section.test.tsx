jest.mock("@/shared/server/actions/pgr/ai-risk-suggestion", () => ({
  suggestRisks: jest.fn(),
  acceptSuggestedRisks: jest.fn(),
  fillRisk: jest.fn(),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  acceptSuggestedRisks,
  suggestRisks,
} from "@/shared/server/actions/pgr/ai-risk-suggestion";
import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";

import { SuggestRisksSection } from "../suggest-risks-section";

const GES_ID = "11111111-1111-1111-1111-111111111111";
const mockedSuggest = jest.mocked(suggestRisks);
const mockedAccept = jest.mocked(acceptSuggestedRisks);

const TWO_RISKS = [
  {
    agentType: "physical",
    description: "Ruído contínuo",
    hazard: "Ruído",
    sources: "Compressor",
    propagation: "Via aérea",
    possibleInjuries: "PAIR",
    exposureTime: "habitual",
  },
  { agentType: "chemical", description: "Poeira de madeira" },
];

function okSuggestions() {
  mockedSuggest.mockResolvedValue({
    ok: true,
    data: {
      suggestions: [
        {
          agentType: "physical",
          description: "Ruído contínuo",
          hazard: "Ruído",
          sources: "Compressor",
          propagation: "Via aérea",
          possibleInjuries: "PAIR",
          exposureTime: "habitual",
        },
        { agentType: "chemical", description: "Poeira de madeira" },
      ],
    },
  });
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
  return screen.findByRole("group", { name: "Risco 1" });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
  mockedSuggest.mockReset();
  mockedAccept.mockReset();
});

describe("SuggestRisksSection — preenchimento de riscos pela IA", () => {
  it("mostra o aviso antes de preencher e só chama a IA depois do aceite", async () => {
    localStorage.clear();
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestRisksSection gesId={GES_ID} />);

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    expect(mockedSuggest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));
    expect(await screen.findByRole("group", { name: "Risco 1" })).toBeInTheDocument();
    expect(mockedSuggest).toHaveBeenCalledWith(GES_ID);
  });

  it("abre cada risco como cartão editável já preenchido e marcado como da IA", async () => {
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestRisksSection gesId={GES_ID} />);

    const first = await generate(user);
    expect(within(first).getByLabelText(/Descrição/)).toHaveValue("Ruído contínuo");
    expect(within(first).getByLabelText(/Meios de propagação/)).toHaveValue("Via aérea");
    expect(within(first).getByLabelText(/Possíveis lesões/)).toHaveValue("PAIR");
    expect(within(first).getByLabelText(/Tempo de exposição/)).toHaveValue("habitual");
    expect(within(first).getByLabelText(/Grupo do agente/)).toHaveValue("physical");
    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("só salva depois da confirmação e envia os valores editados sem os removidos", async () => {
    okSuggestions();
    mockedAccept.mockResolvedValue({ ok: true, data: { created: 1 } });
    const user = userEvent.setup();
    render(<SuggestRisksSection gesId={GES_ID} />);

    const first = await generate(user);
    const description = within(first).getByLabelText(/Descrição/);
    await user.clear(description);
    await user.type(description, "Ruído revisado");
    await user.click(
      within(screen.getByRole("group", { name: "Risco 2" })).getByRole("button", {
        name: "Remover",
      }),
    );
    expect(screen.queryByRole("group", { name: "Risco 2" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar riscos" }));
    expect(mockedAccept).not.toHaveBeenCalled();
    expect(
      screen.getByText("Confirmar conteúdo preenchido pela IA pgr-e"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => expect(mockedAccept).toHaveBeenCalledTimes(1));
    expect(mockedAccept).toHaveBeenCalledWith(GES_ID, {
      suggestions: [
        {
          ...TWO_RISKS[0],
          description: "Ruído revisado",
        },
      ],
    });
    expect(await screen.findByText(/1 risco\(s\) salvo\(s\)/)).toBeInTheDocument();
  });

  it("voltar e revisar não salva nada", async () => {
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestRisksSection gesId={GES_ID} />);

    await generate(user);
    await user.click(screen.getByRole("button", { name: "Salvar riscos" }));
    await user.click(screen.getByRole("button", { name: "Voltar e revisar" }));

    expect(mockedAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Risco 1" })).toBeInTheDocument();
  });

  it("explica quando a IA está indisponível", async () => {
    mockedSuggest.mockResolvedValue({
      ok: false,
      error: { code: "AI_UNAVAILABLE", message: "erro cru" },
    });
    const user = userEvent.setup();
    render(<SuggestRisksSection gesId={GES_ID} />);

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    expect(await screen.findByText(/indisponível/)).toBeInTheDocument();
    expect(screen.queryByText("erro cru")).not.toBeInTheDocument();
  });
});
