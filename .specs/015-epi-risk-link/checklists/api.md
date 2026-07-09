# Checklist: Qualidade dos requisitos do contrato de API

**Purpose**: Validar se os requisitos da superfície de API do vínculo EPI × risco (regra das 4 partes,
verbos, códigos de erro, filtros) estão completos, claros e consistentes.
**Created**: 2026-07-08
**Feature**: [spec.md](../spec.md) · **Foco**: contrato de API (Server Actions + REST + docs + Postman)

## Requirement Completeness

- [ ] CHK001 - O requisito exige explicitamente as **quatro** partes (Server Action + REST mirror + docs `api-design.md` + Postman) no mesmo entregável? [Completeness, Spec §FR-012]
- [ ] CHK002 - Os formatos de entrada/saída de cada operação (list, available, add, update, remove) estão especificados? [Completeness, Contracts]
- [ ] CHK003 - O contrato do filtro `?available=true&search=` está documentado na spec (não só no arquivo de contratos)? [Gap, Spec §FR-006]
- [ ] CHK004 - O comportamento de paginação/limite da listagem de vinculados está especificado ou explicitamente dispensado? [Gap]

## Requirement Clarity

- [ ] CHK005 - Os códigos de status HTTP por verbo estão definidos (201 no create, 204 no delete)? [Clarity, Contracts]
- [ ] CHK006 - O resultado de neutralização ausente/ inválida (`VALIDATION`/422) está claro? [Clarity, Spec §FR-001]
- [ ] CHK007 - A semântica de duplicidade (POST do mesmo par → `DUPLICATE`/409) está inequívoca? [Clarity, Spec §FR-007]

## Requirement Consistency

- [ ] CHK008 - Os códigos de erro do domínio (`VALIDATION`/`DUPLICATE`/`FK_NOT_FOUND`/`NOT_FOUND`/`FORBIDDEN`) estão mapeados a condições sem sobreposição ambígua? [Consistency, Contracts]
- [ ] CHK009 - Os requisitos garantem que Action e REST reusam o **mesmo** repositório/schema (regra não reimplementada nas duas superfícies)? [Consistency, Spec §FR-012]
- [ ] CHK010 - A nomenclatura do recurso (`/risks/{id}/epis`) é consistente entre spec, contratos e docs? [Consistency]

## Dependencies & Assumptions

- [ ] CHK011 - A premissa do bypass de auth em não-produção (superfície testável via cURL/Postman) está registrada e limitada? [Assumption, quickstart §3]
- [ ] CHK012 - O contrato de leitura para consumo downstream (PGR consulta EPIs por risco) está especificado como estável/reusável? [Coverage, Spec §SC-006]
