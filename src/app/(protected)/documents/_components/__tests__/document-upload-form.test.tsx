/**
 * Regressão do bug de QA (fatia 024, borda de tamanho): quando o corpo do
 * upload é grande demais para o proxy/Server Action (transporte, não
 * `validateFile`), a Server Action LANÇA em vez de devolver `{ok:false}` — o
 * form precisa mostrar uma mensagem amigável em vez de deixar a exceção
 * estourar como erro cru na UI.
 */
const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("@/shared/server/actions/documents/documents", () => ({
  createDocumentAction: jest.fn(),
}));

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDocumentAction } from "@/shared/server/actions/documents/documents";
import { UPLOAD_TRANSPORT_ERROR_MESSAGE } from "../format";
import { DocumentUploadForm } from "../document-upload-form";

const mockedAction = createDocumentAction as jest.MockedFunction<
  typeof createDocumentAction
>;

async function fillRequiredFields() {
  const user = userEvent.setup();
  const file = new File(["conteudo"], "laudo.pdf", { type: "application/pdf" });
  await user.upload(screen.getByLabelText(/Arquivo/i), file);
  await user.type(screen.getByLabelText(/Nome/i), "Laudo Ergonômico");
  await user.type(screen.getByLabelText(/Tipo do documento/i), "Laudo");
  // fireEvent.submit (não click no botão) evita a validação nativa HTML5 do
  // jsdom bloquear o submit por causa do <input type="file" required>.
  const form = screen.getByRole("button", { name: /Enviar documento/i }).closest("form")!;
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("DocumentUploadForm — erro de transporte (corpo grande demais)", () => {
  beforeEach(() => {
    mockedAction.mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
  });

  it("Server Action lança (corpo truncado pelo proxy) → mostra mensagem amigável, não crasha", async () => {
    mockedAction.mockRejectedValue(new Error("Failed to parse multipart body"));

    render(<DocumentUploadForm folders={[]} defaultFolderId={null} />);
    await fillRequiredFields();

    await waitFor(() => {
      expect(screen.getByText(UPLOAD_TRANSPORT_ERROR_MESSAGE)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("arquivo pouco acima do teto (validateFile) → mostra a mensagem de VALIDATION, não a genérica de transporte", async () => {
    mockedAction.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION", message: "Arquivo excede o tamanho máximo de 25 MB." },
    });

    render(<DocumentUploadForm folders={[]} defaultFolderId={null} />);
    await fillRequiredFields();

    await waitFor(() => {
      expect(
        screen.getByText("Arquivo excede o tamanho máximo de 25 MB."),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(UPLOAD_TRANSPORT_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it("caminho feliz: navega para a pasta de destino e não mostra erro", async () => {
    mockedAction.mockResolvedValue({
      ok: true,
      data: {
        id: "d1",
        documentGroupId: "g1",
        name: "Laudo",
        docType: "Laudo",
        version: 1,
        sizeBytes: 10,
        folderId: null,
        createdAt: new Date().toISOString(),
        validUntil: null,
        validityStatus: "no_expiry",
        storagePath: "org/documentos/g1/v1-laudo.pdf",
        relatedEntityType: null,
        relatedEntityId: null,
        updatedAt: new Date().toISOString(),
      },
    });

    render(<DocumentUploadForm folders={[]} defaultFolderId={null} />);
    await fillRequiredFields();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/documents"));
    expect(screen.queryByText(UPLOAD_TRANSPORT_ERROR_MESSAGE)).not.toBeInTheDocument();
  });
});

/**
 * Issue #45 (fatia 028): a tela de upload generaliza o pré-vínculo para
 * qualquer entidade do enum (`pgr`/`ges`/`risk`), não mais só "pgr" hardcoded.
 */
describe("DocumentUploadForm — pré-vínculo genérico por entidade (issue #45)", () => {
  beforeEach(() => {
    mockedAction.mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
  });

  it('pré-vinculado a relatedEntityType="ges" → hidden input carrega "ges", não mais "pgr" fixo', () => {
    const { container } = render(
      <DocumentUploadForm
        folders={[]}
        defaultFolderId={null}
        defaultRelatedEntityType="ges"
        defaultRelatedEntityId="ges-123"
        returnLabel="Setor de Pintura"
      />,
    );

    const typeInput = container.querySelector<HTMLInputElement>(
      'input[name="relatedEntityType"]',
    );
    const idInput = container.querySelector<HTMLInputElement>(
      'input[name="relatedEntityId"]',
    );
    expect(typeInput?.value).toBe("ges");
    expect(idInput?.value).toBe("ges-123");
    expect(screen.getByText("Setor de Pintura")).toBeInTheDocument();
  });

  it('pré-vinculado a relatedEntityType="risk" → hidden input carrega "risk"', () => {
    const { container } = render(
      <DocumentUploadForm
        folders={[]}
        defaultFolderId={null}
        defaultRelatedEntityType="risk"
        defaultRelatedEntityId="risk-456"
        returnLabel="Ruído acima do limite"
      />,
    );

    const typeInput = container.querySelector<HTMLInputElement>(
      'input[name="relatedEntityType"]',
    );
    expect(typeInput?.value).toBe("risk");
  });

  it("fluxo manual de PGR (sem pré-vínculo) continua idêntico: checkbox off por padrão, ligar mostra campo de ID e fixa relatedEntityType=pgr", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DocumentUploadForm folders={[]} defaultFolderId={null} />,
    );

    // Sem pré-vínculo, nenhum hidden input existe até o checkbox ser marcado.
    expect(
      container.querySelector('input[name="relatedEntityType"]'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/Vincular a um PGR/i));

    const typeInput = container.querySelector<HTMLInputElement>(
      'input[name="relatedEntityType"]',
    );
    expect(typeInput?.value).toBe("pgr");
    expect(screen.getByLabelText(/ID do PGR/i)).toBeInTheDocument();
  });
});
