-- app_runtime role must already exist (Supabase SQL Editor infra step — see quickstart.md).
grant usage on schema public to app_runtime;
--> statement-breakpoint
grant select, insert, update, delete on public.users to app_runtime;
--> statement-breakpoint
grant select, insert, update, delete on public.orgs to app_runtime;
--> statement-breakpoint
grant select, insert, update, delete on public.org_memberships to app_runtime;
