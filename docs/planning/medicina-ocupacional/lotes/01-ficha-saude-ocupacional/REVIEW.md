# Lote 01 — REVIEW

> [README do lote](README.md) · [PLAN](PLAN.md)

## Estado

**NÃO INICIADO — nenhuma revisão realizada.**

## Checklist do que revisar

### Escopo

- [ ] Zero migration: nenhum arquivo em `src/shared/db/schema/**` ou `src/shared/db/migrations/**` no diff.
- [ ] Nenhum dado clínico novo; `notes`/`certificatePath` fora de telas e contratos novos.
- [ ] Nenhuma periodicidade calculada; só `valid_until` via `classifyDocumentValidity`; rótulos "validade informada".
- [ ] Nenhuma emissão, assinatura, PCMSO, Lista C ou portal.
- [ ] Nenhum cadastro paralelo de empresa ou funcionário.
- [ ] Divergências com o FIRST-MVP limitadas às do PLAN §12 e decididas no TASK item 2.

### Arquitetura e quatro superfícies

- [ ] Páginas só orquestram; actions e handlers não tocam Drizzle; SQL só em repositórios, dentro de `withOrg`.
- [ ] Core único (`server/medicine/overview-core.ts`) usado por Action e REST.
- [ ] Para cada leitura nova: Action (`officeAction`) + REST (`restHandler`) + `api-design.md` + Postman.
- [ ] Coleção Postman continua única e válida; variáveis reaproveitadas.

### Segurança

- [ ] `client` bloqueado nas telas, actions e REST (com teste).
- [ ] Tenant sempre de `ctx.tenantId`; filtros do cliente somados a `org_id`.
- [ ] Toda consulta de `employees` da Medicina com `companyModuleScope(…, "medicine")`.
- [ ] Empresa sem Medicina: `FORBIDDEN` explícito na lista; seção oculta na ficha.
- [ ] ID malformado → `VALIDATION`, nunca 500 nem lista vazia.
- [ ] `returnTo` montado no servidor; sem redirecionamento aberto.
- [ ] Nada em `localStorage`; nenhum log com payload; nenhuma chamada de IA.

### UX e acessibilidade

- [ ] Erro ≠ vazio em `/medicine`, `/health-exams`, `/health-exams/new`, `/medicos` e na seção da ficha.
- [ ] `ListErrorState` sem `<main>`/`<h1>` duplicados; `loading.tsx` com `role="status"`.
- [ ] Badges com rótulo textual; `StatusBadge` de `data-list.tsx` (sem terceira versão).
- [ ] Sem teal sem aprovação (MED-DEC-17); sem hex cru novo; Manrope/JetBrains Mono.
- [ ] 375/768/1440 sem rolagem horizontal; alvos de toque ≥ 44px nos filtros.
- [ ] `/dashboard` sem regressão visual após mover o `StatCard`.

### Testes

- [ ] Unitários de fronteira de validade e de estados (RTL).
- [ ] Integração em Postgres efêmero, **zero skipped** nos arquivos de Medicina.
- [ ] `runIsolationSuite` para `health_exams`.
- [ ] Teste "filtro por empresa não vaza no mesmo escritório".
- [ ] Regressão das suítes existentes de exames, médicos e módulos.
- [ ] E2E só com dados fictícios e organização de teste.

### Integração com a #112

- [ ] Ordem de merge combinada com o Rikelvin (T00-E3) e conflitos de `nav-menu.tsx`, `api-design.md` e Postman resolvidos sem perder itens dele.

Revisores sugeridos (HIPÓTESE, a confirmar): Carlos (autorrevisão), revisor indicado pelo Douglas, Rikelvin para o trecho de
segurança e módulos.
