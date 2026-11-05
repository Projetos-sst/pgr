import { createHash } from "node:crypto";

/**
 * Extração e validação da Lista C (Anexo II do Decreto 3.048/1999) a partir do HTML oficial
 * (NOB-113). Usado pelo importador e pelos testes; nunca completa nem corrige códigos.
 *
 * Semântica da fonte (Nota 1 da Lista C): cada linha indica um intervalo CID-10 e as classes
 * CNAE (4 dígitos) daquela linha, "nelas incluídas todas as subclasses cujos quatro dígitos
 * iniciais sejam comuns". As relações são par a par dentro da linha — nunca o produto
 * cartesiano entre linhas.
 */
export type ListaCRow = [interval: string, cnaeClasses: string[]];

export const LISTA_C_HEADER = ["INTERVALO CID-10", "CNAE"] as const;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
  ordm: "º",
  ordf: "ª",
  sect: "§",
  deg: "°",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] !== "#") return ENTITIES[entity.toLowerCase()] ?? match;
      const hex = entity[1] === "x" || entity[1] === "X";
      return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    })
    .replace(/\s+/g, " ")
    .trim();
}

const INTERVAL = /^([A-Z])(\d{2})(?:-([A-Z])(\d{2}))?$/;
const CNAE_CLASS = /^\d{4}$/;

export type ListaCExtraction = {
  /** Anotação oficial junto ao título (ex.: "(Lista acrescida pelo Decreto nº 6.957, ...)"). */
  annotation: string;
  /** Nota 1 da lista, verbatim. */
  note: string;
  rows: ListaCRow[];
};

/**
 * Lê a Lista C do texto oficial: do título "LISTA C" (seguido do cabeçalho da matriz) até o
 * próximo anexo. Qualquer token que não seja intervalo CID-10, classe CNAE de 4 dígitos ou o
 * cabeçalho interrompe — fonte truncada ou com formato inesperado não é importada.
 */
export function extractListaC(html: string): ListaCExtraction {
  const text = htmlToText(html);
  const header = LISTA_C_HEADER.join(" ");
  const titles = [...text.matchAll(/LISTA C\b/g)].map((m) => m.index ?? 0);
  const start = titles.find((i) => text.slice(i, i + 3000).includes(header));
  if (start === undefined) throw new Error("Lista C não encontrada na fonte.");
  const rest = text.slice(start);
  const stop = rest.search(/ANEXO (?:III|IV|V)\b|Bras[ií]lia,/);
  // Aspas que abrem o título do anexo seguinte (no Planalto, às vezes mal codificadas: U+0093).
  const section = (stop > 0 ? rest.slice(0, stop) : rest).replace(
    /["\u0093\u201c]\s*$/,
    "",
  );

  const noteStart = section.indexOf("Nota:");
  const noteEnd = section.indexOf(header);
  if (noteStart < 0 || noteEnd < noteStart) throw new Error("Nota da Lista C ausente.");
  const annotation = section.slice("LISTA C".length, noteStart).trim();
  const note = section.slice(noteStart, noteEnd).trim();

  const rows: ListaCRow[] = [];
  const tokens = section.slice(noteEnd).split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "INTERVALO" && tokens[i + 1] === "CID-10" && tokens[i + 2] === "CNAE") {
      i += 2;
    } else if (INTERVAL.test(token)) {
      rows.push([token, []]);
    } else if (CNAE_CLASS.test(token) && rows.length) {
      rows[rows.length - 1][1].push(token);
    } else {
      throw new Error(
        `Token inesperado na Lista C: "${token}" (${[...token].map((c) => c.codePointAt(0)?.toString(16)).join(" ")}) perto de "${tokens.slice(Math.max(0, i - 3), i + 3).join(" ")}".`,
      );
    }
  }
  return { annotation, note, rows };
}

/** Problemas de integridade (lista vazia = válida). Não corrige nada. */
export function validateListaCRows(rows: readonly ListaCRow[]): string[] {
  const problems: string[] = [];
  if (rows.length === 0) problems.push("Nenhum intervalo encontrado.");
  const seen = new Set<string>();
  const ranges: { interval: string; letter: string; from: number; to: number }[] = [];
  for (const [interval, classes] of rows) {
    const m = INTERVAL.exec(interval);
    if (!m) {
      problems.push(`Intervalo CID-10 inválido: ${interval}.`);
      continue;
    }
    const [, letter, from, toLetter = letter, to = from] = m;
    if (toLetter !== letter)
      problems.push(`Intervalo com letras diferentes: ${interval}.`);
    if (Number(to) < Number(from)) problems.push(`Intervalo invertido: ${interval}.`);
    if (seen.has(interval)) problems.push(`Intervalo repetido: ${interval}.`);
    seen.add(interval);
    ranges.push({ interval, letter, from: Number(from), to: Number(to) });
    if (classes.length === 0) problems.push(`Intervalo sem classes CNAE: ${interval}.`);
    const bad = classes.filter((c) => !CNAE_CLASS.test(c));
    if (bad.length)
      problems.push(`Classe CNAE inválida em ${interval}: ${bad.join(", ")}.`);
    if (new Set(classes).size !== classes.length)
      problems.push(`Classe CNAE repetida em ${interval}.`);
  }
  for (const a of ranges)
    for (const b of ranges)
      if (
        a.interval < b.interval &&
        a.letter === b.letter &&
        a.from <= b.to &&
        b.from <= a.to
      )
        problems.push(`Intervalos sobrepostos: ${a.interval} e ${b.interval}.`);
  return problems;
}

/** Hash do catálogo normalizado (linhas na ordem da fonte). */
export function normalizedListaCHash(rows: readonly ListaCRow[]): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
