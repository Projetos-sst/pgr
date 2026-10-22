# FIRST-MVP: primeira entrega demonstrável da Medicina

> Proposta do coordenador, 2026-10-21. **Nada foi implementado.** Aguarda a revisão do Carlos e o aceite do
> Douglas antes do Lote 1.

## 1. Critério de escolha

O MVP precisa de uma jornada verdadeira, com dado salvo, recarregado e protegido por permissão, sem
depender de nada que esteja bloqueado. Ficaram de fora por bloqueio verificado:

| Fora do MVP        | Motivo                                                                                                                          | Fonte                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| PCMSO              | Depende da validação de riscos (NOB-98, sem validador definido)                                                                 | AUDIT-LINEAR-QA §4.7    |
| Emissão de ASO     | Depende de quem emite, dos campos obrigatórios e da camada de snapshot                                                          | AUDIT-DATABASE §10.3    |
| Lista C            | Depende da fonte oficial (Dr. Alcides)                                                                                          | AUDIT-PROTOTYPE §5.12   |
| Qualquer migration | A #112 reservou 0054/0055, e o merge em develop **aplica a migration automaticamente no banco de homologação** (`cd.yml:67-75`) | AUDIT-ARCHITECTURE §4.8 |

**Decisão de desenho:** o MVP é **zero migration**. Ele usa só o que já está em develop:

- `company_modules`;
- `employees`, `companies`, `medicos` e `health_exams`;
- `classifyDocumentValidity`;
- as primitives `_ui`.

Assim ele não colide com a #112 e não muda o banco de homologação.

## 2. A jornada

**"Ficha de saúde ocupacional": da empresa com Medicina até o exame do trabalhador, salvo e recuperado.**

| #   | Passo                                                                                                       | O que o usuário vê                                                                                                                                       | O que acontece por baixo                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Entra em "Medicina do Trabalho" → **Painel** (`/medicine`)                                                  | Empresas do escritório com Medicina habilitada, com contagem real de funcionários e de exames por situação (vigente / a vencer / vencido / sem validade) | `requireOfficeStaffPage()`; `listCompanyOptions(orgId, "medicine")` (NOB-99); contagens `withOrg`                                      |
| 2   | Escritório sem nenhuma empresa com Medicina                                                                 | Estado vazio explicativo. Owner: link para `/companies/[id]/services`. Colaborador: "peça ao responsável"                                                | O mesmo dado de `company_modules`. Nunca KPI fictício (regra da fatia 019)                                                             |
| 3   | Seleciona uma empresa                                                                                       | Lista paginada de funcionários com busca **no servidor** e badge do último exame                                                                         | `listEmployees({ module: "medicine", companyId, search, page })`. Corrige o limite silencioso de 200 do formulário atual               |
| 4   | Abre um funcionário → seção **"Saúde ocupacional"** em `/employees/[id]` (no lugar do placeholder da l.315) | Linha do tempo dos exames (tipo, data, aptidão, médico, validade informada)                                                                              | Novo filtro `employeeId` em `listHealthExams` (hoje só aceita `search`). A seção só aparece se a empresa do funcionário tiver Medicina |
| 5   | "Registrar exame"                                                                                           | Formulário existente de `/health-exams/new` com o funcionário pré-selecionado                                                                            | Action existente `createHealthExamAction` → `assertCompanyModuleTx(..., "medicine")` (#109)                                            |
| 6   | Salva                                                                                                       | Volta à ficha com o exame na linha do tempo                                                                                                              | INSERT em `health_exams` (RLS RESTRICTIVE medicine)                                                                                    |
| 7   | Recarrega a página (F5)                                                                                     | O mesmo dado, vindo do banco                                                                                                                             | Server Component; nada em `localStorage`                                                                                               |
| 8   | Lê o status                                                                                                 | Badge de **validade informada** (`valid_until` → `classifyDocumentValidity`) + aptidão                                                                   | **Não calcula periodicidade 12/24 meses**: é regra clínica não validada (AUDIT-PROTOTYPE D-02)                                         |
| 9   | Tenta acessar o funcionário de uma empresa **sem** Medicina, ou outro tenant por ID                         | Seção oculta ou 404. O servidor recusa a escrita com FORBIDDEN                                                                                           | RLS `health_exams_module_access` + `assertCompanyModuleTx` + `withOrg`                                                                 |
| 10  | Dados prontos para o documento futuro                                                                       | Exame registrado como dado estruturado (funcionário, empresa, médico do catálogo, tipo, data, aptidão)                                                   | É o insumo do snapshot de emissão do Lote 4. Nenhum documento é gerado nem "assinado" no MVP                                           |

**Correções transversais incluídas** (pequenas e no mesmo escopo):

- `/health-exams` e `/medicos` passam a mostrar `ErrorState` quando `result.ok === false`, em vez de "lista vazia" (falso negativo clínico; AUDIT-UX §4.2);
- filtro por empresa em `/health-exams`;
- `loading.tsx` com `Skeleton` nas rotas novas;
- item "Painel" no grupo Medicina do `NAV`;
- **proposta, sujeita ao Dr. Alcides:** um aviso no campo "Observações" do exame: "não registre diagnóstico ou CID".

## 3. Telas

| Rota                                                              | Novo / alterado                            | Reutiliza                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `/medicine` (Painel + seletor de empresa + lista de funcionários) | novo                                       | `PageHeader`, `ListCard`, `DataGrid`, `StatusBadge`, `ListFooter`; `StatCard` promovido de `dashboard-widgets.tsx` para `_ui` |
| `/employees/[id]` seção "Saúde ocupacional"                       | alterado (substitui o placeholder)         | `FormSection`/cartão, `StatusBadge`, `examBadge`                                                                              |
| `/health-exams`                                                   | alterado (filtro de empresa, erro ≠ vazio) | `HealthExamFilters`                                                                                                           |
| `/health-exams/new?employeeId=`                                   | alterado (pré-seleção)                     | `HealthExamForm`                                                                                                              |
| `/medicos`                                                        | alterado (erro ≠ vazio)                    | —                                                                                                                             |

Identidade: Manrope, JetBrains Mono e indigo como primária. O teal `#0d6b63` aparece **só** se o Douglas aprovar o
token de acento por módulo (AUDIT-UX §10.1); caso contrário, o MVP sai sem teal. Nada de Bricolage ou Atkinson.

## 4. Banco

**Nenhuma migration, nenhuma tabela, nenhuma policy nova.**

| Mudança no repositório                                         | Tipo                               |
| -------------------------------------------------------------- | ---------------------------------- |
| `listHealthExams` ganha filtro `employeeId` e `companyId`      | leitura, no próprio repositório    |
| Novo helper de contagem por situação de validade para o painel | leitura `withOrg`                  |
| Busca e paginação de funcionários por empresa                  | `listEmployees` já aceita `module` |

## 5. APIs

Regra do CLAUDE.md: toda superfície HTTP sai com Action + REST + `api-design.md` + Postman.

| Superfície                   | Action                                         | REST                                                             | Docs/Postman |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| Resumo do painel por empresa | `getMedicineOverviewAction` (`officeAction`)   | `GET /api/v1/medicine/overview`                                  | sim          |
| Exames de um funcionário     | reusa `listHealthExamsAction` com `employeeId` | `GET /api/v1/health-exams?employeeId=` (rota existente + filtro) | atualizar    |

## 6. Permissões

| Perfil               | Acesso                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------- |
| owner / collaborator | Leem e registram exames de empresas com Medicina (o comportamento atual, não ampliado) |
| client               | Bloqueado (`requireOfficeStaff`)                                                       |
| Empresa sem Medicina | Bloqueada no banco (RLS RESTRICTIVE) **e** no servidor. A UI só reflete isso           |

**Não inclui** papel clínico, portal de RH nem acesso de clínica. Ficam pendentes de decisão (AUDIT-SECURITY D3/D4).
Registrado explicitamente: o MVP **não** aumenta a exposição do dado de saúde. Ele só organiza o acesso que owner e
collaborator já têm.

## 7. Testes

| Camada                            | Casos                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                              | Contagem por situação de validade; montagem da linha do tempo; estados vazio/erro/loading (RTL)                                                                                                                                                                                                                             |
| Integração (Postgres efêmero)     | Painel conta só empresas com Medicina; empresa sem Medicina não aparece e não aceita exame (FORBIDDEN); `employeeId` de outro tenant → 404; filtro `companyId` não vaza entre empresas do mesmo escritório; erro de leitura ≠ lista vazia; REST `overview` (padrão `rest-health-exams.test.ts`, **não** o harness excluído) |
| Regressão                         | Suítes atuais de `health-exams`, `medicos` e `company-modules` verdes                                                                                                                                                                                                                                                       |
| E2E (Playwright protected, local) | Passos 1 → 7 da jornada com dados **fictícios** de teste, nunca na organização real                                                                                                                                                                                                                                         |
| Comando                           | `npm run check` + `npm run test:integration` com `INTEGRATION_*` definidas, conferindo que nada saiu como "skipped"                                                                                                                                                                                                         |

## 8. Tamanho relativo, dependências e riscos

- **Tamanho:** pequeno a médio (uma fatia: duas telas novas ou alteradas, dois endpoints de leitura, sem schema). Não estimo
  dias sem a revisão do escopo.
- **Dependências:** nenhuma bloqueante. Depende só do que já está em develop.
  - O token teal é opcional (Douglas).
  - O aviso em "Observações" é opcional (Dr. Alcides).

| Risco                                                                                                  | Mitigação                                                                |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Conflito de arquivos com a #112 em `nav-menu.tsx` (a #112 adiciona "Riscos para PCMSO" no mesmo grupo) | Combinar a ordem com o Rikelvin; conflito trivial de lista               |
| Expectativa de "Medicina completa" na demo                                                             | Roteiro deixa claro o que é registro e o que é emissão                   |
| Dados da demo na organização real                                                                      | Usar organização de teste; criar dados em homolog **só com autorização** |

## 9. Critério de demonstração (para Expedito/Douglas)

O MVP só é considerado demonstrado se, ao vivo e em ambiente de teste, estes passos funcionarem:

1. O painel mostra só empresas com Medicina, com números reais.
2. Desligar a Medicina numa empresa de teste (owner, com motivo) faz ela sumir do painel, e a ficha do funcionário dela deixa
   de mostrar a seção.
3. Registrar um exame, recarregar e ver o dado.
4. Tentar abrir o ID de um funcionário de outra organização → 404.
5. Mostrar que um erro de leitura aparece como erro, e não como "nenhum exame".

O que **não** será mostrado como pronto: emissão de ASO, PCMSO, assinatura, Lista C, portais.

## 10. Branch e arquivos (para a execução, após aprovação)

- Branch sugerida: `feature/NOB-108-ficha-saude-ocupacional`, a partir de `origin/develop` atualizado.
- O develop local está 36 commits atrás; atualizar com o dev server parado.

| Arquivo                                                                    | Mudança                                       |
| -------------------------------------------------------------------------- | --------------------------------------------- |
| `src/app/(protected)/medicine/page.tsx` (+ `loading.tsx`, `_components/*`) | novos                                         |
| `src/app/(protected)/employees/[id]/page.tsx`                              | seção de saúde                                |
| `src/app/(protected)/health-exams/{page,new/page}.tsx`                     | filtro, erro, pré-seleção                     |
| `src/app/(protected)/medicos/page.tsx`                                     | erro                                          |
| `src/app/(protected)/_components/nav-menu.tsx`                             | item Painel                                   |
| `src/app/(protected)/_ui/`                                                 | `StatCard` promovido                          |
| `src/shared/db/repositories/health-exams.ts`                               | filtros                                       |
| `src/shared/server/actions/medicine/overview.ts`                           | novo; namespace `medicine`, como na #112      |
| `src/app/api/v1/medicine/overview/route.ts`                                | novo                                          |
| `docs/api/api-design.md`, `docs/api/sst-manager.postman_collection.json`   | atualizar                                     |
| Testes                                                                     | `src/__tests__/{unit,integration}/medicine/*` |
