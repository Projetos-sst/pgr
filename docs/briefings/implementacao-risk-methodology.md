# Implementação — Metodologia de avaliação de riscos (matriz 5×5 configurável) · issue #76

> **Branch:** `feature/risk-methodology` (baseada no HEAD que contém a #129 + merge de `develop`).
> **Tipo:** fatia de **fluxo completo** (dados → domínio → repo → actions → REST → UI → testes + docs).
> **Status:** implementada; `npm run check` + `npm run build` verdes. Segue o
> [briefing](briefing-risk-methodology.md) — todas as decisões (D1–D9) foram travadas conforme a
> recomendação lá.

---

## 1. O que foi entregue (resumo)

Tela + API para a organização **configurar sua metodologia de avaliação de riscos**: rótulos/descrições
das 5 gradações de probabilidade e severidade, as **faixas** que classificam o nível de risco
(`prob × sev` ∈ [1,25]) em **Trivial / Tolerável / Moderado / Substancial / Intolerável**, e a **base**
(AIHA / AS-NZS 4360 / Fundacentro / Personalizada) que preenche os padrões. Seção **read-only** com a
hierarquia NR-01 (4 níveis). Uma configuração por organização (**upsert**, isolada por tenant).

A matriz 5×5 **não é persistida célula a célula**: guardam-se as faixas e a classe de cada uma das 25
células é **derivada** por `classify(prob × sev, faixas)` (função pura). Trocar a metodologia reclassifica
tudo automaticamente (classificação derivada na leitura — D8).

---

## 2. Arquivos (por camada)

**Domínio (puro, reutilizável por UI e servidor)**

- `src/shared/domains/pgr/methodology.ts` — enums Zod (`risk_classification`, `methodology_base`),
  schemas (`methodologyGradeSchema`, `classificationBandSchema`, `methodologyInputSchema`), funções puras
  `classify`, `buildMatrix`, e rótulos pt-BR. Reusa `computeRiskLevel` da #129.
- `src/shared/domains/pgr/methodology-presets.ts` — presets das 4 bases, `defaultRiskMethodology()`
  (fallback Fundacentro) e `NR01_CONTROL_HIERARCHY` (seção read-only; reusa `controlLevelLabel`).

**Dados**

- `src/shared/db/schema/risk-methodology.ts` — tabela `risk_methodology` (JSONB para gradações/faixas —
  D1), 2 `pgEnum`, `unique(org_id)` (singleton), RLS `risk_methodology_isolation`. JSONB tipado por
  `import type` do domínio (sem ciclo em runtime).
- `src/shared/db/schema/index.ts` — export do novo módulo.
- `src/shared/db/migrations/0013_risk_methodology.sql` — gerada por `drizzle-kit` + **SQL custom**
  (GRANT `app_runtime` + trigger `set_updated_at`). `+ meta/0013_snapshot.json` e entrada no `_journal.json`.

**Servidor**

- `src/shared/db/repositories/risk-methodology.ts` — `getRiskMethodology` (row|null),
  `getRiskMethodologyView` (resolve o **padrão** quando ausente, `configured:false` — D7),
  `upsertRiskMethodology` (`onConflictDoUpdate` por `org_id`, via `auditedTenantWrite` + `withOrg`).
- `src/shared/server/actions/pgr/risk-methodology.ts` — `getRiskMethodologyAction` (read) +
  `saveRiskMethodologyAction` (parse Zod + upsert + audit), ambas via `officeAction`.
- `src/app/api/v1/risk-methodology/route.ts` — espelho REST **singleton** `GET`/`PUT` (sem `list`/`[id]` — D6).

**UI**

- `src/app/(protected)/risk-methodology/page.tsx` — server component (gate `requireOfficeStaffPage`,
  carrega via action).
- `src/app/(protected)/risk-methodology/_components/methodology-editor.tsx` — client: seções de
  probabilidade/severidade, **grid 5×5 colorido** (derivado de `buildMatrix`), editor de faixas, seção
  NR-01 read-only, **select de base com autofill**, salvar via `<form onSubmit>` + `useTransition`.
- `src/app/(protected)/layout.tsx` — item de nav "Metodologia de Risco" (`/risk-methodology`) — ponto de
  acesso âncora (D5), já que a listagem de PGR ainda não existe.

**Docs & testes**

- `docs/api/api-design.md` — recurso registrado nas tabelas "Recursos" e "Sumário".
- `docs/api/sst-manager.postman_collection.json` — pasta "Metodologia de Risco" (GET + PUT).
- `src/__tests__/unit/domains/pgr/methodology.test.ts` — 16 casos (classify, buildMatrix, validações,
  presets, rótulos).
- `src/__tests__/integration/pgr/risk-methodology.test.ts` — upsert, default, validação, **isolamento
  cross-tenant**, FORBIDDEN (Postgres efêmero; self-skip sem `INTEGRATION_*`).

---

## 3. Decisões travadas (D1–D9 do briefing)

| #   | Decisão                      | Como ficou                                                                   |
| --- | ---------------------------- | ---------------------------------------------------------------------------- |
| D1  | Storage de gradações/faixas  | **JSONB** tipado + validação Zod.                                            |
| D2  | Formato das faixas           | **Limites superiores ordenados** (última = 25) → cobre 1–25 por construção.  |
| D3  | Cor das células              | **Fixa por classe** (constante de UI, verde→vermelho).                       |
| D4  | Presets por base             | Rótulos comuns; fronteiras distintas e **editáveis** (comentado no código).  |
| D5  | Ponto de acesso              | Item no nav (`/risk-methodology`); gancho p/ listagem de PGR futura.         |
| D6  | Forma REST                   | `GET`/`PUT /api/v1/risk-methodology` (singleton).                            |
| D7  | Org sem config               | **Default derivado** na leitura (não persiste).                              |
| D8  | Classificação nas avaliações | **Derivada** (`classify` pronta); aplicação nas telas de avaliação é futura. |
| D9  | `risk_classification`        | **pgEnum** (fecha a lista; reuso futuro).                                    |

---

## 4. Como validar

- `npm run check` — format + lint + typecheck + **385 testes unit** (16 novos). ✅
- `npm run build` — compila a rota `/risk-methodology` e o endpoint REST (fronteira RSC ok). ✅
- `npm run db:generate` — "No schema changes" (snapshot 0013 consiste com o schema). ✅
- `npm run test:integration` (requer `INTEGRATION_*` → Postgres efêmero) — cobre upsert/isolamento.
- Manual: `PUT /api/v1/risk-methodology` (bypass DEV) com o corpo da pasta Postman; depois `GET`.

---

## 5. Fora de escopo / follow-ups

- **Listagem de PGR** e **tela de avaliação de risco** não existem ainda — quando forem construídas,
  ligar o botão "Metodologia de Avaliação" nelas (o gancho já está no nav) e **aplicar `classify`** para
  exibir a classe qualitativa em cada avaliação (a função e a query já estão prontas e testadas).
- Cor/rótulo das faixas não são customizáveis (dimensão fixa 5×5).
- Sem versionamento/histórico da metodologia (uma linha corrente por org; auditoria via
  `auditedTenantWrite`).
- Fronteiras exatas de cada base (AIHA/AS-NZS/Fundacentro) são padrões razoáveis **editáveis** — se
  houver fonte oficial, ajustar em `methodology-presets.ts`.
