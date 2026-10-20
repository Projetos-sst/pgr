# NOB-100 — serviços por empresa

Base: NOB-99 / PR #110. Reutiliza as tabelas da NOB-97, sem nova migration.

## Regras confirmadas

Owner habilita/desabilita PGR e Medicina separadamente por empresa. Colaboradores
consultam e operam serviços habilitados; não podem alterar a contratação. Novas
empresas começam sem módulos. A migração da NOB-97 mantém os acessos antigos.
Não alterar preços, trial, checkout, plano Pro ou webhooks Stripe.

## Implementação

- `company-module-core`: valida papel, ID e entrada antes de persistir.
- Repositório serializa alterações por lock da empresa e grava estado e evento
  na mesma transação. Repetir o estado atual é idempotente, sem evento fictício.
- Evento append-only contém responsável, data, motivo, estado anterior e novo.
- Action e REST GET/PUT em `/api/v1/companies/{id}/modules` usam o mesmo core.
- Lista de empresas mostra serviços; `/companies/{id}/services` permite consulta,
  manutenção pelo owner e histórico paginado. Revogar preserva registros.
- Medicina não exige habilitar PGR. Entrada/consulta de PGR externo é NOB-98;
  esse critério integrado depende da PR seguinte.

## Riscos e validação

Provar negação para colaborador/cliente, ID de outro tenant, entrada adulterada,
validação de motivo e módulo, idempotência, concorrência, histórico atômico e
revogação efetiva no PGR/exames. Conferir que orgs.plan não é alterado.

Constitution Check: mesma stack, tenant da sessão, role + RLS; API/documentação/
Postman juntos; sem nova infraestrutura e sem alterações comerciais.
