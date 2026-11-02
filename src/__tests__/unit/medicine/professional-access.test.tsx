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
  linkMedicoUserAction,
  revokeMedicoUserLinkAction,
} from "@/shared/server/actions/medicine/professional-links";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/professional-links", () => ({
  linkMedicoUserAction: jest.fn(),
  revokeMedicoUserLinkAction: jest.fn(),
}));

const linkAction = linkMedicoUserAction as jest.Mock;
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
};

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
  it("owner sem vínculo vincula com conta e motivo", async () => {
    linkAction.mockResolvedValue({ ok: true, data: {} });
    render(
      <ProfessionalAccess medicoId={MEDICO} canManage members={MEMBERS} links={[]} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma conta vinculada");
    fireEvent.change(screen.getByRole("combobox", { name: /Conta/ }), {
      target: { value: "u-doctor" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/), {
      target: { value: "Profissional da equipe." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vincular conta" }));
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
    render(
      <ProfessionalAccess medicoId={MEDICO} canManage members={MEMBERS} links={[OPEN]} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Dra. Fictícia · Colaborador");
    expect(
      screen.queryByRole("button", { name: "Vincular conta" }),
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
        medicoId={MEDICO}
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
});
