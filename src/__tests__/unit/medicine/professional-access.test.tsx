/**
 * Vínculo profissional ↔ conta (NOB-149): schemas e seção "Acesso do profissional".
 * O formulário só aparece para o owner; vínculo aberto mostra a revogação; erros do servidor
 * chegam ao formulário. A regra real fica no servidor e na RLS. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProfessionalAccess } from "@/app/(protected)/medicos/_components/professional-access";
import {
  professionalLinkSchema,
  professionalRevokeSchema,
} from "@/shared/domains/medicine/professional-links";
import {
  actOnMedicoLinkInvitationAction,
  inviteMedicoUserAction,
  revokeMedicoUserLinkAction,
} from "@/shared/server/actions/medicine/professional-links";
import type { InvitationView } from "@/shared/domains/medicine/professional-links";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/professional-links", () => ({
  inviteMedicoUserAction: jest.fn(),
  revokeMedicoUserLinkAction: jest.fn(),
  actOnMedicoLinkInvitationAction: jest.fn(),
}));

const linkAction = inviteMedicoUserAction as jest.Mock;
const actAction = actOnMedicoLinkInvitationAction as jest.Mock;
const revokeAction = revokeMedicoUserLinkAction as jest.Mock;
const MEDICO = "b1111111-1111-4111-8111-111111111111";
const MEMBERS = [
  { userId: "u-doctor", label: "Dra. Fictícia · Colaborador" },
  { userId: "u-staff", label: "Equipe Fictícia · Colaborador" },
];
const OPEN = {
  id: "d1111111-1111-4111-8111-111111111111",
  userId: "u-doctor",
  reason: "Acesso fictício",
  linkedAt: "2026-11-01T10:00:00.000Z",
  revokedAt: null,
  revokeReason: null,
  legacy: false,
};
const INVITATION: InvitationView = {
  id: "e1111111-1111-4111-8111-111111111111",
  medicoId: MEDICO,
  userId: "u-doctor",
  reason: "Acesso fictício",
  invitedBy: "u-owner",
  invitedAt: "2026-11-02T10:00:00.000Z",
  expiresAt: "2026-11-09T10:00:00.000Z",
  selfInvitation: false,
  status: "pending_acceptance",
  events: [],
};
const base = { medicoId: MEDICO, currentUserId: "u-owner", invitations: [] };

beforeEach(() => jest.clearAllMocks());

describe("schemas do vínculo", () => {
  it("exige conta e motivo de 10 caracteres", () => {
    expect(
      professionalLinkSchema.safeParse({ userId: "", reason: "x".repeat(10) }).success,
    ).toBe(false);
    expect(
      professionalLinkSchema.safeParse({ userId: "u", reason: "curto" }).success,
    ).toBe(false);
    expect(
      professionalLinkSchema.parse({ userId: " u-1 ", reason: " Motivo suficiente " }),
    ).toEqual({ userId: "u-1", reason: "Motivo suficiente" });
    expect(professionalRevokeSchema.safeParse({ reason: "curto" }).success).toBe(false);
  });

  it("recusa campos extras (ninguém informa o autor pelo cliente)", () => {
    expect(
      professionalLinkSchema.safeParse({
        userId: "u",
        reason: "Motivo suficiente",
        linkedBy: "forjado",
      }).success,
    ).toBe(false);
  });
});

describe("ProfessionalAccess", () => {
  it("owner sem vínculo convida com conta e motivo (o vínculo só nasce do aceite)", async () => {
    linkAction.mockResolvedValue({ ok: true, data: {} });
    render(<ProfessionalAccess {...base} canManage members={MEMBERS} links={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma conta vinculada");
    fireEvent.change(screen.getByRole("combobox", { name: /Conta/ }), {
      target: { value: "u-doctor" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/), {
      target: { value: "Profissional da equipe." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Convidar conta" }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(linkAction).toHaveBeenCalledWith(MEDICO, {
      userId: "u-doctor",
      reason: "Profissional da equipe.",
    });
  });

  it("vínculo aberto mostra a conta e a revogação; erro geral aparece", async () => {
    revokeAction.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Somente o responsável pode revogar." },
    });
    render(<ProfessionalAccess {...base} canManage members={MEMBERS} links={[OPEN]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Dra. Fictícia · Colaborador");
    expect(
      screen.queryByRole("button", { name: "Convidar conta" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Motivo da revogação/), {
      target: { value: "Saída fictícia." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revogar acesso" }));
    expect(
      await screen.findByText("Somente o responsável pode revogar."),
    ).toBeInTheDocument();
    expect(revokeAction).toHaveBeenCalledWith(MEDICO, OPEN.id, {
      reason: "Saída fictícia.",
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("colaborador vê o vínculo e o histórico, sem formulários", () => {
    render(
      <ProfessionalAccess
        {...base}
        canManage={false}
        members={[]}
        links={[
          {
            ...OPEN,
            revokedAt: "2026-11-02T10:00:00.000Z",
            revokeReason: "Troca fictícia",
          },
        ]}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Somente o responsável pelo escritório/)).toBeInTheDocument();
    expect(screen.getByText(/revogado: Troca fictícia/)).toBeInTheDocument();
  });

  it("NOB-157: só a conta convidada vê Aceitar/Recusar; o owner só cancela", async () => {
    actAction.mockResolvedValue({ ok: true, data: {} });
    const { unmount } = render(
      <ProfessionalAccess
        {...base}
        canManage
        members={MEMBERS}
        links={[]}
        invitations={[INVITATION]}
      />,
    );
    expect(screen.queryByRole("button", { name: /Aceitar/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Convidar conta" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar convite" })).toBeInTheDocument();
    unmount();
    render(
      <ProfessionalAccess
        {...base}
        currentUserId="u-doctor"
        canManage={false}
        members={MEMBERS}
        links={[]}
        invitations={[INVITATION]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Aceitar: sou este profissional/ }),
    );
    await waitFor(() =>
      expect(actAction).toHaveBeenCalledWith(MEDICO, INVITATION.id, "accept"),
    );
    expect(screen.getByRole("button", { name: "Recusar" })).toBeInTheDocument();
  });

  it("NOB-157: autovínculo aceito só pode ser aprovado por outro owner", () => {
    const self = {
      ...INVITATION,
      userId: "u-owner",
      invitedBy: "u-owner",
      selfInvitation: true,
      status: "pending_approval" as const,
    };
    const { unmount } = render(
      <ProfessionalAccess
        {...base}
        canManage
        members={MEMBERS}
        links={[]}
        invitations={[self]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Aprovar o autovínculo" }),
    ).not.toBeInTheDocument();
    unmount();
    render(
      <ProfessionalAccess
        {...base}
        currentUserId="u-owner-2"
        canManage
        members={MEMBERS}
        links={[]}
        invitations={[self]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Aprovar o autovínculo" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/aguardando a aprovação de outro responsável/).length,
    ).toBeGreaterThan(0);
  });

  it("vínculo legado aparece sinalizado", () => {
    render(
      <ProfessionalAccess
        {...base}
        canManage
        members={MEMBERS}
        links={[{ ...OPEN, legacy: true }]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "anterior ao convite com aceite",
    );
  });
});
