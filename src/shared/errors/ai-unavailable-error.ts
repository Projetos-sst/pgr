import "server-only";

import { AppError } from "./app-error";

/**
 * Falha ao consultar o provedor de IA (chave ausente, erro de API, timeout,
 * resposta inválida). Mapeado para 502 no REST. **Nunca** bloqueia o cadastro do
 * GES/risco — a sugestão por IA é auxiliar; o usuário segue preenchendo à mão.
 */
export class AiUnavailableError extends AppError {
  readonly code = "AI_UNAVAILABLE" as const;
  readonly status = 502;

  constructor(message = "Serviço de IA indisponível no momento.") {
    super(message);
  }
}
