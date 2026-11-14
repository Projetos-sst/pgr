import { readFile } from "node:fs/promises";

import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { runCatalogCommand } from "@/shared/db/repositories/commercial-catalog-admin";
import {
  CATALOG_COMMAND_USAGE,
  catalogOperatorSchema,
  parseCatalogCommand,
} from "@/shared/domains/commercial/catalog-admin";

dotenv.config({ path: ".env.local" });
dotenv.config();

const USAGE = [
  "Uso: COMMERCIAL_CATALOG_OPERATOR=<quem executa> npx tsx scripts/commercial-catalog.ts <comando>",
  "Exige DATABASE_URL_UNPOOLED (conexão owner). Comandos:",
  ...CATALOG_COMMAND_USAGE.map((line) => `  ${line}`),
].join("\n");

async function readJsonFile(path: string): Promise<unknown> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  return parsed;
}

async function main(): Promise<number> {
  const command = parseCatalogCommand(process.argv.slice(2));
  const operator = catalogOperatorSchema.safeParse(
    process.env.COMMERCIAL_CATALOG_OPERATOR,
  );
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED;
  if (!command || !operator.success || !databaseUrl) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const outcome = await runCatalogCommand(drizzle(client), command, {
    env: { APP_ENV: process.env.APP_ENV },
    operator: operator.data,
    readJsonFile,
  }).then(
    (result) => ({ exitCode: 0, output: result }),
    (error: unknown) => ({
      exitCode: 1,
      output: { error: error instanceof Error ? error.message : String(error) },
    }),
  );
  await client.end();
  process.stdout.write(`${JSON.stringify(outcome.output, null, 2)}\n`);
  return outcome.exitCode;
}

void main().then((exitCode) => {
  process.exitCode = exitCode;
});
