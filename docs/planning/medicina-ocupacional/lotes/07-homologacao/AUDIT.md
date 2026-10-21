# Lote 07 — Homologação · AUDIT

> Base: `origin/develop` = `d6b787c` (21/10/2026). Resume [AUDIT-LINEAR-QA §5–§7](../../AUDIT-LINEAR-QA.md); não repete.
> [README do lote](README.md)

## 1. Infraestrutura existente

| Peça | Estado | Evidência |
|---|---|---|
| Unit (jsdom) | `npm run test` = `jest --selectProjects unit` | `package.json`, `jest.config.ts` |
| Integração (node, Postgres efêmero) | `npm run test:integration`; helpers `_helpers/db.ts` aplicam todos os `.sql` em ordem alfabética (não leem `_journal.json`) | [AUDIT-LINEAR-QA §5.3](../../AUDIT-LINEAR-QA.md) |
| Falso verde local | suites usam `(shouldRun ? describe : describe.skip)`: **sem `INTEGRATION_*` passam como skipped** | idem |
| Suites excluídas | 8 em `jest.config.ts` (6 `rest-*`, `least-privilege`, `companies-scope-model`); `rest-health-exams` **roda** | [AUDIT-LINEAR-QA §5.2](../../AUDIT-LINEAR-QA.md); X-5 do README da Fase 0 |
| Isolation suite | `runIsolationSuite` (6 asserções RLS) cobre 20 tabelas; **nenhuma de saúde** (`medicos`, `health_exams`, `company_modules`, psicossocial) | [AUDIT-LINEAR-QA §5.3](../../AUDIT-LINEAR-QA.md) |
| Seed | `pgr-seed.ts` (`org_a`/`org_b`); não semeia `medicos` nem `health_exams` | idem |
| Testes de Medicina | `medicos`, `health-exams`, `rest-health-exams`, `company-modules`, `company-module-management`, `shared-company-records`, psicossocial | [AUDIT-LINEAR-QA §5.4](../../AUDIT-LINEAR-QA.md) |
| E2E | Playwright: `tests/e2e/public-signature.spec.ts`, `safety-protected.spec.ts`, `auth.setup.ts`; projeto protected só com `E2E_PROTECTED=1`; **nenhum E2E de Medicina; não roda no CI** | `playwright.config.ts`; `.github/workflows/ci.yml` |
| CI | `ci.yml` em PR para develop/main: quality, test (postgres:16, unit + deploy + integração), build | [AUDIT-LINEAR-QA §5.6](../../AUDIT-LINEAR-QA.md) |
| CD | `cd.yml` em push develop/main: `vercel pull` → **`drizzle-kit migrate`** (l. 67-75) → build → deploy. develop → homologação; main → produção | `.github/workflows/cd.yml:67-75` |
| Ambiente de homologação | `APP_ENV=sandbox` com Basic Auth antes do Clerk e do bypass | [AUDIT-SECURITY R1 + nota](../../AUDIT-SECURITY.md); `docs/deploy/vercel.md` |
| Proteção de branch / checks obrigatórios | **NÃO VERIFICADO** (API 403 no plano atual) | [AUDIT-LINEAR-QA §5.6](../../AUDIT-LINEAR-QA.md) |

## 2. Scripts do protótipo (roteiro, nunca execução)

`flow.py`, `portal.py`, `demo.py`, `amianto.py`, `rev3.py` (e outros) testam o HTML monolítico via estado global. **Não são
reaproveitáveis como código** e **não serão executados**. Servem como roteiro de ~60 asserções de aceite
([AUDIT-LINEAR-QA §5.7](../../AUDIT-LINEAR-QA.md)). Atenção: `portal.py` usa datas fixas (R-11 do protótipo), então os
cenários derivados precisam de datas relativas.

| Script | Vira cenário de |
|---|---|
| `flow.py` | validações do ASO, snapshot pós-emissão, guia → ASO (Lotes 04/06) |
| `portal.py` | matriz de autorização empresa/clínica (Lote 06) |
| `demo.py` | restrição de download/impressão no teste grátis (NOB-118/129) — na plataforma, **no servidor** |
| `amianto.py`, `rev3.py` | regras clínicas e aritmética de datas — só após validação do Dr. Alcides |

## 3. Lacunas

| # | Lacuna |
|---|---|
| L1 | Sem responsável para NOB-128/129/130 |
| L2 | Playwright fora do CI; nenhum E2E de Medicina |
| L3 | Isolation suite e seed de Medicina inexistentes |
| L4 | Suites de privilégio mínimo fora do CI ([AUDIT-SECURITY R9](../../AUDIT-SECURITY.md)) |
| L5 | Sem roteiro de ensaio de migrations em cópia da produção antes do release |
| L6 | Sem critério escrito para HOMOLOGADO e PUBLICADO |
| L7 | Sem testes de acessibilidade/responsividade automatizados; contraste das pílulas de status abaixo de AA ([AUDIT-UX §6](../../AUDIT-UX.md)) |
| L8 | Ambiente online para testes reais (NOB-127) sem dono |

## 4. Riscos

| # | Risco | Impacto |
|---|---|---|
| R1 | Tratar MERGED como HOMOLOGADO ou PUBLICADO | entrega declarada sem prova |
| R2 | Release develop → main levar várias migrations juntas (0053 + #112 + Medicina) sem ensaio | falha em produção sem rollback |
| R3 | Falso verde por suites skipped | regressão invisível |
| R4 | Testes REST de Medicina no harness quebrado dos `rest-*` excluídos | cobertura aparente |
| R5 | Regressão de isolamento ao adicionar tabelas de saúde | vazamento entre empresas/escritórios |
| R6 | Dado clínico real usado em homologação | violação de sigilo |
| R7 | Validação dos interessados informal (sem registro) | aprovação inexistente na prática |
