# 026 — Cadastro de Médicos (CRUD)

**Origem:** Parte de #181 (implantação do redesign) — mockup `docs/redesign/medicos.dc.html`.
**Base:** `develop`. **Migration:** `0029_medicos`.

## Objetivo

Implementar o módulo **Cadastro de Médicos** (médicos do trabalho responsáveis por exames/ASO),
tela nova a partir do mockup, com dado real do backend e visual pixel-perfect reusando o kit
`_ui/data-list` e as primitives do design system.

## Modelo de dados

Tabela nova `medicos` (tenant-isolada), enum `medico_status (active|inactive)`:

| Campo                       | Tipo                   | Regra                                                |
| --------------------------- | ---------------------- | ---------------------------------------------------- |
| `id`                        | uuid PK                | `gen_random_uuid()`                                  |
| `org_id`                    | text NOT NULL → orgs   | `ON DELETE CASCADE`; RLS `app.current_org`           |
| `name`                      | text NOT NULL          | Nome do médico                                       |
| `crm`                       | text NOT NULL          | `UNIQUE(org_id, crm)` → `DUPLICATE`                  |
| `specialty`                 | text                   | Especialidade (opcional)                             |
| `clinic`                    | text                   | Clínica/empregador ("Empresa" na lista, texto livre) |
| `phone`                     | text                   | Contato (opcional)                                   |
| `status`                    | medico_status NOT NULL | default `active`                                     |
| `created_at` / `updated_at` | timestamptz            | trigger `set_updated_at`                             |

Sem `/dependents`: o vínculo futuro (exames/ASO, fatia 027) usa `ON DELETE SET NULL` e não bloqueia
a exclusão do médico.

## User stories

- **US1 — CRUD do cadastro:** listar (busca por nome/CRM, filtro por status, paginação offset),
  criar, detalhar=editar, excluir. Server Action + REST mirror + docs + Postman.
- **US2 — Identidade visual:** lista/form pixel-perfect vs. mockup, via kit `data-list` + primitives.

## Divergências de dado registradas (sem dado fictício)

- O mockup mostra o filtro "Todas as Empresas" na toolbar. Médico é cadastro do **escritório**, não
  é escopado por empresa-cliente → substituído por **filtro de Status** (Ativos/Inativos), que mapeia
  dado real. Coluna "Empresa" = `clinic` (texto livre), fiel ao mockup ("Clínica SanaVida", "Autônomo").

## Contratos

- Server Actions: `actions/pgr/medicos.ts` (`list`, `options`, `get`, `create`, `update`, `delete`).
- REST: `/api/v1/medicos` (GET, POST 201) · `/api/v1/medicos/{id}` (GET, PUT, DELETE 204).
- Erros: `VALIDATION` (422), `DUPLICATE` (409, CRM), `NOT_FOUND` (404/cross-tenant), `FORBIDDEN` (403).

## Testes

- Unit: `medicoInputSchema` (obrigatórios, opcionais→undefined, enum status).
- Integração (Postgres efêmero `INTEGRATION_*`): CRUD escopado, busca nome/CRM, filtro status,
  `DUPLICATE` (CRM), `VALIDATION`, cross-tenant → `NOT_FOUND`.

## Constitution Check

- **Princípio I (isolamento multi-tenant):** OK — `org_id` + RLS `pgPolicy` + `withOrg`, réplica de
  `companies`/`categories`. Tenant sempre da sessão.
- **Princípio II (serviço externo):** N/A — sem integração externa.
- **Testabilidade:** OK — unit + integração contra Postgres efêmero.
- **API surface (CRUD):** OK — Server Action + REST mirror + api-design.md + Postman no mesmo PR.
- **Complexity Tracking:** vazio (sem violações).
