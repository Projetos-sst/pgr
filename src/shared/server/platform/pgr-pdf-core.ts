import "server-only";

import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";
import { buildPgrHtml, type PgrPdfOptions } from "@/shared/domains/pgr/pgr-pdf-template";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { htmlToPdf } from "@/shared/integrations/pdf/gotenberg";
import { todayInSaoPaulo } from "@/shared/dates";

export type GeneratedReport = { fileName: string; pdf: Buffer };

export type PgrPdfInput = Omit<PgrPdfOptions, "generatedAt">;

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

  const generatedAt = todayInSaoPaulo();
  const html = buildPgrHtml(data, { ...options, generatedAt });
  const pdf = await htmlToPdf(html);
  return { fileName: `pgr-${pgrId}-${generatedAt}.pdf`, pdf };
}
