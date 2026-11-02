/**
 * Tela do PCMSO (NOB-151): com pendências na conferência não oferece geração; sem pendências
 * oferece a prévia; a última versão aparece com o aviso de prévia e o hash. Fictício.
 */
import { render, screen } from "@testing-library/react";

import PcmsoPage from "@/app/(protected)/companies/[id]/pcmso/page";
import { composePcmso } from "@/shared/domains/medicine/pcmso-composition";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getPcmsoReadinessAction } from "@/shared/server/actions/medicine/pcmso-readiness";
import {
  getPcmsoDocumentAction,
  listPcmsoDocumentsAction,
} from "@/shared/server/actions/medicine/pcmso-documents";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn().mockResolvedValue({ role: "collaborator" }),
}));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  getCompanyAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/pcmso-readiness", () => ({
  getPcmsoReadinessAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/pcmso-documents", () => ({
  listPcmsoDocumentsAction: jest.fn(),
  getPcmsoDocumentAction: jest.fn(),
  generatePcmsoDocumentAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const content = composePcmso({
  validityStart: "2026-11-01",
  company: {
    razaoSocial: "Empresa Fictícia",
    cnpj: "11222333000181",
    cnae: "4120-4",
    mainActivity: "Construção",
    riskGrade: 3,
    activeEmployees: 5,
  },
  coordinator: {
    name: "Dra. Fictícia",
    crm: "123",
    registrationUf: "MA",
    rqe: "456",
    rqeExceptionReason: null,
    startsOn: "2026-01-01",
  },
  riskSources: [
    { id: "s1", kind: "internal", title: "PGR da plataforma", version: "Revisão 1" },
  ],
  risks: [
    {
      exposureGroup: "Produção",
      jobRole: "",
      description: "Ruído",
      agentType: "physical",
      possibleInjuries: "PAIR",
    },
  ],
  plan: {
    id: "p1",
    version: 1,
    approvedAt: "2026-10-30T12:00:00.000Z",
    approvedByName: "Dra. Fictícia",
    items: [
      {
        exposureGroup: "Produção",
        jobRole: "",
        procedureCode: "0281",
        otherDescription: null,
        decision: "kept",
        periodicity: "Anual",
        origin: "suggested",
      },
    ],
  },
  examiners: [{ name: "Dr. Examinador", registration: "CRM 9/MA" }],
  pendingSections: [],
});
const DOC = {
  id: "d1",
  version: 1,
  validityStart: "2026-11-01",
  validityEnd: "2027-10-31",
  generatedAt: "2026-11-02T10:00:00.000Z",
  contentSha256: "a".repeat(64),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
});

async function renderPage() {
  render(await PcmsoPage({ params: Promise.resolve({ id: COMPANY }) }));
}

describe("PcmsoPage", () => {
  it("com pendências na conferência, não oferece a geração", async () => {
    (listPcmsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    (getPcmsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [{ code: "exam_plan", severity: "blocking" }] },
    });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "A prévia não pode ser gerada: 1 pendência",
    );
    expect(
      screen.queryByRole("button", { name: "Gerar prévia do PCMSO" }),
    ).not.toBeInTheDocument();
  });

  it("sem pendências, oferece gerar; mostra a última versão com aviso de prévia e hash", async () => {
    (listPcmsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [DOC] });
    (getPcmsoDocumentAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...DOC, content },
    });
    (getPcmsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [] },
    });
    await renderPage();
    expect(
      screen.getByRole("button", { name: "Gerar prévia do PCMSO" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/PRÉVIA/);
    expect(
      screen.getByText(/Exame 0281 Audiometria tonal ocupacional — Anual/),
    ).toBeInTheDocument();
    expect(screen.getByText(`SHA-256 ${"a".repeat(64)}`)).toBeInTheDocument();
    expect(screen.getByText(/Emissão oficial e assinatura/)).toBeInTheDocument();
  });
});
