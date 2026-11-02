CREATE TABLE "medico_user_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"medico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"linked_by" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_medico_user_links_revocation" CHECK (("medico_user_links"."revoked_at" is null) = ("medico_user_links"."revoked_by" is null) and ("medico_user_links"."revoked_at" is null) = ("medico_user_links"."revoke_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "medico_user_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medico_user_links" ADD CONSTRAINT "medico_user_links_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medico_user_links" ADD CONSTRAINT "medico_user_links_medico_id_org_id_medicos_id_org_id_fk" FOREIGN KEY ("medico_id","org_id") REFERENCES "public"."medicos"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_medico_user_links_medico" ON "medico_user_links" USING btree ("org_id","medico_id");--> statement-breakpoint
CREATE INDEX "idx_medico_user_links_user" ON "medico_user_links" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medico_user_links_open_medico" ON "medico_user_links" USING btree ("org_id","medico_id") WHERE "medico_user_links"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medico_user_links_open_user" ON "medico_user_links" USING btree ("org_id","user_id") WHERE "medico_user_links"."revoked_at" is null;--> statement-breakpoint
CREATE POLICY "medico_user_links_isolation" ON "medico_user_links" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "medico_user_links_owner_insert" ON "medico_user_links" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) and "medico_user_links"."linked_by" = current_setting('app.current_actor', true) and "medico_user_links"."revoked_at" is null);--> statement-breakpoint
CREATE POLICY "medico_user_links_owner_revoke" ON "medico_user_links" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING ("medico_user_links"."revoked_at" is null and exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin'))) WITH CHECK ("medico_user_links"."revoked_by" = current_setting('app.current_actor', true));--> statement-breakpoint
GRANT SELECT, INSERT ON public.medico_user_links TO app_runtime;--> statement-breakpoint
GRANT UPDATE (revoked_at, revoked_by, revoke_reason, updated_at) ON public.medico_user_links TO app_runtime;--> statement-breakpoint
REVOKE DELETE ON public.medico_user_links FROM app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_medico_user_links ON public.medico_user_links;--> statement-breakpoint
CREATE TRIGGER set_updated_at_medico_user_links BEFORE UPDATE ON public.medico_user_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
