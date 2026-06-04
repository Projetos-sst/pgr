-- Password read from session GUC `app.app_runtime_password`, set by
-- scripts/db-migrate.ts before the runner starts.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    execute format(
      'create role app_runtime login password %L nobypassrls noinherit',
      current_setting('app.app_runtime_password')
    );
  end if;
end$$;
--> statement-breakpoint
grant usage on schema public to app_runtime;
--> statement-breakpoint
grant select, insert, update, delete on public.users to app_runtime;
--> statement-breakpoint
grant select, insert, update, delete on public.orgs to app_runtime;
--> statement-breakpoint
grant select, insert, update, delete on public.org_memberships to app_runtime;
