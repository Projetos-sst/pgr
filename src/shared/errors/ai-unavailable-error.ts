import "server-only";

import { AppError } from "./app-error";

/**
 * Falha ao consultar o provedor de IA (chave ausente, erro de API, timeout,
 * resposta inválida). Mapeado para 502 no REST. **Nunca** bloqueia o cadastro do
 * GES/risco — a sugestão por IA é auxiliar; o usuário segue preenchendo à mão.
 *
 * A mensagem é devolvida ao cliente por `toActionError`: fala da **IA pgr-e**, nunca do
 * provedor por trás dela nem do motivo técnico da falha (isso fica no log do servidor).
 */
export class AiUnavailableError extends AppError {
  readonly code = "AI_UNAVAILABLE" as const;
  readonly status = 502;

  constructor(message = "A IA pgr-e está indisponível no momento.") {
    super(message);
  }
}
