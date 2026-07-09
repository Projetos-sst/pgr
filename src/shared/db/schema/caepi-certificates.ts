import { pgTable, text, date, timestamp, pgPolicy } from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";

/**
 * Tabela GLOBAL — exceção documentada ao Princípio I (isolamento multi-tenant).
 *
 * Espelho local da base pública do CAEPI/MTE: dado público, idêntico para todos
 * os tenants — por isso NÃO tem `org_id`, NÃO tem policy de RLS de TENANT e a
 * leitura NÃO passa por `withOrg`. A contenção da exceção é o GRANT por papel
 * (migration 0009): `app_runtime` recebe apenas SELECT; a escrita é exclusiva do
 * job de ingestão (`scripts/caepi-sync.ts`) via conexão owner/unpooled.
 *
 * RLS fica HABILITADO com uma única policy de leitura global (`using true`):
 * o banco de produção força RLS em toda tabela nova (event trigger `ensure_rls`
 * do projeto — fato descoberto no bootstrap T024); sem a policy explícita o
 * `app_runtime` leria vazio lá e o comportamento divergiria do Postgres efêmero
 * dos testes. Escrita segue dupla-trancada: sem GRANT e sem policy de escrita.
 *
 * `ca` é PK natural: alvo do upsert idempotente e da consulta (uma linha por CA).
 */
export const caepiCertificates = pgTable(
  "caepi_certificates",
  {
    ca: text("ca").primaryKey(),
    validUntil: date("valid_until").notNull(),
    situation: text("situation").notNull(),
    manufacturerName: text("manufacturer_name"),
    manufacturerCnpj: text("manufacturer_cnpj"),
    equipmentName: text("equipment_name"),
    description: text("description"),
    nature: text("nature"),
    norms: text("norms"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("caepi_certificates_global_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export type CaepiCertificate = InferSelectModel<typeof caepiCertificates>;
export type NewCaepiCertificate = InferInsertModel<typeof caepiCertificates>;
