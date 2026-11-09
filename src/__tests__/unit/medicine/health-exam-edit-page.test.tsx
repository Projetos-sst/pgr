/**
 * Edição do exame com médico responsável inativo: as opções do select trazem só médicos ativos,
 * então o médico gravado no exame entra como opção própria, marcada "(inativo)" e selecionada —
 * sem ela o select mostrava "— sem médico —" e salvar apagava o examinador. Dados fictícios.
 */
import { render, screen } from "@testing-library/react";

import EditHealthExamPage from "@/app/(protected)/health-exams/[id]/edit/page";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import {
  getMedicoAction,
  listMedicoOptionsAction,
} from "@/shared/server/actions/pgr/medicos";
import {
  getClinicalAccessAction,
  listWorkRestrictionsAction,
} from "@/shared/server/actions/medicine/clinical-record";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn().mockResolvedValue({ role: "collaborator" }),
}));
jest.mock("@/shared/server/actions/pgr/health-exams", () => ({
  getHealthExamAction: jest.fn(),
  createHealthExamAction: jest.fn(),
  updateHealthExamAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/employees", () => ({
  listEmployeesAction: jest.fn(),
  getEmployeeAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/medicos", () => ({
  listMedicoOptionsAction: jest.fn(),
  getMedicoAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/clinical-record", () => ({
  getClinicalAccessAction: jest.fn(),
  listWorkRestrictionsAction: jest.fn(),
  listClinicalAccessEventsAction: jest.fn(),
}));

const EXAM = "e1111111-1111-4111-8111-111111111111";
const EMPLOYEE = "a1111111-1111-4111-8111-111111111111";
const ACTIVE = "m1111111-1111-4111-8111-111111111111";
const INACTIVE = "m2222222-2222-4222-8222-222222222222";

function mockExam(doctorId: string | null) {
  (getHealthExamAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: {
      id: EXAM,
      employeeId: EMPLOYEE,
      doctorId,
      examType: "periodic",
      performedAt: "2026-10-20",
      validUntil: null,
      aptitude: "fit",
      certificatePath: null,
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (listEmployeesAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: {
      rows: [
        { id: EMPLOYEE, fullName: "Pessoa Fictícia", companyName: "Empresa Fictícia" },
      ],
      total: 1,
    },
  });
  (listMedicoOptionsAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: [{ id: ACTIVE, name: "Dra. Ativa Fictícia", crm: "10001" }],
  });
  (getClinicalAccessAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { allowed: false },
  });
  (listWorkRestrictionsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
});

async function renderPage() {
  render(await EditHealthExamPage({ params: Promise.resolve({ id: EXAM }) }));
}

function doctorSelect(): HTMLSelectElement {
  const select = screen.getByRole("combobox", { name: /Médico responsável/ });
  return select as HTMLSelectElement;
}

describe("EditHealthExamPage — médico responsável inativo", () => {
  it("o médico inativo gravado no exame aparece selecionado, marcado como inativo", async () => {
    mockExam(INACTIVE);
    (getMedicoAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        id: INACTIVE,
        name: "Dr. Inativo Fictício",
        crm: "20002",
        status: "inactive",
      },
    });
    await renderPage();

    expect(getMedicoAction).toHaveBeenCalledWith(INACTIVE);
    expect(doctorSelect().value).toBe(INACTIVE);
    expect(
      screen.getByRole("option", { name: "Dr. Inativo Fictício · 20002 (inativo)" }),
    ).toBeInTheDocument();
    // Os ativos continuam disponíveis para a troca.
    expect(
      screen.getByRole("option", { name: "Dra. Ativa Fictícia · 10001" }),
    ).toBeInTheDocument();
  });

  it("médico ativo: nenhuma busca extra e o select vem com ele", async () => {
    mockExam(ACTIVE);
    await renderPage();

    expect(getMedicoAction).not.toHaveBeenCalled();
    expect(doctorSelect().value).toBe(ACTIVE);
    expect(screen.queryByRole("option", { name: /inativo/ })).not.toBeInTheDocument();
  });
});
