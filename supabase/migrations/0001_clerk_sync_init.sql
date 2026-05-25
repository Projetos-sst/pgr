-- Tabelas básicas espelhando Clerk (source of truth = Clerk). -> FUTURAMENTE TUDO DEVE IR PARA O DRIZZLE, MAS POR ENQUANTO FICA AQUI PRA FACILITAR O DESENVOLVIMENTO.
-- Sincronizadas via webhook em app/api/webhooks/clerk/route.ts.
-- IDs são os próprios IDs textuais do Clerk (user_xxx, org_xxx).

create table if not exists public.users (
  id          text primary key,
  email       text,
  first_name  text,
  last_name   text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.orgs (
  id          text primary key,
  name        text not null,
  slug        text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists orgs_slug_idx   on public.orgs  (slug);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists orgs_set_updated_at on public.orgs;
create trigger orgs_set_updated_at
  before update on public.orgs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- RLS
-- Writes só pelo webhook (secret key bypassa RLS).
-- Reads no app passam pela policy: usuário vê APENAS seu próprio user
-- e a org ATIVA dele (claim 'org_id' do token Clerk).
-- ---------------------------------------------------------------
alter table public.users enable row level security;
alter table public.orgs  enable row level security;

-- users: cada usuário vê só o próprio row (claim sub = Clerk userId)
drop policy if exists "users_self_select" on public.users;
create policy "users_self_select"
  on public.users
  for select
  to authenticated
  using ( id = (auth.jwt() ->> 'sub') );

-- orgs: usuário vê só a org atualmente ativa (claim org_id)
drop policy if exists "orgs_active_select" on public.orgs;
create policy "orgs_active_select"
  on public.orgs
  for select
  to authenticated
  using ( id = (auth.jwt() ->> 'org_id') );

-- Sem policies de INSERT/UPDATE/DELETE para `authenticated` =>
-- gravações só acontecem via secret key (webhook).
