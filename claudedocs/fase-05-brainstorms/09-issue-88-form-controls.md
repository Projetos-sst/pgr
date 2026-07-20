# Issue #88 · CRUD de Controle de Formulário (ISO: FRM, REV, N.C.)

**Objetivo:** CRUD clássico de `form_controls` (migration própria) + preview do cabeçalho
em tempo real. A injeção no PDF é fronteira (fica no #37/#40).

**Depende de:** nada (migration própria). **Destrava:** #40.
**Posição sugerida:** primeira fatia depois do #33 (ou em paralelo) — baixo risco.

Issue já está no Modelo B ✅ — a mais "receita de bolo" da fase: espelhar **companies**
(referência canônica do CLAUDE.md): schema+RLS+migration, zod, repo, `officeAction`,
espelho REST `/api/v1/form-controls`, `docs/api/api-design.md`, Postman.

## Pontos a clarificar no spec

1. **Unicidade por tipo:** "uma configuração por tipo de formulário" pede também
   `UNIQUE(org_id, form_type)`? A issue só exige `UNIQUE(org_id, frm_code)`. Se dois
   controles do mesmo tipo forem permitidos, o consumidor (#40) precisa de regra de
   escolha. Cravar no `/speckit-clarify`.
2. **Tipagem dos campos:** `positioning` como `pgEnum` (`top|footer|both`); sugerido
   `rev int`, `date date` (zod), `nc` texto opcional.
3. **GES/Setor responsável:** FK real para `ges` ou texto livre? A issue lista como campo
   simples — texto livre no MVP evita FK cruzada; anotar.
4. **Preview em tempo real:** componente client puro replicando o layout impresso — e que
   deve ser **o mesmo componente/markup** usado no `header.html` do Gotenberg (#37/#40).
   Extrair `FormControlHeader` compartilhado é o jeito DRY de garantir que o preview não
   mente.
5. **Erros:** `UNIQUE(org_id, frm_code)` → 409 `DUPLICATE` (23505, mapeamento já existe);
   404 cross-tenant; 422 validação.

## Testes

- Unit: zod (obrigatórios, posicionamento), montagem do preview.
- Integração: 5 operações org-scopadas; 409 em FRM duplicado no mesmo escritório e
  mesmo FRM aceito em escritórios distintos; 404 cross-tenant; Postgres efêmero.

## Insumos para o /speckit-specify

- **Branch:** `feature/form-control-crud` (da issue — o template da issue já está
  completo; somar as clarificações acima).
