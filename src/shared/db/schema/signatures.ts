import {
  pgTable,
  pgEnum,
  text,
  uuid,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const tokenScope = sql`token_hash = current_setting('app.signature_token', true)`;

// Estado persistido do pedido. "expired" NÃO é valor — é derivado na leitura
// (expires_at < now() e status='pending'). "cancelled" é dormente nesta fatia.
export const signatureRequestStatus = pgEnum("signature_request_status", [
  "pending",
  "signed",
  "cancelled",
]);

// Como a captura foi coletada (QR/link público ou assinatura manual interna).
export const signatureMethod = pgEnum("signature_method", ["qr", "link", "manual"]);

/**
 * Pedido de assinatura emitido por qualquer módulo consumidor. Genérico/polimórfico
 * por `target_type` (registry no domínio) → novo consumidor = +1 `target_type`, zero
 * mudança de schema. O token cru nunca persiste: só o `token_hash` (sha-256, único).
 *
 * Duas policies RLS PERMISSIVE (combinam por OR): a de tenant (acesso interno com
 * `app.current_org`) e a de capability (rota pública sem sessão, que só lê a única
 * linha cujo token o cliente possui via `app.signature_token`).
 */
export const signatureRequests = pgTable(
  "signature_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    tokenHash: text("token_hash").notNull(),
    payload: jsonb("payload").notNull(),
    status: signatureRequestStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_signature_requests_org_id").on(table.orgId),
    index("idx_signature_requests_org_id_created_at").on(table.orgId, table.createdAt),
    uniqueIndex("uq_signature_requests_token_hash").on(table.tokenHash),
    index("idx_signature_requests_target").on(table.targetType, table.targetId),
    pgPolicy("signature_requests_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("signature_requests_token_capability", {
      for: "select",
      to: appRuntimeRole,
      using: tokenScope,
    }),
  ],
).enableRLS();

/**
 * Resultado coletado (1:1 com o request via UNIQUE `request_id`). Imagem da
 * assinatura como data-URL base64 (PNG) sob RLS por tenant. Sem policy de
 * capability: a captura é sempre gravada via `withOrg(orgId)` após o token
 * resolver o tenant.
 */
export const signatureCaptures = pgTable(
  "signature_captures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => signatureRequests.id, { onDelete: "cascade" }),
    imageData: text("image_data").notNull(),
    signerName: text("signer_name").notNull(),
    method: signatureMethod("method").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_signature_captures_org_id").on(table.orgId),
    uniqueIndex("uq_signature_captures_request_id").on(table.requestId),
    pgPolicy("signature_captures_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type SignatureRequest = InferSelectModel<typeof signatureRequests>;
export type NewSignatureRequest = InferInsertModel<typeof signatureRequests>;
export type SignatureCapture = InferSelectModel<typeof signatureCaptures>;
export type NewSignatureCapture = InferInsertModel<typeof signatureCaptures>;
