create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
--> statement-breakpoint
drop trigger if exists set_updated_at_users on public.users;
--> statement-breakpoint
create trigger set_updated_at_users
  before update on public.users
  for each row execute function public.set_updated_at();
--> statement-breakpoint
drop trigger if exists set_updated_at_orgs on public.orgs;
--> statement-breakpoint
create trigger set_updated_at_orgs
  before update on public.orgs
  for each row execute function public.set_updated_at();
--> statement-breakpoint
drop trigger if exists set_updated_at_org_memberships on public.org_memberships;
--> statement-breakpoint
create trigger set_updated_at_org_memberships
  before update on public.org_memberships
  for each row execute function public.set_updated_at();
