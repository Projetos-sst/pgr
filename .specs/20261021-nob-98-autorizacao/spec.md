# NOB-98 — autorização técnica por empresa-cliente

## Decisões aprovadas

A empresa-cliente indica seu autorizador. O owner do escritório registra a
indicação e sua evidência; não escolhe competência técnica por ser owner.
O autorizador usa conta própria, concede/revoga autorização de profissionais
naquela empresa e registra identificação profissional. Validação/rejeição de
riscos exige autorização própria. Roles existentes não recebem autorização
técnica automática. Histórico anterior é preservado.

## Plano de implementação

1. Reutilizar usuários/memberships existentes, tenant da sessão e vínculo de
   empresa de membros client quando presente. Não criar convites, contas ou
   alterar regras de planos/preços. Permitir a área delegada a client somente
   após checar a indicação/autorização daquela empresa; demais áreas mantêm gate.
2. Migration aditiva: autorizador atual por empresa, autorizações profissionais,
   eventos append-only e decisões técnicas com snapshot da identificação.
3. Serializar mudanças pela empresa; gravar estado e evento na mesma transação.
   Substituição encerra o poder do autorizador anterior imediatamente; autorizações
   profissionais existentes continuam até revogação explícita pelo autorizador
   atual. Remoção de membership elimina concessões atuais, preservando eventos.
4. Validação/rejeição registra usuário real, data, motivo e identificação vigente;
   proteger contra decisão concorrente. Origem importada permanece pending.
   Bloquear validação de fonte interna alterada/indisponível/substituída.
5. Actions + REST compartilham core/repositório. Área própria por empresa com
   seleção de usuários existentes e histórico paginado. Documentar API/Postman.
6. Testar owner sem indicação, client delegado, substituição/revogação, outra
   empresa/tenant, identificação, concorrência e rollback de auditoria, além da
   integração existente de fontes, RLS, tipos, lint, formatação e build/CI.

## Impactos e cuidados

Arquivos novos em domains/medicine, schema/repositories, server/medicine,
actions/medicine, api/v1/companies/[id] e área protegida de autorização.
Estender os wrappers existentes com opção explícita de contexto de tenant,
mantendo o gate staff como default; somente as novas rotas delegadas usam a opção.
GRANT de atualização do risco limitado aos campos de revisão; conteúdo da origem
continua imutável. Identificação inclui profissão e registro quando aplicável,
ou justificativa de não aplicação, sem impor conselho/licença por conta própria.

Nenhuma migration em banco real, merge ou deploy nesta etapa. O cadastro declara
identificação; não verifica habilitação legal em conselho externo nem assina o PGR.
