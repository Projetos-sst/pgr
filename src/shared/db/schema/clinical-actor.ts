import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Identidade profissional verificada e válida para (escritório, profissional, conta):
 * - verificação por operador independente;
 * - não revogada e não vencida;
 * - CRM/UF conferidos iguais ao cadastro ATUAL do profissional (alterar o cadastro invalida).
 * Usada pela função central `actor_clinical_medico_ids` e pela inclusão do vínculo no autovínculo
 * do único owner (NOB-160).
 */
export function identityVerified(
  org: SQLWrapper,
  medico: SQLWrapper,
  user: SQLWrapper,
): SQL {
  return sql`exists (select 1 from public.professional_identity_verifications v
        join public.medicos vm on vm.id = v.medico_id and vm.org_id = v.org_id
        where v.org_id = ${org} and v.medico_id = ${medico} and v.user_id = ${user}
          and v.crm = vm.crm and v.registration_uf = vm.registration_uf and v.expires_at > now()
          and not exists (select 1 from public.professional_identity_review_events r
            where r.org_id = v.org_id and r.verification_id = v.id and r.kind = 'revoked'))`;
}

/** Profissional (medico_id) com acesso clínico efetivo da conta da sessão no escritório. */
export function actorClinicalMedico(org: SQLWrapper, medico: SQLWrapper): SQL {
  return sql`${medico} in (select public.actor_clinical_medico_ids(${org}))`;
}
