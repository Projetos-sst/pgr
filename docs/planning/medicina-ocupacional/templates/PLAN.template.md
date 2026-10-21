# PLAN — Lote <preencher: NN> <preencher: nome>

<!-- Modelo. Copiar para lotes/<NN-slug>/PLAN.md (links já relativos a essa pasta). Plano aprovado antes de codar. Proposta não é decisão: marcar o que depende de quem. -->

> Status do plano: <preencher: rascunho / em revisão / aprovado por <nome> em <data>>

## 1. Resultado esperado

<preencher: o que o usuário consegue fazer ao fim, verificável em ambiente de teste>

**Fora de escopo:** <preencher>

## 2. Arquitetura

<preencher: camadas tocadas (page → action → domain → repository → schema), reuso (company_modules, cadastros comuns,
pipeline do Douglas, contrato medical_risk_*)>

## 3. Implementação e sequência

1. <preencher>

## 4. Arquivos

| Arquivo | Mudança |
|---|---|
| <preencher: caminho> | <preencher: novo / alterado — o quê> |

## 5. Tabelas e migrations

- Migration: <preencher: "nenhuma" ou nome + número acordado com Rikelvin/Douglas>
- Se houver migration, colar e preencher o checklist de [06](../../geral/06-GIT-MIGRATIONS-CD.md) §3.4:

- [ ] Última migration em origin/develop: <preencher>
- [ ] Journal/snapshots coerentes, `when` maior que o último
- [ ] Branches/PRs concorrentes com migration verificadas
- [ ] Rikelvin e Douglas de acordo (número e ordem)
- [ ] Ambiente afetado pelo CD registrado (homologação no merge; produção no release)
- [ ] Ensaio em Postgres efêmero sem suíte skipped
- [ ] RLS (isolamento + RESTRICTIVE medicine), GRANTs, índices, FKs
- [ ] Dados antigos / backfill idempotente
- [ ] Falha e recuperação (migration para frente)
- [ ] Rollout aditivo

## 6. APIs (4 superfícies do CLAUDE.md)

| Recurso | Server Action | REST | api-design.md | Postman |
|---|---|---|---|---|
| <preencher> | <preencher> | <preencher: verbo + rota> | [ ] | [ ] |

## 7. Segurança e permissões

- Gate: <preencher> · Tenant: `withOrg` · Empresa/módulo: <preencher>
- Regras S-xx aplicáveis ([05](../../geral/05-SEGURANCA-E-DADOS.md) §2): <preencher>

## 8. Validações

- <preencher: zod, regras de domínio, constraints>

## 9. Testes planejados

| Camada | Casos |
|---|---|
| Unit | <preencher> |
| Integração (Postgres efêmero) | <preencher; incluir runIsolationSuite para tabela nova> |
| E2E (Playwright protected, local) | <preencher; dados fictícios> |
