import { z } from "zod";

import { aliasPreprocessor } from "./enum-aliases";
import { trainingPeriodicitySchema, type TrainingPeriodicity } from "./trainings";

/**
 * Domínio puro da **sugestão de treinamentos obrigatórios por função**. Espelha o
 * subconjunto de `training_catalog` que o LLM preenche e casa a sugestão com o catálogo
 * que a organização já tem. Sem acesso a banco nem ao provedor — só regras/validação.
 *
 * Por que existe: `job_role_required_trainings` vive vazia na prática porque preenchê-la
 * exige saber de cabeça qual NR cada função puxa. É conhecimento normativo estável —
 * exatamente o que um modelo faz bem e o que ninguém gosta de pesquisar item a item.
 */

/** `kind` gravado em `ai_usage_events` para o rate limiting por organização. */
export const AI_TRAINING_SUGGESTION_KIND = "training_suggestion";

/** Teto por rodada (protege contexto e UI). */
export const MAX_TRAINING_SUGGESTIONS = 10;

const optionalText = z.preprocess(
  (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
  z.string().trim().min(1).optional(),
);

/** Periodicidade em pt-BR → enum do banco. Mesma razão do `normalizeAgentType`. */
const PERIODICITY_ALIASES: Record<string, TrainingPeriodicity> = {
  anual: "annual",
  bianual: "biennial",
  bienal: "biennial",
  trienal: "triennial",
  quinquenal: "quinquennial",
  unica: "single",
  unico: "single",
  "uma vez": "single",
  "sem reciclagem": "single",
};

const PERIODICITY_NOISE = /^(periodicidade|reciclagem)s?\s+(de\s+)?/;

export const normalizeTrainingPeriodicity = aliasPreprocessor(
  PERIODICITY_ALIASES,
  PERIODICITY_NOISE,
);

/**
 * Um treinamento sugerido pela IA. `workloadHours` é coagido de texto porque o modelo
 * responde `"8"` tanto quanto `8`; carga fora de 1–200h é recusada — NR nenhuma pede mais
 * que isso, e número absurdo denuncia alucinação.
 */
export const suggestedTrainingSchema = z.object({
  name: z.string().trim().min(1, "Nome do treinamento é obrigatório"),
  referenceNorm: optionalText,
  periodicity: z.preprocess(normalizeTrainingPeriodicity, trainingPeriodicitySchema),
  workloadHours: z.coerce
    .number()
    .int("Carga horária deve ser inteira")
    .min(1, "Carga horária deve ser maior que zero")
    .max(200, "Carga horária acima do plausível para um treinamento de NR"),
  rationale: optionalText,
});

export type SuggestedTraining = z.infer<typeof suggestedTrainingSchema>;

/** Sugestão já confrontada com o catálogo da organização. */
export type MatchedTrainingSuggestion = SuggestedTraining & {
  /** Id no catálogo quando já existe; `null` quando o aceite terá de criá-lo. */
  trainingId: string | null;
  /** Já vinculado a esta função — mostrado como informação, não como proposta. */
  alreadyRequired: boolean;
};

/** Entrada da ação de aceite: os treinamentos selecionados/revisados pelo usuário. */
export const acceptSuggestedTrainingsInputSchema = z.object({
  suggestions: z
    .array(
      suggestedTrainingSchema.extend({
        trainingId: z.uuid().nullish(),
      }),
    )
    .min(1)
    .max(MAX_TRAINING_SUGGESTIONS),
});

export type AcceptSuggestedTrainingsInput = z.input<
  typeof acceptSuggestedTrainingsInputSchema
>;

export type AcceptedTraining = z.output<
  typeof acceptSuggestedTrainingsInputSchema
>["suggestions"][number];

/** Item do catálogo da organização, como entra no prompt e na conciliação. */
export type CatalogEntry = {
  id: string;
  name: string;
  periodicity: string;
  isActive: boolean;
};

/**
 * Contexto **não-PII** enviado ao LLM: o título da função, os riscos aos quais ela está
 * exposta e o catálogo que a organização já mantém. Nunca `employees`.
 */
export type JobRoleTrainingContext = {
  jobRoleTitle: string;
  gesNames: string[];
  risks: { agentType: string; hazard: string | null; description: string }[];
  catalog: CatalogEntry[];
  /** Ids de treinamento já obrigatórios para a função — evita propor o que já existe. */
  requiredTrainingIds: string[];
};

/** Palavras sem valor discriminante num nome de treinamento. */
const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "a",
  "o",
  "as",
  "os",
  "para",
  "com",
  "nr",
  "norma",
  "treinamento",
  "capacitacao",
  "curso",
]);

/**
 * Tokens comparáveis de um nome de treinamento: minúsculas, sem acento, sem pontuação,
 * sem stopword e sem plural. O plural cai porque o catálogo diz "Espaço Confinado" e a
 * norma diz "Espaços Confinados" — é o mesmo curso.
 */
export function trainingNameTokens(name: string): Set<string> {
  const tokens = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t !== "" && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
  return new Set(tokens);
}

/**
 * Dois nomes designam o mesmo curso quando o conjunto menor de tokens está contido no
 * maior. É o que reconcilia "Trabalho em Altura" (catálogo) com "NR-35 — Trabalho em
 * Altura" (resposta do modelo): sem isso, aceitar a sugestão criaria um curso duplicado
 * ao lado do que a organização já mantém.
 *
 * Exige **dois** tokens em comum de propósito. Com um só, "Segurança em Instalações
 * Elétricas" casaria com "Segurança na Construção" — e um vínculo errado é pior que um
 * cadastro a mais.
 */
export function sameTrainingName(a: string, b: string): boolean {
  const ta = trainingNameTokens(a);
  const tb = trainingNameTokens(b);
  const [menor, maior] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (menor.size < 2) return false;
  for (const token of menor) if (!maior.has(token)) return false;
  return true;
}

/** Chave de deduplicação da própria resposta do modelo (nome normalizado simples). */
export function trainingNameKey(name: string): string {
  return [...trainingNameTokens(name)].sort().join(" ");
}

/**
 * Valida a saída crua **item a item** (descarta o inválido sem derrubar o lote), remove
 * nome repetido e aplica o teto. Lista vazia é resultado válido. Aceita `unknown[]` ou
 * `{ trainings: [...] }`.
 */
export function parseModelTrainings(raw: unknown): SuggestedTraining[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { trainings?: unknown }).trainings)
      ? (raw as { trainings: unknown[] }).trainings
      : null;
  if (!arr) return [];

  const seen = new Set<string>();
  const out: SuggestedTraining[] = [];
  for (const item of arr) {
    const parsed = suggestedTrainingSchema.safeParse(item);
    if (!parsed.success) continue;
    const key = trainingNameKey(parsed.data.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
    if (out.length >= MAX_TRAINING_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Casa cada sugestão com o catálogo da organização por tokens (ver `sameTrainingName`) e
 * adota o nome do catálogo quando houver acerto — igualdade literal falharia justamente
 * nos casos que importam, já que o modelo prefixa "NR-35 — " no que o catálogo guarda como
 * "Trabalho em Altura".
 */
export function matchAgainstCatalog(
  suggestions: readonly SuggestedTraining[],
  catalog: readonly CatalogEntry[],
  requiredTrainingIds: readonly string[],
): MatchedTrainingSuggestion[] {
  const required = new Set(requiredTrainingIds);
  return suggestions.map((s) => {
    const hit = catalog.find((c) => sameTrainingName(c.name, s.name));
    return {
      ...s,
      // Vale o nome do catálogo quando casou: é o que a organização já reconhece.
      name: hit ? hit.name : s.name,
      trainingId: hit?.id ?? null,
      alreadyRequired: hit != null && required.has(hit.id),
    };
  });
}

export type TrainingDraft = {
  name: string;
  referenceNorm: string;
  periodicity: string;
  workloadHours: string;
};

export type TrainingDraftField = keyof TrainingDraft;

export function toTrainingDraft(s: SuggestedTraining): TrainingDraft {
  return {
    name: s.name,
    referenceNorm: s.referenceNorm ?? "",
    periodicity: s.periodicity,
    workloadHours: String(s.workloadHours),
  };
}

export function trainingDraftErrors(
  draft: TrainingDraft,
): Partial<Record<TrainingDraftField, string>> {
  const errors: Partial<Record<TrainingDraftField, string>> = {};
  if (draft.name.trim() === "") errors.name = "Informe o nome do treinamento.";
  if (!trainingPeriodicitySchema.safeParse(draft.periodicity).success) {
    errors.periodicity = "Informe a periodicidade.";
  }
  if (
    !suggestedTrainingSchema.shape.workloadHours.safeParse(draft.workloadHours).success
  ) {
    errors.workloadHours = "Informe uma carga horária inteira entre 1 e 200 horas.";
  }
  return errors;
}

function sameCatalogName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function findCatalogEntry(
  name: string,
  catalog: readonly CatalogEntry[],
): CatalogEntry | undefined {
  return catalog.find((c) => c.isActive && sameCatalogName(c.name, name));
}

export function findInactiveCatalogEntry(
  name: string,
  catalog: readonly CatalogEntry[],
): CatalogEntry | undefined {
  return catalog.find((c) => !c.isActive && sameCatalogName(c.name, name));
}
