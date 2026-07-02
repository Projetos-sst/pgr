/**
 * Parse contra a fixture REAL `caepi-sample.csv.gz` — linhas cortadas do
 * download oficial de 2026-07-02 (`RelatorioCA_20260702_100356.csv.gz`),
 * preservando os bytes reais: BOM DUPLO no início (efbbbf 2×, como o arquivo
 * real), campos entre aspas com `;` interno, acentuação UTF-8, e o trailer
 * HTML da página ASPX anexado após o gzip (fato do spike T018). A linha com
 * quebra de linha interna (CA 29) foi ADAPTADA de uma linha real — o caso
 * existe no formato, mas não ocorria na carga de 2026-07-02. Duas linhas
 * quebradas de propósito: uma com 3 colunas e uma com data `99/99/9999`.
 * Asserts validados à mão contra a amostra (spec — IA não aprova sozinha).
 */
import { createReadStream } from "node:fs";
import path from "node:path";

import { parseCaepiCsv } from "@/shared/integrations/caepi/parse";
import type { CaepiParsedRow } from "@/shared/integrations/caepi/types";

const FIXTURES_DIR = path.resolve(process.cwd(), "src/__tests__/integration/_fixtures");

async function parseFixture(name: string, batchSize?: number) {
  const rows: CaepiParsedRow[] = [];
  const batchSizes: number[] = [];
  const discards: Array<{ reason: string; line: number }> = [];
  const stats = await parseCaepiCsv(
    createReadStream(path.join(FIXTURES_DIR, name)),
    async (batch) => {
      rows.push(...batch);
      batchSizes.push(batch.length);
    },
    { batchSize, onDiscard: (reason, line) => discards.push({ reason, line }) },
  );
  return { rows, discards, stats, batchSizes };
}

describe("parseCaepiCsv (fixture real)", () => {
  it("parseia as linhas válidas e descarta as corrompidas SEM abortar a carga", async () => {
    const { rows, stats, discards } = await parseFixture("caepi-sample.csv.gz");
    expect(stats).toEqual({ parsed: 5, discarded: 2 });
    expect(rows.map((r) => r.ca)).toEqual(["53080", "13", "126", "31469", "29"]);
    expect(discards).toHaveLength(2);
  });

  it("remove o BOM (duplo, como no arquivo real) e decodifica acentos UTF-8", async () => {
    const { rows } = await parseFixture("caepi-sample.csv.gz");
    expect(rows[0].ca).toBe("53080");
    expect(rows[0].equipmentName).toBe("LUVA DE MALHA DE AÇO");
    expect(rows[0].situation).toBe("VÁLIDO");
  });

  it("campo entre aspas com `;` interno é UM campo (19 colunas preservadas)", async () => {
    const { rows } = await parseFixture("caepi-sample.csv.gz");
    const ca126 = rows.find((r) => r.ca === "126");
    expect(ca126).toBeDefined();
    expect(ca126?.equipmentName).toBe(
      "LUVA PARA PROTEÇÃO CONTRA AGENTES ABRASIVOS E ESCORIANTES",
    );
  });

  it("campo entre aspas com quebra de linha interna é UM campo", async () => {
    const { rows } = await parseFixture("caepi-sample.csv.gz");
    const ca29 = rows.find((r) => r.ca === "29");
    expect(ca29?.description).toContain("\r\n");
  });

  it("converte DATA DE VALIDADE dd/mm/aaaa → YYYY-MM-DD", async () => {
    const { rows } = await parseFixture("caepi-sample.csv.gz");
    expect(rows.find((r) => r.ca === "53080")?.validUntil).toBe("2031-01-16");
    expect(rows.find((r) => r.ca === "13")?.validUntil).toBe("2006-06-26");
    expect(rows.find((r) => r.ca === "31469")?.validUntil).toBe("2028-05-23");
  });

  it("descarta com motivo/linha: contagem de colunas e data inválida", async () => {
    const { discards, rows } = await parseFixture("caepi-sample.csv.gz");
    expect(discards.some((d) => d.reason.includes("colunas"))).toBe(true);
    expect(discards.some((d) => d.reason.includes("data de validade"))).toBe(true);
    expect(discards.every((d) => d.line > 0)).toBe(true);
    expect(rows.some((r) => r.ca === "99991" || r.ca === "99992")).toBe(false);
  });

  it("campos vazios viram null (colunas anuláveis)", async () => {
    const { rows } = await parseFixture("caepi-sample.csv.gz");
    const ca13 = rows.find((r) => r.ca === "13");
    expect(ca13?.description).toBeNull();
    expect(ca13?.norms).toBeNull();
  });

  it("respeita o batchSize (lotes nunca maiores que o limite)", async () => {
    const { batchSizes, stats } = await parseFixture("caepi-sample.csv.gz", 2);
    expect(stats.parsed).toBe(5);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(2);
  });

  it("gzip truncado → rejeita (fail-safe: o chamador preserva a base)", async () => {
    await expect(parseFixture("caepi-sample-truncated.csv.gz")).rejects.toThrow();
  });
});
