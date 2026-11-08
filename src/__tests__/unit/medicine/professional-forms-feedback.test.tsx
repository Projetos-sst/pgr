/**
 * NOB-112 (etapa E): acesso do profissional (convite/revogação) e ações da própria identidade
 * profissional. Erro de campo sem lugar na tela aparece legível (antes sumia, ou só "Dados
 * inválidos."), a conta convidada mostra o erro no próprio campo, FORBIDDEN cru vira mensagem de
 * permissão e promessa rejeitada vira mensagem genérica, mantendo o que foi digitado.
 * Dados fictícios.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { ProfessionalAccess } from "@/app/(protected)/medicos/_components/professional-access";
import { IdentityControls } from "@/app/(protected)/professional-identity/identity-controls";
import type { ProfessionalIdentityItem } from "@/shared/domains/medicine/professional-identity";
import {
  reconfirmLegacyLinkAction,
  requestIdentityVerificationAction,
} from "@/shared/server/actions/medicine/professional-identity";
import {
  inviteMedicoUserAction,
  revokeMedicoUserLinkAction,
} from "@/shared/server/actions/medicine/professional-links";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/professional-links", () => ({
  inviteMedicoUserAction: jest.fn(),
  revokeMedicoUserLinkAction: jest.fn(),
  actOnMedicoLinkInvitationAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/professional-identity", () => ({
  requestIdentityVerificationAction: jest.fn(),
  reconfirmLegacyLinkAction: jest.fn(),
}));

const invite = inviteMedicoUserAction as jest.Mock;
const revoke = revokeMedicoUserLinkAction as jest.Mock;
const request = requestIdentityVerificationAction as jest.Mock;
const reconfirm = reconfirmLegacyLinkAction as jest.Mock;

const MEDICO = "b1111111-1111-4111-8111-111111111111";
const MEMBERS = [{ userId: "u-doctor", label: "Dra. Fictícia · Colaborador" }];
const OPEN = {
  id: "d1111111-1111-4111-8111-111111111111",
  userId: "u-doctor",
  reason: "Acesso fictício",
  linkedAt: "2026-11-01T10:00:00.000Z",
  revokedAt: null,
  revokeReason: null,
  legacy: false,
};
const base = { medicoId: MEDICO, currentUserId: "u-owner", invitations: [] };
const GENERIC = "Não foi possível concluir a operação. Tente novamente.";

const ITEM: ProfessionalIdentityItem = {
  medicoId: MEDICO,
  medicoName: "Dra. Fictícia",
  registration: "CRM 123/MA",
  linkId: "l1111111-1111-4111-8111-111111111111",
  legacy: true,
  needsReconfirmation: true,
  pendingSelfInvitationId: null,
  status: "not_requested",
  openRequestId: null,
  expiresAt: null,
  clinicalAccess: false,
};

beforeEach(() => jest.clearAllMocks());

describe("acesso do profissional", () => {
  it("convite: erro da conta no próprio campo e chave sem campo legível no resumo", async () => {
    invite.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { userId: "Selecione a conta.", medicoId: "Médico inválido." },
      },
    });
    render(<ProfessionalAccess {...base} canManage members={MEMBERS} links={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Convidar conta" }));

    expect(await screen.findByText("Selecione a conta.")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: /^Conta convidada/ });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Selecione a conta.");
    expect(screen.getByRole("alert")).toHaveTextContent("Médico inválido.");
    expect(document.body).not.toHaveTextContent(/medicoId/);
  });

  it("revogação: inglês do Zod nunca aparece; FORBIDDEN cru vira permissão", async () => {
    revoke.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { reason: "Too small: expected string to have >=10 characters" },
      },
    });
    render(<ProfessionalAccess {...base} canManage members={MEMBERS} links={[OPEN]} />);
    fireEvent.change(screen.getByLabelText(/Motivo da revogação/), {
      target: { value: "Saída" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revogar acesso" }));
    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Too small/);

    revoke.mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Revogar acesso" }));
    expect(
      await screen.findByText("Você não tem permissão para esta operação."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Motivo da revogação/ })).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("promessa rejeitada: mensagem genérica e motivo mantido", async () => {
    invite.mockRejectedValue(new Error("clerk user u-secret not found"));
    render(<ProfessionalAccess {...base} canManage members={MEMBERS} links={[]} />);
    fireEvent.change(screen.getByLabelText(/^Motivo/), {
      target: { value: "Profissional da equipe." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Convidar conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.queryByText(/u-secret/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Motivo/)).toHaveValue("Profissional da equipe.");
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("minha identidade profissional", () => {
  it("erro de campo aparece legível (não só 'Dados inválidos.')", async () => {
    request.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { medicoId: "Cadastro de médico inválido." },
      },
    });
    render(<IdentityControls item={ITEM} />);
    fireEvent.click(screen.getByRole("button", { name: "Pedir verificação de identidade" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cadastro do profissional: Cadastro de médico inválido.",
    );
  });

  it("FORBIDDEN cru vira permissão; promessa rejeitada vira mensagem genérica", async () => {
    reconfirm.mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    render(<IdentityControls item={ITEM} />);
    const name = /^Reconfirmar/;
    fireEvent.click(screen.getByRole("button", { name }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );

    reconfirm.mockRejectedValueOnce(new Error("row-level security policy"));
    fireEvent.click(await screen.findByRole("button", { name }));
    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(screen.queryByText(/row-level/)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name })).toBeEnabled();
  });
});
