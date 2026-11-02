/**
 * Mensagens de erro da Medicina para a interface. O código do contrato
 * (`FORBIDDEN`, `VALIDATION`…) continua no `ActionResult` e no REST; aqui ele vira
 * texto para pessoas, sem expor código técnico, detalhe interno nem conteúdo
 * clínico. Puro (sem server-only): usado por páginas e pelo formulário de exame.
 */

type ErrorLike = { code: string; message: string; fields?: Record<string, string> };

const ERROR_LABELS: Record<string, string> = {
  FORBIDDEN: "Acesso não permitido",
  NO_TENANT_CONTEXT: "Escritório não selecionado",
  UNAUTHORIZED: "Sessão expirada",
  VALIDATION: "Dados inválidos",
  NOT_FOUND: "Não encontrado",
  FK_NOT_FOUND: "Referência não encontrada",
};

/** Rótulo curto para a linha de apoio do `ListErrorState` (no lugar do código cru). */
export function medicineErrorLabel(code: string): string {
  return ERROR_LABELS[code] ?? "Erro inesperado";
}

// Mensagem que é só um código (ex.: "FORBIDDEN", "NOT_FOUND") não serve para a UI.
const CODE_LIKE = /^[A-Z][A-Z0-9_]*$/;

const FORM_FALLBACK: Record<string, string> = {
  FORBIDDEN:
    "Você não tem permissão para esta operação, ou a Medicina do Trabalho não está habilitada para a empresa deste funcionário.",
  NO_TENANT_CONTEXT: "Selecione um escritório para continuar.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente para continuar.",
  NOT_FOUND: "Exame não encontrado neste escritório. Ele pode ter sido removido.",
  FK_NOT_FOUND: "Funcionário ou médico não encontrado neste escritório.",
  VALIDATION: "Revise os campos destacados.",
};

const MODULE_DISABLED_SERVER_MESSAGE = "Serviço não habilitado para esta empresa.";

export type HealthExamFormFeedback = {
  formError: string | null;
  fields: Record<string, string>;
};

/**
 * Traduz o erro de criar/editar exame para o formulário: erros de campo ficam
 * junto ao campo; o resumo nunca mostra código técnico. Mensagens de regra do
 * servidor (`ValidationError`, referência não encontrada) já são frases em PT e
 * passam como estão.
 */
export function healthExamFormFeedback(error: ErrorLike): HealthExamFormFeedback {
  const fields = error.fields ?? {};
  if (Object.keys(fields).length > 0) {
    return { formError: FORM_FALLBACK.VALIDATION, fields };
  }
  if (error.code === "FORBIDDEN" && error.message === MODULE_DISABLED_SERVER_MESSAGE) {
    return {
      formError:
        "A Medicina do Trabalho não está habilitada para a empresa deste funcionário (Empresas → Serviços).",
      fields: {},
    };
  }
  const known = FORM_FALLBACK[error.code];
  const message = error.message?.trim() ?? "";
  if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
    return { formError: known, fields: {} };
  }
  if (message && !CODE_LIKE.test(message) && error.code in FORM_FALLBACK) {
    return { formError: message, fields: {} };
  }
  return {
    formError: known ?? "Não foi possível salvar o exame. Tente novamente.",
    fields: {},
  };
}
