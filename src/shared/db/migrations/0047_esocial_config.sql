CREATE TYPE "public"."esocial_environment" AS ENUM('production', 'homologation');--> statement-breakpoint
CREATE TABLE "esocial_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"environment" "esocial_environment" DEFAULT 'homologation' NOT NULL,
	"employer_cnpj" text,
	"tax_classification" text,
	"certificate_name" text,
	"certificate_expires_at" date,
	"enabled_events" text[] DEFAULT '{}'::text[] NOT NULL,
	"auto_send" boolean DEFAULT false NOT NULL,
	"check_frequency_hours" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "esocial_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "esocial_config" ADD CONSTRAINT "esocial_config_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_esocial_config_org" ON "esocial_config" USING btree ("org_id");--> statement-breakpoint
CREATE POLICY "esocial_config_isolation" ON "esocial_config" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_config TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_esocial_config ON public.esocial_config;--> statement-breakpoint
CREATE TRIGGER set_updated_at_esocial_config BEFORE UPDATE ON public.esocial_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();