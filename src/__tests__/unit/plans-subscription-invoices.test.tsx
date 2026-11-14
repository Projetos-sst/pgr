import { readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";

import type { InvoiceRow } from "@/app/(protected)/plans/_components/commercial/invoices-table";
import type {
  SheetContract,
  SubscriptionSheet,
} from "@/shared/server/commercial/subscription-sheet-core";

const mockPortal = jest.fn();
const mockStart = jest.fn();
const mockSheet = jest.fn();
const mockInvoices = jest.fn();
const mockRedirect = jest.fn();
const mockNotFound = jest.fn();
const mockForbidden = jest.fn();
const mockStaff = jest.fn();
const mockSubscriptionLoader = jest.fn();
const mockInvoicesLoader = jest.fn();
const mockRole = { current: "owner" };

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
  notFound: () => mockNotFound(),
  forbidden: () => mockForbidden(),
}));
jest.mock("@/shared/server/actions/commercial/commercial", () => ({
  createCommercialPortalSessionAction: (id: string) => mockPortal(id),
  startCommercialCheckoutAction: (id: string, input: unknown) => mockStart(id, input),
  registerCommercialContractAction: jest.fn(),
  getCommercialSubscriptionSheetAction: () => mockSheet(),
  listCommercialInvoicesAction: (filters: unknown) => mockInvoices(filters),
}));
jest.mock("@/app/(protected)/plans/_components/commercial/redirect", () => ({
  redirectTo: (url: string) => mockRedirect(url),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: async () => {
    mockStaff();
    return { tenantId: "org_a", userId: "user_a", plan: "free", role: mockRole.current };
  },
}));
jest.mock("@/app/(protected)/plans/_components/commercial/subscription-loader", () => ({
  SubscriptionLoader: () => {
    mockSubscriptionLoader();
    return "ficha-carregada";
  },
}));
jest.mock("@/app/(protected)/plans/_components/commercial/invoices-loader", () => ({
  InvoicesLoader: (props: unknown) => {
    mockInvoicesLoader(props);
    return "faturas-carregadas";
  },
}));

import InvoicesPage from "@/app/(protected)/plans/invoices/page";
import SubscriptionPage from "@/app/(protected)/plans/subscription/page";
import { CommercialPlansSection } from "@/app/(protected)/plans/_components/commercial/commercial-plans-section";
import { InvoicesTable } from "@/app/(protected)/plans/_components/commercial/invoices-table";
import { PageSkeleton } from "@/app/(protected)/plans/_components/commercial/page-skeleton";
import { SubscriptionSheetView } from "@/app/(protected)/plans/_components/commercial/subscription-sheet";

const { InvoicesLoader } = jest.requireActual<
  typeof import("@/app/(protected)/plans/_components/commercial/invoices-loader")
>("@/app/(protected)/plans/_components/commercial/invoices-loader");
const { SubscriptionLoader } = jest.requireActual<
  typeof import("@/app/(protected)/plans/_components/commercial/subscription-loader")
>("@/app/(protected)/plans/_components/commercial/subscription-loader");

const NEW_FILES = [
  "src/app/(protected)/plans/subscription/page.tsx",
  "src/app/(protected)/plans/invoices/page.tsx",
  "src/app/(protected)/plans/_components/commercial/subscription-sheet.tsx",
  "src/app/(protected)/plans/_components/commercial/subscription-loader.tsx",
  "src/app/(protected)/plans/_components/commercial/portal-button.tsx",
  "src/app/(protected)/plans/_components/commercial/resume-checkout-button.tsx",
  "src/app/(protected)/plans/_components/commercial/invoices-table.tsx",
  "src/app/(protected)/plans/_components/commercial/invoices-loader.tsx",
  "src/app/(protected)/plans/_components/commercial/page-skeleton.tsx",
];

const CONTRACT: SheetContract = {
  id: "contract-1",
  offerCode: "ficticio-pgr-medicina",
  offerName: "PGR + Medicina",
  billingPeriod: "monthly",
  currency: "BRL",
  fictitious: true,
  customerLegalName: "Consultoria SST",
  termStart: "2026-11-13",
  items: [
    {
      position: 1,
      service: "pgr",
      label: "PGR por empresa",
      unit: "company",
      unitAmountCents: 4990,
    },
    {
      position: 2,
      service: "medicine",
      label: "Medicina",
      unit: "company",
      unitAmountCents: 129900,
    },
  ],
  companies: [{ id: "c1", name: "Empresa Um" }],
  trials: [
    {
      companyId: "c1",
      companyName: "Empresa Um",
      status: "active",
      endsAt: "2026-11-28T15:00:00.000Z",
    },
  ],
  financial: {
    status: "active",
    checkoutStatus: "completed",
    currentPeriodStart: "2026-11-13T15:00:00.000Z",
    currentPeriodEnd: "2026-12-13T15:00:00.000Z",
    cancelAtPeriodEnd: false,
    canceledAt: null,
  },
  access: {
    state: "granted",
    keptUntil: null,
    rights: [{ companyId: "c1", service: "pgr", state: "granted" }],
  },
  availableActions: ["manage_in_portal"],
};

const INVOICE: InvoiceRow = {
  id: "inv-1",
  contractId: "contract-1",
  status: "paid",
  currency: "brl",
  totalCents: 129900,
  dueAt: new Date("2026-12-01T15:00:00.000Z"),
  paidAt: null,
  periodStart: new Date("2026-11-13T15:00:00.000Z"),
  periodEnd: new Date("2026-12-13T15:00:00.000Z"),
  createdAt: new Date("2026-11-13T15:00:00.000Z"),
  totalsByService: {
    pgr: 4990,
    medicine: 100000,
    pro: 3000,
    one_off: 1910,
    unclassified: 20000,
  },
};

const sheetOf = (patch: Partial<SheetContract> = {}): SubscriptionSheet => ({
  contracts: [{ ...CONTRACT, ...patch }],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRole.current = "owner";
  mockPortal.mockResolvedValue({ ok: true, data: { url: "https://portal.test/sessao" } });
});

afterEach(() => {
  delete process.env.COMMERCIAL_CATALOG_ENABLED;
});

describe("ficha Minha assinatura", () => {
  it("mostra oferta, itens do snapshot, empresas e teste", () => {
    render(<SubscriptionSheetView sheet={sheetOf()} />);
    const card = screen.getByRole("article", { name: "PGR + Medicina" });
    expect(card).toHaveTextContent("Consultoria SST");
    expect(card).toHaveTextContent(/PGR · PGR por empresa — R\$\s?49,90 por empresa/);
    expect(card).toHaveTextContent(/Medicina · Medicina — R\$\s?1\.299,00 por empresa/);
    expect(card).toHaveTextContent("Empresas atendidas: Empresa Um");
    expect(card).toHaveTextContent("Teste de Empresa Um: em andamento (até 28/11/2026)");
  });

  it("separa Pagamento e Acesso em dois blocos, cada um com a sua situação", () => {
    render(
      <SubscriptionSheetView
        sheet={sheetOf({
          financial: { ...CONTRACT.financial, status: "past_due" },
          access: { state: "suspended", keptUntil: null, rights: [] },
        })}
      />,
    );
    const payment = screen.getByRole("region", { name: "Pagamento" });
    const access = screen.getByRole("region", { name: "Acesso" });
    expect(payment).toHaveTextContent("Pagamento em atraso");
    expect(payment).toHaveTextContent("Período atual: 13/11/2026 a 13/12/2026");
    expect(payment).not.toHaveTextContent("Acesso suspenso");
    expect(access).toHaveTextContent("Acesso suspenso");
    expect(access).not.toHaveTextContent("Pagamento em atraso");
  });

  it("legado aparece como acesso legado ou cortesia", () => {
    render(
      <SubscriptionSheetView
        sheet={sheetOf({ access: { state: "legacy", keptUntil: null, rights: [] } })}
      />,
    );
    expect(screen.getByRole("region", { name: "Acesso" })).toHaveTextContent(
      "Acesso legado ou cortesia",
    );
  });

  it("mostra renovação, e cancelamento agendado mantém o acesso até o fim do período", () => {
    const { rerender } = render(<SubscriptionSheetView sheet={sheetOf()} />);
    expect(screen.getByRole("region", { name: "Pagamento" })).toHaveTextContent(
      "Renovação em 13/12/2026",
    );
    rerender(
      <SubscriptionSheetView
        sheet={sheetOf({
          financial: { ...CONTRACT.financial, cancelAtPeriodEnd: true },
          access: { state: "granted", keptUntil: "2026-12-13T15:00:00.000Z", rights: [] },
        })}
      />,
    );
    expect(screen.getByRole("region", { name: "Pagamento" })).toHaveTextContent(
      "Cancelamento agendado para 13/12/2026",
    );
    expect(screen.getByRole("region", { name: "Acesso" })).toHaveTextContent(
      "Acesso liberado",
    );
    expect(screen.getByRole("region", { name: "Acesso" })).toHaveTextContent(
      "O acesso é mantido até 13/12/2026.",
    );
  });

  it("mostra o aviso do portal e o método de pagamento sem dados de cartão", () => {
    render(<SubscriptionSheetView sheet={sheetOf()} />);
    expect(
      screen.getByText(
        "Mudança de plano, cancelamento e reativação são feitos no portal do provedor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Método de pagamento: Gerenciado no portal do provedor/),
    ).toBeInTheDocument();
  });

  it("as ações vêm do servidor: portal, retomar ou nenhuma", () => {
    const { rerender } = render(<SubscriptionSheetView sheet={sheetOf()} />);
    expect(
      screen.getByRole("button", { name: "Gerenciar pagamento" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retomar pagamento" })).toBeNull();
    rerender(
      <SubscriptionSheetView
        sheet={sheetOf({ availableActions: ["resume_checkout"] })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Gerenciar pagamento" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retomar pagamento" })).toBeInTheDocument();
    rerender(<SubscriptionSheetView sheet={sheetOf({ availableActions: [] })} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Nenhuma ação disponível no momento.")).toBeInTheDocument();
  });

  it("sem contratação: estado vazio", () => {
    render(<SubscriptionSheetView sheet={{ contracts: [] }} />);
    expect(
      screen.getByText("Nenhuma contratação registrada para este escritório."),
    ).toBeInTheDocument();
  });

  it("clique abre o portal e redireciona para a URL temporária", async () => {
    render(<SubscriptionSheetView sheet={sheetOf()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerenciar pagamento" }));
    });
    expect(mockPortal).toHaveBeenCalledWith("contract-1");
    expect(mockRedirect).toHaveBeenCalledWith("https://portal.test/sessao");
  });

  it("duplo clique no portal dispara uma única chamada", async () => {
    render(<SubscriptionSheetView sheet={sheetOf()} />);
    const button = screen.getByRole("button", { name: "Gerenciar pagamento" });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(mockPortal).toHaveBeenCalledTimes(1);
  });

  it("falha ao abrir o portal mostra o erro e permite tentar de novo", async () => {
    mockPortal.mockResolvedValueOnce({
      ok: false,
      error: { code: "VALIDATION", message: "Este pagador ainda não tem cadastro." },
    });
    render(<SubscriptionSheetView sheet={sheetOf()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerenciar pagamento" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este pagador ainda não tem cadastro.",
    );
    expect(mockRedirect).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerenciar pagamento" }));
    });
    expect(mockPortal).toHaveBeenCalledTimes(2);
  });

  it("retomar pagamento reaproveita o checkout da contratação", async () => {
    mockStart.mockResolvedValue({ ok: true, data: { url: "https://pagamento.test/s" } });
    render(
      <SubscriptionSheetView
        sheet={sheetOf({ availableActions: ["resume_checkout"] })}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retomar pagamento" }));
    });
    expect(mockStart).toHaveBeenCalledWith("contract-1", {
      idempotencyKey: expect.any(String),
    });
    expect(mockRedirect).toHaveBeenCalledWith("https://pagamento.test/s");
  });

  it("o carregador mostra o erro do servidor", async () => {
    mockSheet.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Apenas o administrador contrata." },
    });
    render(await SubscriptionLoader());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Apenas o administrador contrata.",
    );
  });

  it("o carregador mostra a ficha quando há dados", async () => {
    mockSheet.mockResolvedValue({ ok: true, data: sheetOf() });
    render(await SubscriptionLoader());
    expect(screen.getByRole("article", { name: "PGR + Medicina" })).toBeInTheDocument();
  });
});

describe("tabela de faturas", () => {
  it("mostra total em BRL, moeda, competência, vencimento, situação e detalhamento", () => {
    render(<InvoicesTable rows={[INVOICE]} total={1} page={1} />);
    const row = screen.getAllByRole("row")[1];
    expect(row).toHaveTextContent(/R\$\s?1\.299,00/);
    expect(row).toHaveTextContent("brl");
    expect(row).toHaveTextContent("13/11/2026 a 13/12/2026");
    expect(row).toHaveTextContent("01/12/2026");
    expect(row).toHaveTextContent("Paga");
    const breakdown = screen.getByRole("list", { name: "Detalhamento por serviço" });
    expect(breakdown).toHaveTextContent(/PGR: R\$\s?49,90/);
    expect(breakdown).toHaveTextContent(/Medicina: R\$\s?1\.000,00/);
    expect(breakdown).toHaveTextContent(/Demais: R\$\s?49,10/);
    expect(breakdown).toHaveTextContent(/Não classificado: R\$\s?200,00/);
  });

  it("pagina por links com o número da página", () => {
    render(<InvoicesTable rows={[INVOICE]} total={45} page={2} />);
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/plans/invoices?page=1",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/plans/invoices?page=3",
    );
  });

  it("estado vazio", () => {
    render(<InvoicesTable rows={[]} total={0} page={1} />);
    expect(
      screen.getByText("Nenhuma fatura espelhada do provedor até o momento."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("o carregador pede a página e mostra o erro do servidor", async () => {
    mockInvoices.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL", message: "Falha ao listar." },
    });
    render(await InvoicesLoader({ page: 2 }));
    expect(mockInvoices).toHaveBeenCalledWith({ page: 2 });
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao listar.");
  });

  it("o carregador entrega as linhas à tabela", async () => {
    mockInvoices.mockResolvedValueOnce({ ok: true, data: { rows: [INVOICE], total: 1 } });
    render(await InvoicesLoader({ page: 1 }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("carregando: o esqueleto é anunciado como status", () => {
    render(<PageSkeleton label="Carregando as faturas" />);
    expect(
      screen.getByRole("status", { name: "Carregando as faturas" }),
    ).toBeInTheDocument();
  });
});

describe("páginas", () => {
  it("fatura: o aviso de que não é nota fiscal fica sempre visível", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    render(await InvoicesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Fatura de cobrança não é nota fiscal")).toBeInTheDocument();
    expect(mockInvoicesLoader).toHaveBeenCalledWith({ page: 1 });
  });

  it("fatura: página inválida cai na primeira", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    render(await InvoicesPage({ searchParams: Promise.resolve({ page: "abc" }) }));
    expect(mockInvoicesLoader).toHaveBeenCalledWith({ page: 1 });
  });

  it("fatura: repassa a página pedida", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    render(await InvoicesPage({ searchParams: Promise.resolve({ page: "3" }) }));
    expect(mockInvoicesLoader).toHaveBeenCalledWith({ page: 3 });
  });

  it("assinatura: owner vê a página com a ficha", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    render(await SubscriptionPage());
    expect(screen.getByRole("heading", { name: "Minha assinatura" })).toBeInTheDocument();
    expect(screen.getByText("ficha-carregada")).toBeInTheDocument();
  });

  it("flag desligada: notFound antes de qualquer busca, nas duas páginas", async () => {
    delete process.env.COMMERCIAL_CATALOG_ENABLED;
    await SubscriptionPage();
    await InvoicesPage({ searchParams: Promise.resolve({}) });
    expect(mockNotFound).toHaveBeenCalledTimes(2);
    expect(mockStaff).not.toHaveBeenCalled();
    expect(mockSubscriptionLoader).not.toHaveBeenCalled();
    expect(mockInvoicesLoader).not.toHaveBeenCalled();
  });

  it.each(["collaborator", "client"])(
    "%s recebe a tela de acesso negado",
    async (role) => {
      process.env.COMMERCIAL_CATALOG_ENABLED = "true";
      mockRole.current = role;
      await SubscriptionPage();
      await InvoicesPage({ searchParams: Promise.resolve({}) });
      expect(mockForbidden).toHaveBeenCalledTimes(2);
      expect(mockSubscriptionLoader).not.toHaveBeenCalled();
      expect(mockInvoicesLoader).not.toHaveBeenCalled();
    },
  );
});

describe("entrada em /plans", () => {
  const overview = (canContract: boolean) => ({
    canContract,
    readOnlyMessage: null,
    termStart: "2026-11-13",
    offers: [],
    trials: [],
    customers: [],
    companies: [],
    contracts: [],
  });

  it("owner vê os links para a ficha e as faturas", () => {
    render(<CommercialPlansSection overview={overview(true)} checkoutReturn={null} />);
    expect(screen.getByRole("link", { name: "Minha assinatura" })).toHaveAttribute(
      "href",
      "/plans/subscription",
    );
    expect(screen.getByRole("link", { name: "Faturas" })).toHaveAttribute(
      "href",
      "/plans/invoices",
    );
  });

  it("quem só consulta não vê os links", () => {
    render(<CommercialPlansSection overview={overview(false)} checkoutReturn={null} />);
    expect(screen.queryByRole("link", { name: "Minha assinatura" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Faturas" })).toBeNull();
  });
});

describe("arquivos novos", () => {
  it("só usam componentes do design system, nenhum campo nativo", () => {
    for (const file of NEW_FILES) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/<(input|select|textarea|button)[\s>]/);
    }
  });
});
