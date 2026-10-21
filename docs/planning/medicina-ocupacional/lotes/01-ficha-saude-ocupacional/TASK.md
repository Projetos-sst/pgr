# Lote 01 — TASK

> **Status real: PLANEJADO. Nenhuma tarefa iniciada ou concluída.** Branch `feature/NOB-108-ficha-saude-ocupacional` existe,
> sem commit de código; PR inexistente. Base: [`../../FIRST-MVP.md`](../../FIRST-MVP.md) + [PLAN](PLAN.md).
> Marcar um item só com evidência (arquivo, commit, saída de comando, captura) registrada no [WALKTHROUGH](WALKTHROUGH.md)
> ou no [QA](QA.md). Responsável padrão: **Carlos**. [README](README.md)

## 1. Pré-check Git

- [ ] **T01-01** Conferir o ponto de partida antes de qualquer código.
  - [ ] `git fetch` e confirmar que a branch atual é `feature/NOB-108-ficha-saude-ocupacional`.
  - [ ] Confirmar que a base é o `origin/develop` atual (`git merge-base HEAD origin/develop`); se o develop avançou, **merge** de
        `origin/develop` na branch (sem rebase, sem force), com o dev server **parado**. Ver `../../geral/06-GIT-MIGRATIONS-CD.md`.
  - [ ] `git status` limpo, exceto a pasta de documentação já combinada.
  - [ ] Confirmar a última migration do develop (esperado `0053_company_module_access`) e que a #112 continua aberta (afeta R1).
  - [ ] Confirmar que nenhum arquivo de `src/shared/db/schema/**` ou `src/shared/db/migrations/**` será tocado.
  - Critério de aceite: saída dos comandos anotada no WALKTHROUGH (SHA de base, última migration, estado da #112).
  - Responsável: Carlos. Dependências: nenhuma. Status: não iniciado.

## 2. Leitura do código atual

- [ ] **T01-02** Reler os pontos de [AUDIT](AUDIT.md) §1–§8 no HEAD real e decidir as pendências de escopo.
  - [ ] Conferir se as linhas citadas no AUDIT ainda batem (o develop pode ter mudado).
  - [ ] Conferir `optionalUuid`/`optionalString`/`requiredUuid` em `src/shared/domains/pgr/form-fields.ts` com string vazia.
  - [ ] Conferir o que `logTenantEvent` registra (não pode haver payload clínico).
  - [ ] **Decidir** PLAN §12 itens 1 (endpoint `/medicine/employees`), 2 (placeholder "Histórico") e 4 (`ListErrorState`).
  - Critério de aceite: decisões anotadas no WALKTHROUGH com data; divergências de linha corrigidas no AUDIT.
  - Responsável: Carlos. Dependências: T01-01. Status: não iniciado.

## 3. Componentes reutilizáveis

- [ ] **T01-03** Preparar as primitives sem mudar o visual existente.
  - [ ] `src/app/(protected)/_ui/list-error-state.tsx` (`<section role="alert">`, `<h2>`, sem `<main>`).
  - [ ] `src/app/(protected)/_ui/stat-card.tsx` promovido de `dashboard-widgets.tsx:6-76`, `href?` opcional; reexport no dashboard.
  - [ ] `EmptyState` (`_ui/list.tsx:73-107`) com `action?: ReactNode` opcional.
  - Critério de aceite: `/dashboard` visualmente idêntico (captura antes/depois em 1440 e 375); `npm run typecheck` verde; nenhum
    importador existente alterado além do reexport.
  - Responsável: Carlos. Dependências: T01-02. Status: não iniciado.

## 4. Rotas

- [ ] **T01-04** Implementar as telas do PLAN §3.
  - [ ] `/medicine` (`page.tsx`, `loading.tsx`, `_components/*`) conforme PLAN §3.1.
  - [ ] `/employees/[id]`: `OccupationalHealthSection` conforme PLAN §3.4.
  - [ ] `/health-exams`: filtro de empresa, `employeeId`, erro ≠ vazio, estado sem Medicina (PLAN §3.2).
  - [ ] `/health-exams/new?employeeId=` + `returnTo` montado no servidor (PLAN §3.3).
  - [ ] `/medicos`: erro ≠ vazio (PLAN §3.5).
  - [ ] Menu: item "Painel" no grupo Medicina (PLAN §3.6).
  - Critério de aceite: jornada FIRST-MVP §2 passos 1–8 navegável localmente com dados fictícios; nenhum `result.ok ? … : []` nas
    telas tocadas; sem rolagem horizontal em 375/768/1440.
  - Responsável: Carlos. Dependências: T01-03, T01-06 (as telas consomem as actions). Status: não iniciado.

## 5. Repositories

- [ ] **T01-05** Leituras novas, sem escrita nova (PLAN §5).
  - [ ] `listHealthExams`: filtros `employeeId` e `companyId` (empresa atual do funcionário).
  - [ ] `listLatestHealthExamsByEmployee(orgId, employeeIds)` com desempate determinístico.
  - [ ] `src/shared/db/repositories/medicine-overview.ts` (`getMedicineOverviewData`, uma transação `withOrg`, `companyModuleScope`
        aplicado também em `employees`).
  - [ ] **Decidir** se funcionários desligados entram na contagem e confirmar a semântica "último exame por funcionário" (PLAN §12 item 3).
  - Critério de aceite: toda consulta dentro de `withOrg`; nenhuma consulta de `employees` da Medicina sem o predicado de módulo;
    contrato de retorno igual ao PLAN §5.
  - Responsável: Carlos. Dependências: T01-02. Status: não iniciado.

## 6. Actions

- [ ] **T01-06** Core + Server Actions (PLAN §4 e §6).
  - [ ] Domínio: `EXAM_DUE_WINDOW_DAYS`, `healthExamListFiltersSchema`, `domains/medicine/{overview,employees,timeline}.ts`.
  - [ ] `src/shared/server/medicine/overview-core.ts` (`getMedicineOverview`, `listMedicineEmployees` com `NOT_FOUND`/`FORBIDDEN` explícitos).
  - [ ] `src/shared/server/actions/medicine/overview.ts` com `officeAction`.
  - [ ] `listHealthExamsAction` valida os filtros; create/update revalidam `/medicine` e `/employees/[id]`.
  - Critério de aceite: actions retornam `ActionResult<T>`; ID malformado → `VALIDATION`; nenhuma action toca Drizzle.
  - Responsável: Carlos. Dependências: T01-05. Status: não iniciado.

## 7. REST

- [ ] **T01-07** Espelho REST (PLAN §7.1).
  - [ ] `GET /api/v1/medicine/overview`.
  - [ ] `GET /api/v1/medicine/employees` (`companyId` obrigatório).
  - [ ] `GET /api/v1/health-exams` com `employeeId`/`companyId`.
  - Critério de aceite: mesmos core, schemas e `toActionError` das actions; códigos 200/403/404/422 conforme a tabela; testável via
    cURL/Postman com o bypass dev (fora de produção).
  - Responsável: Carlos. Dependências: T01-06. Status: não iniciado.

## 8. Documentação de API

- [ ] **T01-08** Registrar as superfícies (PLAN §7.2 e §7.3).
  - [ ] `docs/api/api-design.md`: recursos, sumário, seção de exames, seção "Medicina — painel", tabela de páginas.
  - [ ] `docs/api/sst-manager.postman_collection.json`: pasta "Medicina (painel)" + requests de filtro em "Saude Ocupacional (ASO)",
        reusando variáveis existentes.
  - Critério de aceite: JSON da coleção válido (parse sem erro); nenhuma variável ou segredo novo; as 4 superfícies conferidas
    item a item no REVIEW.
  - Responsável: Carlos. Dependências: T01-07. Status: não iniciado.

## 9. Segurança e permissões

- [ ] **T01-09** Conferir a tabela do PLAN §8 linha a linha no código.
  - [ ] `client` bloqueado nas 4 telas, nas actions e no REST.
  - [ ] Empresa sem Medicina: fora do painel, lista recusada, seção oculta, escrita recusada.
  - [ ] `notes`/`certificatePath` ausentes de toda tela e contrato novos; nada de periodicidade calculada.
  - [ ] `returnTo` só montado no servidor; nada em `localStorage`; nenhum log com payload.
  - Critério de aceite: checklist preenchido no REVIEW com arquivo:linha de cada garantia.
  - Responsável: Carlos (execução); revisão sugerida de Rikelvin (HIPÓTESE, aceite dele necessário). Dependências: T01-04…T01-08.
    Status: não iniciado.

## 10. Unitários

- [ ] **T01-10** Escrever e rodar os testes de PLAN §11.1.
  - Critério de aceite: `npm run test` verde, com os arquivos novos listados na saída; fronteiras de validade cobertas (nulo, ontem,
    hoje, hoje+30, hoje+31).
  - Responsável: Carlos. Dependências: T01-03, T01-06. Status: não iniciado.

## 11. Integração

- [ ] **T01-11** Seed fictício + suítes de PLAN §11.2 + regressão.
  - [ ] `_helpers/medicine-seed.ts` (sem dado real).
  - [ ] `overview`, `medicine-employees`, `health-exams-filters`, `rest-medicine`, `health-exams-isolation`.
  - [ ] Regressão das suítes existentes listadas no PLAN.
  - Critério de aceite: `npm run test:integration` contra **Postgres efêmero** com `INTEGRATION_APP_RUNTIME_URL` e
    `INTEGRATION_DATABASE_URL` definidas; **zero suítes "skipped"** nos arquivos de Medicina; saída anexada ao QA.
  - Responsável: Carlos. Dependências: T01-05…T01-07. Status: não iniciado.

## 12. Playwright

- [ ] **T01-12** `tests/e2e/medicine-protected.spec.ts` (PLAN §11.3).
  - Critério de aceite: passos 1→7 do FIRST-MVP e itens 1, 3, 4, 5 do §9 passando localmente em organização de teste; viewports
    375/768/1440 sem rolagem horizontal; capturas no QA. Nunca na organização real.
  - Responsável: Carlos. Dependências: T01-04, T01-11. Status: não iniciado.

## 13. Chrome DevTools

- [ ] **T01-13** Verificação no navegador (PLAN §11.4).
  - Critério de aceite: console sem erro; Network sem 5xx e sem `notes` em payload; Application sem dado médico; Lighthouse de
    acessibilidade de `/medicine` registrado; erro forçado mostra `ListErrorState`.
  - Responsável: Carlos. Dependências: T01-04. Status: não iniciado.

## 14. Review

- [ ] **T01-14** Revisão de código e de segurança com o checklist do [REVIEW](REVIEW.md).
  - Critério de aceite: parecer registrado no REVIEW, com pendências resolvidas ou aceitas por escrito.
  - Responsável: Carlos (autorrevisão) + revisor indicado pelo Douglas (HIPÓTESE). Dependências: T01-09…T01-13. Status: não iniciado.

## 15. QA

- [ ] **T01-15** Executar os cenários do [QA](QA.md) e anexar evidências.
  - Critério de aceite: cada cenário com resultado e evidência; nenhum "PASS" sem saída ou captura.
  - Responsável: Carlos. Dependências: T01-14. Status: não iniciado.

## 16. PR

- [ ] **T01-16** Abrir PR para `develop` **só após revisão** e combinação com o Rikelvin sobre os arquivos comuns (T00-E3).
  - Critério de aceite: PR descreve escopo, "zero migration", 4 superfícies, comandos executados e limitações (PLAN §12); link na
    NOB-108 se autorizado.
  - Responsável: Carlos. Dependências: T01-15, T00-E3. Status: não iniciado.

## 17. CI

- [ ] **T01-17** CI da PR verde (`quality`, `test` com Postgres 16, `build`).
  - Critério de aceite: checks verdes na PR; falha investigada na causa, sem pular hooks.
  - Responsável: Carlos. Dependências: T01-16. Status: não iniciado.

## 18. Aceite

- [ ] **T01-18** Demonstração do critério FIRST-MVP §9 para Carlos e Douglas (Expedito se convidado).
  - Critério de aceite: aceite registrado (quem, quando, canal) no WALKTHROUGH; pendências viram tarefas.
  - Responsável: Carlos. Dependências: T01-17. Status: não iniciado.

## 19. Merge com autorização

- [ ] **T01-19** Merge em `develop` **somente com autorização explícita** (Douglas/Carlos).
  - Critério de aceite: autorização registrada; SHA do merge anotado; lote passa a `MERGED` no [02](../../geral/02-ROADMAP-E-STATUS.md)
    (pelo coordenador). Lembrete: zero migration, então o CD não altera o banco de homologação neste lote.
  - Responsável: quem tiver a autorização. Dependências: T01-18. Status: não iniciado.

## 20. Homologação

- [ ] **T01-20** Validar em homologação com dados fictícios, só com autorização para criar dados lá.
  - Critério de aceite: roteiro do FIRST-MVP §9 repetido em homologação; registro de quem validou e quando; lote passa a
    `HOMOLOGADO` (≠ `PUBLICADO`) no [02](../../geral/02-ROADMAP-E-STATUS.md).
  - Responsável: Carlos + interessados. Dependências: T01-19. Status: não iniciado.
