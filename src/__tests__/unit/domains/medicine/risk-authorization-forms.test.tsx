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
      appointmentOrigin="office_owner"
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

it("company representative appoints with own-company wording and without professional-grant controls", async () => {
  render(
    <AuthorizationForms
      companyId="company"
      appointmentOrigin="company_representative"
      canAuthorize={false}
      candidates={candidates}
      currentAuthorizer={null}
    />,
  );
  expect(screen.getByText("Indicar o autorizador da empresa")).toBeInTheDocument();
  expect(screen.getByText(/não pode indicar a própria conta/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Registrar autorização" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Autorizador indicado/), {
    target: { value: "delegate" },
  });
  fireEvent.change(screen.getByLabelText(/Evidência da indicação/), {
    target: { value: "Ata da diretoria" },
  });
  fireEvent.change(screen.getByLabelText(/Motivo do registro/), {
    target: { value: "Indicação da empresa" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar indicação" }));
  await waitFor(() =>
    expect(appointCompanyAuthorizerAction).toHaveBeenCalledWith("company", {
      userId: "delegate",
      evidence: "Ata da diretoria",
      reason: "Indicação da empresa",
    }),
  );
});

it("authorizer can revoke a professional without entering new identity information", async () => {
  render(
    <AuthorizationForms
      companyId="company"
      appointmentOrigin={null}
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

// NOB-112: erros por campo (e aninhados) ficam no campo, não numa frase única com os textos
// colados; permissão segue como mensagem de permissão; falha inesperada vira mensagem segura.
const invalid = (fields: Record<string, string>) => ({
  ok: false,
  error: { code: "VALIDATION", message: "Dados inválidos.", fields },
});

it("appoint: each server field error is shown next to its own field", async () => {
  (appointCompanyAuthorizerAction as jest.Mock).mockResolvedValue(
    invalid({
      evidence: "Informe a evidência da indicação da empresa.",
      reason: "Informe o motivo do registro ou da substituição.",
    }),
  );
  render(
    <AuthorizationForms
      companyId="company"
      appointmentOrigin="office_owner"
      canAuthorize={false}
      candidates={candidates}
      currentAuthorizer={null}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Registrar indicação" }));
  expect(
    await screen.findByText("Informe a evidência da indicação da empresa."),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Informe o motivo do registro ou da substituição."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("textbox", { name: /^Evidência da indicação/ }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("textbox", { name: /^Motivo do registro/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Revise os campos destacados.");
  expect(screen.queryByText(/ · /)).not.toBeInTheDocument();
  expect(refresh).not.toHaveBeenCalled();
});

it("grant: nested identity errors reach the identity fields; unslotted keys are readable", async () => {
  (authorizeCompanyProfessionalAction as jest.Mock).mockResolvedValue(
    invalid({
      "identity.fullName": "Informe o nome completo do profissional.",
      "identity.registration.council": "Informe o conselho ou órgão de registro.",
      active: "Invalid input",
    }),
  );
  render(
    <AuthorizationForms
      companyId="company"
      appointmentOrigin={null}
      canAuthorize
      candidates={candidates}
      currentAuthorizer="delegate"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Registrar autorização" }));
  expect(
    await screen.findByText("Informe o nome completo do profissional."),
  ).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /^Nome completo/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("textbox", { name: /^Conselho ou órgão/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Operação: Valor inválido.");
  expect(document.body).not.toHaveTextContent(/identity\.|Invalid input/);
});

it("decision: FORBIDDEN keeps the authorization message (not a validation one)", async () => {
  (decideCompanyRiskAction as jest.Mock).mockResolvedValue({
    ok: false,
    error: { code: "FORBIDDEN", message: "Você não está autorizado a validar riscos." },
  });
  render(
    <RiskDecisionForm
      companyId="company"
      entryId="risk"
      status="pending"
      reviewedAt={null}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Você não está autorizado a validar riscos.",
  );
  expect(screen.queryByText(/Revise os campos/)).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: /^Decisão técnica/ })).not.toHaveAttribute(
    "aria-invalid",
  );
});

it("decision: several errors at once, each in place; stale token stays readable", async () => {
  (decideCompanyRiskAction as jest.Mock).mockResolvedValue(
    invalid({
      status: "Selecione a decisão técnica.",
      reason: "Registre o parecer e o motivo da decisão.",
      expectedReviewedAt: "Atualize a página e tente novamente.",
    }),
  );
  render(
    <RiskDecisionForm
      companyId="company"
      entryId="risk"
      status="pending"
      reviewedAt={null}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  expect(await screen.findByText("Selecione a decisão técnica.")).toBeInTheDocument();
  expect(
    screen.getByText("Registre o parecer e o motivo da decisão."),
  ).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: /^Decisão técnica/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Atualize a página e tente novamente.",
  );
  expect(document.body).not.toHaveTextContent(/expectedReviewedAt/);
});

it("decision: unexpected failure shows a safe generic message", async () => {
  (decideCompanyRiskAction as jest.Mock).mockRejectedValue(
    new Error("duplicate key value violates unique constraint"),
  );
  render(
    <RiskDecisionForm
      companyId="company"
      entryId="risk"
      status="pending"
      reviewedAt={null}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível concluir a operação. Tente novamente.",
  );
  expect(screen.queryByText(/duplicate key/)).not.toBeInTheDocument();
});
