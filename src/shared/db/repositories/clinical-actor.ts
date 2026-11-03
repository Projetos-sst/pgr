import "server-only";

import { sql } from "drizzle-orm";

import type { TenantTransaction } from "../with-org";

/**
 * Profissionais (medico_id) com acesso clínico EFETIVO da conta da sessão no escritório (NOB-158/159),
 * pela mesma função central que as policies usam: vínculo ativo, médico ativo, associação viva,
 * convite ou legado reconfirmado, e identidade verificada válida. Exige `app.current_actor` na
 * transação. Nenhuma checagem clínica do servidor deve olhar `medico_user_links` diretamente.
 */
export async function actorClinicalMedicoIdsTx(
  tx: TenantTransaction,
  orgId: string,
): Promise<string[]> {
  const rows = (await tx.execute(
    sql`select medico_id from public.actor_clinical_medico_ids(${orgId}) as c(medico_id)`,
  )) as unknown as { medico_id: string }[];
  return rows.map((r) => r.medico_id);
}
