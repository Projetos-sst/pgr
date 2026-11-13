import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MemberAccessPage from "@/app/(protected)/team/[userId]/access/page";
import TeamPage from "@/app/(protected)/team/page";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { AccessScopeView } from "@/shared/domains/platform/access-scopes";
import type { TeamMemberView } from "@/shared/domains/platform/team";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import {
  grantAccessScopeAction,
  listAccessScopesAction,
  revokeAccessScopeAction,
} from "@/shared/server/actions/platform/access-scopes";
import { listTeamMembers } from "@/shared/server/actions/platform/team";

class MockForbiddenSignal extends Error {}
const refresh = jest.fn();
const mockListWorkUnits = jest.fn();
jest.mock("next/navigation", () => ({
  forbidden: () => {
    throw new MockForbiddenSignal();
  },
  useRouter: () => ({ push: jest.fn(), refresh }),
  usePathname: () => "/team",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/shared/auth/page-guards", () => ({ requireOfficeStaffPage: jest.fn() }));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  listCompanyOptionsAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/work-units", () => ({
  listWorkUnitsAction: (params: unknown) => mockListWorkUnits(params),
}));
jest.mock("@/shared/server/actions/platform/access-scopes", () => ({
  grantAccessScopeAction: jest.fn(),
  listAccessScopesAction: jest.fn(),
  revokeAccessScopeAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/platform/team", () => ({
  listTeamMembers: jest.fn(),
  changeMemberRole: jest.fn(),
  inviteMember: jest.fn(),
  removeMember: jest.fn(),
}));

const MEMBER = "user_colaborador";
const COMPANY = "c1111111-1111-4111-8111-111111111111";
const WORK_UNIT = "d1111111-1111-4111-8111-111111111111";
const SCOPE = "e1111111-1111-4111-8111-111111111111";
const ACCESS_FOLDER = path.join(
  process.cwd(),
  "src/app/(protected)/team/[userId]/access",
);

const member = (overrides: Partial<TeamMemberView>): TeamMemberView => ({
  userId: MEMBER,
  role: "collaborator",
  roleLabel: "Colaborador",
  name: "Colaboradora Fictícia",
  email: "colaboradora@ficticio.test",
  imageUrl: null,
  jobTitle: null,
  ...overrides,
});

const scope = (overrides: Partial<AccessScopeView>): AccessScopeView => ({
  id: SCOPE,
  userId: MEMBER,
  companyId: COMPANY,
  companyName: "Casa Fictícia Ltda",
  workUnitId: null,
  workUnitName: null,
  area: "health",
  grantedBy: "user_owner",
  grantedAt: new Date("2026-11-01T12:00:00Z"),
  ...overrides,
});

function mockData(scopes: AccessScopeView[]) {
  jest.mocked(listTeamMembers).mockResolvedValue({
    ok: true,
    data: {
      rows: [member({ userId: "user_owner", role: "owner", name: "Dona" }), member({})],
      total: 2,
    },
  });
  jest.mocked(listAccessScopesAction).mockResolvedValue({ ok: true, data: scopes });
  jest.mocked(listCompanyOptionsAction).mockResolvedValue({
    ok: true,
    data: [
      {
        id: COMPANY,
        razaoSocial: "Casa Fictícia Ltda",
        zipCode: null,
        street: null,
        number: null,
        complement: null,
        district: null,
        city: null,
        state: null,
      },
    ],
  });
  mockListWorkUnits.mockResolvedValue({
    ok: true,
    data: { rows: [{ id: WORK_UNIT, name: "Obra Fictícia" }], total: 1 },
  });
}

async function renderAccess(role: "owner" | "collaborator" = "owner") {
  jest.mocked(requireOfficeStaffPage).mockResolvedValue({
    userId: "user_owner",
    tenantId: "org_a",
    plan: "pro",
    role,
  });
  render(await MemberAccessPage({ params: Promise.resolve({ userId: MEMBER }) }));
}

function sourcesIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return sourcesIn(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("tela de acessos do membro (NOB-175)", () => {
  it("sem escopo, avisa que o membro continua com acesso a todas as empresas", async () => {
    mockData([]);
    await renderAccess();

    expect(
      screen.getByRole("heading", { name: "Acessos de Colaboradora Fictícia" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(
      /acessa todas as empresas, obras e áreas/,
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("lista cada escopo com empresa, obra e área", async () => {
    mockData([
      scope({}),
      scope({
        id: "e2222222-2222-4222-8222-222222222222",
        workUnitId: WORK_UNIT,
        workUnitName: "Obra Fictícia",
        area: "safety",
      }),
    ]);
    await renderAccess();

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Casa Fictícia Ltda.*Todas as obras.*Medicina do Trabalho/),
      expect.stringMatching(/Casa Fictícia Ltda.*Obra Fictícia.*Segurança do Trabalho/),
    ]);
    expect(screen.getByRole("status").textContent).toMatch(
      /só acessa o que está listado/,
    );
  });

  it("não abre para quem não é o administrador", async () => {
    mockData([]);
    await expect(renderAccess("collaborator")).rejects.toBeInstanceOf(
      MockForbiddenSignal,
    );
    expect(listAccessScopesAction).not.toHaveBeenCalled();
  });

  it("concede o escopo escolhido de empresa, obra e área e recarrega a lista", async () => {
    mockData([]);
    jest.mocked(grantAccessScopeAction).mockResolvedValue({ ok: true, data: scope({}) });
    const user = userEvent.setup();
    await renderAccess();

    await user.selectOptions(screen.getByLabelText(/Empresa/), COMPANY);
    await waitFor(() =>
      expect(mockListWorkUnits).toHaveBeenCalledWith({
        companyId: COMPANY,
        pageSize: 100,
      }),
    );
    await screen.findByRole("option", { name: "Obra Fictícia" });
    await user.selectOptions(screen.getByLabelText(/Obra/), WORK_UNIT);
    await user.selectOptions(screen.getByLabelText(/Área/), "health");
    await user.click(screen.getByRole("button", { name: "Conceder acesso" }));

    await waitFor(() =>
      expect(grantAccessScopeAction).toHaveBeenCalledWith(MEMBER, {
        companyId: COMPANY,
        workUnitId: WORK_UNIT,
        area: "health",
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("mostra a recusa do servidor e não recarrega a lista", async () => {
    mockData([]);
    jest.mocked(grantAccessScopeAction).mockResolvedValue({
      ok: false,
      error: {
        code: "DUPLICATE",
        message: "Registro já existe.",
        fields: { area: "Área inválida." },
      },
    });
    const user = userEvent.setup();
    await renderAccess();

    await user.selectOptions(screen.getByLabelText(/Empresa/), COMPANY);
    await user.selectOptions(screen.getByLabelText(/Área/), "safety");
    await user.click(screen.getByRole("button", { name: "Conceder acesso" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Registro já existe.");
    expect(screen.getByText("Área inválida.")).toBeTruthy();
    expect(grantAccessScopeAction).toHaveBeenCalledWith(MEMBER, {
      companyId: COMPANY,
      workUnitId: "",
      area: "safety",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("revoga o escopo depois da confirmação", async () => {
    mockData([scope({})]);
    jest.mocked(revokeAccessScopeAction).mockResolvedValue({
      ok: true,
      data: { id: SCOPE },
    });
    const user = userEvent.setup();
    await renderAccess();

    await user.click(screen.getByRole("button", { name: "Excluir escopo de acesso" }));
    expect(revokeAccessScopeAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    await waitFor(() =>
      expect(revokeAccessScopeAction).toHaveBeenCalledWith(MEMBER, SCOPE),
    );
  });

  it("não usa campo nem botão nativo fora do design system", () => {
    const sources = sourcesIn(ACCESS_FOLDER);

    expect(sources.length).toBeGreaterThan(0);
    expect(
      sources.filter((file) =>
        /<(select|input|textarea|button)\b/.test(readFileSync(file, "utf8")),
      ),
    ).toEqual([]);
  });
});

describe("lista da equipe (NOB-175)", () => {
  async function renderTeam(role: "owner" | "collaborator") {
    jest.mocked(requireOfficeStaffPage).mockResolvedValue({
      userId: "user_owner",
      tenantId: "org_a",
      plan: "pro",
      role,
    });
    render(await TeamPage({ searchParams: Promise.resolve({}) }));
  }

  it("o administrador chega aos acessos de cada membro que pode ser restringido", async () => {
    mockData([]);
    await renderTeam("owner");

    const links = screen.getAllByRole("link", { name: /^Acessos de / });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `/team/${MEMBER}/access`,
    ]);
  });

  it("o colaborador não vê o atalho de acessos", async () => {
    mockData([]);
    await renderTeam("collaborator");

    expect(screen.queryByRole("link", { name: /^Acessos de / })).toBeNull();
  });
});
