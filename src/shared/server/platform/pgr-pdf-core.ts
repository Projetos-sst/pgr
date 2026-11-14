import "server-only";

import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";
import { buildPgrHtml, type PgrPdfOptions } from "@/shared/domains/pgr/pgr-pdf-template";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { htmlToPdf } from "@/shared/integrations/pdf/gotenberg";
import { slugifyFileName } from "@/shared/integrations/storage/documents-storage";
import { todayInSaoPaulo } from "@/shared/dates";
import { assertPgrEmissionAllowed } from "@/shared/server/commercial/emission-gate";
import { assertPgrApprovalCurrent } from "@/shared/server/pgr/document-approval-core";

export type GeneratedReport = { fileName: string; pdf: Buffer };

export type PgrPdfInput = Omit<PgrPdfOptions, "generatedAt">;

/**
 * Nome legível para quem baixa: `pgr-<empresa>-<unidade>-<data>.pdf`. O UUID do PGR
 * não entra — não diz nada para o usuário e o arquivo acaba salvo em disco/e-mail.
 */
function buildPgrPdfFileName(
  data: { pgr: { companyName: string; workUnitName: string | null } },
  generatedAt: string,
): string {
  const parts = ["pgr", data.pgr.companyName, data.pgr.workUnitName, generatedAt].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return slugifyFileName(`${parts.join(" ")}.pdf`);
}

/**
 * Gera o PDF do PGR (fatia #40). Reusa a leitura consolidada (fatia 022) — o HTML é
 * montado no servidor APÓS o gate de tenant (Princípio I) e enviado ao Gotenberg.
 * PGR inexistente/cross-tenant → NOT_FOUND; serviço de PDF ausente/falho →
 * REPORT_UNAVAILABLE (503, via `htmlToPdf`).
 */
export async function generatePgrPdf(
  orgId: string,
  pgrId: string,
  options: PgrPdfInput = {},
): Promise<GeneratedReport> {
  const data = await getPgrConsolidated(orgId, pgrId);
  if (!data) throw new NotFoundError();
  await assertPgrApprovalCurrent(orgId, pgrId);
  await assertPgrEmissionAllowed({ orgId, pgrId });

  const generatedAt = todayInSaoPaulo();
  const html = buildPgrHtml(data, { ...options, generatedAt });
  const pdf = await htmlToPdf(html);
  return { fileName: buildPgrPdfFileName(data, generatedAt), pdf };
}
