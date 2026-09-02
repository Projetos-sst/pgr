import { z } from "zod";

/**
 * Coerção de texto tolerante à forma que o modelo escolhe — **pura**, sem rede.
 *
 * Um campo que pede "passos concretos, na ordem" convida o modelo a responder com uma
 * lista JSON em vez de uma string, e um campo numérico às vezes volta como número. Antes
 * disso existir, um plano 5W2H completo e correto era **descartado inteiro** porque `how`
 * chegava como `string[]`: a validação do framework roda antes de qualquer código nosso,
 * então o conteúdo bom nunca chegava ao domínio. Retry não resolvia — a preferência do
 * modelo por lista é determinística, então as três tentativas falhavam igual.
 *
 * Formato não é conteúdo: quando a resposta traz a informação pedida, quem se adapta é o
 * nosso schema.
 */

/** Item de lista → linha numerada; o resto vira texto simples. */
function flatten(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter((item) => item !== "");
    // Numerado só quando é de fato uma sequência: um item só não é uma lista de passos.
    return items.length > 1
      ? items.map((item, i) => `${i + 1}. ${item}`).join("\n")
      : (items[0] ?? "");
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return value;
}

/**
 * Campo de texto que aceita `string`, `string[]` (vira lista numerada) ou número.
 * `describe()` é repassado ao schema final porque, com `jsonPromptInjection`, a descrição
 * vira parte do prompt — perdê-la degradaria a instrução dada ao modelo.
 */
export function flexibleText(description: string) {
  return z.preprocess(flatten, z.string().describe(description));
}

/** Idem, para campo opcional: ausente, `null` ou vazio depois de achatado → `undefined`. */
export function flexibleOptionalText(description: string) {
  return z.preprocess((v) => {
    const flat = flatten(v);
    return flat == null || (typeof flat === "string" && flat.trim() === "")
      ? undefined
      : flat;
  }, z.string().optional().describe(description));
}
