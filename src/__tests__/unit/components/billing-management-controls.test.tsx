/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SubscriptionActions,
  SubscriptionChangeForm,
} from "@/app/(protected)/configuracoes/_components/subscription-controls";
import {
  billingPolicySchema,
  type BillingChangePreview,
} from "@/shared/domains/billing/contracts";
import * as actions from "@/shared/server/actions/platform/billing-management";
jest.mock("@/shared/server/actions/platform/billing-management", () => ({
  previewCommercialChangeAction: jest.fn(),
  confirmCommercialChangeAction: jest.fn(),
  cancelCommercialSubscriptionAction: jest.fn(),
  resumeCommercialSubscriptionAction: jest.fn(),
}));
const ids = {
  one: "11111111-1111-4111-8111-111111111111",
  two: "22222222-2222-4222-8222-222222222222",
  price: "33333333-3333-4333-8333-333333333333",
  quote: "44444444-4444-4444-8444-444444444444",
};
const contracts = [
  {
    id: ids.one,
    availableActions: ["change", "cancel"],
    snapshot: { name: "Plano PGR", interval: "month" },
  },
  {
    id: ids.two,
    availableActions: ["change"],
    snapshot: { name: "Outra assinatura", interval: "month" },
  },
];
const offers = [
  { id: ids.price, version: 1, data: { name: "Plano combinado", interval: "month" } },
];
function quote(): BillingChangePreview {
  return {
    id: ids.quote,
    contractId: ids.one,
    amountMinor: 12500,
    items: [
      { product: "pgr", label: "PGR", amountMinor: 10000 },
      { product: "medicine", label: "Medicina", amountMinor: 2500 },
    ],
    policy: billingPolicySchema.parse({}),
    effectiveAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    simulated: true,
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(actions.previewCommercialChangeAction)
    .mockResolvedValue({ ok: true, data: quote() });
  jest
    .mocked(actions.confirmCommercialChangeAction)
    .mockResolvedValue({ ok: true, data: { scheduled: true, effectiveAt: new Date() } });
  jest
    .mocked(actions.cancelCommercialSubscriptionAction)
    .mockResolvedValue({ ok: true, data: { accepted: true, duplicate: false } });
});
async function preview(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Assinatura"), ids.one);
  await user.selectOptions(screen.getByLabelText("Nova oferta"), ids.price);
  await user.click(screen.getByRole("button", { name: "Calcular prévia" }));
  return screen.findByRole("button", { name: "Confirmar mudança simulada" });
}
it("clears an old quote when the selected contract changes", async () => {
  const user = userEvent.setup();
  render(
    <SubscriptionChangeForm
      contracts={contracts}
      offers={offers}
      onChanged={jest.fn()}
    />,
  );
  await preview(user);
  await user.selectOptions(screen.getByLabelText("Assinatura"), ids.two);
  expect(
    screen.queryByRole("button", { name: "Confirmar mudança simulada" }),
  ).not.toBeInTheDocument();
  expect(actions.confirmCommercialChangeAction).not.toHaveBeenCalled();
});
it("disables confirmation after expiry", async () => {
  jest.mocked(actions.previewCommercialChangeAction).mockResolvedValue({
    ok: true,
    data: { ...quote(), expiresAt: new Date(Date.now() - 1).toISOString() },
  });
  const user = userEvent.setup();
  render(
    <SubscriptionChangeForm
      contracts={contracts}
      offers={offers}
      onChanged={jest.fn()}
    />,
  );
  await preview(user);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Confirmar mudança simulada" }),
    ).toBeDisabled(),
  );
  expect(actions.confirmCommercialChangeAction).not.toHaveBeenCalled();
});
it("shows the itemized quote and waits for payment rather than claiming activation", async () => {
  const user = userEvent.setup(),
    changed = jest.fn().mockResolvedValue(undefined);
  render(
    <SubscriptionChangeForm contracts={contracts} offers={offers} onChanged={changed} />,
  );
  const confirmation = await preview(user);
  expect(screen.getByText(/PGR:.*100,00/)).toBeInTheDocument();
  expect(screen.getByText(/Medicina:.*25,00/)).toBeInTheDocument();
  await user.click(confirmation);
  await screen.findByText(
    "Mudança confirmada. O novo acesso aguarda a vigência e a confirmação do pagamento.",
  );
  expect(changed).toHaveBeenCalledTimes(1);
  expect(actions.confirmCommercialChangeAction).toHaveBeenCalledWith({
    quoteId: ids.quote,
    reason: expect.any(String),
  });
});
it("requires explicit cancellation confirmation before invoking the server action", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const user = userEvent.setup(),
    changed = jest.fn().mockResolvedValue(undefined);
  render(<SubscriptionActions contract={contracts[0]} onChanged={changed} />);
  await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
  expect(actions.cancelCommercialSubscriptionAction).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  confirm.mockRestore();
});
