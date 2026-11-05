/**
 * Importa a Lista C do Anexo II do Decreto 3.048/1999 (NTEP: intervalos CID-10 × classes CNAE)
 * para `src/shared/domains/medicine/ntep/lista-c.json` (NOB-113, MED-16).
 *
 * Nada é digitado à mão: intervalos e classes saem do HTML oficial, verbatim e na ordem da
 * fonte. A fonte primária é o texto atualizado da Câmara dos Deputados; as demais (Planalto:
 * anexo compilado e o Decreto 6.957/2009 original) são conferências — qualquer divergência
 * interrompe a importação. Para atualizar, baixe as páginas oficiais e rode:
 *
 *   npx tsx scripts/medicine/import-ntep-lista-c.ts <camara.html> "<versão>" \
 *     [<conferencia.htm> <url-da-conferencia>]...
 *
 * Revise o diff (intervalos/classes incluídos ou excluídos) antes de commitar; uma alteração
 * normativa vira nova versão do snapshot, nunca edição manual.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { format, resolveConfig } from "prettier";

import {
  LISTA_C_HEADER,
  extractListaC,
  normalizedListaCHash,
  validateListaCRows,
} from "../../src/shared/domains/medicine/ntep/lista-c-parse";

const PRIMARY_URL =
  "https://www2.camara.leg.br/legin/fed/decret/1999/decreto-3048-6-maio-1999-368532-normaatualizada-pe.html";

const [, , primaryPath, version, ...checks] = process.argv;
if (!primaryPath || !version || checks.length % 2 !== 0) {
  console.error(
    'Uso: npx tsx scripts/medicine/import-ntep-lista-c.ts <camara.html> "<versão>" [<conferencia.htm> <url>]...',
  );
  process.exit(1);
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const decode = (raw: Buffer) => {
  const utf8 = raw.toString("utf8");
  // Páginas do Planalto vêm em windows-1252; a da Câmara, em UTF-8.
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(raw) : utf8;
};

const primaryRaw = readFileSync(primaryPath);
const primary = extractListaC(decode(primaryRaw));
const problems = validateListaCRows(primary.rows);
if (problems.length) throw new Error(`Fonte primária inválida:\n${problems.join("\n")}`);

const crossChecks = [];
for (let i = 0; i < checks.length; i += 2) {
  const raw = readFileSync(checks[i]);
  const other = extractListaC(decode(raw));
  if (JSON.stringify(other.rows) !== JSON.stringify(primary.rows))
    throw new Error(`A conferência ${checks[i]} diverge da fonte primária.`);
  crossChecks.push({
    url: checks[i + 1],
    sha256: sha256(raw),
    annotation: other.annotation,
  });
}

const relations = primary.rows.reduce((n, [, cnaes]) => n + cnaes.length, 0);
const out = resolve("src/shared/domains/medicine/ntep/lista-c.json");
const json = JSON.stringify({
  source:
    "Decreto nº 3.048/1999 (Regulamento da Previdência Social), Anexo II, Lista C — Nexo Técnico Epidemiológico Previdenciário",
  header: LISTA_C_HEADER,
  includedBy: "Decreto nº 6.957, de 9 de setembro de 2009",
  annotation: primary.annotation,
  note: primary.note,
  version,
  url: PRIMARY_URL,
  sha256: sha256(primaryRaw),
  crossChecks,
  extractedOn: new Date().toISOString().slice(0, 10),
  counts: {
    intervals: primary.rows.length,
    relations,
    distinctCnae: new Set(primary.rows.flatMap(([, cnaes]) => cnaes)).size,
  },
  normalizedSha256: normalizedListaCHash(primary.rows),
  rows: primary.rows,
});
// Mesmo formato do `prettier --check` do CI: reimportar não gera diff de formatação.
void (async () => {
  const options = { ...(await resolveConfig(out)), parser: "json" };
  writeFileSync(out, await format(json, options));
  console.log(
    `${primary.rows.length} intervalos, ${relations} relações gravados em ${out} (${crossChecks.length} conferência(s) idênticas)`,
  );
})();
