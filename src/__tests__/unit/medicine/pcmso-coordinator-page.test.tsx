/**
 * Página do coordenador do PCMSO (NOB-121, MED-02): só o owner vê os formulários
 * (a permissão real fica no servidor e no RLS, coberta na integração), estado
 * vazio, designação vigente com a exceção do NR-7 7.5.2, histórico e empresa sem
 * Medicina. Dados fictícios.
 */
import { render, screen } from "@testing-library/react";

import PcmsoCoordinatorPage from "@/app/(protected)/companies/[id]/pcmso-coordinator/page";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { listMedicosAction } from "@/shared/server/actions/pgr/medicos";
import { listPcmsoCoordinatorsAction } from "@/shared/server/actions/medicine/pcmso-coordinators";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/auth/page-guards", () => ({ requireOfficeStaffPage: jest.fn() }));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  getCompanyAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/medicos", () => ({
  listMedicosAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/pcmso-coordinators", () => ({
  listPcmsoCoordinatorsAction: jest.fn(),
  designatePcmsoCoordinatorAction: jest.fn(),
  closePcmsoCoordinatorAction: jest.fn(),
}));

const COMPANY_ID = "c1111111-1111-4111-8111-111111111111";
const guard = requireOfficeStaffPage as jest.Mock;
const getCompany = getCompanyAction as jest.Mock;
const listMedicos = listMedicosAction as jest.Mock;
const listCoordinators = listPcmsoCoordinatorsAction as jest.Mock;

const OPEN = {
  id: "d1111111-1111-4111-8111-111111111111",
  medicoName: "Dr. Ficcional",
  medicoCrm: "456",
  medicoRegistrationUf: "MA",
  medicoRqe: null,
  medicoAffiliation: "external",
  startsOn: "2026-06-01",
  endsOn: null,
  endReason: null,
  rqeExceptionReason: "Sem médico do trabalho na localidade.",
};
const CLOSED = {
  ...OPEN,
  id: "d2222222-2222-4222-8222-222222222222",
  medicoName: "Dra. Anterior",
  medicoCrm: "123",
  medicoRegistrationUf: "SP",
  medicoRqe: "6789",
  medicoAffiliation: "internal",
  startsOn: "2026-01-01",
  endsOn: "2026-05-31",
  endReason: "Substituído por nova designação.",
  rqeExceptionReason: null,
};

async function renderPage() {
  render(await PcmsoCoordinatorPage({ params: Promise.resolve({ id: COMPANY_ID }) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  getCompany.mockResolvedValue({ ok: true, data: { razaoSocial: "Empresa Fictícia" } });
  listMedicos.mockResolvedValue({
    ok: true,
    data: {
      rows: [
        {
          id: "b1",
          name: "Dra. Fictícia",
          crm: "123",
          registrationUf: "SP",
          rqe: "6789",
          profession: "physician",
        },
        {
          id: "b2",
          name: "Psicóloga Fictícia",
          crm: "06/1",
          registrationUf: "MA",
          rqe: null,
          profession: "psychologist",
        },
      ],
      total: 2,
    },
  });
});

describe("PcmsoCoordinatorPage", () => {
  it("owner sem designação vê o estado vazio e o formulário só com médicos", async () => {
    guard.mockResolvedValue({ role: "owner" });
    listCoordinators.mockResolvedValue({ ok: true, data: [] });
    await renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Nenhum coordenador designado");
    expect(
      screen.getByRole("heading", { name: "Designar coordenador" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Dra\. Fictícia/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Psicóloga Fictícia/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sem designações registradas.")).toBeInTheDocument();
  });

  it("colaborador vê a designação e o histórico, sem formulários nem lista de médicos", async () => {
    guard.mockResolvedValue({ role: "collaborator" });
    listCoordinators.mockResolvedValue({ ok: true, data: [OPEN, CLOSED] });
    await renderPage();

    expect(screen.getByText(/Somente o responsável pelo escritório/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar designação" }),
    ).not.toBeInTheDocument();
    expect(listMedicos).not.toHaveBeenCalled();
    expect(screen.getByRole("note")).toHaveTextContent(/exceção do item 7\.5\.2/);
    expect(screen.getByText("vigente")).toBeInTheDocument();
    expect(screen.getByText("Substituído por nova designação.")).toBeInTheDocument();
  });

  it("owner com designação vigente vê troca e encerramento", async () => {
    guard.mockResolvedValue({ role: "owner" });
    listCoordinators.mockResolvedValue({ ok: true, data: [OPEN] });
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Trocar coordenador" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Encerrar sem substituto/)).toBeInTheDocument();
  });

  it("empresa sem Medicina mostra o erro do servidor e não lista médicos", async () => {
    guard.mockResolvedValue({ role: "owner" });
    listCoordinators.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Medicina não habilitada para esta empresa." },
    });
    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Medicina não habilitada");
    expect(listMedicos).not.toHaveBeenCalled();
  });

  it("empresa inexistente ou de outro tenant cai no notFound", async () => {
    guard.mockResolvedValue({ role: "owner" });
    getCompany.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Não encontrado." },
    });
    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(listCoordinators).not.toHaveBeenCalled();
  });
});
