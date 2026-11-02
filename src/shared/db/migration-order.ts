/**
 * Ordem das migrations do Drizzle. O `migrate` (drizzle-orm `pg-core/dialect.js`) lê a última
 * linha de `drizzle.__drizzle_migrations` por `created_at` e só aplica a migration cujo `when`
 * (folderMillis) for **maior** que esse valor. Uma migration com `when` menor ou igual ao de
 * alguma anterior é pulada sem erro num banco que já aplicou a anterior: o CD termina verde e
 * a tabela não existe. Renumerar arquivo sem regenerar o `when` cai exatamente nesse caso.
 */
export type JournalMigration = { tag: string; when: number };

/** Migrations pendentes que o migrator pularia num banco aplicado até `appliedCount` itens. */
export function silentlySkipped(
  migrations: readonly JournalMigration[],
  appliedCount: number,
): JournalMigration[] {
  const applied = migrations.slice(0, appliedCount);
  if (!applied.length) return [];
  const lastCreatedAt = Math.max(...applied.map((m) => m.when));
  return migrations.slice(appliedCount).filter((m) => m.when <= lastCreatedAt);
}

/**
 * Migrations cujo `when` não supera o de todas as anteriores: seriam puladas num banco que
 * parou imediatamente antes delas.
 */
export function outOfOrder(migrations: readonly JournalMigration[]): JournalMigration[] {
  let max = -Infinity;
  const issues: JournalMigration[] = [];
  for (const migration of migrations) {
    if (migration.when <= max) issues.push(migration);
    max = Math.max(max, migration.when);
  }
  return issues;
}
