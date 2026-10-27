import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommercialPanel } from "@/app/(protected)/configuracoes/_components/commercial-panel";
import { CommercialOfferForm } from "@/app/(protected)/configuracoes/_components/commercial-offer-form";
import { CommercialInvoices } from "@/app/(protected)/configuracoes/_components/commercial-invoices";
import {
  getCommercialPaymentProfileAction,
  openCommercialPortalAction,
} from "@/shared/server/actions/platform/billing-portal";
import type { getCommercialOverview } from "@/shared/server/platform/commercial-core";
import { getCommercialOverviewAction } from "@/shared/server/actions/platform/commercial";
import { startCommercialCheckoutAction } from "@/shared/server/actions/platform/billing-checkout";
jest.mock("@/shared/server/actions/platform/commercial", () => ({
  getCommercialOverviewAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-checkout", () => ({
  startCommercialCheckoutAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-catalog", () => ({
  createBillingOfferAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-trials", () => ({
  startCommercialTrialAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-interests", () => ({
  registerCommercialInterestAction: jest.fn(),
  getCommercialInterestsAction: jest.fn(),
  acknowledgeCommercialInterestAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-subscriptions", () => ({
  simulateCommercialPaymentAction: jest.fn(),
  reconcileCommercialSubscriptionAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-management", () => ({
  previewCommercialChangeAction: jest.fn(),
  confirmCommercialChangeAction: jest.fn(),
  cancelCommercialSubscriptionAction: jest.fn(),
  resumeCommercialSubscriptionAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-charges", () => ({
  getCommercialChargesAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/billing-portal", () => ({
  openCommercialPortalAction: jest.fn(),
  getCommercialPaymentProfileAction: jest.fn(),
}));
type Data = Awaited<ReturnType<typeof getCommercialOverview>>;
function fixture(pending = false): Data {
  return {
    simulated: true,
    companyOptions: [
      { id: "company-a", name: "Empresa A" },
      { id: "company-b", name: "Empresa B" },
    ],
    customers: [{ id: "customer-a", companyId: "company-a", name: "Empresa A" }],
    offers: [
      {
        id: "price-a",
        version: 1,
        data: {
          name: "Oferta PGR",
          description: "Fictícia",
          interval: "month",
          items: [{ product: "pgr", label: "PGR", amountMinor: 10000 }],
          benefits: [],
          limits: { companies: null, employees: null },
        },
      },
    ],
    contracts: pending
      ? [
          {
            id: "contract-a",
            offerId: "price-a",
            customerId: "customer-a",
            status: "pending_payment",
            snapshot: {
              name: "Oferta PGR",
              interval: "month",
              items: [{ product: "pgr", label: "PGR", amountMinor: 10000 }],
            },
            availableActions: [],
            access: false,
            periodStart: null,
            periodEnd: null,
          },
        ]
      : [],
    trials: [],
    interests: [],
    history: [],
    invoicePage: 1,
    invoices: [],
    interestInbox: { rows: [], page: 1, hasMore: false },
    invoiceList: { rows: [], page: 1, hasMore: false, simulated: true },
  } as unknown as Data;
}
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  jest
    .mocked(getCommercialOverviewAction)
    .mockResolvedValue({ ok: true, data: fixture() });
  jest
    .spyOn(crypto, "randomUUID")
    .mockReturnValue("11111111-1111-4111-8111-111111111111");
});
afterEach(() => jest.restoreAllMocks());
it("uses a new key only after checkout expiry is confirmed by the server", async () => {
  const user = userEvent.setup();
  jest
    .mocked(crypto.randomUUID)
    .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
    .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
  jest.mocked(startCommercialCheckoutAction).mockResolvedValue({
    ok: false,
    error: {
      code: "DUPLICATE",
      message: "A sessão do checkout expirou. Consulte a assinatura.",
    },
  });
  render(<CommercialPanel initial={fixture()} section="plans" />);
  await user.click(screen.getByRole("button", { name: "Contratar no simulador" }));
  await screen.findByText(/A sessão do checkout expirou/);
  await user.click(screen.getByRole("button", { name: "Contratar no simulador" }));
  await waitFor(() => expect(startCommercialCheckoutAction).toHaveBeenCalledTimes(2));
  expect(jest.mocked(startCommercialCheckoutAction).mock.calls[0][0]).not.toEqual(
    jest.mocked(startCommercialCheckoutAction).mock.calls[1][0],
  );
});
it("can request a fresh portal after its previous session has expired", async () => {
  const user = userEvent.setup();
  jest
    .mocked(crypto.randomUUID)
    .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
    .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
  jest.mocked(getCommercialPaymentProfileAction).mockResolvedValue({
    ok: true,
    data: {
      customerId: "customer-a",
      provider: "mock",
      simulated: true,
      paymentMethod: null,
      portalAvailable: true,
    },
  });
  jest.mocked(openCommercialPortalAction).mockResolvedValue({
    ok: false,
    error: { code: "DUPLICATE", message: "A sessão expirou. Solicite um novo portal." },
  });
  render(
    <CommercialInvoices
      initial={fixture().invoiceList}
      customers={fixture().customers}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Gerar sessão de portal simulado" }),
  );
  await screen.findByText(/A sessão expirou/);
  await user.click(
    screen.getByRole("button", { name: "Gerar sessão de portal simulado" }),
  );
  await waitFor(() => expect(openCommercialPortalAction).toHaveBeenCalledTimes(2));
  expect(jest.mocked(openCommercialPortalAction).mock.calls[0][0]).not.toEqual(
    jest.mocked(openCommercialPortalAction).mock.calls[1][0],
  );
});
it("shows a synchronized test method and clears it when changing the selected customer", async () => {
  const user = userEvent.setup();
  jest
    .mocked(getCommercialPaymentProfileAction)
    .mockResolvedValueOnce({
      ok: true,
      data: {
        customerId: "customer-a",
        provider: "mock",
        simulated: true,
        paymentMethod: {
          brand: "Visa (teste)",
          last4: "4242",
          synchronizedAt: new Date().toISOString(),
        },
        portalAvailable: true,
      },
    })
    .mockResolvedValueOnce({
      ok: true,
      data: {
        customerId: "customer-b",
        provider: "mock",
        simulated: true,
        paymentMethod: null,
        portalAvailable: true,
      },
    });
  render(
    <CommercialInvoices
      initial={fixture().invoiceList}
      customers={[
        ...fixture().customers,
        { id: "customer-b", companyId: "company-b", name: "Empresa B" },
      ]}
    />,
  );
  await screen.findByText("Visa (teste) •••• 4242");
  await user.selectOptions(screen.getByLabelText("Cliente comercial"), "customer-b");
  await screen.findByText("Nenhum método de teste vinculado ao cliente selecionado.");
  expect(screen.queryByText("Visa (teste) •••• 4242")).not.toBeInTheDocument();
});
it("retains checkout retry identity after an unknown failure and does not send browser prices", async () => {
  const user = userEvent.setup();
  jest
    .mocked(startCommercialCheckoutAction)
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({
      ok: true,
      data: {
        simulated: true,
        sessionId: "session-a",
        contractId: "contract-a",
        checkoutUrl: "/configuracoes/assinatura/simulacao?session=session-a",
        expiresAt: new Date().toISOString(),
      },
    });
  render(<CommercialPanel initial={fixture()} section="plans" />);
  await user.click(screen.getByRole("button", { name: "Contratar no simulador" }));
  await screen.findByText(/Não foi possível concluir/);
  await user.click(screen.getByRole("button", { name: "Contratar no simulador" }));
  await screen.findByRole("link", { name: "Continuar no checkout simulado" });
  const calls = jest.mocked(startCommercialCheckoutAction).mock.calls;
  expect(calls[0][0]).toEqual(calls[1][0]);
  expect(calls[0][0]).toEqual({
    companyId: "company-a",
    priceId: "price-a",
    key: expect.any(String),
  });
});
it("a pending checkout remains without access and duplicate checkout is disabled", () => {
  const { unmount } = render(<CommercialPanel initial={fixture(true)} section="plans" />);
  expect(screen.getByRole("button", { name: "Contratar no simulador" })).toBeDisabled();
  unmount();
  render(
    <CommercialPanel
      initial={fixture(true)}
      section="simulation"
      checkoutContractId="contract-a"
    />,
  );
  expect(screen.getByText(/sem acesso comercial vigente/)).toBeInTheDocument();
  expect(screen.getByText(/O retorno do checkout não ativa acesso/)).toBeInTheDocument();
  expect(startCommercialCheckoutAction).not.toHaveBeenCalled();
});
it("changes the selected company without reusing a previous continuation link", async () => {
  const user = userEvent.setup();
  jest.mocked(startCommercialCheckoutAction).mockResolvedValue({
    ok: true,
    data: {
      simulated: true,
      sessionId: "session-a",
      contractId: "contract-a",
      checkoutUrl: "/configuracoes/assinatura/simulacao?session=session-a",
      expiresAt: new Date().toISOString(),
    },
  });
  render(<CommercialPanel initial={fixture()} section="plans" />);
  await user.click(screen.getByRole("button", { name: "Contratar no simulador" }));
  await screen.findByRole("link", { name: "Continuar no checkout simulado" });
  await user.selectOptions(screen.getByLabelText("Empresa-cliente"), "company-b");
  expect(
    screen.queryByRole("link", { name: "Continuar no checkout simulado" }),
  ).not.toBeInTheDocument();
});
it("parses Brazilian decimal prices into cents without accepting a third decimal place", async () => {
  const user = userEvent.setup(),
    save = jest.fn();
  render(<CommercialOfferForm pending={false} onSave={save} />);
  const value = screen.getByLabelText("Valor fictício de PGR");
  await user.clear(value);
  await user.type(value, "10,999");
  await user.click(screen.getByRole("button", { name: /Salvar/ }));
  await screen.findByText(/até duas casas/);
  expect(save).not.toHaveBeenCalled();
  await user.clear(value);
  await user.type(value, "10,99");
  await user.click(screen.getByRole("button", { name: /Salvar/ }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(
    save.mock.calls[0][0].items.find((i: { product: string }) => i.product === "pgr")
      .amountMinor,
  ).toBe(1099);
});
