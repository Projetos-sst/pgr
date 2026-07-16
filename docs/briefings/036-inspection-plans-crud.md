# Briefing — Fatia 036: CRUD de Plano de Inspeção + itens (issue #98)

## Contexto

Fase 08 (Módulo de Inspeções e Permissões de Trabalho). A fatia 034 entregou o modelo de dados
(6 tabelas + 5 enums), incluindo `inspection_plans` e `inspection_plan_items`. Esta fatia (036)
entrega o **CRUD do plano de inspeção** — o checklist reutilizável consumido pelas inspeções
veiculares e de máquinas/equipamentos. Inspeções de **segurança** não usam plano.

Base: `feature/034-inspections-data-model` (stacked). **Zero migration** — tabelas/enums/RLS já são da 034.

## Escopo

- **Plano** (`inspection_plans`): `type` (`vehicular`|`equipment`), `subtype?`, `title`, `description?`.
- **Itens** (`inspection_plan_items`): `description`, `defaultValue` (bool), `order`. Os itens **vivem
  dentro do plano** — não há CRUD próprio de item. Salvar um plano = **substituir todos os itens**
  transacionalmente (delete-then-insert; `order` = índice do array).

## Decisões

- **Itens como sub-tabela do plano** (não entidade de topo): a UI edita o plano inteiro (form com
  linhas dinâmicas de item); o repositório troca os itens numa transação `withOrg`.
- **`itemCount` derivado na listagem** por subconsulta correlacionada (sem coluna materializada).
  ⚠️ Ao escrever a subconsulta em `sql\`\``, a coluna externa foi **qualificada explicitamente**
(`"inspection_plans"."id"`) porque o Drizzle renderiza `${inspectionPlans.id}`sem qualificar,
colidindo com o`id` da tabela interna (`inspection_plan_items`) e zerando a contagem. Bug pego
  pelo teste de integração.
- **`type` restrito a `vehicular|equipment`** no domínio (`planTypeSchema`), embora a coluna use o
  enum `inspectionType` (que inclui `safety`). Segurança não tem plano.
- **PUT exige corpo completo** (`inspectionPlanInputSchema`, sem `.partial()`) — espelho de companies.

## Superfície (mandato de 4 partes)

1. **Server Action** — `src/shared/server/actions/inspections/plans.ts`
   (`list/get/create/update/delete`, `officeAction`, `revalidatePath("/planos-inspecao")`).
2. **REST** — `src/app/api/v1/inspection-plans/route.ts` (GET list `?search=`/`?type=`, POST 201) +
   `[id]/route.ts` (GET `{plan, items}`, PUT, DELETE 204).
3. **Docs** — `docs/api/api-design.md` (linha em "Recursos" + bullet).
4. **Postman** — pasta "Planos de inspecao" + variável `planId`.

- **UI** — `/planos-inspecao` (lista/busca), `/new`, `/[id]/edit`, form client com linhas de item
  dinâmicas (add/remover), delete inline, entrada no nav.

## Camadas

- Domínio: `src/shared/domains/inspections/plans.ts` (Zod + labels + projeções).
- Repositório: `src/shared/db/repositories/inspection-plans.ts` (queries via `withOrg`,
  `auditedTenantWrite` nas escritas).

## Erros

Reusa `VALIDATION` (422), `NOT_FOUND` (404), `FORBIDDEN` (403). Sem novos códigos, sem `/dependents`
nesta fatia.

## Testes

- **Unit** — `domains/inspections/__tests__/plans.test.ts` (schemas, labels, projeção).
- **Integração** (Postgres efêmero) — `__tests__/integration/inspections/plans-crud.test.ts`:
  create+read ordenado, update substitui itens, busca/filtro/`itemCount`, delete com cascade,
  isolamento cross-tenant (org_b não vê/edita/apaga plano de org_a).
