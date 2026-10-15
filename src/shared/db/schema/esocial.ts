import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

function isolationPolicy(name: string) {
  return pgPolicy(name, {
    for: "all",
    to: appRuntimeRole,
    using: tenantScope,
    withCheck: tenantScope,
  });
}

// Eventos SST do eSocial suportados.
export const esocialEventType = pgEnum("esocial_event_type", [
  "S-2190",
  "S-2200",
  "S-2210",
  "S-2220",
  "S-2221",
  "S-2240",
  "S-2300",
]);

// Ciclo de vida do evento (rascunho → pendente → enviado → retorno).
export const esocialEventStatus = pgEnum("esocial_event_status", [
  "draft",
  "pending",
  "sent",
  "accepted",
  "rejected",
  "error",
]);

// Status do lote de envio.
export const esocialBatchStatus = pgEnum("esocial_batch_status", [
  "sent",
  "processed",
  "error",
]);

// Ambiente de transmissão do eSocial (parâmetro de configuração por tenant).
export const esocialEnvironment = pgEnum("esocial_environment", [
  "production",
  "homologation",
]);

// ── Lote de envio ───────────────────────────────────────────────────────────
export const esocialBatches = pgTable(
  "esocial_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    protocolNumber: text("protocol_number"),
    status: esocialBatchStatus("status").notNull().default("sent"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    responseReceivedAt: timestamp("response_received_at", { withTimezone: true }),
    rawResponse: text("raw_response"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_esocial_batches_org_id").on(table.orgId),
    isolationPolicy("esocial_batches_isolation"),
  ],
).enableRLS();

// ── Evento ──────────────────────────────────────────────────────────────────
export const esocialEvents = pgTable(
  "esocial_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    eventType: esocialEventType("event_type").notNull(),
    // Referência polimórfica à entidade de origem (funcionário/risco/incidente/
    // ASO). Sem FK física — as tabelas de origem variam por tipo de evento.
    referenceId: uuid("reference_id"),
    // XML serializado do evento (string) — simples de depurar.
    payload: text("payload").notNull(),
    status: esocialEventStatus("status").notNull().default("draft"),
    batchId: uuid("batch_id").references(() => esocialBatches.id, {
      onDelete: "set null",
    }),
    // Mensagem/retorno do governo por evento.
    governmentResponse: text("government_response"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_esocial_events_org_id").on(table.orgId),
    index("idx_esocial_events_org_status").on(table.orgId, table.status),
    index("idx_esocial_events_org_type").on(table.orgId, table.eventType),
    index("idx_esocial_events_batch").on(table.batchId),
    isolationPolicy("esocial_events_isolation"),
  ],
).enableRLS();

// ── Configuração do eSocial (singleton por tenant) ──────────────────────────
// Parâmetros de transmissão persistidos por escritório. Config apenas — NÃO
// executa transmissão nem agenda envio; `auto_send`/`check_frequency_hours`
// registram a PREFERÊNCIA do usuário (a automação em si é capacidade futura,
// não simulada aqui). `certificate_*` são metadados informativos (nome + validade
// para o alerta de vencimento) — sem upload do arquivo .pfx nem credencial.
export const esocialConfig = pgTable(
  "esocial_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    environment: esocialEnvironment("environment").notNull().default("homologation"),
    employerCnpj: text("employer_cnpj"),
    taxClassification: text("tax_classification"),
    certificateName: text("certificate_name"),
    certificateExpiresAt: date("certificate_expires_at"),
    // Conjunto de códigos de evento habilitados (subconjunto de esocial_event_type).
    enabledEvents: text("enabled_events")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Preferência de envio automático (não aciona worker nesta fatia).
    autoSend: boolean("auto_send").notNull().default(false),
    checkFrequencyHours: integer("check_frequency_hours").notNull().default(24),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_esocial_config_org").on(table.orgId),
    isolationPolicy("esocial_config_isolation"),
  ],
).enableRLS();

export type EsocialEvent = InferSelectModel<typeof esocialEvents>;
export type NewEsocialEvent = InferInsertModel<typeof esocialEvents>;
export type EsocialEventType = EsocialEvent["eventType"];
export type EsocialEventStatus = EsocialEvent["status"];
export type EsocialBatch = InferSelectModel<typeof esocialBatches>;
export type NewEsocialBatch = InferInsertModel<typeof esocialBatches>;
export type EsocialBatchStatus = EsocialBatch["status"];
export type EsocialConfig = InferSelectModel<typeof esocialConfig>;
export type NewEsocialConfig = InferInsertModel<typeof esocialConfig>;
export type EsocialEnvironment = EsocialConfig["environment"];
