/**
 * Importa a Tabela 27 (Procedimentos Diagnósticos) do anexo oficial de tabelas do
 * eSocial para `src/shared/domains/medicine/procedures/esocial-table-27.json`.
 *
 * Nada é digitado à mão: código e descrição saem do HTML oficial, verbatim (inclusive
 * eventuais erros de grafia da fonte). Para atualizar, baixe o `tabelas.html` da versão
 * vigente em https://www.gov.br/esocial/pt-br/documentacao-tecnica e rode:
 *
 *   npx tsx scripts/medicine/import-esocial-table-27.ts <tabelas.html> "<versão>" "<url>"
 *
 * Revise o diff (códigos incluídos/excluídos) antes de commitar.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { format, resolveConfig } from "prettier";

const [, , htmlPath, version, url] = process.argv;
if (!htmlPath || !version || !url) {
  console.error(
    'Uso: npx tsx scripts/medicine/import-esocial-table-27.ts <tabelas.html> "<versão>" "<url>"',
  );
  process.exit(1);
}

const raw = readFileSync(htmlPath);
const BOM = String.fromCharCode(0xfeff);
const html = raw.toString("utf8").replace(BOM, "");
const start = html.indexOf('<table id="27"');
if (start < 0) throw new Error("Tabela 27 não encontrada no HTML.");
const table = html.slice(start, html.indexOf("</table>", start));

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
};
const text = (cell: string) =>
  cell
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (_, e: string) =>
      e.startsWith("#")
        ? String.fromCharCode(Number(e.slice(1)))
        : (ENTITIES[e] ?? `&${e};`),
    )
    .replace(/\s+/g, " ")
    .trim();

const procedures: [string, string][] = [];
for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
  const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
  if (cells.length === 2 && /^\d{4}$/.test(cells[0]))
    procedures.push([cells[0], cells[1]]);
}
const codes = new Set(procedures.map(([code]) => code));
if (codes.size !== procedures.length) throw new Error("Código duplicado na fonte.");
if (procedures.length < 1000)
  throw new Error(`Poucas linhas lidas (${procedures.length}).`);

const out = resolve("src/shared/domains/medicine/procedures/esocial-table-27.json");
const json = JSON.stringify({
  source: "eSocial — Anexo I dos leiautes, Tabela 27 (Procedimentos Diagnósticos)",
  version,
  url,
  sha256: createHash("sha256").update(raw).digest("hex"),
  importedOn: new Date().toISOString().slice(0, 10),
  count: procedures.length,
  procedures,
});
// Mesmo formato do `prettier --check` do CI: reimportar não gera diff de formatação.
void (async () => {
  const options = { ...(await resolveConfig(out)), parser: "json" };
  writeFileSync(out, await format(json, options));
  console.log(`${procedures.length} procedimentos gravados em ${out}`);
})();
