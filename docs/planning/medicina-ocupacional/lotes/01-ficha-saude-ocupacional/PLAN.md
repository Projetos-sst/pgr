# Lote 01 — PLAN (base do prompt de implementação)

> **Base obrigatória:** [`../../FIRST-MVP.md`](../../FIRST-MVP.md). Este plano detalha **como** implementar o que o FIRST-MVP
> define; onde ele acrescenta algo, a seção [§12](#12-expansões-e-divergências-em-relação-ao-first-mvp) diz o quê e por quê.
> Código de referência: HEAD `d6b787c`, linhas em [AUDIT](AUDIT.md). **Nada aqui foi implementado.**
> [README do lote](README.md) · [TASK](TASK.md)

## 0. Regras do lote (valem para cada arquivo tocado)

1. **Zero migration.** Nenhum arquivo em `src/shared/db/schema/**` nem em `src/shared/db/migrations/**` muda. Nenhuma policy nova.
2. **Nenhum dado clínico novo.** Só se lê o que `health_exams` já guarda. `notes` e `certificatePath` **não** aparecem em
   nenhuma tela ou contrato novo (o tipo `HealthExamListItem`, `domains/pgr/health-exams.ts:100-110`, já os exclui).
3. **Sem periodicidade calculada.** Status = validade **informada** (`valid_until`) via `classifyDocumentValidity`
   (`domains/documents/validity.ts:16-24`), janela de 30 dias já usada em `/health-exams`. Nenhuma regra 12/24 meses.
4. **Sem cadastro paralelo.** Empresas e funcionários vêm de `companies`/`employees` (NOB-99).
5. **Tenant sempre da sessão.** `companyId`/`employeeId` vindos do cliente são só filtros, sempre somados a `org_id`, RLS e
   `companyModuleScope(…, "medicine")`.
6. **Erro ≠ vazio** em toda leitura nova ou alterada.
7. **Quatro superfícies** (CLAUDE.md) para toda leitura HTTP nova: Action `officeAction` + REST `restHandler` +
   `docs/api/api-design.md` + coleção Postman única.
8. Regras permanentes de segurança clínica: [`../../geral/01-CONTEXTO-E-ESCOPO.md` §8](../../geral/01-CONTEXTO-E-ESCOPO.md).

## 1. Resultado esperado

A jornada de FIRST-MVP §2 (passos 1–10) funciona com dados fictícios em ambiente de teste, e os cinco pontos do critério de
demonstração (FIRST-MVP §9) passam ao vivo:

| # | Demonstração | Como o código garante |
|---|---|---|
| 1 | Painel mostra só empresas com Medicina, com números reais | `getMedicineOverview` filtra por `companyModuleScope(…, "medicine")`; contagens `withOrg` |
| 2 | Desligar a Medicina numa empresa de teste a tira do painel e esconde a seção na ficha | mesma consulta + `getCompanyModuleOverviewAction` na ficha; RLS `health_exams_module_access` |
| 3 | Registrar exame, recarregar (F5), ver o dado | Server Components `force-dynamic`; nada em `localStorage` |
| 4 | ID de funcionário de outra organização → 404 | `getEmployeeAction` → `NOT_FOUND` → `notFound()` (`employees/[id]/page.tsx:66-67`) |
| 5 | Erro de leitura aparece como erro, não como "nenhum exame" | `ListErrorState` em todo `result.ok === false` |

Fora do resultado: emissão de ASO, PCMSO, assinatura, Lista C, portais (FIRST-MVP §9, último parágrafo).

## 2. Arquitetura

Camadas do CLAUDE.md, sem atalhos:

```
src/app/(protected)/medicine/page.tsx ─┐                     src/app/api/v1/medicine/overview/route.ts ─┐
src/app/(protected)/employees/[id]/…   ├─► actions/medicine/overview.ts ─┐   src/app/api/v1/medicine/employees/route.ts ─┤
                                       │   (officeAction)                ├─► server/medicine/overview-core.ts ◄─┘ (restHandler)
                                       │                                 │      │ valida (zod, domains/medicine/*)
                                       │                                 │      ├─► repositories/medicine-overview.ts (novo)
                                       │                                 │      ├─► repositories/employees.ts (listEmployees, existente)
                                       │                                 │      ├─► repositories/health-exams.ts (+ latest por funcionário)
                                       │                                 │      └─► repositories/company-modules.ts (getCompanyModules)
src/app/(protected)/health-exams/… ────┴─► actions/pgr/health-exams.ts (existente, + filtros) ─► repositories/health-exams.ts
src/app/api/v1/health-exams/route.ts ───► repositories/health-exams.ts (existente, + filtros)
```

- O **core** (`src/shared/server/medicine/overview-core.ts`, `import "server-only"`) é compartilhado por Action e REST, no padrão
  de `src/shared/server/platform/company-module-core.ts` e do `risk-source-core.ts` da #112. Nem Action nem Route Handler tocam
  Drizzle.
- Namespace `medicine` (domínio, actions, core) igual ao da #112; os nomes de arquivo são diferentes dos dela
  (`risk-sources.ts`, `risk-source-core.ts`, `medical-risk-sources.ts`), então não há colisão de arquivo, só de diretório.
- Leituras não usam `audit: true` (padrão do repositório: só escritas auditam).

## 3. Rotas e componentes

### 3.1 `/medicine` — Painel (novo)

Arquivos:

| Arquivo | Tipo | Conteúdo |
|---|---|---|
| `src/app/(protected)/medicine/page.tsx` | Server Component, `dynamic = "force-dynamic"` | orquestra; nenhuma regra |
| `src/app/(protected)/medicine/loading.tsx` | Server Component | esqueleto (ver §9) |
| `src/app/(protected)/medicine/_components/medicine-overview-cards.tsx` | Server, presentational | grade de `StatCard` |
| `src/app/(protected)/medicine/_components/medicine-company-filter.tsx` | Client (`"use client"`) | `<form method="get">` com `AutoSubmitSelect` (empresa) + busca |
| `src/app/(protected)/medicine/_components/medicine-employee-list.tsx` | Server, presentational | `ListCard` + `DataGrid` + `StatusBadge` + `ListFooter` |
| `src/app/(protected)/medicine/_components/medicine-empty-state.tsx` | Server, presentational | vazio sem empresa com Medicina (texto por papel) |

`searchParams`: `{ companyId?: string; search?: string; page?: string }`.

Fluxo de `page.tsx`:

1. `const ctx = await requireOfficeStaffPage()` (`src/shared/auth/page-guards.ts:14`; devolve `TenantContext` com `role`).
2. `const overview = await getMedicineOverviewAction()`.
   - `!overview.ok` → `PageHeader` + `ListErrorState` ("Não foi possível carregar o painel da Medicina. Isso não significa que
     não haja dados."). **Não** renderizar cartões zerados.
   - `overview.data.companies.length === 0` → `MedicineEmptyState` com `role = ctx.role`.
3. Cartões (`MedicineOverviewCards`) com `overview.data.totals` (ou com a empresa selecionada, se houver).
4. Empresa selecionada: `sp.companyId` só vale se estiver em `overview.data.companies` (o servidor revalida no core). Se só há uma
   empresa, ela fica pré-selecionada. `companyId` presente mas fora da lista → aviso "Empresa inexistente ou sem Medicina
   habilitada" (não lista vazia).
5. Com empresa: `listMedicineEmployeesAction({ companyId, search: sp.search, page })`.
   - `!ok` → `ListErrorState` dentro do `ListCard` (com o código: `FORBIDDEN` → "Medicina não habilitada para esta empresa").
   - `rows.length === 0` → `EmptyState isFlat` ("Nenhum funcionário nesta empresa" ou "Nenhum funcionário encontrado para a
     busca").
   - linhas: Funcionário (link `/employees/[id]`), Função, GES, Último exame (tipo + data em `font-mono`), Validade informada,
     `StatusBadge` do `examBadge`; sem exame → `StatusBadge tone="neutral"` "Sem exame registrado".
6. `PageHeader`: título "Medicina do Trabalho", descrição "Painel das empresas com Medicina habilitada", ícone reutilizando
   `HealthExamIcon` (`health-exams/_components/health-exam-icon.tsx`), ação `ToolbarButton`/link "Registrar exame" →
   `/health-exams/new`.

Cartões (só dado real; regra da fatia 019):

| Cartão | Valor | `href` |
|---|---|---|
| Empresas com Medicina | `totals.companies` | `/companies` |
| Funcionários | `totals.employees` (ou da empresa) | sem link |
| Vencidos | `expired` | sem link (não existe filtro por validade em `/health-exams`; link enganaria) |
| A vencer (30 dias) | `dueSoon` | sem link |
| Sem exame registrado | `withoutExam` | sem link |

O rótulo de cada cartão diz "validade informada" no `subtext` (ex.: "pelo vencimento informado no último exame").

### 3.2 `/health-exams` — filtro por empresa e erro ≠ vazio (alterado)

| Arquivo:linha atual | Mudança |
|---|---|
| `health-exams/page.tsx:33` | Remover `DUE_WINDOW_DAYS` local; importar `EXAM_DUE_WINDOW_DAYS` do domínio (§4) |
| `page.tsx:48` | `SearchParams` ganha `companyId?: string` e `employeeId?: string` |
| `page.tsx:55` | Manter `requireOfficeStaffPage()`; guardar o `ctx` para o texto do estado vazio |
| `page.tsx:63` | Em paralelo: `listHealthExamsAction({ search, examType, companyId, employeeId, page })` e `listCompanyOptionsAction("medicine")` |
| `page.tsx:64` | Trocar o fallback por ramos explícitos: `!result.ok` → `ListErrorState`; opções de empresa vazias (`ok` e `length === 0`) → `MedicineEmptyState`; senão lista |
| `page.tsx:77-81` | `HealthExamFilters` recebe `companies` e `companyId` |
| `page.tsx:85-95` | Mensagem do vazio considera `companyId`/`employeeId` ("Nenhum exame encontrado para os filtros.") |
| `page.tsx:158-164` | `ListFooter params` inclui `companyId` e `employeeId` |
| (novo) | Com `employeeId`: faixa "Filtrado por funcionário" + link "limpar filtro" (é o destino do "ver todos" da ficha, §3.4) |

`health-exam-filters.tsx`: props `companies: { id: string; razaoSocial: string }[]`, `companyId?: string`; novo `<select
name="companyId" aria-label="Filtrar por empresa">` copiando o padrão de l.47-68 (auto-submit, `h-11`). Se a carga das opções
falhar, o filtro de empresa some e aparece aviso curto "Filtro de empresa indisponível" (a lista não é afetada).

Fora do escopo: coluna "Empresa" na grade, troca do hex de `VALIDITY_COLOR` (l.35-40) — dívida de token (MED-DEC-17).

### 3.3 `/health-exams/new?employeeId=` — pré-seleção e retorno à ficha (alterado)

| Arquivo:linha atual | Mudança |
|---|---|
| `health-exams/new/page.tsx:11` | Receber `searchParams: Promise<{ employeeId?: string }>` |
| `new/page.tsx:13-16` | Com `employeeId`: `getEmployeeAction(employeeId)` (não-ok → `notFound()`); depois `listEmployeesAction({ module: "medicine", companyId: employee.companyId, pageSize: 200 })`. Se o funcionário não vier na lista (empresa sem Medicina) → `ListErrorState` "Medicina não habilitada para a empresa deste funcionário" (o servidor recusaria a escrita de qualquer forma: `assertCompanyModuleTx`, `repositories/health-exams.ts:37`) |
| `new/page.tsx:17-23` | Falha de funcionários ou médicos → `ListErrorState` em vez de select vazio |
| `new/page.tsx:27-32` | `backHref` = ficha quando há `employeeId`, senão `/health-exams` |
| `health-exam-form.tsx:51-61` | Props novas opcionais: `defaultEmployeeId?: string`, `returnTo?: string` |
| `health-exam-form.tsx:106` | `defaultValue={initial?.employeeId ?? defaultEmployeeId ?? ""}` |
| `health-exam-form.tsx:87` | `router.push(returnTo ?? "/health-exams")` |
| `health-exam-form.tsx:169` | `CancelLink href={returnTo ?? "/health-exams"}` |

`returnTo` é montado **no servidor** pela página, nunca lido cru da URL: só `/employees/${employee.id}` de um funcionário já
carregado do tenant (evita redirecionamento aberto).

Aviso em "Observações" (`health-exam-form.tsx:158-165`): **só se MED-DEC-18 for aprovada.** Implementar como texto de ajuda
próprio (não usar `FieldHint`, que diz "Dica da IA:"); exige prop `hint?` em `TextField` (`_ui/form.tsx:210`) ou texto logo
abaixo do campo. Sem aprovação, nada muda no formulário.

### 3.4 `/employees/[id]`: seção Saúde ocupacional

| Arquivo:linha atual | Mudança |
|---|---|
| `employees/[id]/page.tsx:70-88` | Acrescentar ao `Promise.all`: `getCompanyModuleOverviewAction(employee.companyId, { pageSize: 1 })` e `listHealthExamsAction({ employeeId: employee.id, pageSize: 20 })` |
| (novo, antes de `page.tsx:314`) | `<OccupationalHealthSection …/>` |
| `page.tsx:314-317` | **Decisão do Carlos** (TASK item 2): manter os placeholders "Histórico" e "Ordens de serviço" (recomendado: "Histórico" pode virar o histórico de função do Lote 04, P3) ou trocar "Histórico" pela seção, como diz o FIRST-MVP |

Componente novo `src/app/(protected)/employees/[id]/_components/occupational-health-section.tsx` (Server, presentational),
props: `{ employeeId; moduleState: "enabled" | "disabled" | "error"; exams: ActionResult<Paginated<HealthExamListItem>>; today }`.

| Situação | Renderização |
|---|---|
| Verificação de módulo falhou | Seção com `ListErrorState` "Não foi possível verificar se a Medicina está habilitada para a empresa" |
| Medicina desabilitada | **Seção não renderizada** (FIRST-MVP passo 9). Nada de exames, nem contagem |
| Exames com erro | Seção com título + `ListErrorState` |
| Sem exames | "Nenhum exame registrado para este funcionário." + botão "Registrar exame" |
| Com exames | `<ol>` (linha do tempo, mais recente primeiro): tipo, data (`font-mono`), médico (ou "—"), aptidão, validade informada, `StatusBadge` do `examBadge`; link "abrir" → `/health-exams/[id]/edit` |
| `total > 20` | Link "Ver todos os N exames" → `/health-exams?employeeId=<id>` |

Botão "Registrar exame" → `/health-exams/new?employeeId=<id>`. Visual: `<section className="glass-card animate-fade-in flex
flex-col gap-4 p-4">` + `<h2>` como a seção de Treinamentos (`page.tsx:228-268`). Não exibir `notes`, `certificatePath` nem
contagem de aptidão. Não mexer nos campos já exibidos (CPF, tipo sanguíneo: `page.tsx:123-130`).

### 3.5 `/medicos` — erro ≠ vazio (alterado)

`medicos/page.tsx:47`: `!result.ok` → `ListErrorState` dentro do `ListCard`. `page.tsx:48` (clínicas): falha não esconde a
lista; filtro de clínica some com aviso curto. Sem estado de módulo: `medicos` é catálogo do escritório, sem gate por módulo
(decisão da spec NOB-97).

### 3.6 Menu

`nav-menu.tsx:106-109`: inserir `{ href: "/medicine", label: "Painel", iconName: "<ícone existente>" }` como primeiro item do grupo
"Medicina do Trabalho" (sugestão: `"clipboard-list"`; o `"activity"` já é do grupo e de "Exames e ASO"). Sem SVG novo. Sem
menu dinâmico. Ordem final combinada com o Rikelvin se a #112 entrar antes ([Lote 00 PLAN §3](../00-alinhamento-e-contratos/PLAN.md#3-convivência-com-o-trabalho-do-rikelvin)).

### 3.7 Reutilizar × novo

| Peça | Origem | Decisão |
|---|---|---|
| `PageHeader`, `EmptyState` | `_ui/list.tsx:4`, `:73` | reutilizar; `EmptyState` ganha `action?: ReactNode` opcional (retrocompatível) para o CTA |
| `ListCard`, `ListToolbar`, `DataGrid`, `GridHeader`, `GridRow`, `Cell`, `ListFooter`, `ToolbarButton` | `_ui/data-list.tsx` | reutilizar (os de `list.tsx:263,272` não) |
| `StatusBadge` | `_ui/data-list.tsx:358` | **reutilizar esta** (23 importadores, a mesma de `/health-exams`); a de `status-badge.tsx` fica para a unificação do Douglas (MED-DEC-17). Não criar terceira |
| `AutoSubmitSelect` | `_ui/auto-submit-select.tsx` | reutilizar no seletor de empresa |
| `Skeleton` | `_ui/skeleton.tsx:7` | reutilizar no `loading.tsx` |
| `StatCard` | `dashboard/_components/dashboard-widgets.tsx:6-76` | **promover** para `src/app/(protected)/_ui/stat-card.tsx` com `href?` opcional (sem `href` → `<div>`); `dashboard-widgets.tsx` reexporta para não mudar `dashboard-client-wrapper.tsx`; visual do dashboard idêntico (classes copiadas sem alteração) |
| `ErrorState` | `src/app/_components/error-state.tsx` | **não embutir** (renderiza `<main>` l.34 e `<h1>` l.53). Novo `src/app/(protected)/_ui/list-error-state.tsx` (`ListErrorState({ title, description, code? })`): `<section role="alert">`, `<h2>`, barra de acento + eyebrow mono no mesmo estilo; alternativa equivalente: prop `as`/`headingLevel` no `ErrorState` com padrão inalterado |
| `examBadge`, `EXAM_TYPE_LABELS`, `EXAM_APTITUDE_LABELS` | `domains/pgr/health-exams.ts` | reutilizar |
| `classifyDocumentValidity` | `domains/documents/validity.ts:16` | reutilizar; nenhuma regra nova de validade |
| `HealthExamForm`, `HealthExamFilters` | `health-exams/_components/*` | reutilizar com props novas opcionais |
| `getCompanyModuleOverviewAction` | `actions/platform/company-modules.ts:11` | reutilizar na ficha (sem superfície nova) |
| `listCompanyOptionsAction("medicine")` | `actions/pgr/companies.ts:33` | reutilizar no filtro de `/health-exams` |

## 4. Domínio

| Arquivo | Conteúdo |
|---|---|
| `src/shared/domains/pgr/health-exams.ts` (alterado) | `export const EXAM_DUE_WINDOW_DAYS = 30` (sai de `page.tsx:33`); `healthExamListFiltersSchema = z.object({ employeeId: optionalUuid, companyId: optionalUuid })` reusando `optionalUuid` de `./form-fields` |
| `src/shared/domains/medicine/overview.ts` (novo) | tipos e função pura de resumo (abaixo) |
| `src/shared/domains/medicine/employees.ts` (novo) | `medicineEmployeesQuerySchema` e tipos da lista |
| `src/shared/domains/medicine/timeline.ts` (novo) | montagem da linha do tempo (pura) |

```ts
// domains/medicine/overview.ts — contrato proposto
export const EXAM_VALIDITY_LABELS: Record<DocumentValidityStatus, string> = {
  ok: "Vigente", due_soon: "A vencer", expired: "Vencido", no_expiry: "Sem validade informada",
};
export type ExamValidityCounts = { ok: number; dueSoon: number; expired: number; noExpiry: number; withoutExam: number };
export type MedicineCompanySummary = {
  companyId: string; companyName: string; employeeCount: number; validity: ExamValidityCounts;
};
export type MedicineOverview = {
  today: string; dueWindowDays: number;
  companies: MedicineCompanySummary[];
  totals: { companies: number; employees: number } & ExamValidityCounts;
};
export function summarizeMedicineOverview(
  data: {
    companies: { id: string; razaoSocial: string }[];
    employeeCounts: { companyId: string; count: number }[];
    latestExams: { companyId: string; validUntil: string | null }[]; // 1 por funcionário com exame
  },
  opts: { today: string; dueWindowDays: number },
): MedicineOverview;
```

Regras de `summarizeMedicineOverview`: cada exame mais recente de cada funcionário é classificado por
`classifyDocumentValidity` (mesmas fronteiras do badge); `withoutExam = employeeCount − nº de funcionários com exame` (nunca
negativo); empresa sem funcionários aparece com zeros; ordenação por razão social. **Semântica:** conta a situação do
**último exame de cada funcionário**, não todos os exames (ver §12, item 3).

```ts
// domains/medicine/employees.ts
export const medicineEmployeesQuerySchema = z.object({
  companyId: requiredUuid("Selecione uma empresa"),
  search: optionalString,                      // de ./../pgr/form-fields
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type LatestExam = { examType: ExamType; performedAt: string; validUntil: string | null; aptitude: ExamAptitude };
export type MedicineEmployeeItem = {
  id: string; fullName: string; status: string; jobRoleTitle: string | null; gesName: string | null;
  latestExam: LatestExam | null;               // sem CPF, sem notes
};

// domains/medicine/timeline.ts
export type ExamTimelineItem = HealthExamListItem & {
  validity: DocumentValidityStatus; validityLabel: string; badge: ExamBadge;
};
export function toExamTimeline(rows: HealthExamListItem[], opts: { today: string; dueWindowDays: number }): ExamTimelineItem[];
```

Conferir em `form-fields.ts` o comportamento de `optionalUuid`/`optionalString` com string vazia antes de usar (TASK item 2).

## 5. Repositórios

### 5.1 `src/shared/db/repositories/health-exams.ts` (alterado)

```ts
export type ListHealthExamsParams = PageParams & {
  search?: string; examType?: ExamType;
  employeeId?: string;   // novo
  companyId?: string;    // novo: empresa ATUAL do funcionário (employees.company_id)
};
```

- Em `listHealthExams` (l.54-108): `if (params.employeeId) filters.push(eq(healthExams.employeeId, params.employeeId))`;
  `if (params.companyId) filters.push(eq(employees.companyId, params.companyId))`. O `innerJoin(employees)` já existe na lista
  (l.95) e na contagem (l.101-105), então o mesmo `where` serve às duas.
- Nova função:

```ts
export async function listLatestHealthExamsByEmployee(
  orgId: string,
  employeeIds: readonly string[],
): Promise<Array<{ employeeId: string } & LatestExam>>;
```

  `employeeIds` vazio → `[]` sem consulta. Dentro de `withOrg`: `selectDistinctOn([healthExams.employeeId], …)` com
  `where(and(eq(healthExams.orgId, orgId), inArray(healthExams.employeeId, ids)))` e
  `orderBy(healthExams.employeeId, desc(healthExams.performedAt), desc(healthExams.createdAt))` (desempate determinístico).
  A RLS RESTRICTIVE já esconde exames de empresas sem Medicina.

### 5.2 `src/shared/db/repositories/medicine-overview.ts` (novo)

```ts
export async function getMedicineOverviewData(orgId: string): Promise<{
  companies: { id: string; razaoSocial: string }[];
  employeeCounts: { companyId: string; count: number }[];
  latestExams: { companyId: string; validUntil: string | null }[];
}>;
```

Uma única transação `withOrg` (fotografia consistente), três consultas:

1. Empresas: `select id, razao_social from companies where org_id = $org and companyModuleScope(companies.orgId, companies.id,
   "medicine") order by razao_social` (mesmo predicado de `listCompanyOptions`, `companies.ts:133-162`).
2. Funcionários por empresa: `select company_id, count(*)::int from employees where org_id = $org and
   companyModuleScope(employees.orgId, employees.companyId, "medicine") group by company_id`. **Obrigatório** aplicar o
   predicado: `employees` não tem policy de módulo. Conta todos os status (como `listEmployees` sem filtro); confirmar no
   TASK item 5 se desligados entram.
3. Último exame por funcionário: `selectDistinctOn([healthExams.employeeId], { companyId: employees.companyId, validUntil })`
   `from health_exams inner join employees` `where health_exams.org_id = $org`, mesma ordenação de 5.1.

Volume: a consulta 3 devolve uma linha por funcionário com exame. Aceitável no MVP; se o volume crescer, trocar por agregação
`CASE` em SQL com `today` como parâmetro, mantendo os testes de fronteira (risco R6, §10).

### 5.3 Sem mudança

`employees.ts` (`listEmployees` já aceita `module`, `companyId`, `search`, paginação: l.22-28, l.104-167), `companies.ts`,
`company-modules.ts`. Nenhuma escrita nova: create/update/delete de exames continuam como estão (`health-exams.ts:124-188`).

## 6. Server Actions

| Arquivo | Função | Detalhe |
|---|---|---|
| `src/shared/server/actions/medicine/overview.ts` (novo, `"use server"`) | `getMedicineOverviewAction(): Promise<ActionResult<MedicineOverview>>` | `officeAction("medicine.overview.get", (ctx) => core.getMedicineOverview(ctx))` |
| idem | `listMedicineEmployeesAction(input): Promise<ActionResult<Paginated<MedicineEmployeeItem>>>` | `officeAction("medicine.employees.list", (ctx) => core.listMedicineEmployees(ctx, input))` |
| `src/shared/server/actions/pgr/health-exams.ts` (alterado) | `listHealthExamsAction` (l.19-25) | dentro do callback: `healthExamListFiltersSchema.parse({ employeeId, companyId })` antes do repositório → ID malformado vira `VALIDATION`, não erro 500 nem lista vazia |
| idem | `createHealthExamAction` (l.35-48) e `updateHealthExamAction` (l.50-66) | além de `/health-exams`: `revalidatePath("/medicine")` e `revalidatePath(\`/employees/${data.employeeId}\`)` (as páginas são `force-dynamic`; isso só mantém o cache de navegação coerente) |

Core `src/shared/server/medicine/overview-core.ts` (`import "server-only"`):

```ts
export async function getMedicineOverview(ctx: TenantContext): Promise<MedicineOverview> {
  const data = await overviewRepo.getMedicineOverviewData(ctx.tenantId);
  return summarizeMedicineOverview(data, { today: todayInSaoPaulo(), dueWindowDays: EXAM_DUE_WINDOW_DAYS });
}

export async function listMedicineEmployees(ctx: TenantContext, input: unknown) {
  const q = medicineEmployeesQuerySchema.parse(input);                 // VALIDATION
  const modules = await companyModulesRepo.getCompanyModules(ctx.tenantId, q.companyId); // NOT_FOUND se outro tenant
  if (!modules.some((m) => m.module === "medicine" && m.enabled))
    throw new ForbiddenError("Serviço não habilitado para esta empresa.");                // FORBIDDEN explícito
  const page = await employeesRepo.listEmployees(ctx.tenantId, {
    module: "medicine", companyId: q.companyId, search: q.search, page: q.page, pageSize: q.pageSize,
  });
  const latest = await healthExamsRepo.listLatestHealthExamsByEmployee(ctx.tenantId, page.rows.map((r) => r.id));
  // mapeia para MedicineEmployeeItem (sem serviceOrderCount, sem companyName, sem CPF)
}
```

`todayInSaoPaulo` vem de `src/shared/dates.ts` (já usado em `/health-exams`). Erros mapeados por `toActionError`:
`VALIDATION` 422, `NOT_FOUND` 404, `FORBIDDEN` 403.

## 7. REST, documentação e Postman (regra das 4 superfícies)

### 7.1 Route Handlers

| Arquivo | Verbo | Corpo | Respostas |
|---|---|---|---|
| `src/app/api/v1/medicine/overview/route.ts` (novo) | `GET` | `restHandler(req, (ctx) => core.getMedicineOverview(ctx))` | 200 · 403 `client` |
| `src/app/api/v1/medicine/employees/route.ts` (novo) | `GET ?companyId=&search=&page=&pageSize=` | `restHandler(req, (ctx) => core.listMedicineEmployees(ctx, { companyId: sp.get("companyId"), ...pageParamsFrom(req) }))` | 200 · 422 sem/má `companyId` · 404 empresa de outro tenant · 403 empresa sem Medicina ou `client` |
| `src/app/api/v1/health-exams/route.ts` (alterado, l.18-26) | `GET` + `?employeeId=&companyId=` | `healthExamListFiltersSchema.parse(...)` antes de `repo.listHealthExams` | 200 · 422 ID malformado |

Os dois recursos novos são **read-models** (só `GET`), no precedente de `/api/v1/dashboard/summary`
(`src/app/api/v1/dashboard/summary/route.ts:9-11`; `docs/api/api-design.md:153`). Não há POST/PUT/DELETE nem `/dependents`
porque não são entidades. `export const runtime = "nodejs"` e `dynamic = "force-dynamic"`, como os handlers vizinhos.

### 7.2 `docs/api/api-design.md`

| Trecho atual | Mudança |
|---|---|
| Tabela de recursos REST (linhas ~142-153) | + `/medicine/overview` (GET, read-model) e `/medicine/employees` (GET, `?companyId=` obrigatório, `?search=`, paginação); linha `/health-exams` (l.143) + `?employeeId=`, `?companyId=` (empresa **atual** do funcionário) |
| Sumário das actions (linhas ~392-400) | + "Medicina — painel · `actions/medicine/overview.ts` · getMedicineOverviewAction, listMedicineEmployeesAction + REST" |
| Seção "Gestão de Saúde Ocupacional (ASO)" (l.662-686) | documentar os filtros novos e o `VALIDATION` para ID malformado |
| Nova seção "Medicina — painel" (após l.686) | contrato (`MedicineOverview`, `MedicineEmployeeItem`), códigos de erro, "validade informada; sem periodicidade; sem `notes`/CPF" |
| Tabela de páginas (l.1100-1101) | + `/medicine`; `/health-exams` (filtro de empresa, erro ≠ vazio); `/health-exams/new?employeeId=` |

### 7.3 Postman (`docs/api/sst-manager.postman_collection.json`, coleção única)

- Pasta nova **"Medicina (painel)"** logo após "Saude Ocupacional (ASO)" (~l.3320): `GET /medicine/overview`;
  `GET /medicine/employees?companyId={{companyId}}&page=1`; `GET /medicine/employees` sem `companyId` (exemplo de 422).
- Na pasta "Saude Ocupacional (ASO)": `GET /health-exams?employeeId={{employeeId}}` e `GET /health-exams?companyId={{companyId}}`.
- Reusar as variáveis existentes `baseUrl`, `devTenant`, `devRole`, `companyId`, `employeeId`; cabeçalhos `x-dev-tenant`/`x-dev-role`
  iguais aos das pastas vizinhas. Nenhuma variável nova, nenhum segredo.
- **Conflito esperado com a #112** neste arquivo: resolver no rebase, nunca regenerar a coleção.

## 8. Permissões e segurança

| Tema | Regra | Onde é garantida |
|---|---|---|
| Quem acessa | owner e collaborator (comportamento atual, **não ampliado**) | `requireOfficeStaffPage()` nas páginas; `officeAction`/`restHandler` → `requireOfficeStaff()` |
| `client` | bloqueado em tudo: página → `forbidden()`; Action → `FORBIDDEN`; REST → 403 | idem; testes de integração |
| Tenant | sempre da sessão (`ctx.tenantId`); nenhum parâmetro escolhe tenant | `withOrg` + RLS `*_isolation` |
| Empresa sem Medicina | invisível no painel, lista de funcionários recusada (`FORBIDDEN`), seção da ficha oculta, exames ocultos pela RLS, escrita recusada | `companyModuleScope` (consultas 1–2 de §5.2), core §6, `health_exams_module_access` (`schema/health-exams.ts:63-70`), `assertCompanyModuleTx` (`repositories/health-exams.ts:37`) |
| `employees` sem policy de módulo | toda lista de funcionários da Medicina passa `module: "medicine"` | core §6; teste "empresa sem Medicina nunca devolve funcionários" |
| IDOR | ID de outro tenant → 404 na ficha; filtro por `employeeId`/`companyId` alheio → lista vazia (filtro somado a `org_id`) | `getEmployeeById` (`employees.ts:169-181`), `withOrg` |
| ID malformado | `VALIDATION` (422), nunca 500 nem lista vazia | `healthExamListFiltersSchema`, `medicineEmployeesQuerySchema` |
| Periodicidade | **não calculada**; só `valid_until` informado; rótulos dizem "validade informada" | §4 |
| Campos clínicos livres | `notes`/`certificatePath` fora de toda tela e contrato novos | tipos de §4; teste RTL "não renderiza notes" |
| Dado em cliente | nada em `localStorage`/`sessionStorage`; Server Components | revisão + Chrome DevTools (Application) |
| IA | nenhum dado de saúde em prompt (MED-DEC-20) | não há chamada de IA no lote |
| Logs | `officeAction` registra só a operação (`medicine.overview.get` etc.), sem payload | conferir `logTenantEvent` na revisão |
| Redirecionamento | `returnTo` montado no servidor só com `/employees/<id do tenant>` | §3.3 |
| Assinatura/emissão | nenhuma; nada é chamado de "ASO emitido" | escopo |
| Dados de teste | só fictícios; E2E em organização de teste; homolog só com autorização | §11 |

## 9. Estados, responsividade e identidade visual

### 9.1 Estados

| Tela | Loading | Erro | Vazio |
|---|---|---|---|
| `/medicine` | `loading.tsx`: container `role="status"` com texto `sr-only` "Carregando painel da Medicina" + `Skeleton` de 4–5 cartões e 6 linhas | `ListErrorState` (painel) ou dentro do `ListCard` (lista) | sem empresa com Medicina (owner: "Habilite a Medicina em Empresas → Serviços" + link `/companies`; collaborator: "Peça ao administrador do escritório para habilitar"; texto alinhado a MED-DEC-16); empresa sem funcionários; busca sem resultado |
| `/health-exams` | sem `loading.tsx` novo (rota existente) | `ListErrorState` | sem empresa com Medicina (mesmo componente); filtros sem resultado; sem exames |
| `/health-exams/new` | — | `ListErrorState` se funcionários/médicos não carregarem | funcionário sem Medicina → mensagem explícita |
| `/employees/[id]` (seção) | — | `ListErrorState` na seção (módulo ou exames) | "Nenhum exame registrado para este funcionário." + CTA |
| `/medicos` | — | `ListErrorState` | inalterado |

`ListErrorState` nunca diz "nenhum registro"; diz que a leitura falhou e oferece "Tentar novamente" (link para a mesma URL).

### 9.2 Responsividade (375 · 768 · 1440)

- Sem rolagem horizontal da página em nenhuma largura (`document.documentElement.scrollWidth <= window.innerWidth`).
- Cartões: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` (ou 4 + 1); números em `font-mono`, `tabular-nums`.
- Filtro de empresa e busca empilhados no 375 (`flex-wrap`), altura `h-11` (44px, alvo de toque).
- `DataGrid` com `minWidth` rola **dentro** do cartão; no 375 a lista do painel pode virar cartões empilhados se a grade ficar
  ilegível (decidir no item 4 do TASK, com captura).
- Linha do tempo da ficha: `<ol>` em coluna única; linhas quebram em duas no 375.
- `PageHeader` já é responsivo (`sm:flex-row`).

### 9.3 Identidade visual

- Manrope + JetBrains Mono; indigo `#5B63F5` como primária; primitives `_ui`; nada de Bricolage/Atkinson nem tokens globais novos.
- Teal `#0d6b63` **só** se o Douglas aprovar MED-DEC-17; sem aprovação, o lote sai sem teal.
- Significado nunca só por cor: todo badge tem rótulo textual. As pílulas atuais estão abaixo de AA
  ([`../../AUDIT-UX.md`](../../AUDIT-UX.md) §4.7): dívida registrada, não corrigida globalmente aqui.
- Hex cru novo proibido; o `StatCard` promovido mantém as classes atuais (troca por token é decisão do Douglas).

## 10. Riscos

| # | Risco | Prob. | Mitigação |
|---|---|---|---|
| R1 | Conflito com a #112 em `nav-menu.tsx` (l.102-110), `api-design.md`, Postman e no diretório `medicine/` | Alta | Combinar a ordem com o Rikelvin (T00-E3); quem mergear depois rebaseia; nunca regenerar a coleção Postman |
| R2 | `companyId` em exames reflete a empresa **atual** do funcionário; transferência move o histórico | Média | Documentar em api-design e na UI ("empresa atual"); correção estrutural no Lote 02 (`health_exams.company_id`) |
| R3 | Falso verde: suítes de integração "skipped" sem `INTEGRATION_APP_RUNTIME_URL` + `INTEGRATION_DATABASE_URL` | Alta | Conferir contagem de skipped (§11) |
| R4 | Regressão no dashboard ao promover `StatCard` | Baixa | Reexport; captura antes/depois do `/dashboard` |
| R5 | `ErrorState` embutido duplicaria `<main>`/`<h1>` | Média | `ListErrorState` dedicado |
| R6 | Desempenho da consulta 3 de §5.2 em escritórios grandes | Baixa no MVP | Índices existentes (`idx_health_exams_employee_id`); plano B em SQL agregado |
| R7 | Expectativa de "Medicina completa" na demonstração | Média | Roteiro do FIRST-MVP §9; rótulos "validade informada" |
| R8 | Dados de demo na organização real | Média | Organização de teste; homolog só com autorização |
| R9 | Limite de 200 funcionários no formulário genérico (sem pré-seleção) continua | Média | Pré-seleção resolve o fluxo pela ficha; picker com busca fica registrado como limitação (§12) |
| R10 | Dev server com erro 500 do Clerk após troca de branch | Média | É artefato do dev server, não bug: reiniciar com cache limpo antes de concluir algo |

## 11. Testes

### 11.1 Unitários (`npm run test`, jsdom)

| Arquivo (novo salvo indicação) | Casos |
|---|---|
| `src/__tests__/unit/domains/medicine/overview.test.ts` | `validUntil` nulo → `noExpiry`; ontem → `expired`; hoje → `dueSoon`; hoje+30 → `dueSoon`; hoje+31 → `ok`; funcionário sem exame → `withoutExam`; `withoutExam` nunca negativo; empresa sem funcionários com zeros; totais = soma; ordenação por razão social |
| `src/__tests__/unit/domains/medicine/timeline.test.ts` | preserva a ordem do servidor; badge igual ao de `examBadge`; rótulo de validade; lista vazia |
| `src/__tests__/unit/domains/medicine/employees.test.ts` | `companyId` ausente/malformado → erro; `pageSize` > 100 recusado; `search` vazio → `undefined` |
| `src/__tests__/unit/domains/pgr/health-exams.test.ts` (existente, ampliar) | `healthExamListFiltersSchema`; `EXAM_DUE_WINDOW_DAYS = 30` |
| `src/app/(protected)/_ui/__tests__/list-error-state.test.tsx` | `role="alert"`, `h2`, nunca o texto "Nenhum" |
| `src/app/(protected)/_ui/__tests__/stat-card.test.tsx` | com `href` → link; sem `href` → sem link |
| `src/__tests__/unit/medicine/occupational-health-section.test.tsx` | desabilitada → nada renderizado; erro de módulo; erro de exames; vazio com CTA para `/health-exams/new?employeeId=`; lista em `<ol>`; **não** renderiza `notes` |
| `src/__tests__/unit/medicine/medicine-empty-state.test.tsx` | owner vê link; collaborator vê "peça ao administrador" |

### 11.2 Integração (`npm run test:integration`, Postgres efêmero)

Seed: `src/__tests__/integration/_helpers/medicine-seed.ts` (novo), chamado **depois** de `seedPgrBase`, só com dados fictícios:
em `org_a`, `companyA2` (Medicina ligada, PGR desligado) e `companyA3` (Medicina desligada); um funcionário em cada; dois médicos
fictícios; exames de `employeeA` (um antigo vencido + um recente vigente), `employeeA2` (sem validade), `employeeA3` (exame
inserido como admin, invisível); em `org_b`, um exame de `employeeB`.

| Arquivo (novo) | Casos |
|---|---|
| `integration/medicine/overview.test.ts` | painel lista `companyA` e `companyA2`, nunca `companyA3` nem `org_b`; contagens pelo último exame; `withoutExam`; desligar Medicina em `companyA2` (admin) remove a empresa; `client` → `FORBIDDEN` |
| `integration/medicine/medicine-employees.test.ts` | lista por empresa com `latestExam`; busca e paginação no servidor (`total` correto); `companyA3` → `FORBIDDEN`; empresa de `org_b` → `NOT_FOUND`; `companyId` ausente/malformado → `VALIDATION`; nunca devolve funcionário de outra empresa |
| `integration/medicine/health-exams-filters.test.ts` | `employeeId` filtra; `companyId` de `companyA` não traz exames de `companyA2` (mesmo escritório); `employeeId` de `org_b` → `ok` com lista vazia; ID malformado → `VALIDATION` (**não** lista vazia); criar exame para funcionário de `companyA3` → `FORBIDDEN` |
| `integration/medicine/rest-medicine.test.ts` | padrão de `rest-health-exams.test.ts` (mocks l.9-15, import direto dos handlers): overview 200/403; employees 200/422/403/404; `/health-exams?employeeId=`/`?companyId=` 200 e 422 |
| `integration/medicine/health-exams-isolation.test.ts` | `runIsolationSuite({ table: "health_exams", seededCountA: 1, extraSeedSql: <um exame por tenant>, crossTenantInsertSql: <exame org_b> })` |

Regressão obrigatória (sem alterar as suítes): `pgr/health-exams`, `pgr/rest-health-exams`, `pgr/medicos`,
`platform/company-modules`, `platform/company-module-management`, `platform/shared-company-records`, testes do dashboard.

Comando e conferência:

```
npm run check
# Postgres efêmero, nunca dev/homolog/produção:
INTEGRATION_APP_RUNTIME_URL=… INTEGRATION_DATABASE_URL=… [INTEGRATION_DATABASE_URL_ADMIN=…] npm run test:integration
npx jest --selectProjects integration src/__tests__/integration/medicine --verbose   # nenhuma suíte "skipped"
```

### 11.3 Playwright (projeto `protected`, local, fora do CI)

`tests/e2e/medicine-protected.spec.ts` (novo), `E2E_PROTECTED=1 npx playwright test --project=protected tests/e2e/medicine-protected.spec.ts`.
Organização **de teste**, dados fictícios criados pelo próprio teste ou por seed de teste. Cenários: passos 1→7 do FIRST-MVP;
critério de demonstração §9 itens 1, 3, 4 e 5 (o item 2 — desligar Medicina — só em empresa de teste, com owner e motivo);
viewports 375/768/1440 sem rolagem horizontal; `client` recebe a página `forbidden`.

### 11.4 Chrome DevTools (MCP)

Console sem erro nem aviso de hidratação; Network sem 4xx/5xx inesperados e sem `notes` em payload de Server Action/RSC; Application
sem dado médico em `localStorage`/`sessionStorage`; Lighthouse (acessibilidade) em `/medicine` com a nota registrada; emulação
375/768/1440; erro forçado com `/health-exams?employeeId=invalido` mostrando `ListErrorState`; trace de performance do `/medicine`
registrado (sem meta inventada).

## 12. Expansões e divergências em relação ao FIRST-MVP

| # | Item | FIRST-MVP | Este plano | Quem confirma |
|---|---|---|---|---|
| 1 | Badge do último exame na lista do painel | passo 3 pede o badge; §5 lista só duas superfícies | terceira superfície read-only `GET /api/v1/medicine/employees` + `listMedicineEmployeesAction` (alternativa: sem badge, o que descumpre o passo 3) | Carlos (TASK item 2) |
| 2 | Placeholder da ficha | "no lugar do placeholder da l.315" | l.315 é "Histórico" (genérico); seção como bloco próprio, remoção opcional | Carlos (TASK item 2) |
| 3 | Contagem do painel | "exames por situação" | situação do **último exame de cada funcionário** (+ "sem exame"), para não contar exame antigo superado | Carlos (TASK item 5) |
| 4 | `ErrorState` | "passam a mostrar `ErrorState`" | mesma identidade, componente inline `ListErrorState` (o atual tem `<main>`/`<h1>`) | Carlos |
| 5 | "Ver todos" na ficha | — | `/health-exams?employeeId=` com faixa de filtro | Carlos |
| 6 | Primitives | `StatCard` promovido | + `href?` opcional; `EmptyState` com `action?` | Carlos |
| 7 | Limitações mantidas | — | limite de 200 no formulário genérico; `companyId` = empresa atual; menu estático | registradas |

## 13. Sequência

Igual ao [TASK](TASK.md): 1 pré-check Git → 2 leitura do código → 3 componentes reutilizáveis (`ListErrorState`, `StatCard`,
`EmptyState.action`) → 4 rotas → 5 repositórios → 6 actions/core → 7 REST → 8 documentação de API e Postman → 9 segurança →
10 unitários → 11 integração → 12 Playwright → 13 Chrome DevTools → 14 review → 15 QA → 16 PR → 17 CI → 18 aceite →
19 merge com autorização → 20 homologação. Na prática, 5 e 6 podem preceder 4 (as telas consomem as actions); a ordem do TASK é
a de registro e aceite.

## 14. Arquivos previstos

| Arquivo | Novo/alterado |
|---|---|
| `src/app/(protected)/medicine/page.tsx`, `loading.tsx`, `_components/{medicine-overview-cards,medicine-company-filter,medicine-employee-list,medicine-empty-state}.tsx` | novos |
| `src/app/(protected)/employees/[id]/page.tsx`; `employees/[id]/_components/occupational-health-section.tsx` | alterado; novo |
| `src/app/(protected)/health-exams/page.tsx`, `new/page.tsx`, `_components/health-exam-filters.tsx`, `_components/health-exam-form.tsx` | alterados |
| `src/app/(protected)/medicos/page.tsx` | alterado |
| `src/app/(protected)/_components/nav-menu.tsx` | alterado (1 item) |
| `src/app/(protected)/_ui/stat-card.tsx`, `_ui/list-error-state.tsx` | novos |
| `src/app/(protected)/_ui/list.tsx` (`EmptyState.action?`), `dashboard/_components/dashboard-widgets.tsx` (reexport) | alterados |
| `src/shared/domains/medicine/{overview,employees,timeline}.ts` | novos |
| `src/shared/domains/pgr/health-exams.ts` | alterado |
| `src/shared/db/repositories/medicine-overview.ts` | novo |
| `src/shared/db/repositories/health-exams.ts` | alterado |
| `src/shared/server/medicine/overview-core.ts`, `src/shared/server/actions/medicine/overview.ts` | novos |
| `src/shared/server/actions/pgr/health-exams.ts` | alterado |
| `src/app/api/v1/medicine/overview/route.ts`, `src/app/api/v1/medicine/employees/route.ts` | novos |
| `src/app/api/v1/health-exams/route.ts` | alterado |
| `docs/api/api-design.md`, `docs/api/sst-manager.postman_collection.json` | alterados |
| testes de §11 + `tests/e2e/medicine-protected.spec.ts` + `_helpers/medicine-seed.ts` | novos (e 1 unitário ampliado) |

**Nenhum** arquivo em `src/shared/db/schema/**`, `src/shared/db/migrations/**`, `.github/**`, `proxy.ts` ou `globals.css` muda neste lote.
