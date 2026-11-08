import { sql, type SQL } from "drizzle-orm";

/**
 * Dia de calendário de hoje no fuso America/Sao_Paulo, calculado no banco. Mesma regra de
 * `todayInSaoPaulo()` (`src/shared/dates.ts`) no app: o sistema não tem fuso por escritório.
 */
export const saoPauloTodaySql = sql`(now() at time zone 'America/Sao_Paulo')::date`;

/**
 * Permissão do coordenador do PCMSO (NOB-109/NOB-144/NOB-149): a designação `alias` (linha de
 * `pcmso_coordinator_assignments` no `from` do chamador) está **em vigor hoje** no calendário de
 * São Paulo e é a **única** em vigor na empresa nesse dia.
 *
 * - "Em vigor" ≠ "aberta": `starts_on <= hoje` e (`ends_on` nulo ou `ends_on >= hoje`). As colunas
 *   são DATE e o fim é inclusivo; a troca encerra a anterior na véspera do início da nova, então
 *   no dia da troca só a nova vale. Encerramento agendado mantém o poder até o fim; sucessor
 *   agendado só tem poder a partir do início.
 * - Sobreposição (duas designações em vigor no mesmo dia, só alcançável fora do app): ninguém tem o
 *   poder — falha fechada, sem escolher uma. Mesma regra de `coordinatorInForceOn` (`overlap`).
 *
 * Só decide QUEM PODE AGIR AGORA. Quem era o coordenador na data de referência de um documento
 * (prévia, ASO) é conteúdo do documento e segue a regra própria dele.
 */
export function coordinatorAssignmentInForceToday(alias: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/.test(alias))
    throw new Error(`Alias SQL inválido para a designação: ${alias}`);
  const a = sql.raw(alias);
  const today = saoPauloTodaySql;
  return sql`${a}.starts_on <= ${today} and (${a}.ends_on is null or ${a}.ends_on >= ${today})
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = ${a}.org_id and concurrent.company_id = ${a}.company_id
          and concurrent.id <> ${a}.id and concurrent.starts_on <= ${today}
          and (concurrent.ends_on is null or concurrent.ends_on >= ${today}))`;
}
