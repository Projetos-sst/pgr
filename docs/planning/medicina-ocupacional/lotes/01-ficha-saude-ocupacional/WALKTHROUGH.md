# Lote 01 — WALKTHROUGH

> Só fatos de implementação. [README do lote](README.md) · [TASK](TASK.md)

## Estado

**`PR_ABERTA` (draft): [PR #120](https://github.com/Projetos-sst/pgr/pull/120)**, de `feature/NOB-108-ficha-saude-ocupacional` para
`develop`. Implementação, testes automatizados, QA no navegador e revisão de segurança feitos em 2026-10-21. Faltam:

- CI verde depois do commit de documentação;
- revisão do Douglas;
- aceite (T01-18);
- merge com autorização.

Formato de cada entrada: data · item do TASK · fato · evidência.

## T01-01 — Pré-check Git (2026-10-21)

- `git fetch origin --prune`: `origin/develop` = `d6b787c` (sem avanço desde a Fase 0). Branch atual
  `feature/NOB-108-ficha-saude-ocupacional`, HEAD `c0f10e4` (só documentação), working tree limpo. **Nenhum merge necessário.**
- Última migration da develop: `0053_company_module_access`.
- PR #112 (NOB-98): `OPEN`, **draft**, base `develop`, `MERGEABLE`, CI verde no head `5cca180`. Reserva 0054, 0055 e 0056.
- Pilha de PRs draft do Rikelvin sobre a #112:
  - #119 (0057);
  - #115 (sem migration);
  - #116 (0058);
  - #117 (0059).
- Arquivos em comum com a #112 que o Lote 01 toca: `nav-menu.tsx`, `docs/api/api-design.md` e Postman.
- O Lote 01 **não** toca `office-action.ts` nem `api/rest.ts`, que a #112 altera.

## T01-02 — Decisões de escopo (Carlos, 2026-10-21)

| PLAN §12      | Decisão                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| 1             | SIM: superfície read-only `GET /api/v1/medicine/employees` + `listMedicineEmployeesAction`                    |
| 2             | Seção "Saúde ocupacional" como bloco próprio; os placeholders "Histórico" e "Ordens de serviço" ficam         |
| 3             | Contagem pela situação do **último** exame de cada funcionário + "sem exame"; funcionários em todos os status |
| 4             | `ListErrorState` dedicado (`_ui/list-error-state.tsx`)                                                        |
| MED-DEC-17/18 | Não aprovadas: sem teal; formulário sem aviso novo em Observações                                             |

O direcionamento geral foi aprovado pelo Douglas, conforme informado pelo Carlos (MED-DEC-25).

## T01-03 a T01-08 — Implementação (commits `09bc02d`, `8372ec3`)

Execução por agentes com escopo de arquivos isolado: backend, frontend, QA, segurança. A integração e a revisão ficaram com o
coordenador.

- **Domínio:**
  - `domains/medicine/{overview,employees,timeline}.ts`;
  - `EXAM_DUE_WINDOW_DAYS` e `healthExamListFiltersSchema` em `domains/pgr/health-exams.ts`;
  - `optionalUuidWith(message)` em `form-fields.ts`, para mensagem em PT-BR nos filtros. O comportamento de `optionalUuid` não muda.
- **Repositórios:**
  - `medicine-overview.ts` (uma transação `withOrg`, predicado de módulo em `companies` e `employees`);
  - `health-exams.ts` (filtros + `listLatestHealthExamsByEmployee`);
  - `employees.ts` (desempate por `id` na ordenação).
- **Core, actions e REST:**
  - `server/medicine/overview-core.ts`;
  - `actions/medicine/overview.ts`;
  - `listHealthExamsAction` valida os filtros e create/update revalidam `/medicine` e `/employees/[id]`;
  - `GET /api/v1/medicine/{overview,employees}`;
  - filtros em `GET /api/v1/health-exams`.
- **Telas:**
  - `/medicine` (+ `loading.tsx`, 4 componentes);
  - seção na ficha;
  - `/health-exams` (filtros, erro ≠ vazio, faixa de funcionário);
  - `/health-exams/new` (pré-seleção, `returnTo` no servidor, bloqueio por módulo);
  - `/medicos` (erro ≠ vazio);
  - item "Painel" no menu;
  - `StatCard` promovido;
  - `EmptyState.action`.
- **Docs de API:** `api-design.md` e a coleção Postman (pasta "Medicina (painel)" + 2 requests na pasta ASO). O JSON é válido e
  não há variável nova.

### Desvios do PLAN e motivo

1. `/health-exams/new` confere a Medicina com `getCompanyModuleOverviewAction`, e não pela ausência do funcionário na lista de 200.
   Com mais de 200 funcionários, a regra do PLAN acusaria falsamente "sem Medicina".
2. `GET /medicine/employees` com `pageSize` acima de 100 ou `page`/`pageSize` não numéricos → 422. Segue o schema do PLAN; as
   outras rotas reduzem ao limite em silêncio.
3. O predicado de módulo também vale na consulta do último exame do painel, além da RLS.
4. O `StatCard` sem `href` não tem hover, para não parecer clicável. Os números dos cartões não usam `font-mono`, para manter o
   dashboard idêntico.
5. `listEmployees` ganhou desempate por `id`. Achado do QA: funcionários com o mesmo `created_at` podiam repetir ou sumir entre
   páginas.
6. INFO-1 da revisão de segurança corrigido: `/health-exams/new` só mostra o nome do funcionário depois de confirmar a Medicina.
7. Mensagem de UUID inválido nos filtros de exames em PT-BR ("Funcionário inválido" / "Empresa inválida").

## T01-05 — Semântica

Funcionários em todos os status contam no painel. A contagem considera o último exame de cada funcionário (desempate:
`performed_at desc, created_at desc`).

## T01-09 a T01-15 — Revisão e testes

Comandos e saídas literais no [QA](QA.md) §3–§5; parecer no [REVIEW](REVIEW.md).

- `npm run check` verde.
- Integração: 169 suítes passaram, 0 falharam, 5 skipped fora da Medicina.
- Medicina: 53 testes, 0 skipped.
- Jornada completa no navegador em 1440, 768, 375 e 320.
- Segurança: 0 CRITICAL / 0 HIGH / 0 MEDIUM.

## T01-16 / T01-17 — PR e CI

- [PR #120](https://github.com/Projetos-sst/pgr/pull/120) aberta em **draft** em 2026-10-21.
- 1ª execução de CI no head `8372ec3`: build ✔ e testes ✔. **`quality` ✘ só por Prettier** em 72 documentos de
  `docs/planning/medicina-ocupacional/` (já estavam em `c0f10e4`).
- O commit de documentação aplica o Prettier. A conferência por normalização mostrou que só mudou espaço em branco: alinhamento de
  tabelas e formatação de blocos de código. Nenhum arquivo da Fase 0 teve texto alterado.

## Pendente

| Item   | Registro                                              |
| ------ | ----------------------------------------------------- |
| T01-17 | **Verde** em `59bf798` (quality ✔, build ✔, testes ✔) |
| T01-18 | Aceite: quem, quando, canal                           |
| T01-19 | Autorização do merge e SHA                            |
| T01-20 | Validação em homologação: quem, quando                |
