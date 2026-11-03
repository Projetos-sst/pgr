CREATE TABLE "identity_challenge_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"verifier_user_id" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity_challenge_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "identity_challenge_attempts" ADD CONSTRAINT "identity_challenge_attempts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_challenge_attempts" ADD CONSTRAINT "fk_identity_attempts_request" FOREIGN KEY ("request_id","org_id") REFERENCES "public"."professional_identity_requests"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_identity_attempts_request" ON "identity_challenge_attempts" USING btree ("request_id","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_identity_attempts_user" ON "identity_challenge_attempts" USING btree ("user_id","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_identity_attempts_verifier" ON "identity_challenge_attempts" USING btree ("verifier_user_id","attempted_at");--> statement-breakpoint
CREATE POLICY "identity_attempts_verifier_read" ON "identity_challenge_attempts" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "identity_attempts_verifier_insert" ON "identity_challenge_attempts" AS PERMISSIVE FOR INSERT TO "identity_verifier" WITH CHECK ("identity_challenge_attempts"."verifier_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.identity_verifiers iv where iv.user_id = current_setting('app.current_actor', true) and iv.revoked_at is null)
        and not exists (select 1 from public.org_memberships om where om.org_id = "identity_challenge_attempts"."org_id" and om.user_id = current_setting('app.current_actor', true))
        and exists (select 1 from public.professional_identity_requests rq where rq.id = "identity_challenge_attempts"."request_id" and rq.org_id = "identity_challenge_attempts"."org_id" and rq.user_id = "identity_challenge_attempts"."user_id"));--> statement-breakpoint
-- Custom: tentativas só pelo operador (inclusão e leitura); nenhum acesso do app_runtime.
REVOKE ALL ON public.identity_challenge_attempts FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.identity_challenge_attempts TO identity_verifier;