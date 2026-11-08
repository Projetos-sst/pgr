/**
 * Datas exibidas nas telas da Medicina (NOB-112/109/110). Um carimbo (instante) gravado às 22h30
 * de Brasília já é o dia seguinte em UTC: a tela mostra o dia de Brasília, nunca o corte do ISO.
 * Datas civis (coluna `date`) aparecem como estão, sem conversão. Dados fictícios.
 */
import { render, screen } from "@testing-library/react";

import AsoPage from "@/app/(protected)/health-exams/[id]/aso/page";
import ClinicalRecordPage from "@/app/(protected)/health-exams/[id]/clinical-record/page";
import ExamPlanPage from "@/app/(protected)/companies/[id]/exam-plan/page";
import InterpretationCriteriaPage from "@/app/(protected)/companies/[id]/interpretation-criteria/page";
import PcmsoPage from "@/app/(protected)/companies/[id]/pcmso/page";
import { asoChecklist } from "@/shared/domains/medicine/aso";
import { composePcmso } from "@/shared/domains/medicine/pcmso-composition";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  getAsoDocumentAction,
  getAsoReadinessAction,
  listAsoDeliveriesAction,
  listAsoDocumentsAction,
  listExaminerConclusionsAction,
  listExamProceduresAction,
  listSignedAsosAction,
} from "@/shared/server/actions/medicine/aso";
import {
  listWorkRestrictionsAction,
  readClinicalRecordAction,
} from "@/shared/server/actions/medicine/clinical-record";
import {
  getExamPlanAction,
  listExamPlansAction,
} from "@/shared/server/actions/medicine/exam-plans";
import { listInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";
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
jest.mock("@/shared/server/actions/pgr/health-exams", () => ({
  getHealthExamAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/aso", () => ({
  getAsoReadinessAction: jest.fn(),
  listExamProceduresAction: jest.fn(),
  listAsoDocumentsAction: jest.fn(),
  listExaminerConclusionsAction: jest.fn(),
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
  reviewAsoDeliveryEvidenceAction: jest.fn(),
  getAsoDeliveryEvidenceAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/clinical-record", () => ({
  readClinicalRecordAction: jest.fn(),
  listWorkRestrictionsAction: jest.fn(),
  addClinicalNoteAction: jest.fn(),
  recordWorkRestrictionAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/exam-plans", () => ({
  listExamPlansAction: jest.fn(),
  getExamPlanAction: jest.fn(),
  createExamPlanDraftAction: jest.fn(),
  decideExamPlanItemAction: jest.fn(),
  addExamPlanItemAction: jest.fn(),
  approveExamPlanAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/interpretation-criteria", () => ({
  listInterpretationCriteriaAction: jest.fn(),
  defineInterpretationCriteriaAction: jest.fn(),
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
const EXAM = "e1111111-1111-4111-8111-111111111111";

/** 22h30 de Brasília do dia `day` (YYYY-MM-DD) = 01h30 UTC do dia seguinte. */
function lateEveningInBrasilia(day: string): string {
  const next = new Date(`${day}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T01:30:00.000Z`;
}

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
});

describe("ASO do exame", () => {
  it("registro, confirmação e prévia às 22h30 de Brasília mostram o dia de Brasília; datas civis ficam como estão", async () => {
    (getHealthExamAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        id: EXAM,
        examType: "periodic",
        performedAt: "2026-10-20",
        aptitude: "fit_with_restrictions",
      },
    });
    (getAsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [], checklist: asoChecklist([]) },
    });
    (listExamProceduresAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    (listExaminerConclusionsAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "k1",
          conclusion: "fit",
          confirmedAt: lateEveningInBrasilia("2026-10-21"),
        },
      ],
    });
    (listAsoDocumentsAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "d1",
          version: 1,
          generatedAt: new Date(lateEveningInBrasilia("2026-11-02")),
          contentSha256: "b".repeat(64),
        },
      ],
    });
    (getAsoDocumentAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "x" },
    });
    (listSignedAsosAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "s1",
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
          replacesId: null,
          replaceReason: null,
          registeredBy: "staff",
          registeredAt: lateEveningInBrasilia("2026-10-22"),
          replacedById: null,
        },
      ],
    });
    (listAsoDeliveriesAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        currentSignedDocumentId: "s1",
        summary: {
          state: "none",
          physicalCopyPending: false,
          previousVersionDelivered: false,
        },
        deliveries: [],
      },
    });

    render(await AsoPage({ params: Promise.resolve({ id: EXAM }) }));

    expect(screen.getByText(/confirmado em 2026-10-21/)).toBeInTheDocument();
    expect(screen.getByText(/registrado em 2026-10-22/)).toBeInTheDocument();
    expect(screen.getByText(/gerada em 2026-11-02/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-10-23|2026-11-03/)).not.toBeInTheDocument();
    // Datas civis: como estão.
    expect(screen.getByText(/assinado em 2026-10-21/)).toBeInTheDocument();
    expect(screen.getByText("Exame clínico — 2026-10-20")).toBeInTheDocument();
  });
});

describe("PCMSO da empresa", () => {
  it("aprovação do plano no conteúdo arquivado, registro e geração às 22h30 de Brasília", async () => {
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
        {
          id: "s1",
          kind: "internal",
          origin: "PGR interno",
          title: "PGR da plataforma",
          version: "Revisão 1",
        },
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
        approvedAt: lateEveningInBrasilia("2026-10-30"),
        approvedByName: "Dra. Fictícia",
        items: [],
      },
      examiners: [{ name: "Dr. Examinador", registration: "CRM 9/MA" }],
      interpretationCriteria: [],
      analyticalReport: null,
      pendingSections: [],
    });
    const doc = {
      id: "d1",
      version: 1,
      cycleStart: "2026-11-01",
      cycleEnd: "2027-10-31",
      generatedAt: new Date(lateEveningInBrasilia("2026-11-02")),
      contentSha256: "a".repeat(64),
    };
    (listPcmsoDocumentsAction as jest.Mock).mockResolvedValue({ ok: true, data: [doc] });
    (getPcmsoDocumentAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...doc, content },
    });
    (getPcmsoReadinessAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { items: [] },
    });
    (listSignedPcmsosAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        currentId: "s1",
        warnings: [],
        items: [
          {
            id: "s1",
            orgId: "org",
            companyId: COMPANY,
            previewDocumentId: "d1",
            previewSha256: "a".repeat(64),
            examPlanId: "p1",
            origin: "coordinator",
            signatureMethod: "icp_brasil",
            signerName: "Dra. Fictícia",
            signerRegistration: "123",
            signerUf: "MA",
            signedOn: "2026-11-02",
            verificationKind: "documentary",
            verificationReference: "Verificador ITI 77",
            fileSha256: "e".repeat(64),
            sizeBytes: 10,
            replacesId: null,
            changeKind: null,
            replaceReason: null,
            replacedById: null,
            registeredBy: "doctor",
            registeredAt: lateEveningInBrasilia("2026-11-03"),
            previewVersion: 1,
            cycleStart: "2026-11-01",
            cycleEnd: "2027-10-31",
          },
        ],
      },
    });

    render(await PcmsoPage({ params: Promise.resolve({ id: COMPANY }) }));

    // O conteúdo arquivado guarda o instante; a tela mostra o dia de Brasília.
    expect(content.examPlan.approvedAt).toBe("2026-10-31T01:30:00.000Z");
    expect(
      screen.getByText(/aprovado por Dra. Fictícia em 2026-10-30/),
    ).toBeInTheDocument();
    expect(screen.getByText(/registrado em 2026-11-03/)).toBeInTheDocument();
    expect(screen.getByText(/gerada em 2026-11-02/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-10-31|2026-11-04/)).not.toBeInTheDocument();
    // Datas civis: como estão.
    expect(screen.getByText(/assinado em 2026-11-02/)).toBeInTheDocument();
    expect(
      screen.getByText(/Versão 1 · prévia · ciclo 2026-11-01 a 2027-10-31/),
    ).toBeInTheDocument();
  });
});

describe("Plano de exames", () => {
  it("aprovação e histórico às 22h30 de Brasília mostram data e hora de Brasília", async () => {
    const plan = {
      id: "p1",
      companyId: COMPANY,
      version: 1,
      status: "approved" as const,
      approvedAt: new Date(lateEveningInBrasilia("2026-11-02")),
      approvalNote: null,
      items: [],
      events: [
        {
          id: "e1",
          event: "approved",
          actor: "coordenadora",
          createdAt: new Date(lateEveningInBrasilia("2026-11-02")),
        },
      ],
    };
    (listExamPlansAction as jest.Mock).mockResolvedValue({ ok: true, data: [plan] });
    (getExamPlanAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...plan, canDecide: true },
    });

    render(await ExamPlanPage({ params: Promise.resolve({ id: COMPANY }) }));

    expect(screen.getByText("Aprovado em 2026-11-02")).toBeInTheDocument();
    expect(
      screen.getByText("2026-11-02 22:30 · approved · coordenadora"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2026-11-03/)).not.toBeInTheDocument();
  });
});

describe("Prontuário clínico do exame", () => {
  it("observação e restrição às 22h30 de Brasília mostram o dia de Brasília; o exame (data civil) fica como está", async () => {
    (getHealthExamAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: EXAM, examType: "periodic", performedAt: "2026-10-20" },
    });
    (readClinicalRecordAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        basis: "examiner",
        notes: [
          {
            id: "n1",
            origin: "clinician",
            content: "Observação fictícia.",
            authorName: null,
            authorRegistration: null,
            recordedAt: lateEveningInBrasilia("2026-10-20"),
          },
        ],
      },
    });
    (listWorkRestrictionsAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "r1",
          kind: "restriction",
          restriction: "Restrição fictícia.",
          authorName: null,
          recordedAt: lateEveningInBrasilia("2026-10-21"),
        },
      ],
    });

    render(await ClinicalRecordPage({ params: Promise.resolve({ id: EXAM }) }));

    expect(screen.getByText(/^2026-10-20 · /)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("· 2026-10-21");
    expect(screen.queryByText(/2026-10-22/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /de 2026-10-20$/ })).toBeInTheDocument();
  });
});

describe("Critérios de interpretação", () => {
  it("versão registrada às 22h30 de Brasília mostra o dia de Brasília", async () => {
    (listInterpretationCriteriaAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        approvedPlanVersion: 1,
        missing: [],
        rows: [
          {
            procedureCode: "0281",
            otherDescription: null,
            description: "Audiometria tonal ocupacional",
            inApprovedPlan: true,
            current: {
              id: "k1",
              procedureCode: "0281",
              otherDescription: null,
              version: 2,
              criteria: "Critério fictício.",
              conduct: "Conduta fictícia.",
              authorName: "Dra. Fictícia",
              authoredAt: lateEveningInBrasilia("2026-11-01"),
            },
          },
        ],
      },
    });

    render(
      await InterpretationCriteriaPage({ params: Promise.resolve({ id: COMPANY }) }),
    );

    expect(screen.getByText(/versão 2 · Dra. Fictícia · 2026-11-01/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-11-02/)).not.toBeInTheDocument();
  });
});
