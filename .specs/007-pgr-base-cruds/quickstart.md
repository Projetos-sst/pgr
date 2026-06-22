# Quickstart — Fatia 007 (CRUDs base do PGR)

## Pré-requisitos

- Branch `feature/pgr-base-cruds` (criada). Schema já migrado na 006 (migration `0005`) — **esta
  fatia não roda migration**.
- Variáveis de ambiente do app (Supabase/Clerk) configuradas em `.env.local`.
- Para os testes de integração de isolamento (RLS): `INTEGRATION_DATABASE_URL` (admin/owner),
  `INTEGRATION_APP_RUNTIME_URL` (role `app_runtime`) apontando para um **Postgres efêmero**.

## Rodar a aplicação

```bash
npm run dev         # http://localhost:3000
```

Rotas da fatia (área autenticada, equipe do escritório — papel owner/collaborator):

- `/companies`, `/work-units`, `/job-roles`, `/ges`, `/employees`.
  Um membro com papel `client` recebe **403** (página `forbidden`).

## Fluxo de validação manual (caminho feliz, na ordem da cadeia)

1. **Empresa**: criar com razão social + Grau de Risco (1–4) → aparece na lista; editar; ver aviso
   de cascata ao excluir.
2. **Unidade de Obra**: criar sob a empresa; usar "copiar endereço da empresa".
3. **Função**: criar sob a empresa (com CBO livre).
4. **GES**: criar (empresa → obra em cascata); adicionar função com `worker_count` → ver nº de
   expostos = soma; editar/remover vínculo → soma recalcula.
5. **Funcionário**: criar com CPF; selecionar GES → o picker de Função mostra só as funções do GES.

## Testes

```bash
npm run lint && npm run typecheck      # quality gate (Princípio V / Fluxo)
npm run test                            # unitários (validação, DTO, derivação, mapeamento de erro)
npm run test:integration                # Server Actions/queries + 404 cross-tenant + isolamento (efêmero)
```

Os testes de isolamento são pulados automaticamente se `INTEGRATION_APP_RUNTIME_URL`/
`INTEGRATION_DATABASE_URL` não estiverem setadas (ver `runIsolationSuite`).

## Critérios de "pronto" (da spec)

- SC-001 CRUD completo nas 5 entidades · SC-002 risk_grade 1..4 · SC-003 expostos derivado ·
  SC-004 picker de função do GES · SC-005 unicidade por tenant (CPF/CNPJ) · SC-006 isolamento
  total (404 cross-tenant, lista vazia) · SC-007 suites verdes · SC-008 papel `client` negado ·
  SC-009 listas paginadas no servidor.

## Onde mexer (mapa rápido)

- Contrato de retorno: `src/shared/server/result.ts` (novo).
- Gate de papel: `src/shared/auth/require-office-staff.ts` (novo) + `ForbiddenError` em `errors.ts`.
- Server Actions: `src/shared/server/actions/pgr/*.ts` (novos).
- Schemas de entrada + DTO: `src/shared/domains/pgr/*.ts` (reusar `validation.ts`/`exposed-workers.ts`).
- Repositórios: `src/shared/db/repositories/*.ts` (estender).
- UI: `src/app/(protected)/{companies,work-units,job-roles,ges,employees}/`.
- Testes: `src/__tests__/unit/domains/pgr/`, `src/__tests__/integration/pgr/` (reusar `_helpers/`).
