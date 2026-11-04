/**
 * Novo PGR: o seletor de empresas só lista empresas com o serviço PGR habilitado (NOB-97). A tela
 * explica quando as empresas cadastradas não aparecem (sem o serviço, sem empresas ou erro de
 * carga), em vez de mostrar só "— selecione —". Dados fictícios.
 */
import { render, screen, within } from "@testing-library/react";

import NewPgrPage from "@/app/(protected)/pgr/new/page";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { pgrCompanyAvailability } from "@/shared/domains/pgr/company-availability";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  listCompanyOptionsAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/work-units", () => ({
  listWorkUnitsAction: jest.fn().mockResolvedValue({ ok: true, data: { rows: [] } }),
}));
jest.mock("@/shared/server/actions/pgr/pgr", () => ({
  createPgrAction: jest.fn(),
  updatePgrAction: jest.fn(),
}));
jest.mock("@/app/(protected)/_components/onboarding-tip", () => ({
  OnboardingTip: () => null,
}));

const option = (id: string, razaoSocial: string) => ({
  id,
  razaoSocial,
  zipCode: null,
  street: null,
  number: null,
  complement: null,
  district: null,
  city: null,
  state: null,
});
const A = option("a1111111-1111-4111-8111-111111111111", "Alfa Fictícia Ltda");
const B = option("b2222222-2222-4222-8222-222222222222", "Beta Fictícia Ltda");

function mockOptions(pgr: unknown, all: unknown) {
  (listCompanyOptionsAction as jest.Mock).mockImplementation((module?: string) =>
    Promise.resolve(module === "pgr" ? pgr : all),
  );
}
async function renderPage(role: "owner" | "collaborator" = "owner") {
  (requireOfficeStaffPage as jest.Mock).mockResolvedValue({ role, tenantId: "org_a" });
  render(await NewPgrPage({ searchParams: Promise.resolve({}) }));
}
const companyOptions = () =>
  within(screen.getByRole("combobox", { name: /^Empresa/ }))
    .getAllByRole("option")
    .map((o) => o.textContent)
    .filter((t) => t && !t.includes("selecione"));

describe("Novo PGR — empresas disponíveis", () => {
  it("duas empresas cadastradas sem o serviço PGR (caso relatado): explica e indica como habilitar (owner)", async () => {
    mockOptions({ ok: true, data: [] }, { ok: true, data: [A, B] });
    await renderPage("owner");
    expect(screen.getByText(/2 empresas cadastradas não aparecem/)).toBeInTheDocument();
    expect(screen.getByText(/serviço PGR não está habilitado/)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Habilitar PGR/ })
        .map((l) => l.getAttribute("href")),
    ).toEqual([`/companies/${A.id}/services`, `/companies/${B.id}/services`]);
    expect(companyOptions()).toEqual([]);
  });

  it("colaborador: orienta pedir ao administrador, sem link de alteração", async () => {
    mockOptions({ ok: true, data: [] }, { ok: true, data: [A, B] });
    await renderPage("collaborator");
    expect(screen.getByText(/Peça ao administrador do escritório/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Habilitar PGR/ })).not.toBeInTheDocument();
  });

  it("uma empresa habilitada e outra não: lista a habilitada e avisa da outra", async () => {
    mockOptions({ ok: true, data: [A] }, { ok: true, data: [A, B] });
    await renderPage();
    expect(companyOptions()).toEqual([A.razaoSocial]);
    expect(screen.getByText(/1 empresa cadastrada não aparece/)).toBeInTheDocument();
    expect(screen.getByText(B.razaoSocial)).toBeInTheDocument();
  });

  it("todas habilitadas: sem aviso", async () => {
    mockOptions({ ok: true, data: [A, B] }, { ok: true, data: [A, B] });
    await renderPage();
    expect(companyOptions()).toEqual([A.razaoSocial, B.razaoSocial]);
    expect(screen.queryByText(/não aparece/)).not.toBeInTheDocument();
  });

  it("nenhuma empresa cadastrada (lista vazia legítima): indica o cadastro", async () => {
    mockOptions({ ok: true, data: [] }, { ok: true, data: [] });
    await renderPage();
    expect(screen.getByText(/Nenhuma empresa cadastrada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cadastrar empresa/ })).toHaveAttribute(
      "href",
      "/companies/new",
    );
  });

  it.each([
    ["403", { ok: false, error: { code: "FORBIDDEN", message: "Sem permissão." } }],
    ["500", { ok: false, error: { code: "INTERNAL", message: "Erro inesperado." } }],
  ])("erro ao carregar (%s) não vira lista vazia silenciosa", async (_label, failure) => {
    mockOptions(failure, { ok: true, data: [A, B] });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Não foi possível carregar as empresas/,
    );
    expect(screen.queryByText(/não aparecem/)).not.toBeInTheDocument();
  });
});

describe("pgrCompanyAvailability", () => {
  it("classifica erro, sem empresas, nenhuma habilitada e pronta", () => {
    expect(pgrCompanyAvailability(null, [])).toEqual({ state: "error" });
    expect(pgrCompanyAvailability([A], null)).toEqual({ state: "error" });
    expect(pgrCompanyAvailability([], [])).toEqual({ state: "no_companies" });
    expect(pgrCompanyAvailability([A, B], [])).toEqual({
      state: "none_enabled",
      withoutPgr: [
        { id: A.id, razaoSocial: A.razaoSocial },
        { id: B.id, razaoSocial: B.razaoSocial },
      ],
    });
    expect(pgrCompanyAvailability([A, B], [A, B])).toEqual({
      state: "ready",
      withoutPgr: [],
    });
  });
});
