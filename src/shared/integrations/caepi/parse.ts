/**
 * Parse do CSV oficial do CAEPI — função pura no sentido da spec (FR-031): sem
 * I/O próprio, recebe o stream do `.csv.gz` e entrega lotes tipados via callback.
 * Layout real (Spike 0): separador `;`, campos entre aspas com escape `""` (há
 * `;` e quebras de linha DENTRO das aspas), UTF-8 com BOM, 19 colunas.
 * Sem `server-only`: consumido pelo script tsx do job e pelos testes.
 */
import { Transform } from "node:stream";
import { createGunzip } from "node:zlib";

import { parse } from "csv-parse";
import { z } from "zod";

import { normalizeCa } from "./normalize";
import type { CaepiParsedRow } from "./types";

export type ParseStats = { parsed: number; discarded: number };

export type ParseOptions = {
  batchSize?: number;
  onDiscard?: (reason: string, line: number) => void;
};

const EXPECTED_COLUMNS = 19;
const DEFAULT_BATCH_SIZE = 1_000;

/** Posições no CSV (mapa D8 do data-model — colunas 1-based do layout). */
const COL = {
  ca: 0,
  validUntil: 1,
  situation: 2,
  manufacturerCnpj: 4,
  manufacturerName: 5,
  nature: 6,
  equipmentName: 7,
  description: 8,
  norms: 18,
} as const;

const parsedRowSchema = z.object({
  ca: z.string().regex(/^\d{1,10}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  situation: z.string().min(1),
  manufacturerName: z.string().nullable(),
  manufacturerCnpj: z.string().nullable(),
  equipmentName: z.string().nullable(),
  description: z.string().nullable(),
  nature: z.string().nullable(),
  norms: z.string().nullable(),
});

/** `dd/mm/aaaa` → `YYYY-MM-DD`; devolve null para data ausente/impossível. */
function toIsoDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const roundTrips =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  return roundTrips ? `${year}-${month}-${day}` : null;
}

function toNullable(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function toParsedRow(record: string[]): { row: CaepiParsedRow } | { reason: string } {
  if (record.length !== EXPECTED_COLUMNS) {
    return { reason: `contagem de colunas ${record.length} != ${EXPECTED_COLUMNS}` };
  }
  const ca = normalizeCa(record[COL.ca]);
  if (ca === "") return { reason: "ca vazio/não-numérico" };

  const validUntil = toIsoDate(record[COL.validUntil]);
  if (validUntil === null) return { reason: "data de validade ausente/inválida" };

  const candidate: CaepiParsedRow = {
    ca,
    validUntil,
    situation: record[COL.situation].trim(),
    manufacturerName: toNullable(record[COL.manufacturerName]),
    manufacturerCnpj: toNullable(record[COL.manufacturerCnpj]),
    equipmentName: toNullable(record[COL.equipmentName]),
    description: toNullable(record[COL.description]),
    nature: toNullable(record[COL.nature]),
    norms: toNullable(record[COL.norms]),
  };

  const result = parsedRowSchema.safeParse(candidate);
  if (!result.success) return { reason: "linha reprovada na validação" };
  return { row: result.data };
}

const ASPX_TRAILER_MARKER = Buffer.from("\r\n\r\n<!DOCTYPE html");

/**
 * Fato do spike T018: o servidor do MTE anexa o HTML da página ASPX (~885 KB)
 * DEPOIS do stream gzip, no mesmo corpo de resposta — e o zlib do Node, ao
 * tocar nesse lixo, descarta o output do chunk final (perde os últimos
 * registros) antes de errar. Truncar o stream BRUTO no marcador do trailer é
 * determinístico e tem backstop: se o corte sair errado, o CRC do gzip falha
 * alto — nunca carga corrompida em silêncio. Arquivo sem o trailer passa
 * intacto (o `flush` devolve o resto).
 */
function stripAspxTrailer(): Transform {
  let carry: Buffer = Buffer.alloc(0);
  let done = false;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (done) return callback();
      const data = Buffer.concat([carry, chunk]);
      const markerIndex = data.indexOf(ASPX_TRAILER_MARKER);
      if (markerIndex !== -1) {
        done = true;
        carry = Buffer.alloc(0);
        return callback(null, data.subarray(0, markerIndex));
      }
      const safeLength = Math.max(0, data.length - (ASPX_TRAILER_MARKER.length - 1));
      carry = data.subarray(safeLength);
      callback(null, data.subarray(0, safeLength));
    },
    flush(callback) {
      callback(null, done ? undefined : carry);
    },
  });
}

/**
 * Gunzip + CSV em streaming (memória constante — a base é nacional). Linha
 * corrompida/colunas faltando/data inválida/`ca` inválido → descartada com
 * `onDiscard` e contada; a carga NUNCA aborta por linha ruim (FR-032). Erros de
 * stream (gzip truncado/corrompido) propagam — fail-safe do chamador.
 */
export async function parseCaepiCsv(
  gzipStream: NodeJS.ReadableStream,
  onBatch: (rows: CaepiParsedRow[]) => Promise<void>,
  opts: ParseOptions = {},
): Promise<ParseStats> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const gunzip = createGunzip();
  const parser = parse({
    delimiter: ";",
    bom: true,
    quote: '"',
    escape: '"',
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  });

  // Erros de gzip truncado/corrompido e de leitura da fonte propagam para o
  // iterador (fail-safe do chamador — FR-036); só linha ruim é descartada.
  gunzip.on("error", (error) => parser.destroy(error));
  gzipStream.on("error", (error) => parser.destroy(error));

  gzipStream.pipe(stripAspxTrailer()).pipe(gunzip).pipe(parser);

  const stats: ParseStats = { parsed: 0, discarded: 0 };
  let batch: CaepiParsedRow[] = [];
  let line = 0;
  let isHeader = true;

  for await (const record of parser as AsyncIterable<string[]>) {
    line += 1;
    if (isHeader) {
      isHeader = false;
      continue;
    }
    const outcome = toParsedRow(record);
    if ("reason" in outcome) {
      stats.discarded += 1;
      opts.onDiscard?.(outcome.reason, line);
      continue;
    }
    stats.parsed += 1;
    batch.push(outcome.row);
    if (batch.length >= batchSize) {
      await onBatch(batch);
      batch = [];
    }
  }
  if (batch.length > 0) await onBatch(batch);

  return stats;
}
