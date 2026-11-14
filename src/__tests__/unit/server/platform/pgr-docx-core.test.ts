/**
 * @jest-environment node
 *
 * Orquestração do PGR em DOCX com deps mockadas (sem DB/Storage/Gotenberg/Google
 * reais): escolha do provedor de PDF, nome do arquivo e erros mapeados. O template e
 * o motor de preenchimento são os de verdade.
 */
import type { PgrConsolidated } from "@/shared/domains/pgr/pgr-consolidated";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PgrDocxExtras } from "@/shared/domains/pgr/pgr-docx/from-consolidated";

const getPgrConsolidated = jest.fn();
const getPgrDocxExtras = jest.fn();
const getRiskMethodologyView = jest.fn();
const downloadCompanyLogo = jest.fn();
const docxToPdf = jest.fn();
const convertDocxWithGoogle = jest.fn();
const getGoogleDocsConfig = jest.fn();
const readEmissionFacts = jest.fn();

jest.mock("@/shared/db/repositories/commercial-trials", () => ({
  readEmissionFacts: (...a: unknown[]) => readEmissionFacts(...a),
}));

jest.mock("@/shared/db/repositories/pgr-consolidated", () => ({
  getPgrConsolidated: (...a: unknown[]) => getPgrConsolidated(...a),
}));
jest.mock("@/shared/db/repositories/pgr-docx-extras", () => ({
  getPgrDocxExtras: (...a: unknown[]) => getPgrDocxExtras(...a),
}));
jest.mock("@/shared/db/repositories/risk-methodology", () => ({
  getRiskMethodologyView: (...a: unknown[]) => getRiskMethodologyView(...a),
}));
jest.mock("@/shared/db/repositories/pgr-generation-snapshot", () => ({
  getPgrGenerationSnapshot: async (orgId: string, pgrId: string) => {
    const consolidated = await getPgrConsolidated(orgId, pgrId);
    const extras = await getPgrDocxExtras(orgId, pgrId);
    const methodology = await getRiskMethodologyView(orgId);
    return consolidated && extras ? { consolidated, extras, methodology } : null;
  },
}));
jest.mock("@/shared/db/repositories/pgr-document-approvals", () => ({
  listApprovalEvents: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: (...a: unknown[]) => downloadCompanyLogo(...a),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () =>
  jest.requireActual("@/shared/integrations/storage/documents-storage"),
);
jest.mock("@/shared/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: jest.fn(),
}));
jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  docxToPdf: (...a: unknown[]) => docxToPdf(...a),
}));
jest.mock("@/shared/integrations/google/config", () => ({
  getGoogleDocsConfig: () => getGoogleDocsConfig(),
}));
jest.mock("@/shared/integrations/google/drive-docs", () => ({
  DOCX_MIME: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  createGoogleDocsClient: () => ({}),
  convertDocxWithGoogle: (...a: unknown[]) => convertDocxWithGoogle(...a),
}));

import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";
import { EmissionBlockedError } from "@/shared/errors/emission-blocked-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { ReportUnavailableError } from "@/shared/errors/report-unavailable-error";
import { extractDocxText } from "@/shared/integrations/docx/template-engine";
import {
  emittedAtInSaoPaulo,
  generatePgrDocx,
  getPgrDocxPdfProvider,
  pgrDocxBaseName,
} from "@/shared/server/platform/pgr-docx-core";

const consolidated: PgrConsolidated = {
  pgr: {
    id: "pgr-1",
    companyName: "Construtora S.A.",
    workUnitName: "Obra Centro",
    responsible: "Eng. Fulano",
    registrationType: "crea",
    registrationNumber: "123",
    issuedAt: "2026-10-01",
    validUntil: "2028-09-30",
  },
  ges: [],
};
const extras: PgrDocxExtras = {
  company: { phone: null, logoPath: "org_a/logos/x.png" },
  revisions: [],
  ges: {},
  requiredTrainings: [],
};

const env = process.env;

beforeEach(() => {
  process.env = { ...env, PGR_DOCX_PDF_PROVIDER: "", COMMERCIAL_CATALOG_ENABLED: "" };
  for (const fn of [
    getPgrConsolidated,
    getPgrDocxExtras,
    getRiskMethodologyView,
    downloadCompanyLogo,
    docxToPdf,
    convertDocxWithGoogle,
    getGoogleDocsConfig,
    readEmissionFacts,
  ]) {
    fn.mockReset();
  }
  getPgrConsolidated.mockResolvedValue(consolidated);
  getPgrDocxExtras.mockResolvedValue(extras);
  getRiskMethodologyView.mockResolvedValue({
    configured: false,
    ...defaultRiskMethodology(),
  });
  downloadCompanyLogo.mockResolvedValue(null);
});

afterAll(() => {
  process.env = env;
});

describe("helpers", () => {
  it("data de emissão no fuso de São Paulo", () => {
    expect(emittedAtInSaoPaulo(new Date("2026-10-02T02:30:00Z"))).toBe(
      "01/10/2026 23:30",
    );
  });

  it("nome do arquivo não confunde 'S.A.' com extensão", () => {
    expect(pgrDocxBaseName(consolidated.pgr, "02/10/2026 09:30")).toBe(
      "pgr-construtora-s-a-obra-centro-2026-10-02",
    );
  });

  it("provedor de PDF: gotenberg por padrão, google só quando pedido", () => {
    expect(getPgrDocxPdfProvider()).toBe("gotenberg");
    process.env.PGR_DOCX_PDF_PROVIDER = "Google";
    expect(getPgrDocxPdfProvider()).toBe("google");
  });
});

describe("generatePgrDocx", () => {
  it("identifies the template, input changes and actual exported bytes without exposing source fields", async () => {
    const first = await generatePgrDocx("org_a", "pgr-1");
    const repeated = await generatePgrDocx("org_a", "pgr-1");
    expect(first.provenance.pgrId).toBe("pgr-1");
    expect(Number.isNaN(Date.parse(first.provenance.generatedAt))).toBe(false);
    expect(first.provenance.sourceSha256).toBe(repeated.provenance.sourceSha256);
    expect(first.provenance.templateSha256).toBe(
      createHash("sha256")
        .update(readFileSync("templates/pgr/pgr-template.docx"))
        .digest("hex"),
    );
    expect(first.provenance.fileSha256).toBe(
      createHash("sha256").update(first.file).digest("hex"),
    );
    getPgrConsolidated.mockResolvedValue({
      ...consolidated,
      pgr: { ...consolidated.pgr, companyName: "Outra razão social" },
    });
    const changed = await generatePgrDocx("org_a", "pgr-1");
    expect(changed.provenance.sourceSha256).not.toBe(first.provenance.sourceSha256);
    expect(JSON.stringify(changed.provenance)).not.toContain("Outra razão social");
  });

  it("fingerprints the converted PDF bytes and includes semi-fixed overrides in the source identifier", async () => {
    docxToPdf.mockResolvedValue(Buffer.from("%PDF"));
    const original = await generatePgrDocx("org_a", "pgr-1", { format: "pdf" });
    const changed = await generatePgrDocx("org_a", "pgr-1", {
      format: "pdf",
      overrides: { titles: { introduction: "Apresentação revista" } },
    });
    expect(original.provenance.fileSha256).toBe(
      createHash("sha256").update(Buffer.from("%PDF")).digest("hex"),
    );
    expect(original.provenance.sourceSha256).not.toBe(changed.provenance.sourceSha256);
  });
  it("gera o DOCX do tenant e busca o logo da empresa", async () => {
    const result = await generatePgrDocx("org_a", "pgr-1");
    expect(getPgrConsolidated).toHaveBeenCalledWith("org_a", "pgr-1");
    expect(getPgrDocxExtras).toHaveBeenCalledWith("org_a", "pgr-1");
    expect(downloadCompanyLogo).toHaveBeenCalledWith("org_a/logos/x.png");
    expect(result.fileName).toMatch(
      /^pgr-construtora-s-a-obra-centro-\d{4}-\d{2}-\d{2}\.docx$/,
    );
    expect(result.title).toBe("PGR — Construtora S.A. — Obra Centro");
    expect(extractDocxText(result.file)).toContain("CONSTRUTORA S.A.");
    expect(docxToPdf).not.toHaveBeenCalled();
  });

  it("usa as faixas da metodologia da organização", async () => {
    getRiskMethodologyView.mockResolvedValue({
      configured: true,
      ...defaultRiskMethodology(),
      classificationBands: [
        { classification: "trivial", maxLevel: 3 },
        { classification: "tolerable", maxLevel: 8 },
        { classification: "moderate", maxLevel: 11 },
        { classification: "substantial", maxLevel: 16 },
        { classification: "intolerable", maxLevel: 25 },
      ],
    });
    const result = await generatePgrDocx("org_a", "pgr-1");
    expect(getRiskMethodologyView).toHaveBeenCalledWith("org_a");
    const text = extractDocxText(result.file).replace(/\u00A0/g, " ");
    expect(text).toContain("Moderado (9-11)");
    expect(text).toContain("Nenhum GES cadastrado neste PGR.");
    expect(text).toContain("Nenhuma ação planejada neste PGR.");
  });

  it("PGR inexistente/de outro tenant → NOT_FOUND", async () => {
    getPgrDocxExtras.mockResolvedValue(null);
    await expect(generatePgrDocx("org_b", "pgr-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("gate comercial da emissão final", () => {
    const blockedFacts = {
      trial: {
        id: "t1",
        companyId: "c1",
        startedAt: new Date("2026-01-01T00:00:00Z"),
        endsAt: new Date("2026-01-16T00:00:00Z"),
        days: 15,
        startedBy: "owner",
        convertedAt: null,
      },
      hasPaidPgr: false,
    };

    it("flag desligada: emissão final segue a validação de hoje e não consulta o banco", async () => {
      process.env.COMMERCIAL_CATALOG_ENABLED = "false";
      await expect(
        generatePgrDocx("org_a", "pgr-1", { purpose: "issue" }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(readEmissionFacts).not.toHaveBeenCalled();
    });

    it("flag ligada com teste sem PGR pago: emissão final → EMISSION_BLOCKED", async () => {
      process.env.COMMERCIAL_CATALOG_ENABLED = "true";
      readEmissionFacts.mockResolvedValue(blockedFacts);
      await expect(
        generatePgrDocx("org_a", "pgr-1", { purpose: "issue" }),
      ).rejects.toBeInstanceOf(EmissionBlockedError);
    });

    it("flag ligada: a prévia (sem purpose) segue livre e não consulta o banco", async () => {
      process.env.COMMERCIAL_CATALOG_ENABLED = "true";
      readEmissionFacts.mockResolvedValue(blockedFacts);
      const out = await generatePgrDocx("org_a", "pgr-1");
      expect(out.contentType).toContain("wordprocessingml");
      expect(readEmissionFacts).not.toHaveBeenCalled();
    });
  });

  it("PDF pelo Gotenberg (padrão)", async () => {
    docxToPdf.mockResolvedValue(Buffer.from("%PDF"));
    const result = await generatePgrDocx("org_a", "pgr-1", { format: "pdf" });
    expect(result.contentType).toBe("application/pdf");
    expect(result.file.toString()).toBe("%PDF");
    expect(convertDocxWithGoogle).not.toHaveBeenCalled();
  });

  it("PDF pelo Google Docs quando PGR_DOCX_PDF_PROVIDER=google", async () => {
    process.env.PGR_DOCX_PDF_PROVIDER = "google";
    getGoogleDocsConfig.mockReturnValue({
      credentials: {},
      subject: null,
      folderId: null,
    });
    convertDocxWithGoogle.mockResolvedValue(Buffer.from("%PDF-google"));
    const result = await generatePgrDocx("org_a", "pgr-1", { format: "pdf" });
    expect(result.file.toString()).toBe("%PDF-google");
    expect(docxToPdf).not.toHaveBeenCalled();
  });

  it("Google pedido mas sem Service Account, ou falhando → REPORT_UNAVAILABLE", async () => {
    process.env.PGR_DOCX_PDF_PROVIDER = "google";
    getGoogleDocsConfig.mockReturnValue(null);
    await expect(
      generatePgrDocx("org_a", "pgr-1", { format: "pdf" }),
    ).rejects.toBeInstanceOf(ReportUnavailableError);

    getGoogleDocsConfig.mockReturnValue({
      credentials: {},
      subject: null,
      folderId: null,
    });
    convertDocxWithGoogle.mockRejectedValue(new Error("quota detalhada do Google"));
    await expect(
      generatePgrDocx("org_a", "pgr-1", { format: "pdf" }),
    ).rejects.toBeInstanceOf(ReportUnavailableError);
  });
});
