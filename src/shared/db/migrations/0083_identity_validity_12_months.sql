-- NOB-158/NOB-162: validade da verificação independente de identidade limitada a 12 meses
-- (decisão registrada no Linear; antes o teto técnico era 36 meses).
-- 1) CHECK de 12 meses para toda verificação nova. NOT VALID: as linhas existentes não são
--    reescritas nem revalidadas (o histórico fica como foi gravado) e uma linha antiga mais longa
--    não derruba o CD. Validar depois, com decisão do Carlos e inventário zerado:
--    ALTER TABLE ... VALIDATE CONSTRAINT ck_identity_verifications_validity.
-- 2) Validade EFETIVA na autorização: a verificação vale até expires_at e, no máximo, até
--    verified_at + 12 meses, inclusive as anteriores a esta migration (função central
--    actor_clinical_medico_ids, usada pelo app e pelas policies clínicas, e a policy de inclusão
--    do autovínculo do único owner, NOB-160). CREATE OR REPLACE preserva os GRANTs da função.
ALTER TABLE "professional_identity_verifications" DROP CONSTRAINT "ck_identity_verifications_validity";--> statement-breakpoint
ALTER TABLE "professional_identity_verifications" ADD CONSTRAINT "ck_identity_verifications_validity" CHECK ("professional_identity_verifications"."expires_at" > "professional_identity_verifications"."verified_at" and "professional_identity_verifications"."expires_at" <= "professional_identity_verifications"."verified_at" + interval '12 months') NOT VALID;--> statement-breakpoint
ALTER POLICY "medico_user_links_invited_insert" ON "medico_user_links" TO app_runtime WITH CHECK ("medico_user_links"."linked_by" = current_setting('app.current_actor', true) and "medico_user_links"."revoked_at" is null and exists (select 1 from public.medico_link_invitations i
        where i.id = "medico_user_links"."invitation_id" and i.org_id = "medico_user_links"."org_id" and i.medico_id = "medico_user_links"."medico_id" and i.user_id = "medico_user_links"."user_id"
          and not exists (select 1 from public.medico_link_invitation_events c where c.org_id = i.org_id and c.invitation_id = i.id and c.kind in ('declined','cancelled')) and i.expires_at > now()
          and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted' and a.actor_user_id = i.user_id)
          and (i.invited_by <> i.user_id or exists (select 1 from public.medico_link_invitation_events p where p.org_id = i.org_id and p.invitation_id = i.id and p.kind = 'approved' and p.actor_user_id <> i.user_id)
            or exists (select 1 from public.professional_identity_verifications v
        join public.medicos vm on vm.id = v.medico_id and vm.org_id = v.org_id
        where v.org_id = i.org_id and v.medico_id = i.medico_id and v.user_id = i.user_id
          and v.crm = vm.crm and v.registration_uf = vm.registration_uf and v.expires_at > now()
          and v.verified_at + interval '12 months' > now()
          and not exists (select 1 from public.professional_identity_review_events r
            where r.org_id = v.org_id and r.verification_id = v.id and r.kind = 'revoked')))));--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.actor_clinical_medico_ids(p_org text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  SELECT l.medico_id
    FROM public.medico_user_links l
    JOIN public.medicos m ON m.id = l.medico_id AND m.org_id = l.org_id
     AND m.status = 'active' AND m.profession = 'physician'
    JOIN public.org_memberships om ON om.org_id = l.org_id AND om.user_id = l.user_id
   WHERE l.org_id = p_org
     AND l.user_id = current_setting('app.current_actor', true)
     AND l.revoked_at IS NULL
     AND (l.invitation_id IS NOT NULL OR EXISTS (
           SELECT 1 FROM public.medico_link_reconfirmations rc
            WHERE rc.org_id = l.org_id AND rc.link_id = l.id AND rc.user_id = l.user_id))
     AND EXISTS (
           SELECT 1 FROM public.professional_identity_verifications v
            WHERE v.org_id = l.org_id AND v.medico_id = l.medico_id AND v.user_id = l.user_id
              AND v.crm = m.crm AND v.registration_uf = m.registration_uf AND v.expires_at > now()
              AND v.verified_at + interval '12 months' > now()
              AND NOT EXISTS (
                SELECT 1 FROM public.professional_identity_review_events r
                 WHERE r.org_id = v.org_id AND r.verification_id = v.id AND r.kind = 'revoked'))
$fn$;
