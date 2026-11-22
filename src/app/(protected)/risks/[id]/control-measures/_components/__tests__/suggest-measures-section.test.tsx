jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/pgr/ai-control-measures", () => ({
  suggestControlMeasures: jest.fn(),
  acceptSuggestedControlMeasures: jest.fn(),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  acceptSuggestedControlMeasures,
  suggestControlMeasures,
} from "@/shared/server/actions/pgr/ai-control-measures";
import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";

import { SuggestMeasuresSection } from "../suggest-measures-section";

const RISK_ID = "11111111-1111-1111-1111-1111111111d1";
const mockedSuggest = jest.mocked(suggestControlMeasures);
const mockedAccept = jest.mocked(acceptSuggestedControlMeasures);

function okSuggestions(requiresResponsibleAndDeadline = false) {
  mockedSuggest.mockResolvedValue({
    ok: true,
    data: {
      requiresResponsibleAndDeadline,
      existingLevels: ["elimination"],
      suggestions: [
        {
          controlLevel: "collective_protection",
          actionWhat: "Enclausurar o compressor",
          actionWhy: "Reduzir o ruído na fonte",
          actionHow: "Instalar cabine acústica",
          monitoring: "Dosimetria semestral",
          justification: "Controle coletivo antes do EPI",
        },
        {
          controlLevel: "ppe",
          actionWhat: "Fornecer protetor auricular",
          actionHow: "Entregar com ficha de EPI",
        },
      ],
    },
  });
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
  return screen.findByRole("group", { name: "Medida 1" });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
  mockedSuggest.mockReset();
  mockedAccept.mockReset();
});

describe("SuggestMeasuresSection — preenchimento de medidas pela IA", () => {
  it("mostra o aviso antes de preencher e só chama a IA depois do aceite", async () => {
    localStorage.clear();
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestMeasuresSection riskId={RISK_ID} />);

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    expect(mockedSuggest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));
    expect(await screen.findByRole("group", { name: "Medida 1" })).toBeInTheDocument();
    expect(mockedSuggest).toHaveBeenCalledWith(RISK_ID);
  });

  it("abre cada medida como cartão editável já preenchido e marcado como da IA", async () => {
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestMeasuresSection riskId={RISK_ID} />);

    const first = await generate(user);
    expect(within(first).getByLabelText(/Nível de controle/)).toHaveValue(
      "collective_protection",
    );
    expect(within(first).getByLabelText(/O que será feito/)).toHaveValue(
      "Enclausurar o compressor",
    );
    expect(within(first).getByLabelText(/Por que/)).toHaveValue(
      "Reduzir o ruído na fonte",
    );
    expect(within(first).getByLabelText(/Como/)).toHaveValue("Instalar cabine acústica");
    expect(within(first).getByLabelText(/Monitoramento/)).toHaveValue(
      "Dosimetria semestral",
    );
    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      within(within(first).getByLabelText(/Nível de controle/)).queryByRole("option", {
        name: /Eliminação/,
      }),
    ).not.toBeInTheDocument();
  });

  it("só salva depois da confirmação e envia os valores editados sem os removidos", async () => {
    okSuggestions();
    mockedAccept.mockResolvedValue({ ok: true, data: { created: 1 } });
    const user = userEvent.setup();
    render(<SuggestMeasuresSection riskId={RISK_ID} />);

    const first = await generate(user);
    const what = within(first).getByLabelText(/O que será feito/);
    await user.clear(what);
    await user.type(what, "Enclausurar revisado");
    await user.click(
      within(screen.getByRole("group", { name: "Medida 2" })).getByRole("button", {
        name: "Remover",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Salvar medidas" }));
    expect(mockedAccept).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));

    await waitFor(() => expect(mockedAccept).toHaveBeenCalledTimes(1));
    expect(mockedAccept).toHaveBeenCalledWith(RISK_ID, {
      suggestions: [
        {
          controlLevel: "collective_protection",
          actionWhat: "Enclausurar revisado",
          actionWhy: "Reduzir o ruído na fonte",
          actionHow: "Instalar cabine acústica",
          monitoring: "Dosimetria semestral",
          justification: "Controle coletivo antes do EPI",
          actionResponsible: "",
          actionDeadline: "",
        },
      ],
    });
    expect(await screen.findByText(/1 medida\(s\) salva\(s\)/)).toBeInTheDocument();
  });

  it("risco moderado+: cobra responsável e prazo no cartão antes de pedir confirmação", async () => {
    okSuggestions(true);
    mockedAccept.mockResolvedValue({ ok: true, data: { created: 1 } });
    const user = userEvent.setup();
    render(<SuggestMeasuresSection riskId={RISK_ID} />);

    const first = await generate(user);
    await user.click(
      within(screen.getByRole("group", { name: "Medida 2" })).getByRole("button", {
        name: "Remover",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar medidas" }));

    expect(
      screen.queryByText("Confirmar conteúdo preenchido pela IA pgr-e"),
    ).not.toBeInTheDocument();
    expect(within(first).getAllByText(/informe responsável e prazo/)).toHaveLength(2);

    await user.type(within(first).getByLabelText(/Responsável/), "SESMT");
    await user.type(within(first).getByLabelText(/Prazo/), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Salvar medidas" }));
    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));

    await waitFor(() => expect(mockedAccept).toHaveBeenCalledTimes(1));
    expect(mockedAccept.mock.calls[0]?.[1].suggestions[0]).toEqual(
      expect.objectContaining({
        actionResponsible: "SESMT",
        actionDeadline: "2026-12-31",
      }),
    );
  });

  it("voltar e revisar não salva nada", async () => {
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestMeasuresSection riskId={RISK_ID} />);

    await generate(user);
    await user.click(screen.getByRole("button", { name: "Salvar medidas" }));
    await user.click(screen.getByRole("button", { name: "Voltar e revisar" }));

    expect(mockedAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Medida 1" })).toBeInTheDocument();
  });

  it("explica quando a cota acabou", async () => {
    mockedSuggest.mockResolvedValue({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "erro cru" },
    });
    const user = userEvent.setup();
    render(<SuggestMeasuresSection riskId={RISK_ID} />);

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    expect(await screen.findByText(/limite mensal/)).toBeInTheDocument();
    expect(screen.queryByText("erro cru")).not.toBeInTheDocument();
  });
});
