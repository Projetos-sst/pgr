# Lote 01 — QA

> [README do lote](README.md) · [PLAN §11](PLAN.md#11-testes)

## Estado

**NÃO INICIADO — nenhum teste executado.**

## Ambiente previsto

| Camada | Ambiente | Pré-requisitos |
|---|---|---|
| Unit | local, jsdom | `npm run test` |
| Integração | **Postgres efêmero** (nunca dev, homologação ou produção) | `INTEGRATION_APP_RUNTIME_URL` (runtime) e `INTEGRATION_DATABASE_URL` (admin/owner); `INTEGRATION_DATABASE_URL_ADMIN` opcional. Sem as duas primeiras, as suítes saem **skipped** |
| E2E | local, projeto `protected` do Playwright | `E2E_PROTECTED=1`, usuário de teste do Clerk, organização **de teste**, dados fictícios |
| Navegador | Chrome DevTools (MCP) sobre o dev server local | dev server reiniciado após troca de branch |
| CI | GitHub Actions da PR (`quality`, `test` com Postgres 16, `build`) | PR aberta para `develop` |

## Comandos previstos

```
npm run check
npm run test:integration                       # com as variáveis INTEGRATION_* do Postgres efêmero
npx jest --selectProjects integration src/__tests__/integration/medicine --verbose
E2E_PROTECTED=1 npx playwright test --project=protected tests/e2e/medicine-protected.spec.ts
```

## Cenários planejados

| # | Cenário | Camada | Resultado esperado |
|---|---|---|---|
| Q01 | Painel lista só empresas com Medicina, com contagens pelo último exame | I + E | `companyA`, `companyA2`; nunca `companyA3`/`org_b` |
| Q02 | Escritório sem empresa com Medicina | U + E | estado vazio; owner vê link, collaborator vê "peça ao administrador" |
| Q03 | Desligar Medicina numa empresa de teste | I + E | some do painel; seção da ficha oculta; exames ocultos |
| Q04 | Lista de funcionários com busca e paginação no servidor | I + E | `total` correto; sem limite silencioso |
| Q05 | Empresa sem Medicina por `companyId` | I | `FORBIDDEN` (403 no REST) |
| Q06 | Empresa de outro tenant por `companyId` | I | `NOT_FOUND` (404) |
| Q07 | Ficha com seção "Saúde ocupacional" | U + E | linha do tempo com validade informada e badge; sem `notes` |
| Q08 | Registrar exame pela ficha, salvar, F5 | E | volta à ficha; dado persiste após recarga |
| Q09 | Funcionário de outra organização por ID | I + E | 404 |
| Q10 | Erro de leitura (ID malformado, falha forçada) | U + I + navegador | `ListErrorState`, nunca "Nenhum exame" |
| Q11 | Filtro `companyId` não vaza entre empresas do mesmo escritório | I | só exames da empresa filtrada |
| Q12 | Criar exame para funcionário de empresa sem Medicina | I | `FORBIDDEN` |
| Q13 | Papel `client` | I + E | `forbidden()` / `FORBIDDEN` / 403 |
| Q14 | Isolamento RLS de `health_exams` | I | 6 asserções do `runIsolationSuite` |
| Q15 | Regressão das suítes existentes de exames, médicos e módulos | I | sem falha nova |
| Q16 | Responsividade 375/768/1440 | E + navegador | sem rolagem horizontal da página |
| Q17 | Console, Network, Application, Lighthouse a11y | navegador | sem erro; sem `notes` em payload; sem dado médico em storage; nota registrada |
| Q18 | Dashboard após promover `StatCard` | navegador | idêntico às capturas de antes |
| Q19 | Contagem de suítes skipped | I | zero nos arquivos de Medicina |

## Evidências

Nenhuma. Ao executar, registrar por cenário: data, comando ou passo, resultado e evidência (saída resumida, captura com
dados fictícios). Nunca registrar "PASS" sem evidência.
