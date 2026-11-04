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
  listSignedPcmsosAction,
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
  listSignedPcmsosAction: jest.fn(),
  registerSignedPcmsoAction: jest.fn(),
  getSignedPcmsoDownloadAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const content = composePcmso({
  cycleStart: "2026-11-01",
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
  interpretationCriteria: [],
  analyticalReport: null,
  pendingSections: [],
});
const DOC = {
  id: "d1",
  version: 1,
  cycleStart: "2026-11-01",
  cycleEnd: "2027-10-31",
  generatedAt: "2026-11-02T10:00:00.000Z",
  contentSha256: "a".repeat(64),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
  (listSignedPcmsosAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { items: [], currentId: null, warnings: [] },
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
    expect(screen.getByText(/A prévia não é o PCMSO oficial/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum PCMSO assinado registrado/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar PCMSO assinado" }),
    ).toBeInTheDocument();
  });
  it("PCMSO assinado: vigente e substituído, conferência documental, tipo de mudança e alertas", async () => {
    (listPcmsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [DOC] });
    (getPcmsoDocumentAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...DOC, content },
    });
    (getPcmsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [] },
    });
    const base = {
      orgId: "org",
      companyId: COMPANY,
      previewDocumentId: "d1",
      previewSha256: "a".repeat(64),
      examPlanId: "p1",
      signatureMethod: "icp_brasil",
      signerName: "Dra. Fictícia",
      signerRegistration: "123",
      signerUf: "MA",
      signedOn: "2026-11-03",
      verificationKind: "documentary",
      fileSha256: "e".repeat(64),
      sizeBytes: 10,
      registeredBy: "doctor",
      registeredAt: "2026-11-03T12:00:00.000Z",
      previewVersion: 1,
      cycleStart: "2026-11-01",
      cycleEnd: "2027-10-31",
    };
    (listSignedPcmsosAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        currentId: "s2",
        warnings: ["newer_preview"],
        items: [
          {
            ...base,
            id: "s1",
            origin: "office_received",
            verificationReference: "Original na pasta 3",
            replacesId: null,
            changeKind: null,
            replaceReason: null,
            replacedById: "s2",
          },
          {
            ...base,
            id: "s2",
            origin: "coordinator",
            verificationReference: "Verificador ITI 77",
            replacesId: "s1",
            changeKind: "administrative",
            replaceReason: "Troca do médico responsável.",
            replacedById: null,
          },
        ],
      },
    });
    await renderPage();
    expect(screen.getByText(/^Vigente/)).toBeInTheDocument();
    expect(screen.getByText(/^Substituído/)).toBeInTheDocument();
    expect(screen.getAllByText(/conferida documentalmente/)).toHaveLength(2);
    expect(screen.queryByText(/assinatura digital validada/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Alteração administrativa.*Troca do médico responsável/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Há prévia mais recente que a assinada/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar nova versão assinada" }),
    ).toBeInTheDocument();
  });
});
