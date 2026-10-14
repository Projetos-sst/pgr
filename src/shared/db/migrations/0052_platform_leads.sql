CREATE TYPE "public"."lead_interest" AS ENUM('safety', 'health', 'both');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('quote', 'landing');--> statement-breakpoint
CREATE TABLE "platform_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"interest" "lead_interest" NOT NULL,
	"message" text,
	"source" "lead_source" DEFAULT 'quote' NOT NULL,
	"submitted_on" date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_leads_email_day" ON "platform_leads" USING btree (lower("email"),"submitted_on");--> statement-breakpoint
CREATE POLICY "platform_leads_public_insert" ON "platform_leads" AS PERMISSIVE FOR INSERT TO "app_runtime" WITH CHECK (true);--> statement-breakpoint
-- Tabela GLOBAL (pré-cadastro de interessados do portal público) — exceção
-- documentada ao Princípio I: o visitante não tem tenant, então não há org_id
-- para isolar. A contenção é o GRANT por papel, e aqui ele é INVERTIDO em
-- relação à caepi_certificates: app_runtime recebe APENAS INSERT, nunca SELECT.
-- Resultado: a superfície pública grava o pedido de orçamento e NÃO consegue
-- ler lead nenhum (nem o que acabou de gravar) — não existe consulta pública de
-- leads. A leitura administrativa fica para a conexão owner/unpooled. A policy
-- de INSERT acima existe porque o banco de produção força RLS em toda tabela
-- nova (event trigger ensure_rls); sem ela o app_runtime não gravaria em
-- produção. A 0006 já revogou os privilégios default de anon/authenticated em
-- tabelas futuras — a tabela nasce fechada na Data API do Supabase.
GRANT INSERT ON public.platform_leads TO app_runtime;
