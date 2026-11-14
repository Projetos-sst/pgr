import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, screen, within } from "@testing-library/react";

import type {
  AdminSubscriptionDetail,
  AdminSubscriptionRow,
} from "@/shared/domains/commercial/admin-subscriptions";

class NotFoundSignal {}

const mockList = jest.fn();
const mockDetail = jest.fn();
const mockReconcile = jest.fn();
const mockRefresh = jest.fn();
const mockNotFound = jest.fn(() => {
  throw new NotFoundSignal();
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  notFound: () => mockNotFound(),
}));
jest.mock("@/shared/auth/require-master", () => ({
  requireMasterPage: async () => ({ userId: "master-1" }),
}));
jest.mock("@/shared/server/actions/commercial/admin-subscriptions", () => ({
  listAdminSubscriptionsAction: (input: unknown) => mockList(input),
  getAdminSubscriptionAction: (orgId: string, contractId: string) =>
    mockDetail(orgId, contractId),
  reconcileSubscriptionAction: (input: unknown) => mockReconcile(input),
}));
jest.mock("@/shared/server/actions/platform/admin", () => ({
  listMastersAction: async () => ({ ok: true, data: [] }),
  aiUsageByOrgAction: async () => ({ ok: true, data: [] }),
}));
jest.mock("@/app/(protected)/admin-global/_components/master-manager", () => ({
  MasterManager: () => "gestao-masters",
}));

import AdminGlobalPage from "@/app/(protected)/admin-global/page";
import AdminSubscriptionPage from "@/app/(protected)/admin-global/subscriptions/[contractId]/page";
import AdminSubscriptionsPage from "@/app/(protected)/admin-global/subscriptions/page";
import { ReconcileForm } from "@/app/(protected)/admin-global/subscriptions/_components/reconcile-form";

const SUBSCRIPTIONS_DIR = path.join(
  process.cwd(),
  "src/app/(protected)/admin-global/subscriptions",
);
const CONTRACT = "22222222-2222-2222-2222-222222222222";

const row: AdminSubscriptionRow = {
  orgId: "org_a",
  contractId: CONTRACT,
  offerName: "PGR por empresa",
  offerCode: "ficticio-pgr",
  billingPeriod: "monthly",
  items: [
    {
      position: 1,
      service: "pgr",
      label: "PGR por empresa",
      unit: "company",
      unitAmountCents: 11100,
    },
  ],
  providerSubscriptionId: "sub_abc12345",
  status: "active",
  currentPeriodStart: "2026-11-01T00:00:00.000Z",
  currentPeriodEnd: "2026-12-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  lastEvent: {
    type: "customer.subscription.updated",
    outcome: "applied",
    occurredAt: "2026-11-02T12:00:00.000Z",
  },
  divergence: "entitlement_mismatch",
};

const detail: AdminSubscriptionDetail = {
  orgId: "org_a",
  contractId: CONTRACT,
  offerName: "PGR por empresa",
  offerCode: "ficticio-pgr",
  offerVersion: 1,
  billingPeriod: "monthly",
  currency: "BRL",
  fictitious: true,
  termStart: "2026-11-13",
  termEnd: null,
  items: row.items,
  subscription: {
    providerSubscriptionId: "sub_abc12345",
    providerCustomerId: "cus_abc12345",
    status: "active",
    currentPeriodStart: "2026-11-01T00:00:00.000Z",
    currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    canceledAt: null,
    lastEventAt: "2026-11-02T12:00:00.000Z",
  },
  entitlements: [
    {
      companyId: "11111111-1111-1111-1111-1111111111c1",
      service: "pgr",
      status: "inactive",
      reason: "subscription_incomplete",
      applied: false,
      updatedAt: "2026-11-02T12:00:00.000Z",
    },
  ],
  events: [
    {
      type: "customer.subscription.updated",
      outcome: "applied",
      detail: "active",
      occurredAt: "2026-11-02T12:00:00.000Z",
    },
  ],
  reconciliations: [
    {
      id: "r1",
      operatorId: "master-9",
      reason: "conferência semanal",
      result: "no_change",
      source: "provider",
      detail: "provider_state_applied:active",
      createdAt: "2026-11-10T12:00:00.000Z",
    },
  ],
  divergence: "entitlement_mismatch",
};

const detailPage = (orgId: string | undefined = "org_a") =>
  AdminSubscriptionPage({
    params: Promise.resolve({ contractId: CONTRACT }),
    searchParams: Promise.resolve({ orgId }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.COMMERCIAL_CATALOG_ENABLED = "true";
  mockList.mockResolvedValue({ ok: true, data: { rows: [row], total: 1 } });
  mockDetail.mockResolvedValue({ ok: true, data: detail });
  mockReconcile.mockResolvedValue({
    ok: true,
    data: { id: "r2", result: "corrected", source: "provider", detail: "ok" },
  });
});

afterEach(() => {
  delete process.env.COMMERCIAL_CATALOG_ENABLED;
});

describe("lista de assinaturas", () => {
  it("flag desligada: notFound e nenhuma consulta", async () => {
    delete process.env.COMMERCIAL_CATALOG_ENABLED;
    await expect(
      AdminSubscriptionsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toBeInstanceOf(NotFoundSignal);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("mostra escritório, oferta, valor do snapshot, status, período, último evento e divergência", async () => {
    render(await AdminSubscriptionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("org_a")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PGR por empresa" })).toHaveAttribute(
      "href",
      `/admin-global/subscriptions/${CONTRACT}?orgId=org_a`,
    );
    expect(screen.getByText(/R\$\s?111,00 por empresa/)).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Ativa")).toBeInTheDocument();
    expect(table.getByText("sub_abc12345")).toBeInTheDocument();
    expect(
      table.getByText(/customer\.subscription\.updated \(applied\)/),
    ).toBeInTheDocument();
    expect(table.getByText("Direitos divergem do espelho")).toBeInTheDocument();
  });

  it("oferece os filtros e repassa a consulta ao servidor", async () => {
    render(
      await AdminSubscriptionsPage({
        searchParams: Promise.resolve({ orgId: "org_a", service: "pgr", page: "1" }),
      }),
    );
    expect(screen.getByLabelText("Escritório (org_id)")).toHaveValue("org_a");
    expect(document.querySelector('[name="service"]')).toHaveValue("pgr");
    expect(document.querySelector('[name="status"]')).toBeInTheDocument();
    expect(screen.getByLabelText("Período de")).toBeInTheDocument();
    expect(screen.getByLabelText("Período até")).toBeInTheDocument();
    expect(screen.getByLabelText("Identificador do provedor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar" })).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith({ orgId: "org_a", service: "pgr", page: "1" });
  });

  it("sem resultados: estado vazio", async () => {
    mockList.mockResolvedValue({ ok: true, data: { rows: [], total: 0 } });
    render(await AdminSubscriptionsPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByText("Nenhuma assinatura encontrada para os filtros informados."),
    ).toBeInTheDocument();
  });

  it("erro do servidor aparece como alerta", async () => {
    mockList.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Acesso restrito a administradores." },
    });
    render(await AdminSubscriptionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso restrito");
  });
});

describe("ficha da assinatura", () => {
  it("flag desligada: notFound", async () => {
    delete process.env.COMMERCIAL_CATALOG_ENABLED;
    await expect(detailPage()).rejects.toBeInstanceOf(NotFoundSignal);
    expect(mockDetail).not.toHaveBeenCalled();
  });

  it("contratação inexistente: notFound", async () => {
    mockDetail.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "NOT_FOUND" },
    });
    await expect(detailPage()).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("mostra preço, identificadores do provedor, direitos, eventos e histórico", async () => {
    render(await detailPage());
    expect(mockDetail).toHaveBeenCalledWith("org_a", CONTRACT);
    expect(screen.getByText(/R\$\s?111,00 por empresa/)).toBeInTheDocument();
    expect(screen.getByText("sub_abc12345")).toBeInTheDocument();
    expect(screen.getByText("cus_abc12345")).toBeInTheDocument();
    expect(screen.getByText("subscription_incomplete")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Eventos do provedor" })).toHaveTextContent(
      "customer.subscription.updated",
    );
    const history = screen.getByRole("region", { name: "Histórico de reconciliações" });
    expect(history).toHaveTextContent("master-9");
    expect(history).toHaveTextContent("conferência semanal");
    expect(history).toHaveTextContent("Nada a corrigir");
  });
});

describe("formulário de reconciliação", () => {
  const typeReason = (value: string) =>
    fireEvent.change(screen.getByLabelText(/Motivo da reconciliação/), {
      target: { value },
    });
  const open = () => fireEvent.click(screen.getByRole("button", { name: "Reconciliar" }));

  it("motivo obrigatório: sem motivo não abre confirmação nem chama o servidor", () => {
    render(<ReconcileForm orgId="org_a" contractId={CONTRACT} />);
    open();
    expect(
      screen.getByText(/O motivo precisa ter ao menos 10 caracteres/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Confirmar reconciliação")).toBeNull();
    typeReason("curto");
    open();
    expect(screen.queryByText("Confirmar reconciliação")).toBeNull();
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("confirma, reconcilia uma vez com o motivo e anuncia o resultado", async () => {
    render(<ReconcileForm orgId="org_a" contractId={CONTRACT} />);
    typeReason("conferência manual de divergência");
    open();
    expect(screen.getByText("Confirmar reconciliação")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reconciliar agora" }));
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith({
      orgId: "org_a",
      contractId: CONTRACT,
      reason: "conferência manual de divergência",
    });
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Corrigido");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("duplo clique em confirmar dispara uma única reconciliação", async () => {
    render(<ReconcileForm orgId="org_a" contractId={CONTRACT} />);
    typeReason("conferência manual de divergência");
    open();
    const confirm = screen.getByRole("button", { name: "Reconciliar agora" });
    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it("erro do servidor aparece na região de status", async () => {
    mockReconcile.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Contratação não encontrada." },
    });
    render(<ReconcileForm orgId="org_a" contractId={CONTRACT} />);
    typeReason("conferência manual de divergência");
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reconciliar agora" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Contratação não encontrada.");
  });
});

describe("link na página /admin-global", () => {
  it("aparece só com a flag ligada", async () => {
    render(await AdminGlobalPage());
    expect(
      screen.getByRole("link", { name: /Assinaturas e reconciliação/ }),
    ).toHaveAttribute("href", "/admin-global/subscriptions");
  });

  it("não aparece com a flag desligada", async () => {
    delete process.env.COMMERCIAL_CATALOG_ENABLED;
    render(await AdminGlobalPage());
    expect(
      screen.queryByRole("link", { name: /Assinaturas e reconciliação/ }),
    ).toBeNull();
  });
});

describe("pasta das telas de assinaturas", () => {
  it("só usa componentes do design system, nenhum campo nativo", () => {
    const sources = readdirSync(SUBSCRIPTIONS_DIR, {
      recursive: true,
      encoding: "utf8",
    }).filter((file) => file.endsWith(".tsx"));
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const source = readFileSync(path.join(SUBSCRIPTIONS_DIR, file), "utf8");
      expect(source).not.toMatch(/<(input|select|textarea|button)[\s>]/);
    }
  });
});
