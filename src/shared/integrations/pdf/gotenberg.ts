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
