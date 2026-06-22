-- Fecha a porta da Data API (PostgREST) para o schema public: o acesso a dados
-- e 100% pelo backend (app_runtime via Drizzle) e pelo service_role (provisionamento
-- Clerk). Os roles anon/authenticated (chave publishable, publica no browser) nao tem
-- consumidor na app — os clients supabase-js publishable estao mortos. Sem este revoke,
-- o RLS seria a UNICA tranca da Data API; aqui adicionamos defesa em profundidade
-- fechando o GRANT (modelo C: porta fechada + RLS mantido como backstop).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
-- Tabelas/sequences futuras criadas pelo owner (drizzle-kit roda como postgres) nao
-- reabrem a porta: remove o GRANT default que o Supabase aplica a anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;
