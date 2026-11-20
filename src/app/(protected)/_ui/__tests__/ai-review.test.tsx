import { fireEvent, render, screen } from "@testing-library/react";

import {
  AI_REVIEW_DISMISSED_KEY,
  AI_REVIEW_WARNING,
} from "@/shared/domains/platform/ai-review";

import {
  AiFillButton,
  AiFilledBadge,
  AiSaveConfirm,
  useAiGenerateWarning,
} from "../ai-review";
import { AppFooter } from "../app-footer";

function GenerateHarness({ onGenerate }: { onGenerate: () => void }) {
  const { request, modal } = useAiGenerateWarning(onGenerate);
  return (
    <>
      <AiFillButton onClick={request} />
      {modal}
    </>
  );
}

function clickFill() {
  fireEvent.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
}

beforeEach(() => {
  localStorage.clear();
});

describe("useAiGenerateWarning", () => {
  it("mostra o aviso antes de gerar e não gera só por abrir o aviso", () => {
    const onGenerate = jest.fn();
    render(<GenerateHarness onGenerate={onGenerate} />);

    clickFill();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(AI_REVIEW_WARNING);
    expect(dialog).toHaveAccessibleName();
    expect(screen.getByRole("link", { name: "Ver termos de uso" })).toHaveAttribute(
      "href",
      "/termos",
    );
    expect(screen.getByRole("button", { name: "Entendi, preencher" })).toHaveFocus();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("gera ao confirmar o aviso, sem gravar a dispensa quando a caixa fica desmarcada", () => {
    const onGenerate = jest.fn();
    render(<GenerateHarness onGenerate={onGenerate} />);

    clickFill();
    fireEvent.click(screen.getByRole("button", { name: "Entendi, preencher" }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(AI_REVIEW_DISMISSED_KEY)).toBeNull();

    clickFill();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("'Não mostrar novamente' persiste e o próximo pedido gera direto", () => {
    const onGenerate = jest.fn();
    render(<GenerateHarness onGenerate={onGenerate} />);

    clickFill();
    fireEvent.click(screen.getByRole("checkbox", { name: "Não mostrar novamente" }));
    fireEvent.click(screen.getByRole("button", { name: "Entendi, preencher" }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(AI_REVIEW_DISMISSED_KEY)).toBe("true");

    clickFill();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onGenerate).toHaveBeenCalledTimes(2);
  });

  it("com a dispensa já gravada no navegador, gera direto sem aviso", () => {
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    const onGenerate = jest.fn();
    render(<GenerateHarness onGenerate={onGenerate} />);

    clickFill();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("Cancelar fecha o aviso sem gerar e sem gravar a dispensa", () => {
    const onGenerate = jest.fn();
    render(<GenerateHarness onGenerate={onGenerate} />);

    clickFill();
    fireEvent.click(screen.getByRole("checkbox", { name: "Não mostrar novamente" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
    expect(localStorage.getItem(AI_REVIEW_DISMISSED_KEY)).toBeNull();
  });

  it("Esc fecha o aviso sem gerar", () => {
    const onGenerate = jest.fn();
    render(<GenerateHarness onGenerate={onGenerate} />);

    clickFill();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe("AiSaveConfirm", () => {
  it("aparece mesmo com o aviso de geração dispensado e não tem 'Não mostrar novamente'", () => {
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    render(<AiSaveConfirm open onConfirm={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByRole("dialog")).toHaveTextContent(AI_REVIEW_WARNING);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Confirmar e salvar" })).toHaveFocus();
  });

  it("só confirma no clique em 'Confirmar e salvar'", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<AiSaveConfirm open onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar e revisar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fechado não renderiza nada", () => {
    render(<AiSaveConfirm open={false} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("AiFilledBadge", () => {
  it("marca o campo como preenchido pela IA pgr-e", () => {
    render(<AiFilledBadge />);
    expect(screen.getByText("Preenchido pela IA pgr-e")).toBeInTheDocument();
  });
});

describe("AppFooter", () => {
  it("tem o link para os termos de uso", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute(
      "href",
      "/termos",
    );
  });
});
