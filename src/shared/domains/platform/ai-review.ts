export const AI_BRAND = "IA pgr-e";

export const AI_REVIEW_TITLE = "Revise o que a IA pgr-e preencher";

export const AI_REVIEW_WARNING = "A IA pode errar. Revise campo a campo antes de salvar.";

export const AI_REVIEW_DISMISSED_KEY = "pgr-e:ai-review-warning:dismissed";

export const AI_FILL_LABEL = "Preencher com IA pgr-e";

export const AI_FILLED_LABEL = "Preenchido pela IA pgr-e";

export const AI_SAVE_TITLE = "Confirmar conteúdo preenchido pela IA pgr-e";

export const TERMS_PATH = "/termos";

export const TERMS_LINK_LABEL = "Termos de uso";

const AI_FILL_ERROR_MESSAGES: Partial<Record<string, string>> = {
  AI_UNAVAILABLE:
    "A IA pgr-e está indisponível no momento. Preencha os campos manualmente e salve normalmente.",
  QUOTA_EXCEEDED:
    "Sua organização atingiu o limite mensal de preenchimentos com a IA pgr-e do plano. Preencha os campos manualmente ou faça upgrade do plano.",
};

export function aiFillErrorMessage(error: { code: string; message: string }): string {
  return AI_FILL_ERROR_MESSAGES[error.code] ?? error.message;
}
