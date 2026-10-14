import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";

export const leadInterest = pgEnum("lead_interest", ["safety", "health", "both"]);
export const leadSource = pgEnum("lead_source", ["quote", "landing"]);

/**
 * Pré-cadastro de interessados vindo do portal público (botão "Solicitar
 * orçamento").
 *
 * Tabela GLOBAL — segunda exceção documentada ao Princípio I, por natureza
 * diferente da `caepi_certificates`: o visitante **não tem tenant**. Um pedido
 * de orçamento acontece antes de existir organização, então não há `org_id` para
 * isolar e `withOrg` não se aplica.
 *
 * A contenção é o GRANT por papel, invertido em relação à CAEPI:
 * `app_runtime` recebe **apenas INSERT** — nunca SELECT. Com isso a superfície
 * pública consegue gravar o pedido e **não consegue ler lead nenhum**, nem o
 * próprio. A leitura administrativa fica para a conexão owner/unpooled (mesmo
 * precedente de `caepi-upsert`), ainda sem tela — ver a decisão registrada em
 * `docs/planning/reuniao-2026-10-05/PORTAL-AUDIT.md`.
 *
 * RLS fica habilitado com uma única policy de INSERT (`with check true`) porque
 * o banco de produção força RLS em toda tabela nova (event trigger `ensure_rls`
 * do projeto): sem a policy explícita o `app_runtime` não gravaria lá e o
 * comportamento divergiria do Postgres efêmero dos testes.
 *
 * `submittedOn` é a data em São Paulo e existe para o índice único de
 * deduplicação: o mesmo e-mail não grava dois pedidos no mesmo dia. É o
 * backstop de abuso que mora no banco — o limite por janela de tempo na
 * aplicação é só a primeira barreira.
 */
export const platformLeads = pgTable(
  "platform_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    company: text("company").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    interest: leadInterest("interest").notNull(),
    message: text("message"),
    source: leadSource("source").notNull().default("quote"),
    submittedOn: date("submitted_on")
      .notNull()
      .default(sql`(now() AT TIME ZONE 'America/Sao_Paulo')::date`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_platform_leads_email_day").on(
      sql`lower(${table.email})`,
      table.submittedOn,
    ),
    pgPolicy("platform_leads_public_insert", {
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type PlatformLead = InferSelectModel<typeof platformLeads>;
export type NewPlatformLead = InferInsertModel<typeof platformLeads>;
