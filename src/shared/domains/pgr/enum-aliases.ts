/**
 * Resolução de **sinônimos de enum** vindos do modelo — pura, sem rede.
 *
 * O prompt pede o valor canônico em inglês (o enum do banco), mas a conversa com o modelo
 * acontece em português e ele às vezes responde no idioma dela: `"Químico"` em vez de
 * `"chemical"`, `"EPI"` em vez de `"ppe"`. Sem tradução, o Zod reprova **item a item** e
 * uma resposta inteira e correta vira lista vazia — que, na tela, é indistinguível de "a
 * IA não encontrou nada". Foi assim que os dois primeiros agentes falhavam.
 *
 * O que **não** fazemos: aceitar valor desconhecido. A chave irreconhecível passa intacta
 * para o enum reprovar. Tolerar a forma da resposta não é aceitar qualquer conteúdo.
 */

/**
 * Chave comparável: minúsculas, sem acento, sem pontuação de borda e sem os prefixos de
 * ruído que o modelo gosta de anexar ("risco físico", "medida de eliminação").
 */
export function normalizeAliasKey(raw: string, noisePrefixes: RegExp): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(noisePrefixes, "")
    .trim();
}

/**
 * Constrói o `preprocess` do Zod para um enum com sinônimos. Tenta a chave normalizada e,
 * em seguida, a forma singular — o modelo alterna entre "acidente" e "acidentes" sem
 * critério.
 */
export function aliasPreprocessor<T extends string>(
  aliases: Readonly<Record<string, T>>,
  noisePrefixes: RegExp,
): (raw: unknown) => unknown {
  return (raw: unknown) => {
    if (typeof raw !== "string") return raw;
    const key = normalizeAliasKey(raw, noisePrefixes);
    return aliases[key] ?? aliases[key.replace(/s$/, "")] ?? key;
  };
}
