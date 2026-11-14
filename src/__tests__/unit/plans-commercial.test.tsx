import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";

import type { PlansOverview } from "@/shared/server/commercial/plans-overview-core";

const mockRegister = jest.fn();
const mockStart = jest.fn();
const mockOverview = jest.fn();
const mockRedirect = jest.fn();
const mockLoader = jest.fn();
const mockRole = { current: "owner" };

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/commercial/commercial", () => ({
  registerCommercialContractAction: (input: unknown) => mockRegister(input),
  startCommercialCheckoutAction: (id: string, input: unknown) => mockStart(id, input),
  getCommercialPlansOverviewAction: () => mockOverview(),
}));
jest.mock("@/app/(protected)/plans/_components/commercial/redirect", () => ({
  redirectTo: (url: string) => mockRedirect(url),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: async () => ({
    tenantId: "org_a",
    userId: "user_a",
    plan: "free",
    role: mockRole.current,
  }),
}));
jest.mock("@/shared/integrations/stripe/config", () => ({
  isBillingEnabled: () => true,
}));
jest.mock("@/app/(protected)/plans/_components/upgrade-button", () => ({
  UpgradeButton: () => "upgrade-pro-antigo",
}));
jest.mock("@/app/(protected)/plans/_components/manage-billing-button", () => ({
  ManageBillingButton: () => "gerenciar-pro",
}));
jest.mock(
  "@/app/(protected)/plans/_components/commercial/commercial-plans-loader",
  () => ({
    CommercialPlansLoader: (props: unknown) => {
      mockLoader(props);
      return "secao-comercial";
    },
  }),
);

import PlanosPage from "@/app/(protected)/plans/page";
import { CommercialPlansSection } from "@/app/(protected)/plans/_components/commercial/commercial-plans-section";
import { CommercialPlansSkeleton } from "@/app/(protected)/plans/_components/commercial/commercial-plans-skeleton";

const COMMERCIAL_DIR = path.join(
  process.cwd(),
  "src/app/(protected)/plans/_components/commercial",
);
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
const OFFICE: PlansOverview["customers"][number] = {
  id: "cu-office",
  kind: "office",
  companyId: null,
  legalName: "Consultoria SST",
};
const DIRECT: PlansOverview["customers"][number] = {
  id: "cu-direct",
  kind: "company",
  companyId: "c2",
  legalName: "Cliente Direto",
};

const COMPANY_OFFER: PlansOverview["offers"][number] = {
  id: "offer-company",
  code: "ficticio-pgr-medicina",
  version: 1,
  name: "PGR + Medicina",
  description: "Oferta de teste",
  scope: "company",
  billingPeriod: "monthly",
  quotas: [{ metric: "pgr_emissions", limit: 10 }],
  fictitious: true,
  items: [
    { service: "pgr", label: "PGR por empresa", unit: "company", unitAmountCents: 4990 },
    { service: "medicine", label: "Medicina", unit: "company", unitAmountCents: 129900 },
  ],
};
const ORG_OFFER: PlansOverview["offers"][number] = {
  id: "offer-org",
  code: "pro-escritorio",
  version: 2,
  name: "Pro do escritório",
  description: "Plano Pro",
  scope: "organization",
  billingPeriod: "annual",
  quotas: [],
  fictitious: false,
  items: [{ service: "pro", label: "Pro", unit: "organization", unitAmountCents: 19700 }],
};

function overviewOf(patch: Partial<PlansOverview> = {}): PlansOverview {
  return {
    canContract: true,
    readOnlyMessage: null,
    termStart: "2026-11-13",
    offers: [COMPANY_OFFER, ORG_OFFER],
    trials: [],
    customers: [OFFICE],
    companies: [
      { id: "c1", name: "Empresa Um" },
      { id: "c2", name: "Empresa Dois" },
    ],
    contracts: [],
    ...patch,
  };
}

function renderSection(
  patch: Partial<PlansOverview> = {},
  checkoutReturn: "success" | "cancelled" | null = null,
) {
  return render(
    <CommercialPlansSection
      overview={overviewOf(patch)}
      checkoutReturn={checkoutReturn}
    />,
  );
}

function chooseOffer(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Contratar ${name}` }));
}

async function click(name: string, times = 1) {
  const button = screen.getByRole("button", { name });
  await act(async () => {
    for (let count = 0; count < times; count += 1) fireEvent.click(button);
  });
}

beforeAll(() => {
  if (typeof globalThis.crypto?.randomUUID === "function") return;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRole.current = "owner";
  mockRegister.mockResolvedValue({ ok: true, data: { id: "contract-1" } });
  mockStart.mockResolvedValue({
    ok: true,
    data: { url: "https://pagamento.test/sessao" },
  });
});

describe("página /plans", () => {
  afterEach(() => {
    delete process.env.COMMERCIAL_CATALOG_ENABLED;
  });

  it("flag desligada: renderiza como antes, sem a seção e sem busca extra", async () => {
    delete process.env.COMMERCIAL_CATALOG_ENABLED;
    render(await PlanosPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText("secao-comercial")).toBeNull();
    expect(screen.queryByText("Contratação por empresa")).toBeNull();
    expect(mockLoader).not.toHaveBeenCalled();
    expect(mockOverview).not.toHaveBeenCalled();
    expect(screen.getByText("upgrade-pro-antigo")).toBeInTheDocument();
    expect(screen.getByText("Comparativo Detalhado de Recursos")).toBeInTheDocument();
  });

  it("flag ligada: mostra a seção abaixo do conteúdo atual e repassa o retorno do checkout", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    render(
      await PlanosPage({
        searchParams: Promise.resolve({ commercial_checkout: "success" }),
      }),
    );
    expect(screen.getByText("secao-comercial")).toBeInTheDocument();
    expect(screen.getByText("upgrade-pro-antigo")).toBeInTheDocument();
    expect(mockLoader).toHaveBeenCalledWith({
      tenantId: "org_a",
      checkoutReturn: "success",
    });
  });

  it("flag ligada: cliente do escritório não vê a seção", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    mockRole.current = "client";
    render(await PlanosPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText("secao-comercial")).toBeNull();
  });
});

describe("cartões de comparação", () => {
  it("mostram valor em BRL, periodicidade, itens, serviços, cotas e o selo fictício", () => {
    renderSection();
    const card = screen.getByRole("article", { name: "PGR + Medicina" });
    expect(card).toHaveTextContent(/R\$\s?49,90 por empresa/);
    expect(card).toHaveTextContent(/R\$\s?1\.299,00 por empresa/);
    expect(card).toHaveTextContent("Cobrança: por mês");
    expect(card).toHaveTextContent("PGR · PGR por empresa");
    expect(card).toHaveTextContent("Medicina · Medicina");
    expect(card).toHaveTextContent("pgr emissions: 10");
    expect(card).toHaveTextContent("Catálogo fictício — não é oferta comercial");
    const real = screen.getByRole("article", { name: "Pro do escritório" });
    expect(real).toHaveTextContent("Cobrança: por ano");
    expect(real).not.toHaveTextContent("Catálogo fictício");
  });

  it("indicam o plano atual e o teste em andamento da empresa", () => {
    renderSection({
      contracts: [
        {
          id: "contract-9",
          offerVersionId: "offer-org",
          offerCode: "pro-escritorio",
          offerName: "Pro do escritório",
          customerId: "cu-office",
          companyIds: [],
          termStart: "2026-11-01",
          payment: "released",
        },
      ],
      trials: [{ companyId: "c1", status: "active", endsAt: "2026-11-28T12:00:00.000Z" }],
    });
    expect(screen.getByRole("article", { name: "Pro do escritório" })).toHaveTextContent(
      "Plano atual",
    );
    expect(screen.getByRole("article", { name: "PGR + Medicina" })).toHaveTextContent(
      "Teste em andamento: Empresa Um até 28/11/2026",
    );
  });
});

describe("fluxo de contratação", () => {
  it("o resumo traz exatamente os itens e valores da oferta, sem total calculado", () => {
    renderSection();
    chooseOffer("PGR + Medicina");
    fireEvent.click(screen.getByLabelText("Empresa Dois"));
    const summary = screen.getByRole("region", { name: "Resumo da contratação" });
    const items = screen.getByRole("list", { name: "Itens da contratação" });
    expect(items.querySelectorAll("li")).toHaveLength(COMPANY_OFFER.items.length);
    expect(items).toHaveTextContent(/PGR · PGR por empresa — R\$\s?49,90 por empresa/);
    expect(items).toHaveTextContent(/Medicina · Medicina — R\$\s?1\.299,00 por empresa/);
    expect(summary).toHaveTextContent("Pagador: Consultoria SST");
    expect(summary).toHaveTextContent("Empresas: Empresa Dois");
  });

  it("oferta por escritório não pede empresa", () => {
    renderSection();
    chooseOffer("Pro do escritório");
    expect(screen.queryByLabelText("Empresa Um")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Confirmar e ir ao pagamento" }),
    ).toBeEnabled();
  });

  it("oferta por empresa só confirma com ao menos uma empresa escolhida", () => {
    renderSection();
    chooseOffer("PGR + Medicina");
    const confirm = screen.getByRole("button", { name: "Confirmar e ir ao pagamento" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Empresa Um"));
    expect(confirm).toBeEnabled();
  });

  it("cliente direto contrata só para a própria empresa, sem escolher outra", async () => {
    renderSection({ customers: [DIRECT] });
    chooseOffer("PGR + Medicina");
    expect(screen.queryByLabelText("Empresa Um")).toBeNull();
    await click("Confirmar e ir ao pagamento");
    expect(mockRegister).toHaveBeenCalledWith({
      customerId: "cu-direct",
      offerVersionId: "offer-company",
      companyIds: ["c2"],
      termStart: "2026-11-13",
      termEnd: null,
    });
  });

  it("oferta por escritório com só cliente direto orienta a cadastrar a consultoria", () => {
    renderSection({ customers: [DIRECT] });
    chooseOffer("Pro do escritório");
    expect(screen.getByRole("alert")).toHaveTextContent("Cadastre a consultoria");
  });

  it("confirmar cria a contratação, abre o checkout e redireciona para a URL devolvida", async () => {
    renderSection();
    chooseOffer("PGR + Medicina");
    fireEvent.click(screen.getByLabelText("Empresa Um"));
    await click("Confirmar e ir ao pagamento");
    expect(mockRegister).toHaveBeenCalledWith({
      customerId: "cu-office",
      offerVersionId: "offer-company",
      companyIds: ["c1"],
      termStart: "2026-11-13",
      termEnd: null,
    });
    expect(mockStart).toHaveBeenCalledWith("contract-1", {
      idempotencyKey: expect.stringMatching(KEY_PATTERN),
    });
    expect(mockRedirect).toHaveBeenCalledWith("https://pagamento.test/sessao");
  });

  it("duplo clique dispara uma única contratação e um único checkout", async () => {
    renderSection();
    chooseOffer("Pro do escritório");
    await click("Confirmar e ir ao pagamento", 2);
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("falha no checkout: tentar de novo não recria a contratação e reusa a mesma chave", async () => {
    mockStart.mockResolvedValueOnce({
      ok: false,
      error: { code: "BILLING_UNAVAILABLE", message: "BILLING_UNAVAILABLE" },
    });
    renderSection();
    chooseOffer("Pro do escritório");
    await click("Confirmar e ir ao pagamento");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pagamento indisponível neste ambiente",
    );
    expect(mockRedirect).not.toHaveBeenCalled();
    await click("Tentar novamente");
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(mockStart.mock.calls[1][0]).toBe("contract-1");
    expect(mockStart.mock.calls[1][1]).toEqual(mockStart.mock.calls[0][1]);
    expect(mockRedirect).toHaveBeenCalledWith("https://pagamento.test/sessao");
  });

  it("checkout sem preço mapeado mostra a mensagem específica", async () => {
    mockStart.mockResolvedValueOnce({
      ok: false,
      error: { code: "VALIDATION", message: 'O item "Pro" não tem preço.' },
    });
    renderSection();
    chooseOffer("Pro do escritório");
    await click("Confirmar e ir ao pagamento");
    expect(screen.getByRole("alert")).toHaveTextContent("não tem preço mapeado");
  });

  it("erro genérico do servidor aparece em região de alerta", async () => {
    mockRegister.mockResolvedValueOnce({
      ok: false,
      error: { code: "DUPLICATE", message: "Registro já existe neste escritório." },
    });
    renderSection();
    chooseOffer("Pro do escritório");
    await click("Confirmar e ir ao pagamento");
    expect(screen.getByRole("alert")).toHaveTextContent("Registro já existe");
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("contratação sem pagamento pode ser retomada sem criar outra", async () => {
    renderSection({
      contracts: [
        {
          id: "contract-7",
          offerVersionId: "offer-org",
          offerCode: "pro-escritorio",
          offerName: "Pro do escritório",
          customerId: "cu-office",
          companyIds: [],
          termStart: "2026-11-01",
          payment: "pending",
        },
      ],
    });
    await click("Retomar pagamento");
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalledWith("contract-7", {
      idempotencyKey: expect.stringMatching(KEY_PATTERN),
    });
  });
});

describe("retorno do checkout", () => {
  it("success avisa que está em processamento, mostra a situação real e não escreve nada", () => {
    renderSection(
      {
        contracts: [
          {
            id: "contract-2",
            offerVersionId: "offer-org",
            offerCode: "pro-escritorio",
            offerName: "Pro do escritório",
            customerId: "cu-office",
            companyIds: [],
            termStart: "2026-11-01",
            payment: "processing",
          },
        ],
      },
      "success",
    );
    const notice = screen.getByText(
      "Pagamento em processamento — a liberação acontece quando o provedor confirmar",
    );
    expect(notice.closest("[aria-live]")).not.toBeNull();
    expect(
      screen.getAllByText("Aguardando confirmação do provedor").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Plano atual")).toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("cancelled mostra o aviso de cancelamento", () => {
    renderSection({}, "cancelled");
    expect(
      screen.getByText(/Pagamento cancelado — nenhuma cobrança foi feita/),
    ).toBeInTheDocument();
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe("estados", () => {
  it("vazio: sem oferta publicada", () => {
    renderSection({ offers: [] });
    expect(screen.getByText("Nenhuma oferta publicada no momento.")).toBeInTheDocument();
  });

  it("sem cliente pagador: orienta a cadastrar", () => {
    renderSection({ customers: [] });
    chooseOffer("Pro do escritório");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nenhum cliente pagador cadastrado",
    );
  });

  it("somente leitura: mostra as ofertas, sem botão de contratar", () => {
    renderSection({
      canContract: false,
      readOnlyMessage: "Apenas o administrador contrata.",
      customers: [],
    });
    expect(screen.getByText("Apenas o administrador contrata.")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "PGR + Medicina" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Contratar/ })).toBeNull();
  });

  it("carregando: o esqueleto é anunciado como status", () => {
    render(<CommercialPlansSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando contratação por empresa" }),
    ).toBeInTheDocument();
  });
});

describe("pasta da seção comercial", () => {
  it("só usa componentes do design system, nenhum campo nativo", () => {
    const sources = readdirSync(COMMERCIAL_DIR).filter((file) => file.endsWith(".tsx"));
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const source = readFileSync(path.join(COMMERCIAL_DIR, file), "utf8");
      expect(source).not.toMatch(/<(input|select|textarea|button)[\s>]/);
    }
  });
});
