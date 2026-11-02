/**
 * Telas só leitura da NOB-147: catálogo da Tabela 27 e proposta de exames. Nenhum
 * botão de aprovar/aceitar (a revisão do coordenador ainda não existe), avisos e
 * exclusões visíveis, erro ≠ vazio. Dados fictícios.
 */
import { render, screen } from "@testing-library/react";

import ExamProposalPage from "@/app/(protected)/companies/[id]/exam-proposal/page";
import ProceduresPage from "@/app/(protected)/medicine/procedures/page";
import { buildExamProposal } from "@/shared/domains/medicine/exam-proposal";
import {
  searchProcedures,
  PROCEDURE_CATALOG_SOURCE,
} from "@/shared/domains/medicine/procedure-catalog";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  getExamProposalAction,
  searchProceduresAction,
} from "@/shared/server/actions/medicine/exam-proposal";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/medicine/procedures",
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn().mockResolvedValue({ role: "owner" }),
}));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  getCompanyAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/exam-proposal", () => ({
  getExamProposalAction: jest.fn(),
  searchProceduresAction: jest.fn(),
}));

const COMPANY_ID = "c1111111-1111-4111-8111-111111111111";
const getCompany = getCompanyAction as jest.Mock;
const getProposal = getExamProposalAction as jest.Mock;
const search = searchProceduresAction as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  getCompany.mockResolvedValue({ ok: true, data: { razaoSocial: "Empresa Fictícia" } });
});

async function renderProposal() {
  render(await ExamProposalPage({ params: Promise.resolve({ id: COMPANY_ID }) }));
}

describe("ProceduresPage", () => {
  it("lista código e descrição oficiais com a fonte", async () => {
    search.mockResolvedValue({
      ok: true,
      data: {
        ...searchProcedures("audiometria ocupacional"),
        source: PROCEDURE_CATALOG_SOURCE,
      },
    });
    render(
      await ProceduresPage({ searchParams: Promise.resolve({ search: "audiometria" }) }),
    );
    expect(screen.getByText("0281")).toBeInTheDocument();
    expect(screen.getByText("Audiometria tonal ocupacional")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          (el.textContent ?? "").startsWith("Fonte: eSocial") &&
          (el.textContent ?? "").includes("S-1.3 — NT 07/2026 rev. 20/10/2026"),
      ),
    ).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith("audiometria", { page: 1 });
  });

  it("busca sem resultado mostra estado vazio", async () => {
    search.mockResolvedValue({
      ok: true,
      data: { rows: [], total: 0, source: PROCEDURE_CATALOG_SOURCE },
    });
    render(await ProceduresPage({ searchParams: Promise.resolve({ search: "xyz" }) }));
    expect(
      screen.getByText("Nenhum procedimento encontrado para a busca."),
    ).toBeInTheDocument();
  });

  it("erro não vira lista vazia", async () => {
    search.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Sem permissão." },
    });
    render(await ProceduresPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Não foi possível carregar o catálogo")).toBeInTheDocument();
  });
});

describe("ExamProposalPage", () => {
  const validatedNoise = {
    id: "s1",
    kind: "internal" as const,
    title: "PGR da plataforma",
    version: "Revisão 2",
    reference: "PGR:x",
    freshness: "current" as const,
    superseded: false,
    risks: [
      {
        id: "r1",
        status: "validated" as const,
        content: {
          agentType: "physical" as const,
          description: "Ruído contínuo fictício",
          exposureGroup: "Produção",
          originalData: { inventory: { noxious_agent_code: "02.01.001" } },
        },
      },
      {
        id: "r2",
        status: "pending" as const,
        content: {
          agentType: "chemical" as const,
          description: "Solvente pendente fictício",
          exposureGroup: "Produção",
        },
      },
    ],
  };

  it("mostra sugestão com referência, fonte, avisos e exclusões, sem botão de aprovar", async () => {
    getProposal.mockResolvedValue({
      ok: true,
      data: buildExamProposal([validatedNoise]),
    });
    await renderProposal();
    expect(screen.getByText("Audiometria tonal ocupacional")).toBeInTheDocument();
    expect(screen.getByText(/NR-7, Anexo II, itens 2 e 4/)).toBeInTheDocument();
    expect(
      screen.getByText(/PGR da plataforma: PGR da plataforma · versão Revisão 2/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nada aqui foi aprovado/, { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pendentes de validação técnica \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Solvente pendente fictício/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem fonte: aviso de que não é ausência de risco e link para registrar", async () => {
    getProposal.mockResolvedValue({ ok: true, data: buildExamProposal([]) });
    await renderProposal();
    expect(screen.getByText(/não significa ausência de riscos/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Registrar fonte de riscos" }),
    ).toHaveAttribute("href", `/companies/${COMPANY_ID}/medical-risks`);
  });

  it("empresa sem Medicina mostra o erro do servidor", async () => {
    getProposal.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Medicina não habilitada para esta empresa." },
    });
    await renderProposal();
    expect(screen.getByRole("alert")).toHaveTextContent("Medicina não habilitada");
  });

  it("empresa inexistente ou de outro tenant cai no notFound", async () => {
    getCompany.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "x" },
    });
    await expect(renderProposal()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProposal).not.toHaveBeenCalled();
  });
});
