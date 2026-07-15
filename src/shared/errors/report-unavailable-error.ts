import "server-only";

import { AppError } from "./app-error";

/**
 * Geração de relatório indisponível — serviço de PDF (Gotenberg) não configurado
 * ou falhou. 503: é infraestrutura ausente/instável, não erro do cliente. Não
 * vaza detalhe do provedor.
 */
export class ReportUnavailableError extends AppError {
  readonly code = "REPORT_UNAVAILABLE" as const;
  readonly status = 503;

  constructor(message = "REPORT_UNAVAILABLE") {
    super(message);
  }
}
