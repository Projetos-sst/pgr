import "server-only";

import { AppError } from "./app-error";

export class ExportUnavailableError extends AppError {
  readonly code = "EXPORT_UNAVAILABLE" as const;
  readonly status = 503;

  constructor(
    message = "Não foi possível ler os arquivos do acervo agora. Nenhum pacote foi gerado; tente novamente.",
  ) {
    super(message);
  }
}
