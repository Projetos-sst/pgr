import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockSave = jest.fn();
jest.mock("@/shared/server/actions/pgr/pgr-docx-texts", () => ({
  savePgrDocxTextVersionAction: (pgrId: string, input: unknown) => mockSave(pgrId, input),
}));

import { PgrDocxTextsForm } from "@/app/(protected)/pgr/[id]/texts/texts-form";
import { editableTextGroups } from "@/shared/domains/pgr/pgr-docx/text-overrides";
import { DEFAULT_TITLES } from "@/shared/domains/pgr/pgr-docx/defaults";

const PGR_ID = "11111111-1111-4111-8111-111111111111";
const SCREEN_DIR = path.join(process.cwd(), "src/app/(protected)/pgr/[id]/texts");

function renderForm() {
  return render(
    <PgrDocxTextsForm
      pgrId={PGR_ID}
      groups={editableTextGroups({ titles: { objective: "2 - PROPÓSITO" } })}
    />,
  );
}

describe("tela de textos padrão do PGR", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mostra o valor atual de cada campo e marca o que já difere do padrão", () => {
    renderForm();
    expect(screen.getByLabelText(DEFAULT_TITLES.introduction)).toHaveValue(
      DEFAULT_TITLES.introduction,
    );
    expect(screen.getByLabelText(`${DEFAULT_TITLES.objective} (alterado)`)).toHaveValue(
      "2 - PROPÓSITO",
    );
  });

  it("envia o motivo e os valores dos campos agrupados por seção", async () => {
    mockSave.mockResolvedValue({
      ok: true,
      data: { id: "v1", version: 3, textsSha256: "a".repeat(64) },
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(DEFAULT_TITLES.introduction), {
      target: { value: "1 - ABERTURA" },
    });
    fireEvent.change(screen.getByLabelText(/Motivo da alteração/), {
      target: { value: "Pedido do responsável" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar nova versão dos textos" }),
      );
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const [pgrId, input] = mockSave.mock.calls[0];
    expect(pgrId).toBe(PGR_ID);
    expect(input.reason).toBe("Pedido do responsável");
    expect(input.overrides.titles.introduction).toBe("1 - ABERTURA");
    expect(input.overrides.titles.objective).toBe("2 - PROPÓSITO");
    expect(Object.keys(input.overrides)).toEqual(["titles", "texts", "labels"]);
    expect(await screen.findByRole("status")).toHaveTextContent("Versão 3 salva");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("mostra a mensagem do servidor quando o salvamento é recusado", async () => {
    mockSave.mockResolvedValue({
      ok: false,
      error: { code: "ALREADY_SIGNED", message: "PGR assinado não pode ser alterado." },
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Motivo da alteração/), {
      target: { value: "Tentativa" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar nova versão dos textos" }),
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PGR assinado não pode ser alterado.",
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("a pasta da tela só usa campos do design system, nenhum campo nativo", () => {
    const sources = readdirSync(SCREEN_DIR).filter((file) => file.endsWith(".tsx"));
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const source = readFileSync(path.join(SCREEN_DIR, file), "utf8");
      expect(source).not.toMatch(/<(input|select|textarea|button)[\s>]/);
    }
  });
});
