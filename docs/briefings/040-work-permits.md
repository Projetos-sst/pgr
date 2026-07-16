# Briefing — Fatia 040: Permissões de Trabalho (PT) (issue #107)

## Contexto

Fase 08. Módulo **independente** da cadeia de inspeções: gestão de **Permissões de Trabalho** (PT) —
documentos que autorizam trabalhos de risco (a quente NR-33, em altura NR-35, espaço confinado, serviços
elétricos NR-10, escavação NR-18, etc).

Base: `feature/039-safety-inspections` **apenas por ordenação de migration** (para emitir a migration
`0019` limpa após a `0018` das inspeções e evitar colisão de numeração `0018`). Conceitualmente
independente — não referencia nenhuma entidade de inspeção.

## Modelo (migration nova `0019_work_permits`)

- Enum `work_permit_type`: hot_work, confined_space, height, electrical, excavation, cold_work, other.
- Enum `work_permit_status`: draft, active, suspended, closed, cancelled.
- Tabela `work_permits` isolada por tenant (org_id + RLS `app_runtime` + GRANT + trigger
  `set_updated_at`, no padrão das demais migrations): `number`, `type`, `status` (default draft),
  `companyId?` (SET NULL), `area?`, `description`, `validFrom`, `validUntil`, `requestedBy?`,
  `approvedBy?`, `precautions?`, `notes?`.
- Constraints: `UNIQUE(org_id, number)` e `CHECK valid_until >= valid_from`.

## Decisões

- **Número único por org** (não global) → duplicado vira `23505` → **`409 DUPLICATE`** (auto-mapeado
  por `action-error.ts`, sem catch no repo).
- **Validade**: `validUntil >= validFrom` validado no **Zod** (`.refine`) **e** como `CHECK` no banco
  (backstop) — o teste de integração prova o backstop.
- **Empresa opcional**: `assertCompany` só valida quando informada → cross-tenant `422 FK_NOT_FOUND`.
- **Status explícito** (não derivado): o fiscal transiciona draft→active→closed/cancelled pela UI.
- **Sem sub-tabela de medidas nesta fatia**: precauções ficam em `precautions text` (checklist de
  controles fica para evolução futura).

## Superfície (mandato de 4 partes)

1. **Server Action** — `actions/work-permits/work-permits.ts`
   (`list/get/create/update/delete` + options de empresa).
2. **REST** — `/api/v1/work-permits` (GET `?search=`/`?status=`/`?type=`, POST 201) + `/[id]`
   (GET/PUT/DELETE 204).
3. **Docs** — `docs/api/api-design.md` (linha + bullet).
4. **Postman** — pasta "Permissoes de trabalho (PT)" + var `workPermitId`.

- **UI** — `/permissoes-trabalho` (lista/busca), `/new`, `/[id]/edit`, delete inline, nav.

## Camadas

- Domínio: `domains/work-permits/work-permits.ts` (Zod + labels + projeções).
- Repositório: `repositories/work-permits.ts` (`withOrg` + `auditedTenantWrite`).
- Schema: `db/schema/work-permits.ts` + registro no barrel + migration `0019`.

## Erros

Reusa `VALIDATION` (422 — inclui range de validade), `DUPLICATE` (409 — nº repetido),
`FK_NOT_FOUND` (422 — empresa cross-tenant), `NOT_FOUND` (404), `FORBIDDEN` (403). Sem novos códigos.

## Testes

- **Unit** — schema (validade/obrigatórios/tipo, status default), labels, projeção.
- **Integração** (Postgres efêmero) — create + get, **DUPLICATE** por org (e reuso do nº em outro
  tenant), **FK_NOT_FOUND** empresa cross-tenant, update/delete, busca, isolamento, **CHECK** de
  validade no banco.
