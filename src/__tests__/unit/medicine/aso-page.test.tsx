/**
 * Tela do ASO (NOB-152): com bloqueio na conferência não oferece a prévia; sem bloqueio oferece;
 * a última versão aparece com aviso de prévia, conclusão e assinatura pendente; o ASO assinado
 * (NOB-163) aparece com vigente, substituído, conferência e motivo. Fictício.
 */
import { render, screen, within } from "@testing-library/react";

import AsoPage from "@/app/(protected)/health-exams/[id]/aso/page";
import { asoChecklist, composeAso } from "@/shared/domains/medicine/aso";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  getAsoDocumentAction,
  getAsoReadinessAction,
  listAsoDocumentsAction,
  listAsoDeliveriesAction,
  listExamProceduresAction,
  listSignedAsosAction,
} from "@/shared/server/actions/medicine/aso";

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
}));
jest.mock("@/shared/server/actions/medicine/aso", () => ({
  getAsoReadinessAction: jest.fn(),
  listExamProceduresAction: jest.fn(),
  listAsoDocumentsAction: jest.fn(),
  listExaminerConclusionsAction: jest.fn().mockResolvedValue({ ok: true, data: [] }),
  getAsoDocumentAction: jest.fn(),
  addExamProcedureAction: jest.fn(),
  removeExamProcedureAction: jest.fn(),
  generateAsoDocumentAction: jest.fn(),
  listSignedAsosAction: jest.fn(),
  registerSignedAsoAction: jest.fn(),
  getSignedAsoDownloadAction: jest.fn(),
  listAsoDeliveriesAction: jest.fn(),
  registerAsoDeliveryAction: jest.fn(),
  voidAsoDeliveryAction: jest.fn(),
  getAsoDeliveryEvidenceAction: jest.fn(),
}));

const EXAM = "e1111111-1111-4111-8111-111111111111";
const content = composeAso({
  exam: {
    examType: "periodic",
    performedAt: "2026-10-20",
    aptitude: "fit",
    companyId: "c1",
  },
  examinerConclusion: null,
  employee: {
    fullName: "Pessoa Fictícia",
    cpf: "00000000191",
    companyId: "c1",
    jobRole: "Soldador",
    gesId: "g1",
    gesName: "Produção",
  },
  company: { razaoSocial: "Empresa Fictícia", cnpj: "11222333000181" },
  examiner: {
    name: "Dr. Examinador",
    profession: "physician",
    registration: "CRM 1/MA",
    registrationUf: "MA",
  },
  coordinator: null,
  risks: {
    validated: [{ description: "Ruído", agentType: "physical" }],
    pending: 0,
    usableSources: 1,
  },
  procedures: [
    { procedureCode: "0281", otherDescription: null, performedAt: "2026-10-18" },
  ],
  plannedProcedures: null,
  riskAbsence: null,
});
const DOC = {
  id: "d1",
  version: 1,
  generatedAt: "2026-11-02T10:00:00.000Z",
  contentSha256: "b".repeat(64),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getHealthExamAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { id: EXAM, examType: "periodic", performedAt: "2026-10-20", notes: "sigilo" },
  });
  (listExamProceduresAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
  (listSignedAsosAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
  (listAsoDeliveriesAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: {
      currentSignedDocumentId: null,
      summary: {
        state: "none",
        physicalCopyPending: false,
        previousVersionDelivered: false,
      },
      deliveries: [],
    },
  });
});

async function renderPage() {
  render(await AsoPage({ params: Promise.resolve({ id: EXAM }) }));
}

describe("AsoPage", () => {
  it("com bloqueio, não oferece a prévia e mostra o item pendente", async () => {
    const items = [
      {
        code: "examiner_missing",
        item: "e" as const,
        severity: "blocking" as const,
        message: "Médico examinador não informado no exame.",
        reference: "MED-01",
      },
    ];
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items, checklist: asoChecklist(items) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "A prévia não pode ser gerada: 1",
    );
    expect(screen.getByText(/Bloqueia: Médico examinador/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Gerar prévia do ASO" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("sigilo")).not.toBeInTheDocument();
  });

  it("sem bloqueio, oferece gerar e mostra a última prévia com aviso e assinatura pendente", async () => {
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [], checklist: asoChecklist([]) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [DOC] });
    (getAsoDocumentAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...DOC, content },
    });
    await renderPage();
    expect(
      screen.getByRole("button", { name: "Gerar prévia do ASO" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/PRÉVIA/);
    expect(
      within(screen.getByRole("article")).getByText(/Apto para a função/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Assinatura do médico examinador pendente/),
    ).toBeInTheDocument();
    expect(screen.getByText(`SHA-256 ${"b".repeat(64)}`)).toBeInTheDocument();
    expect(screen.queryByText("sigilo")).not.toBeInTheDocument();
  });

  it("ASO assinado: sem registro avisa que não há ASO oficial e oferece o registro", async () => {
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [], checklist: asoChecklist([]) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await renderPage();
    expect(screen.getByText(/Nenhum ASO assinado registrado/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar ASO assinado" }),
    ).toBeInTheDocument();
  });

  it("ASO assinado com substituição: vigente, substituído, conferência e motivo", async () => {
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [], checklist: asoChecklist([]) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    const signed = {
      origin: "external_clinic",
      previewDocumentId: null,
      signatureMethod: "handwritten",
      signerName: "Dra. Clínica Fictícia",
      signerRegistration: "88001",
      signerUf: "PI",
      conclusion: "fit",
      signedOn: "2026-10-21",
      fileSha256: "c".repeat(64),
      sizeBytes: 10,
      registeredBy: "staff",
      registeredAt: "2026-10-22T10:00:00.000Z",
    };
    (listSignedAsosAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [
        {
          ...signed,
          id: "s1",
          verificationReference: "Original na pasta 1",
          replacesId: null,
          replaceReason: null,
          replacedById: "s2",
        },
        {
          ...signed,
          id: "s2",
          verificationReference: "Original na pasta 2",
          replacesId: "s1",
          replaceReason: "Data corrigida pela clínica.",
          replacedById: null,
        },
      ],
    });
    await renderPage();
    expect(screen.getByText(/^Vigente/)).toBeInTheDocument();
    expect(screen.getByText(/^Substituído/)).toBeInTheDocument();
    expect(screen.getByText(/Conferência: Original na pasta 2/)).toBeInTheDocument();
    expect(screen.getByText(/Motivo: Data corrigida pela clínica/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar substituição" }),
    ).toBeInTheDocument();
  });
  it("entrega: sem ASO assinado não oferece registro; com ASO, mostra a situação, avisos e histórico", async () => {
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [], checklist: asoChecklist([]) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    await renderPage();
    expect(screen.getByText(/a prévia não é entregue como ASO/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/O que registrar/)).not.toBeInTheDocument();
  });

  it("entrega com ASO vigente: situação registrada, via física pendente e versão substituída no histórico", async () => {
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [], checklist: asoChecklist([]) },
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    const signed = {
      origin: "external_clinic",
      previewDocumentId: null,
      signatureMethod: "handwritten",
      verificationReference: "Original na pasta 1",
      signerName: "Dra. Clínica Fictícia",
      signerRegistration: "88001",
      signerUf: "PI",
      conclusion: "fit",
      signedOn: "2026-10-21",
      fileSha256: "c".repeat(64),
      sizeBytes: 10,
      replaceReason: null,
      registeredBy: "staff",
      registeredAt: "2026-10-22T10:00:00.000Z",
    };
    (listSignedAsosAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [
        { ...signed, id: "s1", replacesId: null, replacedById: "s2" },
        {
          ...signed,
          id: "s2",
          replacesId: "s1",
          replaceReason: "Data corrigida pela clínica.",
          replacedById: null,
        },
      ],
    });
    const event = {
      channelDescription: null,
      evidenceKind: null,
      evidenceSha256: null,
      hasEvidence: false,
      voidsId: null,
      voidReason: null,
    };
    (listAsoDeliveriesAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        currentSignedDocumentId: "s2",
        summary: {
          state: "registered",
          physicalCopyPending: true,
          previousVersionDelivered: false,
        },
        deliveries: [
          {
            ...event,
            id: "d1",
            signedDocumentId: "s1",
            kind: "made_available",
            method: "physical_copy",
            occurredAt: "2026-10-22T13:00:00.000Z",
            evidenceReference: "Recibo da versão 1",
          },
          {
            ...event,
            id: "d2",
            signedDocumentId: "s2",
            kind: "physical_copy_requested",
            method: null,
            occurredAt: "2026-10-23T11:00:00.000Z",
            evidenceReference: null,
          },
        ],
      },
    });
    await renderPage();
    expect(
      screen.getByText("Disponibilização registrada, sem comprovante"),
    ).toBeInTheDocument();
    expect(screen.getByText(/pediu a via física/)).toBeInTheDocument();
    expect(screen.getByText(/versão substituída/)).toBeInTheDocument();
    expect(screen.getByText(/Evidência: Recibo da versão 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Recebimento confirmado/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/O que registrar/)).toBeInTheDocument();
  });
});
