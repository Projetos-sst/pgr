-- Etapa B (NOB-112/NOB-110/NOB-156): declaração de inexistência de riscos presa ao id da função.
-- SQL que o drizzle-kit não emite. Acrescentar AO FINAL da 0080 gerada (depois do ADD COLUMN
-- "job_role_id", do UNIQUE "uq_job_roles_id_scope" e do ADD CONSTRAINT "fk_risk_absence_job_role").
-- Roda como owner (conexão direta): RLS não se aplica e o REVOKE UPDATE do app_runtime não pesa.
--
-- 1) ON DELETE SET NULL só na coluna da função: o "set null" do schema zeraria também org_id e
--    company_id (NOT NULL) e impediria excluir a função. Excluir a função zera só job_role_id;
--    título, autor, data e justificativa ficam (PostgreSQL >= 15).
ALTER TABLE "medical_risk_absence_declarations" DROP CONSTRAINT "fk_risk_absence_job_role";--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ADD CONSTRAINT "fk_risk_absence_job_role" FOREIGN KEY ("job_role_id","org_id","company_id") REFERENCES "public"."job_roles"("id","org_id","company_id") ON DELETE SET NULL ("job_role_id") ON UPDATE no action;--> statement-breakpoint
-- 2) backfill:risk-absence-job-role-id — vincula declarações antigas (só título) à função
--    cadastrada SOMENTE quando inequívoco: exatamente uma função da mesma empresa e tenant com
--    exatamente aquele título (sem ajuste de caixa, acento ou espaço) E vinculada ao GES da
--    declaração em ges_job_roles. Ambíguas ou sem correspondência ficam com job_role_id nulo e
--    não valem no ASO (regularização: o profissional autorizado declara de novo). Só preenche
--    job_role_id; nada é apagado nem reescrito. Idempotente (só linhas com job_role_id nulo).
UPDATE "medical_risk_absence_declarations" AS d
SET "job_role_id" = c.job_role_id
FROM (
  SELECT d2.id AS declaration_id,
    min(jr.id::text)::uuid AS job_role_id,
    count(*) AS same_title,
    bool_and(EXISTS (
      SELECT 1 FROM "ges_job_roles" gjr
      WHERE gjr.org_id = d2.org_id AND gjr.ges_id = d2.ges_id AND gjr.job_role_id = jr.id
    )) AS linked
  FROM "medical_risk_absence_declarations" d2
  JOIN "job_roles" jr
    ON jr.org_id = d2.org_id AND jr.company_id = d2.company_id AND jr.title = d2.job_role
  WHERE d2.job_role_id IS NULL AND d2.job_role <> ''
  GROUP BY d2.id
) AS c
WHERE d.id = c.declaration_id
  AND c.same_title = 1
  AND c.linked
  AND d.job_role_id IS NULL;
