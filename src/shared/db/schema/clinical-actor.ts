import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Identidade profissional verificada e válida para (escritório, profissional, conta):
 * - verificação por operador independente;
 * - não revogada e não vencida: vale até `expires_at` e, no máximo, 12 meses depois da conferência
 *   (`verified_at`), inclusive para verificações anteriores à 0083 com validade original maior
 *   (decisão NOB-158; o histórico não é reescrito);
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
          and v.verified_at + interval '12 months' > now()
          and not exists (select 1 from public.professional_identity_review_events r
            where r.org_id = v.org_id and r.verification_id = v.id and r.kind = 'revoked'))`;
}

/**
 * Validade EFETIVA de uma verificação: o menor entre `expires_at` e `verified_at + 12 meses`
 * (NOB-158). Usada nas leituras do app (situação e fila), com a mesma regra do predicado do banco.
 */
export function identityEffectiveExpiry(
  verifiedAt: SQLWrapper,
  expiresAt: SQLWrapper,
): SQL {
  return sql`least(${expiresAt}, ${verifiedAt} + interval '12 months')`;
}

/** Profissional (medico_id) com acesso clínico efetivo da conta da sessão no escritório. */
export function actorClinicalMedico(org: SQLWrapper, medico: SQLWrapper): SQL {
  return sql`${medico} in (select public.actor_clinical_medico_ids(${org}))`;
}
