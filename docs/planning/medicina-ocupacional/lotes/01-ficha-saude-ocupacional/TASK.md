# Lote 01 — TASK

> **Status real (2026-10-21): `PR_ABERTA` em draft ([#120](https://github.com/Projetos-sst/pgr/pull/120)).** Código, testes
> automatizados, QA no navegador (1440/768/375/320) e revisão de segurança concluídos. **Pendentes:** spec Playwright automatizado
> (exige usuário de teste do Clerk), revisão do Douglas, aceite. CI verde em `59bf798`. Base: [`../../FIRST-MVP.md`](../../FIRST-MVP.md) + [PLAN](PLAN.md).
> Um item só é marcado com evidência registrada no [WALKTHROUGH](WALKTHROUGH.md) ou no [QA](QA.md). Responsável padrão:
> **Carlos** (execução assistida pelo coordenador Claude). [README](README.md)

## 1. Pré-check Git

- [x] **T01-01** Conferir o ponto de partida antes de qualquer código.
  - [x] `git fetch` e confirmar que a branch atual é `feature/NOB-108-ficha-saude-ocupacional`.
  - [x] Confirmar que a base é o `origin/develop` atual: `origin/develop` = `d6b787c`, igual à base da branch; **nenhum merge necessário**.
  - [x] `git status` limpo antes do código (só a documentação já commitada em `c0f10e4`).
  - [x] Última migration do develop: `0053_company_module_access`. #112 aberta (draft, base `develop`, CI verde) e reserva 0054–0056.
  - [x] Nenhum arquivo de `src/shared/db/schema/**` ou `src/shared/db/migrations/**` tocado (conferido no diff final).
  - Evidência: [WALKTHROUGH](WALKTHROUGH.md) §T01-01. Status: **concluído**.

## 2. Leitura do código atual

- [x] **T01-02** Reler os pontos do [AUDIT](AUDIT.md) no HEAD real e decidir as pendências de escopo.
  - [x] Linhas do AUDIT conferidas pelos agentes de backend e frontend antes de mudar (sem divergência relevante; ver WALKTHROUGH).
  - [x] `optionalUuid`/`optionalString`/`requiredUuid` conferidos (string vazia → `undefined`).
  - [x] `logTenantEvent` conferido: leitura sem `audit` não registra sucesso; erro registra só operação, resultado, org e usuário.
  - [x] Decididos PLAN §12 itens 1, 2, 3 e 4 (WALKTHROUGH §T01-02).
  - Status: **concluído**.

## 3. Componentes reutilizáveis

- [x] **T01-03** Preparar as primitives sem mudar o visual existente.
  - [x] `src/app/(protected)/_ui/list-error-state.tsx` (`<section role="alert">`, `<h2>`, sem `<main>`).
  - [x] `src/app/(protected)/_ui/stat-card.tsx` promovido, `href?` opcional; reexport no dashboard.
  - [x] `EmptyState` com `action?: ReactNode` opcional.
  - [x] `/dashboard` conferido: KPIs continuam links com as **mesmas classes** da develop (diff) + captura posterior
        `capturas/q18-dashboard-1440.png`. Sem captura "antes" (evitou-se trocar de branch com o dev server no ar).
  - Typecheck verde; testes de componente verdes. Status: **concluído**.

## 4. Rotas

- [x] **T01-04** Implementar as telas do PLAN §3.
  - [x] `/medicine` (`page.tsx`, `loading.tsx`, `_components/*`).
  - [x] `/employees/[id]`: `OccupationalHealthSection`.
  - [x] `/health-exams`: filtro de empresa, `employeeId`, erro ≠ vazio, estado sem Medicina.
  - [x] `/health-exams/new?employeeId=` + `returnTo` montado no servidor.
  - [x] `/medicos`: erro ≠ vazio.
  - [x] Menu: item "Painel" no grupo Medicina.
  - [x] Jornada navegável localmente e sem rolagem horizontal em 320/375/768/1440 ([QA](QA.md) §5).
  - Status: **concluído**.

## 5. Repositories

- [x] **T01-05** Leituras novas, sem escrita nova.
  - [x] `listHealthExams`: filtros `employeeId` e `companyId` (empresa atual do funcionário).
  - [x] `listLatestHealthExamsByEmployee(orgId, employeeIds)` com desempate determinístico.
  - [x] `medicine-overview.ts` (`getMedicineOverviewData`, uma transação `withOrg`, predicado de módulo também em `employees`).
  - [x] Decidido: todos os status de funcionário contam; semântica "último exame por funcionário".
  - [x] Extra: `listEmployees` ganhou desempate por `id` (paginação estável; achado do QA).
  - Status: **concluído**.

## 6. Actions

- [x] **T01-06** Core + Server Actions.
  - [x] Domínio: `EXAM_DUE_WINDOW_DAYS`, `healthExamListFiltersSchema`, `domains/medicine/{overview,employees,timeline}.ts`.
  - [x] `server/medicine/overview-core.ts` com `NOT_FOUND`/`FORBIDDEN` explícitos.
  - [x] `server/actions/medicine/overview.ts` com `officeAction`.
  - [x] `listHealthExamsAction` valida os filtros; create/update revalidam `/medicine` e `/employees/[id]`.
  - Status: **concluído**.

## 7. REST

- [x] **T01-07** Espelho REST.
  - [x] `GET /api/v1/medicine/overview`.
  - [x] `GET /api/v1/medicine/employees` (`companyId` obrigatório).
  - [x] `GET /api/v1/health-exams` com `employeeId`/`companyId`.
  - Evidência: testes `rest-medicine` + cURL com o bypass dev contra o banco local de QA ([QA](QA.md) §3). Status: **concluído**.

## 8. Documentação de API

- [x] **T01-08** `api-design.md` e coleção Postman única atualizados; JSON válido; nenhuma variável nova. Status: **concluído**.

## 9. Segurança e permissões

- [x] **T01-09** Tabela do PLAN §8 conferida linha a linha (revisão independente, [REVIEW](REVIEW.md) §2). Status: **concluído**.

## 10. Unitários

- [x] **T01-10** `npm run test`: 179 suítes / 1768 testes passaram, 0 skipped ([QA](QA.md) §2). Status: **concluído**.

## 11. Integração

- [x] **T01-11** Seed fictício + 5 suítes de Medicina (53 testes) + regressão.
  - [x] `npm run test:integration` em Postgres efêmero: 169 suítes passaram, 0 falharam, 5 skipped (nenhuma da Medicina).
  - Status: **concluído**.

## 12. Playwright

- [ ] **T01-12** `tests/e2e/medicine-protected.spec.ts`.
  - **Spec não escrito.** O projeto `protected` exige `E2E_CLERK_*` (usuário de teste do Clerk), ausentes neste ambiente.
  - Compensação executada: a jornada FIRST-MVP passos 1→7 e os itens 1, 3, 4, 5 do §9 foram percorridos no navegador real (Chrome via
    DevTools MCP, login feito pelo Carlos, banco local fictício), em 1440/768/375/320 — [QA](QA.md) §5.
  - Status: **parcial — automação bloqueada por credencial de teste (decisão do Douglas)**.

## 13. Chrome DevTools

- [x] **T01-13** Verificação no navegador: console 0 erros, rede sem 4xx/5xx, sem dado médico em storage, sem `notes` no payload,
      Lighthouse a11y 100 em `/medicine`, erro forçado com `ListErrorState` ([QA](QA.md) §5). Status: **concluído**.

## 14. Review

- [ ] **T01-14** Revisão de código e de segurança.
  - [x] Revisão de segurança independente: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW (preexistente), 3 INFO; INFO-1 corrigido.
  - [x] Revisão do coordenador sobre core, repositórios e páginas.
  - [ ] Revisão do Douglas na PR.
  - Status: **em revisão**.

## 15. QA

- [x] **T01-15** Cenários Q01–Q19 do [QA](QA.md) executados com evidência; não verificados: tela de `client` e estado de
      collaborator no navegador (sem contas desses papéis) e `loading.tsx` visual.

## 16. PR

- [x] **T01-16** PR para `develop` aberta em **draft** (número no [WALKTHROUGH](WALKTHROUGH.md)), com escopo, zero migration, 4
      superfícies, comandos e limitações. A combinação com o Rikelvin sobre os arquivos comuns (T00-E3) segue pendente; os conflitos
      esperados são só `nav-menu.tsx`, `api-design.md` e Postman.

## 17. CI

- [x] **T01-17** CI da PR verde no head `59bf798` (2026-10-21): Lint, format & typecheck ✔ · Production build ✔ · Unit & integration
      tests ✔. A 1ª execução (`8372ec3`) falhou só no Prettier dos docs de planejamento, corrigido.

## 18. Aceite

- [x] **T01-18** Aceite: o Douglas validou a entrega e autorizou o merge, informado pelo Carlos em 2026-10-22. A demonstração
      formal do FIRST-MVP §9 não tem registro próprio.

## 19. Merge com autorização

- [x] **T01-19** Merge em `develop` com autorização do Douglas e do Carlos: PR #120, merge commit `15015fa` (2026-10-22 02:46 UTC).
      CD da develop verde (run `39713265589`): migrations sem pendência nova (`migrations applied successfully!`), build e
      publicação na homologação ok. Zero migration do lote.

## 20. Homologação

- [ ] **T01-20** Validar em homologação com dados fictícios, só com autorização. Status: não iniciado (deploy publicado, sem
      validação registrada).
