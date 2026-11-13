import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockRecord = jest.fn();
jest.mock("@/shared/server/actions/retention/retention", () => ({
  recordRetentionPolicyVersionAction: (input: unknown) => mockRecord(input),
}));

import { PgrRetentionExportForm } from "@/app/(protected)/pgr/[id]/retention-export/export-form";
import { RetentionPolicyForm } from "@/app/(protected)/retention/policy-form";
import { PROPOSED_RETENTION_TERMS } from "@/shared/domains/retention/policy";

const PGR_ID = "11111111-1111-4111-8111-111111111111";
const SCREEN_DIRS = [
  "src/app/(protected)/retention",
  "src/app/(protected)/pgr/[id]/retention-export",
].map((dir) => path.join(process.cwd(), dir));
const mockFetch = jest.fn();

async function submit(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("formulário da política de guarda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parte dos termos recebidos e registra uma versão proposta", async () => {
    mockRecord.mockResolvedValue({ ok: true, data: { version: 1, status: "proposed" } });
    render(<RetentionPolicyForm terms={PROPOSED_RETENTION_TERMS} />);
    expect(screen.getByLabelText(/Documentos do PGR: prazo/)).toHaveValue(12);
    expect(screen.getByLabelText(/Avisos antes/)).toHaveValue("90, 60, 30");
    expect(screen.queryByLabelText(/Quem aprovou/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Documentos do PGR: prazo/), {
      target: { value: "24" },
    });
    await submit("Registrar versão da política");
    const [input] = mockRecord.mock.calls[0];
    expect(input.status).toBe("proposed");
    expect(input.approval).toBeUndefined();
    expect(input.terms.noticeDaysBefore).toEqual(["90", "60", "30"]);
    expect(input.terms.categories[0]).toEqual({
      category: "pgr_documents",
      retentionMonths: "24",
      startingPoint: "contract_end",
    });
    expect(input.terms.categories).toHaveLength(5);
    expect(await screen.findByRole("status")).toHaveTextContent("Versão 1 registrada");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("versão aprovada pede e envia quem aprovou, cargo, data e referência", async () => {
    mockRecord.mockResolvedValue({ ok: true, data: { version: 2, status: "approved" } });
    render(<RetentionPolicyForm terms={PROPOSED_RETENTION_TERMS} />);
    fireEvent.change(screen.getByLabelText(/Situação desta versão/), {
      target: { value: "approved" },
    });
    const fill = (label: RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill(/Quem aprovou/, "Maria Responsável");
    fill(/Cargo de quem aprovou/, "Sócia");
    fill(/Data da aprovação/, "2026-11-10");
    fill(/Onde a aprovação está registrada/, "Ata de 10/11");
    await submit("Registrar versão da política");
    const [input] = mockRecord.mock.calls[0];
    expect(input.status).toBe("approved");
    expect(input.approval).toEqual({
      approverName: "Maria Responsável",
      approverRole: "Sócia",
      approvedOn: "2026-11-10",
      reference: "Ata de 10/11",
    });
  });

  it("mostra a recusa do servidor e não atualiza a tela", async () => {
    mockRecord.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Somente o administrador registra." },
    });
    render(<RetentionPolicyForm terms={PROPOSED_RETENTION_TERMS} />);
    await submit("Registrar versão da política");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Somente o administrador registra.",
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("exportação do pacote de guarda", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    URL.createObjectURL = jest.fn(() => "blob:pacote");
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("pede o pacote por POST e mostra a situação e o hash do conjunto", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["zip"]),
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="pgr-guarda.zip"',
        "X-Retention-Export-Status": "incomplete",
        "X-Retention-Export-Sha256": "f".repeat(64),
      }),
    });
    render(<PgrRetentionExportForm pgrId={PGR_ID} />);
    await submit("Exportar pacote de guarda");
    expect(mockFetch).toHaveBeenCalledWith(`/api/v1/pgr/${PGR_ID}/retention-exports`, {
      method: "POST",
    });
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("incompleto");
    expect(status).toHaveTextContent("f".repeat(64));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("mostra o erro de domínio quando o pacote não é gerado", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Nenhum pacote foi gerado." } }),
    });
    render(<PgrRetentionExportForm pgrId={PGR_ID} />);
    await submit("Exportar pacote de guarda");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nenhum pacote foi gerado.",
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("avisa quando a conexão falha", async () => {
    mockFetch.mockRejectedValue(new TypeError("network"));
    render(<PgrRetentionExportForm pgrId={PGR_ID} />);
    await submit("Exportar pacote de guarda");
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
  });
});

describe("telas de guarda", () => {
  it("as pastas só usam campos do design system, nenhum campo nativo", () => {
    for (const dir of SCREEN_DIRS) {
      const sources = readdirSync(dir).filter((file) => file.endsWith(".tsx"));
      expect(sources.length).toBeGreaterThan(0);
      for (const file of sources) {
        const source = readFileSync(path.join(dir, file), "utf8");
        expect(source).not.toMatch(/<(input|select|textarea|button)[\s>]/);
      }
    }
  });
});
