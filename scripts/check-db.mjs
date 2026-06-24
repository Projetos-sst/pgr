// Verificação pontual: lista tabelas do schema public (sem imprimir segredos).
import fs from "node:fs";
import postgres from "postgres";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
if (!m) {
  console.error("DATABASE_URL não encontrada no .env.local");
  process.exit(1);
}
const sql = postgres(m[1], { max: 1, prepare: false });
const rows = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name`;
const names = rows.map((r) => r.table_name);
const epi = names.filter((n) => n.startsWith("epi_") || n === "stock_movements");
console.log("Total de tabelas:", names.length);
console.log("Tabelas de EPI (fatia 008):", epi.length ? epi.join(", ") : "NENHUMA");
// confirma a constraint da FR-002a
const fk = await sql`
  select constraint_name from information_schema.table_constraints
  where table_name = 'epi_catalog' and constraint_type = 'FOREIGN KEY'`;
console.log("FKs de epi_catalog:", fk.map((r) => r.constraint_name).join(", ") || "nenhuma");
await sql.end({ timeout: 5 });
