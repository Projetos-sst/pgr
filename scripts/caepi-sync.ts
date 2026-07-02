/**
 * Job de ingestão da base CAEPI/MTE (fatia 011) — collect → parse → upsertMany.
 *
 *   npx tsx scripts/caepi-sync.ts            # fluxo completo (browser real)
 *   npx tsx scripts/caepi-sync.ts --file X   # fallback semi-manual/bootstrap/CI:
 *                                            # ingere X (.csv.gz) sem coleta
 *
 * Fail-safe (FR-036): falha de coleta/gzip acontece ANTES de qualquer escrita —
 * a base anterior fica intocada. Qualquer falha (inclusive zero linhas válidas)
 * → log estruturado + exit ≠ 0 ("falha alto": o agendador transforma em alerta).
 * Escrita exclusiva via conexão owner (`DATABASE_URL_UNPOOLED`); o papel
 * `app_runtime` tem apenas SELECT nesta tabela (contenção da exceção de tenant).
 * Cadência recomendada: semanal (agendador é decisão de infra fora do escopo).
 */
import { createReadStream, openSync, readSync, closeSync, statSync } from "node:fs";

import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { collectCaepiFile, CollectError } from "@/shared/integrations/caepi/collect";
import { parseCaepiCsv } from "@/shared/integrations/caepi/parse";
import { upsertMany } from "@/shared/db/repositories/caepi-upsert";

dotenv.config({ path: ".env.local" });
dotenv.config();

const GZIP_SIGNATURE = Buffer.from([0x1f, 0x8b, 0x08]);

type Phase = "start" | "collect" | "parse" | "upsert" | "finish";

function log(level: "info" | "error", phase: Phase, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, operation: "caepi.sync", phase, ...extra }));
}

function assertGzipFile(filePath: string): void {
  const { size } = statSync(filePath);
  if (size === 0) throw new CollectError(`Arquivo vazio: ${filePath}`);
  const fd = openSync(filePath, "r");
  const header = Buffer.alloc(GZIP_SIGNATURE.length);
  try {
    readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }
  if (!header.equals(GZIP_SIGNATURE)) {
    throw new CollectError(`Assinatura gzip inválida em ${filePath}`);
  }
}

function parseArgs(argv: string[]): { file: string | null } {
  const fileFlagIndex = argv.indexOf("--file");
  if (fileFlagIndex === -1) return { file: null };
  const file = argv[fileFlagIndex + 1];
  if (!file) throw new Error("--file exige um caminho para o .csv.gz");
  return { file };
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const { file } = parseArgs(process.argv.slice(2));
  log("info", "start", { mode: file ? "file" : "collect", file });

  // (1) resolve o arquivo — toda falha aqui acontece antes de abrir conexão/escrever
  const csvGzPath = file ?? (await collectCaepiFile());
  assertGzipFile(csvGzPath);
  log("info", "collect", { file: csvGzPath });

  // (2) conexão owner: a única com GRANT de escrita em caepi_certificates
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED;
  if (!databaseUrl) throw new Error("DATABASE_URL_UNPOOLED is not set.");
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    const syncedAt = new Date();
    let upserted = 0;

    const stats = await parseCaepiCsv(
      createReadStream(csvGzPath),
      async (rows) => {
        const result = await upsertMany(db, rows, syncedAt);
        upserted += result.upserted;
      },
      {
        onDiscard: (reason, line) =>
          log("info", "parse", { discardedLine: line, reason }),
      },
    );
    log("info", "parse", { parsed: stats.parsed, discarded: stats.discarded });

    if (stats.parsed === 0) {
      throw new Error(
        "Zero linhas válidas — layout novo da fonte? Carga vazia não pode passar por sucesso (R12).",
      );
    }

    log("info", "upsert", { upserted });
    log("info", "finish", {
      parsed: stats.parsed,
      discarded: stats.discarded,
      upserted,
      durationMs: Date.now() - startedAt,
    });
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  log("error", "finish", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
