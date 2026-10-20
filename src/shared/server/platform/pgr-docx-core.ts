import "server-only";

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";
import { getPgrDocxExtras } from "@/shared/db/repositories/pgr-docx-extras";
import { getRiskMethodologyView } from "@/shared/db/repositories/risk-methodology";
import {
  buildPgrDocxData,
  type PgrDocxOverrides,
} from "@/shared/domains/pgr/pgr-docx/build-data";
import { buildPgrDocxContent } from "@/shared/domains/pgr/pgr-docx/from-consolidated";
import type { PgrDocxFormat } from "@/shared/domains/pgr/pgr-docx/request";
import {
  PGR_DOCX_LOGO_PLACEHOLDER,
  PGR_DOCX_TEMPLATE_FILE,
} from "@/shared/domains/pgr/pgr-docx/template-file";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReportUnavailableError } from "@/shared/errors/report-unavailable-error";
import { renderDocxTemplate } from "@/shared/integrations/docx/template-engine";
import { getGoogleDocsConfig } from "@/shared/integrations/google/config";
import {
  convertDocxWithGoogle,
  createGoogleDocsClient,
  DOCX_MIME,
} from "@/shared/integrations/google/drive-docs";
import { docxToPdf } from "@/shared/integrations/pdf/gotenberg";
import { downloadCompanyLogo } from "@/shared/integrations/storage/company-logo-storage";
import { slugifyFileName } from "@/shared/integrations/storage/documents-storage";

/**
 * PGR em DOCX/PDF a partir do template (`templates/pgr/pgr-template.docx`):
 *
 *   consolidado + extras (banco, `withOrg`) → `buildPgrDocxContent` → `buildPgrDocxData`
 *   (+ semi-fixos alterados) → docxtemplater (+ logo da empresa) → DOCX
 *   → PDF pelo provedor (`PGR_DOCX_PDF_PROVIDER`: `gotenberg` padrão | `google`).
 *
 * PGR inexistente/cross-tenant → NOT_FOUND; template/provedor ausente ou falho →
 * REPORT_UNAVAILABLE (503), sem vazar detalhe do provedor.
 */

export type PgrDocxPdfProvider = "gotenberg" | "google";

export type GeneratedPgrDocx = {
  fileName: string;
  /** Nome legível do documento ("PGR — Empresa — Obra"), p/ o GED. */
  title: string;
  contentType: string;
  file: Buffer;
  /** Tags do template sem valor no dado (saíram vazias) — diagnóstico, não erro. */
  missingTags: string[];
  /** Technical identifiers for this export, not a signature or technical approval. */
  provenance: {
    pgrId: string;
    generatedAt: string;
    templateSha256: string;
    sourceSha256: string;
    fileSha256: string;
  };
};

export type GeneratePgrDocxOptions = {
  format?: PgrDocxFormat;
  overrides?: PgrDocxOverrides;
};

export function getPgrDocxPdfProvider(): PgrDocxPdfProvider {
  return process.env.PGR_DOCX_PDF_PROVIDER?.trim().toLowerCase() === "google"
    ? "google"
    : "gotenberg";
}

/** "02/10/2026 09:30" no fuso do negócio (rodapé "Emitido em"). */
export function emittedAtInSaoPaulo(date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/**
 * `pgr-<empresa>-<obra>-<aaaa-mm-dd>` (sem extensão). Passa pelo `slugifyFileName` COM
 * extensão — sem ela um "S.A." no nome viraria a "extensão" do arquivo.
 */
export function pgrDocxBaseName(
  pgr: { companyName: string; workUnitName: string | null },
  emittedAt: string,
): string {
  const date = emittedAt.slice(0, 10).split("/").reverse().join("-");
  const parts = ["pgr", pgr.companyName, pgr.workUnitName, date].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return slugifyFileName(`${parts.join(" ")}.docx`).replace(/\.docx$/, "");
}

/** "PGR — Empresa — Obra" (nome do documento no GED). */
export function pgrDocxTitle(pgr: {
  companyName: string;
  workUnitName: string | null;
}): string {
  return ["PGR", pgr.companyName, pgr.workUnitName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" — ");
}

let templateCache: Promise<Buffer> | null = null;

/**
 * Lido do disco uma vez por processo. `turbopackIgnore`: sem ele o bundler rastreia o
 * projeto inteiro; o arquivo entra no deploy pelo `outputFileTracingIncludes` do
 * `next.config.ts`.
 */
function loadTemplate(): Promise<Buffer> {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), PGR_DOCX_TEMPLATE_FILE);
  templateCache ??= readFile(file).catch((error: unknown) => {
    templateCache = null;
    throw error;
  });
  return templateCache;
}

async function toPdf(docx: Buffer, fileName: string): Promise<Buffer> {
  if (getPgrDocxPdfProvider() === "gotenberg") return docxToPdf(docx, fileName);
  const config = getGoogleDocsConfig();
  if (!config) throw new ReportUnavailableError();
  try {
    return await convertDocxWithGoogle(createGoogleDocsClient(config), docx, fileName);
  } catch {
    throw new ReportUnavailableError();
  }
}

export async function generatePgrDocx(
  orgId: string,
  pgrId: string,
  options: GeneratePgrDocxOptions = {},
): Promise<GeneratedPgrDocx> {
  const [consolidated, extras, methodology] = await Promise.all([
    getPgrConsolidated(orgId, pgrId),
    getPgrDocxExtras(orgId, pgrId),
    getRiskMethodologyView(orgId),
  ]);
  if (!consolidated || !extras) throw new NotFoundError();

  const generatedAt = new Date();
  const emittedAt = emittedAtInSaoPaulo(generatedAt);
  const content = buildPgrDocxContent(consolidated, extras, {
    emittedAt,
    classificationBands: methodology.classificationBands,
  });
  const data = buildPgrDocxData(content, { overrides: options.overrides });

  let template: Buffer;
  try {
    template = await loadTemplate();
  } catch {
    throw new ReportUnavailableError();
  }
  // `logoPath` veio da leitura `withOrg` deste tenant — o objeto é dele.
  const logo = extras.company.logoPath
    ? await downloadCompanyLogo(extras.company.logoPath)
    : null;
  const { buffer, missingTags } = renderDocxTemplate(template, data, {
    images: { [PGR_DOCX_LOGO_PLACEHOLDER]: logo },
  });

  const baseName = pgrDocxBaseName(consolidated.pgr, emittedAt);
  const title = pgrDocxTitle(consolidated.pgr);
  const pdf = options.format === "pdf";
  const file = pdf ? await toPdf(buffer, `${baseName}.docx`) : buffer;
  const sha256 = (value: Buffer | string) =>
    createHash("sha256").update(value).digest("hex");
  return {
    fileName: `${baseName}.${pdf ? "pdf" : "docx"}`,
    title,
    contentType: pdf ? "application/pdf" : DOCX_MIME,
    file,
    missingTags,
    provenance: {
      pgrId,
      generatedAt: generatedAt.toISOString(),
      templateSha256: sha256(template),
      // Hash exactly the input snapshot used by this generation, without emitting it.
      // This does not assert a single DB transaction across the existing readers.
      sourceSha256: sha256(
        JSON.stringify({
          pgrId,
          consolidated,
          extras,
          classificationBands: methodology.classificationBands,
          overrides: options.overrides ?? null,
          logoSha256: logo ? sha256(logo) : null,
        }),
      ),
      fileSha256: sha256(file),
    },
  };
}
