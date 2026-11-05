import listaC from "./lista-c.json";
import {
  normalizedListaCHash,
  validateListaCRows,
  type ListaCRow,
} from "./lista-c-parse";

/**
 * Lista C do Anexo II do Decreto 3.048/1999 (NTEP), importada verbatim da fonte oficial por
 * `scripts/medicine/import-ntep-lista-c.ts` (NOB-113, MED-16). Catálogo global de referência,
 * sem dado de pessoa. A correspondência é **epidemiológica e informativa**: não estabelece nexo
 * ocupacional individual, não conclui doença ocupacional, incapacidade, aptidão, necessidade de
 * CAT nem resultado pericial — isso é avaliação médica e decisão competente.
 */
export const NTEP_NOTICE =
  "Correspondência epidemiológica da Lista C (Decreto 3.048/1999, Anexo II): apoio informativo. Não estabelece nexo ocupacional individual nem substitui avaliação médica, análise previdenciária ou decisão pericial.";

export type ListaCSnapshot = {
  source: string;
  version: string;
  url: string;
  sha256: string;
  includedBy: string;
  annotation: string;
  note: string;
  extractedOn: string;
  crossChecks: { url: string; sha256: string }[];
  counts: { intervals: number; relations: number; distinctCnae: number };
  normalizedSha256: string;
  rows: ListaCRow[];
};

export type ListaCSource = Omit<ListaCSnapshot, "rows" | "note" | "crossChecks"> & {
  crossChecks: { url: string; sha256: string }[];
};

type Interval = {
  interval: string;
  letter: string;
  from: number;
  to: number;
  classes: Set<string>;
};

export type LoadedCatalog =
  | { status: "ready"; source: ListaCSource; intervals: Interval[] }
  | { status: "invalid"; reason: string }
  | { status: "unavailable" };

/** Revalida o snapshot (formato, contagens e hash normalizado) antes de responder qualquer consulta. */
export function loadListaC(snapshot: unknown): LoadedCatalog {
  if (!snapshot || typeof snapshot !== "object") return { status: "unavailable" };
  const s = snapshot as Partial<ListaCSnapshot>;
  if (!Array.isArray(s.rows) || !s.counts || !s.normalizedSha256 || !s.version)
    return {
      status: "invalid",
      reason: "Snapshot sem linhas, contagens, hash ou versão.",
    };
  const problems = validateListaCRows(s.rows);
  if (problems.length) return { status: "invalid", reason: problems[0] };
  const relations = s.rows.reduce((n, [, c]) => n + c.length, 0);
  const distinct = new Set(s.rows.flatMap(([, c]) => c)).size;
  if (
    s.rows.length !== s.counts.intervals ||
    relations !== s.counts.relations ||
    distinct !== s.counts.distinctCnae
  )
    return {
      status: "invalid",
      reason: "Contagens do snapshot não conferem com as linhas.",
    };
  if (normalizedListaCHash(s.rows) !== s.normalizedSha256)
    return { status: "invalid", reason: "Hash do catálogo normalizado não confere." };
  const intervals = s.rows.map(([interval, classes]) => {
    const [from, to = from] = interval.split("-");
    return {
      interval,
      letter: from[0],
      from: Number(from.slice(1)),
      to: Number(to.slice(1)),
      classes: new Set(classes),
    };
  });
  const { rows: _rows, note: _note, ...source } = s as ListaCSnapshot;
  void _rows;
  void _note;
  return { status: "ready", source, intervals };
}

const DEFAULT_CATALOG = loadListaC(listaC);

/** Fonte e versão do catálogo carregado (null se o snapshot não foi validado). */
export const NTEP_LISTA_C_SOURCE =
  DEFAULT_CATALOG.status === "ready" ? DEFAULT_CATALOG.source : null;

/** CID-10: letra + 2 dígitos, com subcategoria opcional (ex.: M54, M54.5, M545). Só formato. */
export function parseCid10(input: string): { code: string; category: string } | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z])(\d{2})(?:\.?(\d{1,2}))?$/.exec(raw);
  if (!m) return null;
  const category = `${m[1]}${m[2]}`;
  return { code: m[3] ? `${category}.${m[3]}` : category, category };
}

/**
 * Classe CNAE de 4 dígitos (Lista C compara por classe). Aceita a classe (4120), a classe com
 * dígito verificador (41.20-4) ou a subclasse (4120-4/00): vale a regra da Nota 1, "subclasses
 * cujos quatro dígitos iniciais sejam comuns". Não confere o DV nem a existência na CNAE.
 */
export function parseCnaeClass(input: string): string | null {
  const digits = input.replace(/[\s./-]/g, "");
  if (!/^\d+$/.test(digits) || ![4, 5, 7].includes(digits.length)) return null;
  return digits.slice(0, 4);
}

export type NtepLookupInput = {
  cid?: string | null;
  cnae?: string | null;
  version?: string | null;
};

type Found = { interval: string; cnaeClasses: string[] };
export type NtepLookup =
  | { kind: "invalid"; field: "cid" | "cnae" | "input"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "unvalidated"; message: string }
  | { kind: "version_not_available"; message: string; available: string }
  | {
      kind: "match" | "no_match";
      cid: string | null;
      cnaeClass: string | null;
      /** Intervalos que correspondem à consulta (com as classes CNAE da linha, se pedido só CID). */
      matches: Found[];
      source: ListaCSource;
      notice: string;
    };

/**
 * Consulta a matriz por CID-10, por classe CNAE ou pelo par. Distingue código inválido, catálogo
 * indisponível, catálogo não validado e versão inexistente de "sem correspondência".
 */
export function lookupNtep(
  input: NtepLookupInput,
  catalog: LoadedCatalog = DEFAULT_CATALOG,
): NtepLookup {
  const cidRaw = input.cid?.trim() || null;
  const cnaeRaw = input.cnae?.trim() || null;
  if (!cidRaw && !cnaeRaw)
    return {
      kind: "invalid",
      field: "input",
      message: "Informe um CID-10, uma classe CNAE ou ambos.",
    };
  const cid = cidRaw ? parseCid10(cidRaw) : null;
  if (cidRaw && !cid)
    return {
      kind: "invalid",
      field: "cid",
      message:
        "CID-10 inválido: use letra e dois dígitos, com subcategoria opcional (ex.: M54 ou M54.5).",
    };
  const cnaeClass = cnaeRaw ? parseCnaeClass(cnaeRaw) : null;
  if (cnaeRaw && !cnaeClass)
    return {
      kind: "invalid",
      field: "cnae",
      message:
        "CNAE inválido: informe a classe (4 dígitos, ex.: 4120) ou a subclasse (ex.: 4120-4/00).",
    };
  if (catalog.status === "unavailable")
    return {
      kind: "unavailable",
      message:
        "Catálogo da Lista C indisponível: não é possível afirmar correspondência nem ausência.",
    };
  if (catalog.status === "invalid")
    return {
      kind: "unvalidated",
      message: `Catálogo da Lista C não validado (${catalog.reason}): consulta suspensa.`,
    };
  if (input.version && input.version !== catalog.source.version)
    return {
      kind: "version_not_available",
      message: "Esta versão da Lista C não está disponível no catálogo.",
      available: catalog.source.version,
    };

  const matches: Found[] = catalog.intervals
    .filter((i) => {
      if (cid) {
        const letter = cid.category[0];
        const n = Number(cid.category.slice(1));
        if (letter !== i.letter || n < i.from || n > i.to) return false;
      }
      return cnaeClass ? i.classes.has(cnaeClass) : true;
    })
    .map((i) => ({
      interval: i.interval,
      cnaeClasses: cnaeClass ? [cnaeClass] : [...i.classes],
    }));
  return {
    kind: matches.length ? "match" : "no_match",
    cid: cid?.code ?? null,
    cnaeClass,
    matches,
    source: catalog.source,
    notice: NTEP_NOTICE,
  };
}
