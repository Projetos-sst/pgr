CREATE TABLE "caepi_certificates" (
	"ca" text PRIMARY KEY NOT NULL,
	"valid_until" date NOT NULL,
	"situation" text NOT NULL,
	"manufacturer_name" text,
	"manufacturer_cnpj" text,
	"equipment_name" text,
	"description" text,
	"nature" text,
	"norms" text,
	"synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "caepi_certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "caepi_certificates_global_read" ON "caepi_certificates" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (true);--> statement-breakpoint
-- Tabela GLOBAL (espelho público do CAEPI/MTE) — exceção documentada ao Princípio I:
-- sem org_id, sem policy de RLS de TENANT. A contenção é o GRANT por papel:
-- app_runtime recebe APENAS SELECT (sem INSERT/UPDATE/DELETE); a escrita é exclusiva
-- do job de ingestão via conexão owner/unpooled. O RLS acima (policy de leitura
-- global `using true`) existe porque o banco de produção força RLS em toda tabela
-- nova (event trigger ensure_rls do projeto); a escrita segue dupla-trancada
-- (sem GRANT e sem policy de escrita). A 0006 já revogou os privilégios default
-- de anon/authenticated em tabelas futuras — a tabela nasce fechada na Data API.
GRANT SELECT ON public.caepi_certificates TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_caepi_certificates ON public.caepi_certificates;--> statement-breakpoint
CREATE TRIGGER set_updated_at_caepi_certificates BEFORE UPDATE ON public.caepi_certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
