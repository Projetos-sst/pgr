/**
 * Retorno de erro dos formulários da Medicina (NOB-112): cada erro de campo do
 * `ActionResult` (chave = caminho Zod unido por ".", ex.: `participants.1.role`)
 * aparece junto ao campo ou à seção que o formulário mostra; o que não tem lugar
 * na tela vira item legível no resumo do formulário ("Participante 2 — função: …"),
 * nunca o caminho cru nem o texto padrão do Zod em inglês. Erro sem campos
 * (permissão, sessão, regra do servidor) segue como mensagem do formulário e nunca
 * vira erro de validação. Puro (sem server-only): usado pelos formulários cliente.
 */

type ErrorLike = { code?: string; message?: string; fields?: Record<string, string> };

export type FormFeedback = {
  /** Resumo no topo do formulário (null = nada a mostrar). */
  formError: string | null;
  /** Erros sem lugar próprio na tela, já em texto legível. */
  details: string[];
  /** Erros mostrados junto ao campo ou à seção, pela chave do contrato. */
  fields: Record<string, string>;
};

export const EMPTY_FORM_FEEDBACK: FormFeedback = {
  formError: null,
  details: [],
  fields: {},
};

export type PathSegment = string | number;
export type DescribePath = (path: readonly PathSegment[]) => string | null;

export const GENERIC_INVALID_VALUE = "Valor inválido.";
export const UNEXPECTED_FORM_ERROR =
  "Não foi possível concluir a operação. Tente novamente.";

// Texto padrão do Zod (locale en) que vaza quando o schema não tem mensagem própria.
const ZOD_DEFAULT = /^(Invalid\b|Too (small|big)\b|Unrecognized key)/;
// Mensagem que é só um código (ex.: "FORBIDDEN") não serve para a UI.
const CODE_LIKE = /^[A-Z][A-Z0-9_]*\.?$/;

const CODE_FALLBACK: Record<string, string> = {
  FORBIDDEN: "Você não tem permissão para esta operação.",
  NO_TENANT_CONTEXT: "Selecione um escritório para continuar.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente para continuar.",
  NOT_FOUND: "Registro não encontrado. Ele pode ter sido removido.",
  FK_NOT_FOUND: "Referência não encontrada neste escritório.",
  DUPLICATE: "Registro já existe neste escritório.",
  VALIDATION: "Revise os dados informados.",
};

/** Mensagem pronta para a tela; texto padrão do Zod ou código cru dão lugar ao `fallback`. */
export function readableMessage(message: string | undefined, fallback: string): string {
  const text = message?.trim() ?? "";
  if (!text || ZOD_DEFAULT.test(text) || CODE_LIKE.test(text)) return fallback;
  return text;
}

/** `participants.1.role` → `["participants", 1, "role"]`; a raiz (`_`) vira `[]`. */
export function parseFieldPath(key: string): PathSegment[] {
  if (key === "" || key === "_") return [];
  return key.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/**
 * Rótulos legíveis por caminho: `fields` para chaves simples ou aninhadas
 * (`identity.registration.council`) e `lists` para itens de lista
 * (`participants.1.name` → "Participante 2 — nome").
 */
export function pathDescriber(spec: {
  fields?: Record<string, string>;
  lists?: Record<string, { item: string; fields?: Record<string, string> }>;
}): DescribePath {
  return (path) => {
    const [head, index, ...rest] = path;
    const list = typeof head === "string" ? spec.lists?.[head] : undefined;
    if (list && typeof index === "number") {
      const item = `${list.item} ${index + 1}`;
      if (rest.length === 0) return item;
      const field = list.fields?.[rest.join(".")];
      return field ? `${item} — ${field}` : item;
    }
    if (path.some((part) => typeof part === "number")) return null;
    return spec.fields?.[path.join(".")] ?? null;
  };
}

/**
 * Traduz o erro do `ActionResult` para o formulário. `slots` são as chaves que a
 * tela mostra junto ao campo ou à seção; as demais viram `details`.
 */
export function formFeedback(
  error: ErrorLike,
  options: { slots: readonly string[]; describe?: DescribePath },
): FormFeedback {
  const entries = Object.entries(error.fields ?? {});
  if (entries.length === 0) {
    const fallback = CODE_FALLBACK[error.code ?? ""] ?? UNEXPECTED_FORM_ERROR;
    return {
      formError: readableMessage(error.message, fallback),
      details: [],
      fields: {},
    };
  }
  const slots = new Set(options.slots);
  const fields: Record<string, string> = {};
  const details: string[] = [];
  for (const [key, raw] of entries) {
    const message = readableMessage(raw, GENERIC_INVALID_VALUE);
    if (slots.has(key)) {
      fields[key] = message;
      continue;
    }
    const label = options.describe?.(parseFieldPath(key)) ?? null;
    const line = label ? `${label}: ${message}` : message;
    if (!details.includes(line)) details.push(line);
  }
  const formError =
    details.length === 0
      ? "Revise os campos destacados."
      : Object.keys(fields).length === 0
        ? "Revise os pontos abaixo."
        : "Revise os campos destacados e os pontos abaixo.";
  return { formError, details, fields };
}

/** Falha inesperada (ex.: rede, erro não mapeado no servidor): mensagem segura, sem detalhe. */
export function unexpectedFormFeedback(): FormFeedback {
  return { formError: UNEXPECTED_FORM_ERROR, details: [], fields: {} };
}

/**
 * Linhas de lista totalmente em branco não são enviadas (a linha vazia padrão da
 * tela); as demais seguem na ordem, guardando o índice da tela de cada uma para
 * o erro do servidor voltar à linha certa.
 */
export function compactRows<T>(
  rows: readonly T[],
  isBlank: (row: T) => boolean,
): { values: T[]; indexes: number[] } {
  const values: T[] = [];
  const indexes: number[] = [];
  rows.forEach((row, index) => {
    if (isBlank(row)) return;
    values.push(row);
    indexes.push(index);
  });
  return { values, indexes };
}

/** Troca o índice enviado (`list.k.*`) pelo índice da linha na tela. */
export function remapListIndexes(
  fields: Record<string, string> | undefined,
  list: string,
  indexes: readonly number[],
): Record<string, string> | undefined {
  if (!fields) return fields;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(fields)) {
    const [head, index, ...rest] = key.split(".");
    const shown =
      head === list && index !== undefined && /^\d+$/.test(index)
        ? indexes[Number(index)]
        : undefined;
    const next = shown === undefined ? key : [list, String(shown), ...rest].join(".");
    if (!Object.hasOwn(out, next)) out[next] = message;
  }
  return out;
}
