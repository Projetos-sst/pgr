jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/work-permits/work-permits", () => ({
  createWorkPermitAction: jest.fn(),
  updateWorkPermitAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/work-permits/ai-precautions", () => ({
  fillWorkPermitPrecautionsAction: jest.fn(),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";
import { fillWorkPermitPrecautionsAction } from "@/shared/server/actions/work-permits/ai-precautions";
import { updateWorkPermitAction } from "@/shared/server/actions/work-permits/work-permits";

import { PermitForm, type PermitFormInitial } from "../permit-form";

const PERMIT_ID = "11111111-1111-4111-8111-1111111111a1";

const INITIAL: PermitFormInitial = {
  number: "PT-001",
  type: "height",
  status: "draft",
  companyId: null,
  area: "Telhado do galpão 2",
  description: "Troca de telhas",
  validFrom: "2026-11-20",
  validUntil: "2026-11-21",
  requestedBy: null,
  approvedBy: null,
  precautions: "Usar cinto paraquedista",
  notes: null,
};

const mockedFill = jest.mocked(fillWorkPermitPrecautionsAction);
const mockedUpdate = jest.mocked(updateWorkPermitAction);

const fillButton = () => screen.getByRole("button", { name: "Preencher com IA pgr-e" });
const precautionsField = () =>
  screen.getByRole("textbox", { name: "Precauções / medidas de controle" });

function renderForm(initial: PermitFormInitial = INITIAL) {
  return render(<PermitForm id={PERMIT_ID} companies={[]} initial={initial} />);
}

function okFill() {
  mockedFill.mockResolvedValue({
    ok: true,
    data: { precautions: ["Isolar a área abaixo do telhado"] },
  });
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockedUpdate.mockResolvedValue({ ok: true, data: { id: PERMIT_ID } });
});

describe("PermitForm — precauções preenchidas pela IA pgr-e", () => {
  it("mostra o aviso antes e manda tipo, área, descrição e o que já foi escrito", async () => {
    okFill();
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    expect(mockedFill).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));

    await waitFor(() =>
      expect(precautionsField()).toHaveValue(
        "Usar cinto paraquedista\n- Isolar a área abaixo do telhado",
      ),
    );
    expect(mockedFill).toHaveBeenCalledWith({
      type: "height",
      area: "Telhado do galpão 2",
      description: "Troca de telhas",
      precautions: "Usar cinto paraquedista",
    });
    expect(screen.getByText("Preenchido pela IA pgr-e")).toBeInTheDocument();
  });

  it("botão desligado sem descrição do trabalho", () => {
    renderForm({ ...INITIAL, description: "" });
    expect(fillButton()).toBeDisabled();
  });

  it("salvar o que a IA preencheu pede confirmação; voltar não salva", async () => {
    okFill();
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    await screen.findByText("Preenchido pela IA pgr-e");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mockedUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Voltar e revisar" }));
    expect(mockedUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate.mock.calls[0][1]).toMatchObject({
      type: "height",
      precautions: "Usar cinto paraquedista\n- Isolar a área abaixo do telhado",
    });
  });

  it("editar as precauções tira a etiqueta e salva sem confirmação", async () => {
    okFill();
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    await screen.findByText("Preenchido pela IA pgr-e");
    await user.type(precautionsField(), "\n- Vigia no solo");
    expect(screen.queryByText("Preenchido pela IA pgr-e")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
  });

  it("IA sem nada novo avisa e não mexe no campo", async () => {
    mockedFill.mockResolvedValue({ ok: true, data: { precautions: [] } });
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    expect(await screen.findByText(/não encontrou precauções novas/)).toBeInTheDocument();
    expect(precautionsField()).toHaveValue("Usar cinto paraquedista");
  });

  it("cota estourada mostra a mensagem amigável", async () => {
    mockedFill.mockResolvedValue({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "Limite" },
    });
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    expect(
      await screen.findByText(/limite mensal de preenchimentos/),
    ).toBeInTheDocument();
  });

  it("editar sem IA envia o que veio do banco, inclusive tipo, status e precauções", async () => {
    const user = userEvent.setup();
    renderForm({
      ...INITIAL,
      type: "confined_space",
      status: "active",
      precautions: "1) Medir oxigênio",
    });

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate.mock.calls[0][0]).toBe(PERMIT_ID);
    expect(mockedUpdate.mock.calls[0][1]).toMatchObject({
      number: "PT-001",
      type: "confined_space",
      status: "active",
      area: "Telhado do galpão 2",
      description: "Troca de telhas",
      precautions: "1) Medir oxigênio",
    });
  });

  it("todo select vem do SelectField do design system", () => {
    const { container } = renderForm();
    const selects = [...container.querySelectorAll("select")];
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) expect(select).toHaveClass("rounded-field");
  });
});
