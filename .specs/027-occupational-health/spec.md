# 027 — Gestão de Saúde Ocupacional (exames/ASO)

**Origem:** Parte de #181 (implantação do redesign) — mockup `docs/redesign/gestao-saude.dc.html`.
**Base:** `feature/medicos` (empilhada — usa a FK do médico responsável). **Migration:** `0030_health_exams`.

## Objetivo

Implementar o módulo **Gestão de Saúde Ocupacional** (exames ocupacionais / ASO por funcionário),
tela nova a partir do mockup, com dado real do backend e visual pixel-perfect reusando o kit
`_ui/data-list` e as primitives do design system.

## Modelo de dados

Tabela nova `health_exams` (tenant-isolada), enums `exam_type` e `exam_aptitude`:

| Campo                       | Tipo                      | Regra                                                                    |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `id`                        | uuid PK                   | `gen_random_uuid()`                                                      |
| `org_id`                    | text NOT NULL → orgs      | `ON DELETE CASCADE`; RLS `app.current_org`                               |
| `employee_id`               | uuid NOT NULL → employees | `ON DELETE CASCADE`                                                      |
| `doctor_id`                 | uuid → medicos            | `ON DELETE SET NULL` (não bloqueia nem apaga o exame)                    |
| `exam_type`                 | exam_type NOT NULL        | admissional / periodic / change_of_function / return_to_work / dismissal |
| `performed_at`              | date NOT NULL             | não-futura (fuso America/Sao_Paulo)                                      |
| `valid_until`               | date                      | nullable (ex.: demissional sem validade)                                 |
| `aptitude`                  | exam_aptitude NOT NULL    | fit / fit_with_restrictions / unfit                                      |
| `notes`                     | text                      | opcional                                                                 |
| `certificate_path`          | text                      | caminho do ASO (sem GED)                                                 |
| `created_at` / `updated_at` | timestamptz               | trigger `set_updated_at`                                                 |

**Validade derivada na leitura** (nunca coluna): `classifyDocumentValidity(valid_until, {today,
dueWindowDays})` (espelho de Treinamentos/Documentos). O badge de "Status" combina validade + aptidão
(`examBadge`): vencido→vermelho, a vencer→âmbar; vigente → mostra a aptidão (apto/apto c/ restrição/inapto).

Sem `/dependents` (nenhuma FK de entrada).

## User stories

- **US1 — CRUD de exames/ASO:** listar (busca por funcionário, filtro por tipo, paginação), criar
  (com médico opcional), detalhar=editar, excluir. Server Action + REST mirror + docs + Postman.
- **US2 — Identidade visual:** lista/form pixel-perfect vs. mockup, via kit `data-list` + primitives.

## Contratos

- Server Actions: `actions/pgr/health-exams.ts` (`list`, `get`, `create`, `update`, `delete`).
- REST: `/api/v1/health-exams` (GET, POST 201) · `/api/v1/health-exams/{id}` (GET, PUT, DELETE 204).
- Erros: `VALIDATION` (422, data futura/enum), `FK_NOT_FOUND` (422, funcionário/médico cross-tenant),
  `NOT_FOUND` (404/cross-tenant), `FORBIDDEN` (403).

## Testes

- Unit: `healthExamInputSchema` (obrigatórios, data não-futura, enums) + `examBadge` (validade × aptidão).
- Integração (Postgres efêmero `INTEGRATION_*`): CRUD escopado com FK de funcionário/médico, busca,
  filtro por tipo, `FK_NOT_FOUND` cross-tenant, `VALIDATION` (data futura), cross-tenant → `NOT_FOUND`.

## Constitution Check

- **Princípio I (isolamento multi-tenant):** OK — `org_id` + RLS `pgPolicy` + `withOrg`. Tenant da sessão.
- **Princípio II (serviço externo):** N/A.
- **Testabilidade:** OK — unit + integração contra Postgres efêmero.
- **API surface (CRUD):** OK — Server Action + REST mirror + api-design.md + Postman no mesmo PR.
- **Complexity Tracking:** vazio (sem violações). Depende da fatia 026 (Médicos) — PR empilhada.
