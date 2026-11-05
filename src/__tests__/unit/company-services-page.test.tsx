/**
 * NOB-171: Gerenciar serviços com estados claros (texto + ícone), ação conforme o estado, diálogo
 * de confirmação com motivo, sem otimismo, histórico recolhível e falha de leitura que não vira
 * "Desabilitado". NOB-170: a listagem mostra os serviços pela mesma fonte de verdade. Fictício.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CompanyServicesPage from "@/app/(protected)/companies/[id]/services/page";
import CompaniesPage from "@/app/(protected)/companies/page";
import { CompanyServicesSummary } from "@/app/(protected)/companies/_components/service-status";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getCompanyAction,
  listCompaniesAction,
} from "@/shared/server/actions/pgr/companies";
import {
  changeCompanyModuleAction,
  getCompanyModuleOverviewAction,
} from "@/shared/server/actions/platform/company-modules";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh }),
  usePathname: () => "/companies",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  getCompanyAction: jest.fn(),
  listCompaniesAction: jest.fn(),
  deleteCompanyAction: jest.fn(),
  getCompanyDependentsAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/company-modules", () => ({
  getCompanyModuleOverviewAction: jest.fn(),
  changeCompanyModuleAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const event = (o: Record<string, unknown>) => ({
  id: `ev-${Math.random()}`,
  orgId: "org_a",
  companyId: COMPANY,
  module: "pgr",
  previousEnabled: true,
  enabled: true,
  changedBy: "migration:0053",
  reason: "Preservacao dos acessos existentes",
  changedAt: "2026-10-20T17:47:16.000Z",
  ...o,
});
function mockServices(
  pgr: boolean,
  medicine: boolean,
  history = [event({}), event({ module: "medicine" })],
) {
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { id: COMPANY, razaoSocial: "Casa Fictícia Ltda" },
  });
  (getCompanyModuleOverviewAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: {
      modules: [
        { module: "pgr", enabled: pgr },
        { module: "medicine", enabled: medicine },
      ],
      history: { rows: history, total: history.length },
    },
  });
}
async function renderServices(role: "owner" | "collaborator" = "owner") {
  (requireOfficeStaffPage as jest.Mock).mockResolvedValue({ role, tenantId: "org_a" });
  render(
    await CompanyServicesPage({
      params: Promise.resolve({ id: COMPANY }),
      searchParams: Promise.resolve({}),
    }),
  );
}
const card = (name: RegExp) => screen.getByRole("region", { name }) as HTMLElement;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Gerenciar serviços — estados", () => {
  it("ambos habilitados: status Habilitado com ícone, textos e ação de desabilitar (owner)", async () => {
    mockServices(true, true);
    await renderServices();
    const pgr = card(/PGR \/ Segurança do Trabalho/);
    expect(within(pgr).getByText("Habilitado")).toBeInTheDocument();
    expect(within(pgr).getByText("Habilitado").querySelector("svg")).not.toBeNull();
    expect(
      within(pgr).getByText("O serviço PGR está disponível para esta empresa."),
    ).toBeInTheDocument();
    expect(
      within(pgr).getByRole("button", { name: "Desabilitar serviço" }),
    ).toBeInTheDocument();
    const med = card(/Medicina do Trabalho/);
    expect(within(med).getByText(/conforme as permissões de acesso/)).toBeInTheDocument();
    // Motivo não fica aberto o tempo todo.
    expect(screen.queryByLabelText(/Motivo da alteração/)).not.toBeInTheDocument();
  });

  it("nenhum habilitado: Desabilitado (vermelho, com ícone), impacto no Novo PGR e ação de habilitar", async () => {
    mockServices(false, false, []);
    await renderServices();
    const pgr = card(/PGR \/ Segurança do Trabalho/);
    const status = within(pgr).getByText("Desabilitado");
    expect(status.className).toMatch(/red/);
    expect(status.querySelector("svg")).not.toBeNull();
    expect(
      within(pgr).getByText(/Esta empresa não aparecerá na seleção de Novo PGR/),
    ).toBeInTheDocument();
    expect(
      within(pgr).getByRole("button", { name: "Habilitar serviço" }),
    ).toBeInTheDocument();
    expect(
      within(card(/Medicina do Trabalho/)).getByText(
        "O serviço Medicina do Trabalho não está disponível para esta empresa.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma alteração registrada/)).toBeInTheDocument();
  });

  it("só PGR: cada cartão mostra o próprio estado", async () => {
    mockServices(true, false);
    await renderServices();
    expect(within(card(/PGR \/ Segurança/)).getByText("Habilitado")).toBeInTheDocument();
    expect(
      within(card(/Medicina do Trabalho/)).getByText("Desabilitado"),
    ).toBeInTheDocument();
  });

  it("colaborador: vê o estado e a orientação, sem botões de alteração", async () => {
    mockServices(true, false);
    await renderServices("collaborator");
    expect(screen.queryByRole("button", { name: /serviço/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Solicite a alteração ao administrador/)).toHaveLength(2);
  });

  it("falha de leitura: alerta com tentar novamente, nunca 'Desabilitado'", async () => {
    (getCompanyAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: COMPANY, razaoSocial: "Casa Fictícia Ltda" },
    });
    (getCompanyModuleOverviewAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "falha" },
    });
    await renderServices();
    expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível carregar/);
    expect(screen.getByRole("link", { name: "Tentar novamente" })).toHaveAttribute(
      "href",
      `/companies/${COMPANY}/services`,
    );
    expect(screen.queryByText("Desabilitado")).not.toBeInTheDocument();
  });

  it("empresa inexistente ou de outro escritório: 404", async () => {
    (getCompanyAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "x" },
    });
    (getCompanyModuleOverviewAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "x" },
    });
    (requireOfficeStaffPage as jest.Mock).mockResolvedValue({ role: "owner" });
    await expect(
      CompanyServicesPage({
        params: Promise.resolve({ id: COMPANY }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("histórico recolhível com contagem; migration aparece como Sistema, pessoa como está", async () => {
    mockServices(true, true, [
      event({
        changedBy: "user_abc",
        enabled: false,
        previousEnabled: true,
        reason: "Encerrou",
      }),
      event({}),
    ]);
    await renderServices();
    const details = screen.getByText("Histórico de alterações (2)").closest("details")!;
    expect(details.open).toBe(false);
    expect(
      within(details).getByText(/Responsável: Sistema \(migration 0053\)/),
    ).toBeInTheDocument();
    expect(within(details).getByText(/Responsável: user_abc/)).toBeInTheDocument();
    expect(within(details).getByText("Motivo: Encerrou")).toBeInTheDocument();
  });
});

describe("Gerenciar serviços — confirmação", () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    mockServices(true, true);
    await renderServices();
    await user.click(
      within(card(/PGR \/ Segurança/)).getByRole("button", {
        name: "Desabilitar serviço",
      }),
    );
    return screen.getByRole("dialog", { name: /Desabilitar PGR/ });
  }

  it("diálogo mostra empresa, estado atual e novo, consequência e foca o motivo", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    expect(within(dialog).getByText("Casa Fictícia Ltda")).toBeInTheDocument();
    expect(within(dialog).getByText("Habilitado")).toBeInTheDocument();
    expect(within(dialog).getByText("Desabilitado")).toBeInTheDocument();
    expect(within(dialog).getByText(/Nenhum registro é apagado/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Motivo da alteração/)).toHaveFocus();
    expect(changeCompanyModuleAction).not.toHaveBeenCalled();
  });

  it("motivo obrigatório; cancelar e Esc não alteram nada e devolvem o foco", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Informe o motivo/);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = within(card(/PGR \/ Segurança/)).getByRole("button", {
      name: "Desabilitar serviço",
    });
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(changeCompanyModuleAction).not.toHaveBeenCalled();
  });

  it("confirmação persiste uma única vez (duplo clique), atualiza pelo servidor e avisa sucesso", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    (changeCompanyModuleAction as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Motivo da alteração/), "Encerramento");
    const confirm = within(dialog).getByRole("button", { name: "Confirmar" });
    await user.click(confirm);
    await user.click(confirm);
    expect(changeCompanyModuleAction).toHaveBeenCalledTimes(1);
    expect(changeCompanyModuleAction).toHaveBeenCalledWith(COMPANY, {
      module: "pgr",
      enabled: false,
      reason: "Encerramento",
    });
    expect(within(dialog).getByRole("button", { name: "Salvando…" })).toBeDisabled();
    await act(async () => resolve({ ok: true, data: [] }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(card(/PGR \/ Segurança/)).getByRole("status")).toHaveTextContent(
      /serviço desabilitado/,
    );
  });

  it("falha na gravação: mostra o erro, não fecha nem anuncia sucesso", async () => {
    const user = userEvent.setup();
    (changeCompanyModuleAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Somente o administrador pode alterar os serviços da empresa.",
      },
    });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Motivo da alteração/), "Tentativa");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /Somente o administrador/,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(
      within(card(/PGR \/ Segurança/)).getAllByText("Habilitado")[0],
    ).toBeInTheDocument();
    // Estado do cartão continua o do servidor (sem otimismo).
    expect(changeCompanyModuleAction).toHaveBeenCalledTimes(1);
  });
});

describe("Listagem de empresas — serviços", () => {
  it.each([
    [true, true, ["PGR ativo", "Medicina ativa"]],
    [true, false, ["PGR ativo", "Medicina desabilitada"]],
    [false, true, ["PGR desabilitado", "Medicina ativa"]],
    [false, false, ["Nenhum serviço habilitado"]],
  ])("pgr=%s medicina=%s", (pgr, medicine, texts) => {
    render(<CompanyServicesSummary pgrEnabled={pgr} medicineEnabled={medicine} />);
    for (const text of texts) expect(screen.getByText(text)).toBeInTheDocument();
    if (pgr || medicine)
      expect(screen.queryByText("Nenhum serviço habilitado")).not.toBeInTheDocument();
  });

  it("falha da consulta: alerta, nunca 'Nenhuma empresa cadastrada' nem 'sem serviços'", async () => {
    (requireOfficeStaffPage as jest.Mock).mockResolvedValue({ role: "owner" });
    (listCompaniesAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "falha" },
    });
    render(await CompaniesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível carregar/);
    expect(screen.queryByText(/Nenhuma empresa cadastrada/)).not.toBeInTheDocument();
  });

  it("empresa com os dois serviços aparece com os dois e o link Gerenciar serviços", async () => {
    (requireOfficeStaffPage as jest.Mock).mockResolvedValue({ role: "owner" });
    (listCompaniesAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        rows: [
          {
            id: COMPANY,
            razaoSocial: "Casa Fictícia Ltda",
            pgrEnabled: true,
            medicineEnabled: true,
            cnpj: null,
            city: "São Luís",
            state: "MA",
            status: "active",
            employeeCount: 0,
            gesCount: 0,
          },
        ],
        total: 1,
      },
    });
    render(await CompaniesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("PGR ativo")).toBeInTheDocument();
    expect(screen.getByText("Medicina ativa")).toBeInTheDocument();
    expect(screen.queryByText(/Sem módulos/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar serviços" })).toHaveAttribute(
      "href",
      `/companies/${COMPANY}/services`,
    );
  });
});
