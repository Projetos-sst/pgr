CREATE TYPE "public"."medico_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "medicos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"crm" text NOT NULL,
	"specialty" text,
	"clinic" text,
	"phone" text,
	"status" "medico_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medicos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medicos" ADD CONSTRAINT "medicos_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_medicos_org_id" ON "medicos" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medicos_org_crm" ON "medicos" USING btree ("org_id","crm");--> statement-breakpoint
CREATE POLICY "medicos_isolation" ON "medicos" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicos TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_medicos ON public.medicos;--> statement-breakpoint
CREATE TRIGGER set_updated_at_medicos BEFORE UPDATE ON public.medicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();