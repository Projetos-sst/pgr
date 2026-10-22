# Lote 01 — REVIEW

> [README do lote](README.md) · [PLAN](PLAN.md)

## 1. Estado

**Revisão interna concluída em 2026-10-21. A revisão do Douglas na [PR #120](https://github.com/Projetos-sst/pgr/pull/120) está pendente.**

Revisores:

- revisão de segurança independente (agente dedicado, só leitura);
- revisão do coordenador sobre core, repositórios e páginas;
- QA (testes e navegador).

## 2. Revisão de segurança independente

**Resultado: 0 CRITICAL, 0 HIGH, 0 MEDIUM.**

| ID     | Severidade         | Achado                                                                                                                                                                                                                                                                                                                                                | Destino                                                                                                                    |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| LOW-1  | LOW (preexistente) | Em erro 500, o `restHandler` loga `error.message` (`api/rest.ts:119-125`). Com Drizzle, a mensagem inclui SQL e parâmetros, como o termo de busca e IDs. `GET /medicine/employees` é mais uma entrada para esse caminho. Não é dado clínico. O lote não piora o padrão e, nos filtros de exames, melhora: UUID malformado agora vira 422 antes do SQL | Fora do lote: `rest.ts` é alterado pela #112. Sugestão: logar só `error.name` e o SQLSTATE                                 |
| INFO-1 | INFO               | `/health-exams/new?employeeId=` mostrava o nome do funcionário de empresa sem Medicina no cabeçalho                                                                                                                                                                                                                                                   | **Corrigido**: descrição genérica até confirmar a Medicina (`health-exams/new/page.tsx`). Verificado no navegador (QA N17) |
| INFO-2 | INFO               | A checagem de módulo usa `getCompanyModuleOverviewAction`, que também lê o histórico de módulos. Só o estado derivado chega à tela, sem vazamento                                                                                                                                                                                                     | Aceito. Um helper leve fica como melhoria futura                                                                           |
| INFO-3 | INFO               | Nas leituras de exames, o isolamento por módulo fica na RLS RESTRICTIVE `health_exams_module_access`, sem predicado na aplicação                                                                                                                                                                                                                      | Aceito: é o desenho do PLAN §8. No painel, os IDs já vêm de uma lista filtrada por módulo                                  |

### Garantias confirmadas (arquivo:linha no momento da revisão)

| Tema                                                                                                        | Onde                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guard nas páginas (`requireOfficeStaffPage`; `client` → `forbidden()`)                                      | `medicine/page.tsx`, `health-exams/page.tsx`, `health-exams/new/page.tsx`, `employees/[id]/page.tsx`, `medicos/page.tsx`; `page-guards.ts:14-20` |
| `officeAction` nas actions, sem payload em log                                                              | `actions/medicine/overview.ts`, `actions/pgr/health-exams.ts`; `office-action.ts:38-52`                                                          |
| `restHandler` no REST; `x-dev-role` que não é staff → 403                                                   | `api/v1/medicine/*/route.ts`, `api/v1/health-exams/route.ts`; `rest.ts:67-75`                                                                    |
| Tenant sempre de `ctx.tenantId`; `withOrg` + `eq(orgId)`                                                    | `overview-core.ts`, `medicine-overview.ts`, `repositories/health-exams.ts`                                                                       |
| Predicado de módulo em `companies` e `employees`                                                            | `medicine-overview.ts`; `overview-core.ts` (`module: "medicine"`)                                                                                |
| Empresa sem Medicina → FORBIDDEN; de outro tenant → NOT_FOUND                                               | `overview-core.ts`; `company-modules.ts:42-47`                                                                                                   |
| Gravação recusada sem Medicina                                                                              | `assertCompanyModuleTx` (`repositories/health-exams.ts:38`) + RLS `WITH CHECK`                                                                   |
| IDOR: filtros somados a `org_id`; ID de outro tenant → vazio ou 404                                         | `repositories/health-exams.ts`; `health-exams/new/page.tsx` (`notFound()`)                                                                       |
| ID malformado → VALIDATION                                                                                  | `healthExamListFiltersSchema`, `medicineEmployeesQuerySchema`; `action-error.ts`                                                                 |
| Sem `notes`/`certificatePath`/CPF nos contratos novos; Client Components recebem só `{id, nome}`            | `domains/medicine/employees.ts`; `new/page.tsx`, `health-exams/page.tsx`, `medicine/page.tsx`                                                    |
| Redirecionamento aberto: `returnTo` montado no servidor; `hrefWithParams` com base fixa + `URLSearchParams` | `new/page.tsx`, `health-exam-form.tsx`, `list-error-state.tsx`                                                                                   |
| Sem `localStorage`/`sessionStorage`, IA ou `console` nos arquivos do lote                                   | grep + navegador (QA N14)                                                                                                                        |
| Escopo: nada em `db/schema`, `db/migrations`, `office-action.ts`, `rest.ts`, `proxy.ts`, policies           | `git diff --name-only origin/develop..HEAD`                                                                                                      |
| Sem periodicidade: só `classifyDocumentValidity(valid_until)` com janela de 30 dias                         | `domains/medicine/overview.ts`, `timeline.ts`                                                                                                    |

## 3. Outros achados (coordenador e QA)

| Achado                                                                                                               | Severidade                             | Destino                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `listEmployees` ordenava só por `created_at`; a paginação podia repetir ou omitir funcionários                       | MEDIUM (afetava a paginação do painel) | **Corrigido**: desempate por `id`                                                      |
| Mensagem de UUID inválido em inglês, com a regex, nos filtros de exames                                              | LOW                                    | **Corrigido**: "Funcionário inválido" / "Empresa inválida"                             |
| Cabeçalho "Falha na leitura · FORBIDDEN" também no bloqueio por módulo (`/health-exams/new` de empresa sem Medicina) | LOW (texto)                            | Aberto, para ajuste de texto em PR futura ou na revisão                                |
| O tenant do servidor de QA vem do Supabase (`listTenantMembershipsByUser` usa o cliente Supabase, não o Drizzle)     | INFO (ambiente)                        | Registrado no QA §2. O QA local precisa replicar os dados sob o tenant real do usuário |
| Documentos de planejamento fora do Prettier quebravam o `quality` do CI                                              | MEDIUM (CI)                            | **Corrigido** no commit de documentação (só espaço em branco)                          |

## 4. Checklist

### Escopo

- [x] Zero migration: nenhum arquivo em `src/shared/db/schema/**` ou `src/shared/db/migrations/**` no diff.
- [x] Nenhum dado clínico novo; `notes`/`certificatePath` fora das telas e contratos novos (teste + payload no navegador).
- [x] Nenhuma periodicidade calculada; rótulos "validade informada".
- [x] Nenhuma emissão, assinatura, PCMSO, Lista C ou portal.
- [x] Nenhum cadastro paralelo de empresa ou funcionário.
- [x] Divergências com o FIRST-MVP limitadas às do PLAN §12, decididas no T01-02.

### Arquitetura e quatro superfícies

- [x] Páginas só orquestram; actions e handlers não tocam Drizzle; SQL só em repositórios, dentro de `withOrg`.
- [x] Core único (`server/medicine/overview-core.ts`) usado por Action e REST.
- [x] Para cada leitura nova: Action + REST + `api-design.md` + Postman.
- [x] Coleção Postman única e válida; variáveis reaproveitadas.

### Segurança

- [x] `client` bloqueado nas actions e no REST (testes). Nas telas, o guard foi conferido no código; o navegador não foi testado por falta de conta `client`.
- [x] Tenant sempre de `ctx.tenantId`.
- [x] Predicado `medicine` em toda consulta de `employees` da Medicina.
- [x] Empresa sem Medicina: FORBIDDEN explícito; seção oculta na ficha.
- [x] ID malformado → VALIDATION.
- [x] `returnTo` montado no servidor.
- [x] Nada em `localStorage`; nenhum log com payload; nenhuma IA.

### UX e acessibilidade

- [x] Erro ≠ vazio em `/medicine`, `/health-exams`, `/health-exams/new`, `/medicos` e na seção da ficha.
- [x] `ListErrorState` sem `<main>`/`<h1>` duplicados; `loading.tsx` com `role="status"` (só código; o visual não foi visto).
- [x] Badges com rótulo textual; `StatusBadge` de `data-list.tsx`.
- [x] Sem teal; sem hex cru novo.
- [x] 320/375/768/1440 sem rolagem horizontal; selects com 44px.
- [x] `/dashboard` sem regressão (diff de classes + captura).
- [x] Lighthouse a11y de `/medicine` = 100.

### Testes

- [x] Unitários de fronteira de validade e de estados (RTL).
- [x] Integração em Postgres efêmero, zero skipped nas suítes de Medicina.
- [x] `runIsolationSuite` para `health_exams`.
- [x] Filtro por empresa sem vazamento no mesmo escritório.
- [x] Regressão das suítes existentes.
- [ ] Spec Playwright automatizado (`tests/e2e/medicine-protected.spec.ts`): **não feito**, exige `E2E_CLERK_*`.

### Integração com a #112

- [x] A #112 entrou primeiro na develop (`7793fca`); a develop foi integrada à branch do lote (`7ac18cd`). O único conflito foi em `nav-menu.tsx`, resolvido mantendo os três itens (ver §6).

## 5. Pendências para o revisor humano (Douglas)

1. Aceitar ou ajustar os desvios do PLAN listados no [WALKTHROUGH](WALKTHROUGH.md).
2. LOW-1 (`rest.ts`), para ser tratado na #112 ou depois dela.
3. Usuário de teste do Clerk para o projeto Playwright `protected`. Sem ele, o E2E da Medicina não automatiza.
4. ~~Ordem de merge #112 × #120 (arquivos comuns).~~ Resolvido: a #112 entrou primeiro e a develop foi integrada (§6).
5. Volume de documentação na PR: 98 dos 150 arquivos do diff são de `docs/planning/` (cerca de 10 mil linhas). Ver a sugestão de
   separação no relatório da sessão; nada foi separado sem autorização.

## 6. Revalidação após a integração da #112 (2026-10-21, noite)

Revisão independente, só leitura, do merge `7ac18cd`. **Resultado: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW.**

| Ponto                                                                                                                                   | Evidência (arquivo:linha no merge)                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenantAccess` (novo, admite `client`) não é usado pelo Lote 01                                                                         | só em `actions/medicine/risk-authorizations.ts` e rotas de autorização/revisão da NOB-98; padrão `requireOfficeStaff()` em `office-action.ts:25-29` e `resolveContext` em `rest.ts:114`; páginas com `requireOfficeStaffPage()` |
| `companyModuleScope` refatorado gera o mesmo SQL para `medicine`                                                                        | `module-policy.ts` (`MODULE_LITERALS`); uso em `medicine-overview.ts:30,37`                                                                                                                                                     |
| NOT_FOUND / FORBIDDEN preservados                                                                                                       | `getCompanyModules` e `assertCompanyModuleTx` inalterados; só `setCompanyModule` passou a usar `auditedTenantWrite`                                                                                                             |
| Policies 0054–0056 não alcançam as tabelas lidas pelo lote                                                                              | nenhuma em `health_exams`, `employees`, `companies`, `company_modules`, `medicos`; `org_memberships_risk_actor_read` não é consultada pelo lote                                                                                 |
| Sem consulta a `risks`, `risk_assessments`, `medical_risk_*`; sem `originalData`, `notes`, `certificatePath` ou CPF nos contratos novos | grep nos arquivos do lote; `domains/medicine/employees.ts:21-29`, `repositories/health-exams.ts:132-138`, `overview-core.ts:66-82`                                                                                              |
| Menu sem perda de itens                                                                                                                 | `nav-menu.tsx:104-115`; o menu não filtra por papel, igual à develop                                                                                                                                                            |
| Sem export ou arquivo duplicado em `*/medicine/`                                                                                        | listagem dos diretórios                                                                                                                                                                                                         |

INFO preexistente, fora dos contratos novos: a ficha `/employees/[id]` já mostrava CPF e caminho de certificado antes do lote.
