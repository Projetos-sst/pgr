CREATE TABLE "medico_link_invitation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"invitation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"statement" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_medico_link_invitation_events_kind" CHECK ("medico_link_invitation_events"."kind" in ('accepted','declined','approved','cancelled')),
	CONSTRAINT "ck_medico_link_invitation_events_statement" CHECK (("medico_link_invitation_events"."kind" = 'accepted') = ("medico_link_invitation_events"."statement" is not null))
);--> statement-breakpoint
ALTER TABLE "medico_link_invitation_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medico_link_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"medico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"invited_by" text NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	CONSTRAINT "ck_medico_link_invitations_expiry" CHECK ("medico_link_invitations"."expires_at" > "medico_link_invitations"."invited_at")
);--> statement-breakpoint
ALTER TABLE "medico_link_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medico_user_links" ADD COLUMN "invitation_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medico_link_invitations_id_org" ON "medico_link_invitations" USING btree ("id","org_id");--> statement-breakpoint
ALTER TABLE "medico_link_invitation_events" ADD CONSTRAINT "fk_medico_link_invitation_events_invitation" FOREIGN KEY ("invitation_id","org_id") REFERENCES "public"."medico_link_invitations"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medico_link_invitations" ADD CONSTRAINT "medico_link_invitations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medico_link_invitations" ADD CONSTRAINT "fk_medico_link_invitations_medico" FOREIGN KEY ("medico_id","org_id") REFERENCES "public"."medicos"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medico_link_invitation_events_kind" ON "medico_link_invitation_events" USING btree ("org_id","invitation_id","kind");--> statement-breakpoint
CREATE INDEX "idx_medico_link_invitations_medico" ON "medico_link_invitations" USING btree ("org_id","medico_id","invited_at");--> statement-breakpoint
CREATE INDEX "idx_medico_link_invitations_user" ON "medico_link_invitations" USING btree ("org_id","user_id");--> statement-breakpoint
ALTER TABLE "medico_user_links" ADD CONSTRAINT "fk_medico_user_links_invitation" FOREIGN KEY ("invitation_id","org_id") REFERENCES "public"."medico_link_invitations"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medico_user_links_invitation" ON "medico_user_links" USING btree ("invitation_id");--> statement-breakpoint
CREATE POLICY "medico_link_invitation_events_isolation" ON "medico_link_invitation_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "medico_link_invitation_events_insert" ON "medico_link_invitation_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medico_link_invitation_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.medico_link_invitations i
        where i.id = "medico_link_invitation_events"."invitation_id" and i.org_id = "medico_link_invitation_events"."org_id" and not exists (select 1 from public.medico_link_invitation_events c where c.org_id = i.org_id and c.invitation_id = i.id and c.kind in ('declined','cancelled')) and i.expires_at > now()
          and (
            ("medico_link_invitation_events"."kind" in ('accepted','declined') and i.user_id = "medico_link_invitation_events"."actor_user_id")
            or ("medico_link_invitation_events"."kind" = 'cancelled' and exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')))
            or ("medico_link_invitation_events"."kind" = 'approved' and exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) and i.invited_by = i.user_id and i.user_id <> "medico_link_invitation_events"."actor_user_id"
              and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted'))
          )));--> statement-breakpoint
CREATE POLICY "medico_link_invitations_isolation" ON "medico_link_invitations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "medico_link_invitations_owner_insert" ON "medico_link_invitations" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) and "medico_link_invitations"."invited_by" = current_setting('app.current_actor', true));--> statement-breakpoint
DROP POLICY "medico_user_links_owner_insert" ON "medico_user_links";--> statement-breakpoint
CREATE POLICY "medico_user_links_invited_insert" ON "medico_user_links" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medico_user_links"."linked_by" = current_setting('app.current_actor', true) and "medico_user_links"."revoked_at" is null and exists (select 1 from public.medico_link_invitations i
        where i.id = "medico_user_links"."invitation_id" and i.org_id = "medico_user_links"."org_id" and i.medico_id = "medico_user_links"."medico_id" and i.user_id = "medico_user_links"."user_id"
          and not exists (select 1 from public.medico_link_invitation_events c where c.org_id = i.org_id and c.invitation_id = i.id and c.kind in ('declined','cancelled')) and i.expires_at > now()
          and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted' and a.actor_user_id = i.user_id)
          and (i.invited_by <> i.user_id or exists (select 1 from public.medico_link_invitation_events p where p.org_id = i.org_id and p.invitation_id = i.id and p.kind = 'approved' and p.actor_user_id <> i.user_id))));--> statement-breakpoint
GRANT SELECT, INSERT ON public.medico_link_invitations TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.medico_link_invitations FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.medico_link_invitation_events TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.medico_link_invitation_events FROM app_runtime;