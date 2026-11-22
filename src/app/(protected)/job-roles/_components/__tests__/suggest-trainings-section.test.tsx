jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/pgr/ai-required-trainings", () => ({
  suggestRequiredTrainings: jest.fn(),
  acceptSuggestedTrainings: jest.fn(),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  acceptSuggestedTrainings,
  suggestRequiredTrainings,
} from "@/shared/server/actions/pgr/ai-required-trainings";
import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";

import { SuggestTrainingsSection } from "../suggest-trainings-section";

const JOB_ROLE_ID = "11111111-1111-1111-1111-1111111111b1";
const CATALOG_ID = "11111111-1111-1111-1111-1111111111f1";
const mockedSuggest = jest.mocked(suggestRequiredTrainings);
const mockedAccept = jest.mocked(acceptSuggestedTrainings);

function okSuggestions() {
  mockedSuggest.mockResolvedValue({
    ok: true,
    data: {
      suggestions: [
        {
          name: "NR-35 — Trabalho em Altura",
          referenceNorm: "NR-35",
          periodicity: "biennial",
          workloadHours: 8,
          rationale: "Atividade acima de 2 m",
          trainingId: null,
          alreadyRequired: false,
        },
        {
          name: "Uso de EPI",
          referenceNorm: "NR-06",
          periodicity: "annual",
          workloadHours: 4,
          trainingId: CATALOG_ID,
          alreadyRequired: false,
        },
        {
          name: "Integração de Segurança",
          periodicity: "single",
          workloadHours: 2,
          trainingId: "11111111-1111-1111-1111-1111111111f2",
          alreadyRequired: true,
        },
      ],
    },
  });
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
  return screen.findByRole("group", { name: "Treinamento 1" });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
  mockedSuggest.mockReset();
  mockedAccept.mockReset();
});

describe("SuggestTrainingsSection — preenchimento de obrigatórios pela IA", () => {
  it("mostra o aviso antes de preencher e só chama a IA depois do aceite", async () => {
    localStorage.clear();
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestTrainingsSection jobRoleId={JOB_ROLE_ID} />);

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    expect(mockedSuggest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));
    expect(
      await screen.findByRole("group", { name: "Treinamento 1" }),
    ).toBeInTheDocument();
    expect(mockedSuggest).toHaveBeenCalledWith(JOB_ROLE_ID);
  });

  it("abre cartões editáveis e mostra o já obrigatório só como informação", async () => {
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestTrainingsSection jobRoleId={JOB_ROLE_ID} />);

    const first = await generate(user);
    expect(within(first).getByLabelText(/Nome/)).toHaveValue(
      "NR-35 — Trabalho em Altura",
    );
    expect(within(first).getByLabelText(/Norma de referência/)).toHaveValue("NR-35");
    expect(within(first).getByLabelText(/Periodicidade/)).toHaveValue("biennial");
    expect(within(first).getByLabelText(/Carga horária/)).toHaveValue(8);
    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(2);
    expect(
      screen.queryByRole("group", { name: "Treinamento 3" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Integração de Segurança")).toBeInTheDocument();
    expect(screen.getByText(/Já obrigatório nesta função/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    const matched = screen.getByRole("group", { name: "Treinamento 2" });
    expect(within(matched).getByLabelText(/Nome/)).toHaveAttribute("readonly");
    expect(within(matched).getByLabelText(/Periodicidade/)).toBeDisabled();
    expect(within(matched).getByText(/Já existe no catálogo/)).toBeInTheDocument();
  });

  it("só vincula depois da confirmação e envia os valores editados sem os removidos", async () => {
    okSuggestions();
    mockedAccept.mockResolvedValue({
      ok: true,
      data: { linked: 1, createdInCatalog: 1 },
    });
    const user = userEvent.setup();
    render(<SuggestTrainingsSection jobRoleId={JOB_ROLE_ID} />);

    const first = await generate(user);
    const name = within(first).getByLabelText(/Nome/);
    await user.clear(name);
    await user.type(name, "NR-35 revisado");
    const hours = within(first).getByLabelText(/Carga horária/);
    await user.clear(hours);
    await user.type(hours, "16");
    await user.click(
      within(screen.getByRole("group", { name: "Treinamento 2" })).getByRole("button", {
        name: "Remover",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Salvar treinamentos" }));
    expect(mockedAccept).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));

    await waitFor(() => expect(mockedAccept).toHaveBeenCalledTimes(1));
    expect(mockedAccept).toHaveBeenCalledWith(JOB_ROLE_ID, {
      suggestions: [
        {
          name: "NR-35 revisado",
          referenceNorm: "NR-35",
          periodicity: "biennial",
          workloadHours: 16,
          rationale: "Atividade acima de 2 m",
          trainingId: null,
        },
      ],
    });
    expect(
      await screen.findByText(/1 treinamento\(s\) vinculado\(s\)/),
    ).toBeInTheDocument();
  });

  it("cobra o nome apagado no cartão antes de pedir confirmação", async () => {
    okSuggestions();
    const user = userEvent.setup();
    render(<SuggestTrainingsSection jobRoleId={JOB_ROLE_ID} />);

    const first = await generate(user);
    await user.clear(within(first).getByLabelText(/Nome/));
    await user.click(screen.getByRole("button", { name: "Salvar treinamentos" }));

    expect(within(first).getByText("Informe o nome do treinamento.")).toBeInTheDocument();
    expect(
      screen.queryByText("Confirmar conteúdo preenchido pela IA pgr-e"),
    ).not.toBeInTheDocument();
  });

  it("explica quando a cota acabou", async () => {
    mockedSuggest.mockResolvedValue({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "erro cru" },
    });
    const user = userEvent.setup();
    render(<SuggestTrainingsSection jobRoleId={JOB_ROLE_ID} />);

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    expect(await screen.findByText(/limite mensal/)).toBeInTheDocument();
    expect(screen.queryByText("erro cru")).not.toBeInTheDocument();
  });
});
