import "server-only";

import { AppError } from "./app-error";

/**
 * Escrita em uma versão de documento que não é a vigente do grupo (#56). Versões antigas
 * são histórico: só a vigente aceita edição de metadados. Mapeado para o código de contrato
 * `DOCUMENT_VERSION_READ_ONLY` (→ 409) por `toActionError`/`HTTP_BY_CODE`.
 */
export class DocumentVersionReadOnlyError extends AppError {
  readonly code = "DOCUMENT_VERSION_READ_ONLY" as const;
  readonly status = 409;

  constructor(
    message = "Esta é uma versão antiga do documento e é somente leitura. Edite a versão vigente.",
  ) {
    super(message);
  }
}
