/**
 * NOB-112 (etapa E): formulários do PCMSO (gerar prévia, registrar PCMSO assinado, baixar PDF).
 * Erro sem lugar na tela vira item legível no resumo (antes sumia), texto padrão do Zod em inglês
 * nunca aparece, permissão segue como mensagem de permissão (não de validação) e promessa
 * rejeitada vira mensagem genérica segura, mantendo o que foi digitado. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { GeneratePcmsoForm } from "@/app/(protected)/companies/[id]/pcmso/generate-form";
import {
  DownloadSignedPcmsoButton,
  SignedPcmsoForm,
} from "@/app/(protected)/companies/[id]/pcmso/signed-pcmso-controls";
import {
  generatePcmsoDocumentAction,
  getSignedPcmsoDownloadAction,
  registerSignedPcmsoAction,
} from "@/shared/server/actions/medicine/pcmso-documents";

/**
 * Envia o formulário do botão de envio sem a validação nativa do navegador (o jsdom, como o
 * navegador, não envia com campo `required` vazio): estes testes conferem a exibição do erro que o
 * servidor devolve. Botão comum (abrir painel, baixar) continua sendo clique.
 */
function press(element: HTMLElement) {
  const button = element as HTMLButtonElement;
  if (button.type === "submit" && button.form) fireEvent.submit(button.form);
  else fireEvent.click(element);
}

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/pcmso-documents", () => ({
  generatePcmsoDocumentAction: jest.fn(),
  registerSignedPcmsoAction: jest.fn(),
  getSignedPcmsoDownloadAction: jest.fn(),
}));

const generate = generatePcmsoDocumentAction as jest.Mock;
const register = registerSignedPcmsoAction as jest.Mock;
const download = getSignedPcmsoDownloadAction as jest.Mock;

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const PREVIEW = { id: "p1111111-1111-4111-8111-111111111111", version: 3 };
const CURRENT = "s1111111-1111-4111-8111-111111111111";
const COORDINATOR = { name: "Dra. Fictícia", crm: "12345", uf: "MA" };
const GENERIC = "Não foi possível concluir a operação. Tente novamente.";
const ENGLISH = /Invalid input|Too small|Too big|expected string/;

const invalid = (fields: Record<string, string>) => ({
  ok: false,
  error: { code: "VALIDATION", message: "Dados inválidos.", fields },
});

let openSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
});
afterEach(() => openSpy.mockRestore());

function renderSigned(currentId: string | null = null) {
  render(
    <SignedPcmsoForm
      companyId={COMPANY}
      latestPreview={PREVIEW}
      coordinator={COORDINATOR}
      currentId={currentId}
    />,
  );
  return screen.getByRole("button", {
    name: currentId ? "Registrar nova versão assinada" : "Registrar PCMSO assinado",
  });
}

describe("gerar prévia do PCMSO", () => {
  it("erro de chave sem campo na tela aparece no resumo, com rótulo legível", async () => {
    generate.mockResolvedValue(
      invalid({ companyId: "Empresa inválida.", cycleStart: "Data inválida." }),
    );
    render(<GeneratePcmsoForm companyId={COMPANY} />);
    press(screen.getByRole("button", { name: "Gerar prévia do PCMSO" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Empresa inválida.");
    expect(screen.getByLabelText(/^Data-base do ciclo/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/^Data-base do ciclo/)).toHaveAccessibleDescription(
      "Data inválida.",
    );
    expect(document.body).not.toHaveTextContent(/companyId/);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("FORBIDDEN com mensagem crua vira mensagem de permissão, sem destacar campos", async () => {
    generate.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    render(<GeneratePcmsoForm companyId={COMPANY} />);
    press(screen.getByRole("button", { name: "Gerar prévia do PCMSO" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );
    expect(screen.queryByText(/Revise os campos/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Data-base do ciclo/)).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("promessa rejeitada: mensagem genérica, data mantida e botão liberado", async () => {
    generate.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
    render(<GeneratePcmsoForm companyId={COMPANY} />);
    fireEvent.change(screen.getByLabelText(/^Data-base do ciclo/), {
      target: { value: "2026-01-01" },
    });
    press(screen.getByRole("button", { name: "Gerar prévia do PCMSO" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Data-base do ciclo/)).toHaveValue("2026-01-01");
    expect(
      await screen.findByRole("button", { name: "Gerar prévia do PCMSO" }),
    ).toBeEnabled();
  });
});

describe("registrar PCMSO assinado", () => {
  it("erros sem campo na tela (prévia, substituição) viram itens legíveis no resumo", async () => {
    register.mockResolvedValue(
      invalid({
        previewDocumentId: "Informe a prévia do sistema que foi assinada.",
        replaceReason: "Tipo de mudança e motivo só valem para substituição.",
        signedOn: "Data da assinatura inválida.",
      }),
    );
    press(renderSigned());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Prévia assinada: Informe a prévia do sistema que foi assinada.",
    );
    expect(alert).toHaveTextContent(
      "Motivo da substituição: Tipo de mudança e motivo só valem para substituição.",
    );
    expect(screen.getByLabelText(/^Data da assinatura/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Data da assinatura inválida.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/previewDocumentId|replaceReason/);
  });

  it("substituição: tipo de mudança e motivo aparecem nos próprios campos", async () => {
    register.mockResolvedValue(
      invalid({
        changeKind: "Informe o tipo de mudança da nova versão.",
        replaceReason:
          "Explique em pelo menos 10 caracteres por que o documento é substituído.",
      }),
    );
    press(renderSigned(CURRENT));

    expect(
      await screen.findByText("Informe o tipo de mudança da nova versão."),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Tipo de mudança/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByRole("textbox", { name: /^Motivo da substituição/ }),
    ).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect((register.mock.calls[0][1] as FormData).get("replacesId")).toBe(CURRENT);
  });

  it("texto padrão do Zod em inglês nunca aparece", async () => {
    register.mockResolvedValue(
      invalid({
        signerUf: "Invalid input: expected string, received undefined",
        origin: 'Invalid option: expected one of "coordinator"|"office_received"',
      }),
    );
    press(renderSigned());

    expect(await screen.findAllByText("Valor inválido.")).toHaveLength(2);
    expect(document.body).not.toHaveTextContent(ENGLISH);
    expect(document.body).not.toHaveTextContent(/Invalid option/);
  });

  it("FORBIDDEN fica como mensagem de permissão, não de validação", async () => {
    register.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Somente o médico responsável ou a equipe do escritório registra.",
      },
    });
    press(renderSigned());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Somente o médico responsável ou a equipe do escritório registra.",
    );
    expect(screen.queryByText(/Revise os campos/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /^Médico que assinou/ }),
    ).not.toHaveAttribute("aria-invalid");
  });

  it("promessa rejeitada: mensagem genérica e o que foi digitado fica", async () => {
    register.mockRejectedValue(new Error("storage bucket documents/org_a/x.pdf"));
    const button = renderSigned();
    fireEvent.change(screen.getByRole("textbox", { name: /^Conferência documental/ }), {
      target: { value: "Relatório do validador fictício" },
    });
    press(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.queryByText(/bucket|org_a/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Conferência documental/ })).toHaveValue(
      "Relatório do validador fictício",
    );
    expect(screen.getByRole("textbox", { name: /^Médico que assinou/ })).toHaveValue(
      COORDINATOR.name,
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("baixar PCMSO assinado", () => {
  it("FORBIDDEN mostra a mensagem de permissão e não abre o PDF", async () => {
    download.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    render(<DownloadSignedPcmsoButton id={CURRENT} />);
    press(screen.getByRole("button", { name: "Baixar PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("promessa rejeitada vira mensagem genérica; sucesso abre a URL assinada", async () => {
    download.mockRejectedValueOnce(new Error("signed url failed: token=abc"));
    render(<DownloadSignedPcmsoButton id={CURRENT} />);
    press(screen.getByRole("button", { name: "Baixar PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.queryByText(/token=/)).not.toBeInTheDocument();

    download.mockResolvedValueOnce({ ok: true, data: { url: "https://example.test/f" } });
    press(await screen.findByRole("button", { name: "Baixar PDF" }));
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.test/f",
        "_blank",
        "noopener,noreferrer",
      ),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
