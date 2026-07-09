-- 0011 — devolução de item de entrega (fatia 012 / US4).
-- Enum Postgres é forward-only (R5): 'employee_return' entra via ADD VALUE e não
-- tem rollback — reverter exigiria recriar o tipo. IF NOT EXISTS torna o passo
-- idempotente (padrão do runner de teste, que aplica por statement-breakpoint).
ALTER TYPE "public"."stock_movement_type" ADD VALUE IF NOT EXISTS 'employee_return';--> statement-breakpoint
-- NULL = item em uso; preenchido = devolvido (one-shot; guard na aplicação).
ALTER TABLE "epi_delivery_items" ADD COLUMN "returned_at" timestamp with time zone;
