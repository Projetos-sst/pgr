import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AuthorizationForms,
  RiskDecisionForm,
} from "@/app/(protected)/risk-authorizations/[id]/forms";
import {
  appointCompanyAuthorizerAction,
  authorizeCompanyProfessionalAction,
  decideCompanyRiskAction,
} from "@/shared/server/actions/medicine/risk-authorizations";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("@/shared/server/actions/medicine/risk-authorizations", () => ({
  appointCompanyAuthorizerAction: jest.fn(),
  authorizeCompanyProfessionalAction: jest.fn(),
  decideCompanyRiskAction: jest.fn(),
}));
const candidates = [
  { userId: "delegate", label: "Pessoa indicada", email: "pessoa@example.test" },
];
beforeEach(() => {
  jest.clearAllMocks();
  for (const fn of [
    appointCompanyAuthorizerAction,
    authorizeCompanyProfessionalAction,
    decideCompanyRiskAction,
  ])
    (fn as jest.Mock).mockResolvedValue({ ok: true, data: { saved: true } });
});

it("owner records client nomination and evidence without exposing professional-grant controls", async () => {
  render(
    <AuthorizationForms
      companyId="company"
      canAppoint
      canAuthorize={false}
      candidates={candidates}
      currentAuthorizer={null}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Registrar autorização" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Autorizador indicado/), {
    target: { value: "delegate" },
  });
  fireEvent.change(screen.getByLabelText(/Evidência da indicação/), {
    target: { value: "GED: indicação da empresa" },
  });
  fireEvent.change(screen.getByLabelText(/Motivo do registro/), {
    target: { value: "Pedido da empresa" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar indicação" }));
  await waitFor(() =>
    expect(appointCompanyAuthorizerAction).toHaveBeenCalledWith("company", {
      userId: "delegate",
      evidence: "GED: indicação da empresa",
      reason: "Pedido da empresa",
    }),
  );
  expect(authorizeCompanyProfessionalAction).not.toHaveBeenCalled();
});

it("authorizer can revoke a professional without entering new identity information", async () => {
  render(
    <AuthorizationForms
      companyId="company"
      canAppoint={false}
      canAuthorize
      candidates={candidates}
      currentAuthorizer="delegate"
    />,
  );
  fireEvent.change(screen.getByLabelText(/Conta do profissional/), {
    target: { value: "delegate" },
  });
  fireEvent.change(screen.getByLabelText(/Operação/), { target: { value: "false" } });
  expect(screen.queryByLabelText(/Nome completo/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Motivo da autorização/), {
    target: { value: "Revogação solicitada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar autorização" }));
  await waitFor(() =>
    expect(authorizeCompanyProfessionalAction).toHaveBeenCalledWith("company", {
      userId: "delegate",
      active: false,
      reason: "Revogação solicitada",
    }),
  );
});

it("review submits the displayed concurrency token and shows a stale-decision error", async () => {
  (decideCompanyRiskAction as jest.Mock).mockResolvedValue({
    ok: false,
    error: { code: "VALIDATION", message: "Atualize a página antes de decidir." },
  });
  render(
    <RiskDecisionForm
      companyId="company"
      entryId="risk"
      status="validated"
      reviewedAt="2026-10-21T10:00:00.000Z"
    />,
  );
  fireEvent.change(screen.getByLabelText(/Decisão técnica/), {
    target: { value: "rejected" },
  });
  fireEvent.change(screen.getByLabelText(/Parecer e motivo/), {
    target: { value: "Revisão técnica" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await waitFor(() =>
    expect(decideCompanyRiskAction).toHaveBeenCalledWith("company", "risk", {
      status: "rejected",
      reason: "Revisão técnica",
      expectedStatus: "validated",
      expectedReviewedAt: "2026-10-21T10:00:00.000Z",
    }),
  );
  expect(
    await screen.findByText("Atualize a página antes de decidir."),
  ).toBeInTheDocument();
  expect(refresh).not.toHaveBeenCalled();
});
