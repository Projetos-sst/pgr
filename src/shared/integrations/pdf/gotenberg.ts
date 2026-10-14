import "server-only";

import { ReportUnavailableError } from "@/shared/errors/report-unavailable-error";

import { getGotenbergConfig } from "./config";

/**
 * Ponto ÚNICO de rede da geração de PDF. Converte HTML → PDF via Gotenberg
 * (endpoint não-público protegido por token; segredo server-only). Serviço
 * ausente ou falho → `ReportUnavailableError` (503, sem vazar detalhe do
 * provedor). Stateless: o PDF retorna e a aplicação decide o que fazer.
 */
export async function htmlToPdf(html: string, fileName = "index.html"): Promise<Buffer> {
  const config = getGotenbergConfig();
  if (!config) throw new ReportUnavailableError();

  const form = new FormData();
  form.append("files", new Blob([html], { type: "text/html" }), fileName);

  let response: Response;
  try {
    response = await fetch(`${config.url}/forms/chromium/convert/html`, {
      method: "POST",
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ReportUnavailableError();
  }

  if (!response.ok) throw new ReportUnavailableError();
  return Buffer.from(await response.arrayBuffer());
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * DOCX → PDF via LibreOffice do Gotenberg (`/forms/libreoffice/convert`) — a
 * conversão do PGR em DOCX quando o provedor não é o Google Docs. Mesmo contrato de
 * falha do `htmlToPdf` (`ReportUnavailableError`).
 */
export async function docxToPdf(
  docx: Buffer,
  fileName = "document.docx",
): Promise<Buffer> {
  const config = getGotenbergConfig();
  if (!config) throw new ReportUnavailableError();

  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(docx)], { type: DOCX_MIME }), fileName);

  let response: Response;
  try {
    response = await fetch(`${config.url}/forms/libreoffice/convert`, {
      method: "POST",
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ReportUnavailableError();
  }

  if (!response.ok) throw new ReportUnavailableError();
  return Buffer.from(await response.arrayBuffer());
}
