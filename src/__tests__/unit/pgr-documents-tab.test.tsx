import { act, fireEvent, render, screen } from "@testing-library/react";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockEnqueue = jest.fn();
jest.mock("@/shared/server/actions/pgr/pgr-readiness", () => ({
  getPgrReadinessAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/documents/pdf-batch", () => ({
  enqueuePgrPdfBatchAction: (pgrIds: string[]) => mockEnqueue(pgrIds),
}));

import { PgrDocumentsTab } from "@/app/(protected)/pgr/[id]/_components/pgr-documents-tab";

const PGR_ID = "11111111-1111-4111-8111-111111111111";

function renderTab() {
  return render(
    <PgrDocumentsTab
      pgrId={PGR_ID}
      pgrLabel="PGR Acme"
      linkedDocuments={[]}
      linkedTotal={0}
      nr18Checklist={null}
      epiRelation={[]}
    />,
  );
}

describe("PgrDocumentsTab × Arquivar no GED", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("libera o botão assim que a action responde, sem esperar o refresh da página", async () => {
    let respond: (value: unknown) => void = () => {};
    mockEnqueue.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Arquivar no GED" }));
    expect(screen.getByRole("button", { name: "Enfileirando…" })).toBeDisabled();

    await act(async () => {
      respond({ ok: true, data: [] });
    });

    expect(mockEnqueue).toHaveBeenCalledWith([PGR_ID]);
    expect(screen.getByRole("button", { name: "Arquivar no GED" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Geração enfileirada");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("erro da action mostra a mensagem, libera o botão e não recarrega a página", async () => {
    mockEnqueue.mockResolvedValue({
      ok: false,
      error: { code: "FK_NOT_FOUND", message: "PGR não encontrado" },
    });
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Arquivar no GED" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("PGR não encontrado");
    expect(screen.getByRole("button", { name: "Arquivar no GED" })).toBeEnabled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("exceção da action mostra mensagem de falha, libera o botão e não recarrega", async () => {
    mockEnqueue.mockRejectedValue(new Error("rede"));
    renderTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Arquivar no GED" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível enfileirar a geração. Tente novamente.",
    );
    expect(screen.getByRole("button", { name: "Arquivar no GED" })).toBeEnabled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
