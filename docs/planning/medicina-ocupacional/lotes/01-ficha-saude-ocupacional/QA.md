# Lote 01 — QA

> [README do lote](README.md) · [PLAN §11](PLAN.md#11-testes)

## 1. Estado

**EXECUTADO (2026-10-21), com uma limitação.** Passaram:

- unitários e de componentes;
- integração em Postgres efêmero;
- verificação REST;
- jornada no navegador (Chrome via DevTools MCP) em 1440/768/375/320.

**Limitação:** o spec automatizado `tests/e2e/medicine-protected.spec.ts` (PLAN §11.3) **não foi escrito nem executado**. O projeto
Playwright `protected` exige `E2E_CLERK_*` (usuário de teste do Clerk), que não existe neste ambiente. A jornada foi percorrida no
navegador real, com login feito pelo Carlos.

## 2. Ambiente usado

| Camada             | Ambiente real                                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit               | Local, jsdom, `npm run test` (dentro de `npm run check`)                                                                                                                                                                                                                |
| Integração         | Postgres 16.14 **efêmero** no container local existente `qa-pg16` (porta 5433). Banco `sst_test`, bootstrap `scripts/ci-integration-bootstrap.sql`. Runtime como `app_runtime` (RLS aplicada); admin para migrations e seed. Nunca dev, homologação ou produção         |
| REST e navegador   | Dev server próprio em `localhost:3001`, com `DATABASE_URL` sobrescrita para o banco local `sst_qa_lote01`. Migrations 0000–0053 aplicadas por um script que recusa qualquer outro alvo. Seed fictício com prefixo `EXEMPLO`. O REST usou o bypass dev (`APP_ENV=local`) |
| Login no navegador | Feito pelo Carlos, por e-mail no Clerk de **desenvolvimento**. O Google bloqueia login em navegador controlado por automação. O agente não digitou credencial                                                                                                           |
| CI                 | PR #120. Na 1ª execução, `quality` falhou só por Prettier nos documentos de planejamento (corrigido no commit de docs); build e testes passaram                                                                                                                         |

**Achado de ambiente.** `listTenantMembershipsByUser` (`repositories/org-memberships.ts:45-55`) usa o **cliente Supabase** do
`.env.local`, não o Drizzle. Por isso o servidor de QA **leu** os vínculos do usuário no Supabase configurado e tomou dele o tenant
pessoal. Não houve escrita lá: o usuário já existia, então nada foi provisionado. Todo o resto (empresas, funcionários, exames,
módulos) veio do banco local.

Para alinhar os dados, o seed fictício foi replicado no banco local sob esse ID de tenant. O ID foi capturado com `log_statement`
ligado temporariamente **só no banco local** e desligado em seguida.

**Ajuste prévio de ambiente.** `npm install` instalou pacotes que já estavam no `package.json` e no lockfile mas faltavam no
`node_modules` local: `docxtemplater`, `docx`, `pizzip` e `@googleapis/*`. O lockfile não mudou.

## 3. Execuções automatizadas

| Comando                                                                        | Resultado literal                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:integration` no código da develop (linha de base, antes do lote) | `Test Suites: 2 failed, 5 skipped, 162 passed` · `Tests: 14 skipped, 1270 passed, 1284 total`. As 2 falhas: `Cannot find module 'docxtemplater'` (ambiente)                                                       |
| `npm run check`                                                                | exit 0 · `All matched files use Prettier code style!` · `✖ 4 problems (0 errors, 4 warnings)` (avisos `no-img-element` que já existiam) · `Test Suites: 179 passed, 179 total` · `Tests: 1768 passed, 1768 total` |
| `npm run test:integration` (lote completo)                                     | `Test Suites: 5 skipped, 169 passed, 169 of 174 total` · `Tests: 14 skipped, 1337 passed, 1351 total` · 0 falhas                                                                                                  |
| Suítes skipped (JSON do jest)                                                  | `pdf/pgr-docx-live`, `platform/team`, `webhooks/clerk-membership`, `pdf/gotenberg-e2e`, `shared/db/smoke`. Dependem de Google, Supabase, Clerk, Gotenberg ou banco real; **nenhuma é da Medicina**                |
| Suítes de Medicina (JSON do jest)                                              | `health-exams-filters` 11 · `medicine-employees` 11 · `rest-medicine` 14 · `overview` 11 · `health-exams-isolation` 6 → **53 passed, 0 skipped**                                                                  |
| `tsc --noEmit` sem `.next/`                                                    | exit 0. O `npm run typecheck` com o dev server no ar acusa 1 erro em `.next/dev/types`, um artefato conhecido                                                                                                     |

## 4. Verificação REST (cURL)

Tenant `org_qa_a` com 3 empresas: Alfa e Beta com Medicina, Gama sem. `org_qa_b` é outro escritório. Dados fictícios.

| #   | Requisição                                               | Obtido                                                                                                                |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R1  | `GET /medicine/overview` (owner)                         | 200; Gama e `org_qa_b` ausentes                                                                                       |
| R2  | `GET /medicine/employees?companyId=<Alfa>`               | 200, `total 25`, `rows 20`; `latestExam` = exame mais recente; nenhum `notes`/`certificate`/`cpf`/marcador no payload |
| R3  | idem com `&page=2`                                       | 200, `rows 5`                                                                                                         |
| R4  | idem com `&search=Trabalhador 07`                        | 200, `total 1`                                                                                                        |
| R5  | `companyId=<Gama>` (sem Medicina)                        | 403 `FORBIDDEN`                                                                                                       |
| R6  | `companyId=<empresa de org_qa_b>`                        | 404 `NOT_FOUND`                                                                                                       |
| R7  | sem `companyId` / `companyId=abc`                        | 422 `VALIDATION`                                                                                                      |
| R8  | `x-dev-role: client`                                     | 403 `FORBIDDEN`                                                                                                       |
| R9  | `GET /health-exams?employeeId=<funcionário de org_qa_b>` | 200 `{"rows":[],"total":0}`                                                                                           |
| R10 | `GET /health-exams?employeeId=xyz`                       | 422 "Funcionário inválido". Antes da correção, vinha a mensagem padrão do zod, em inglês                              |
| R11 | `GET /health-exams?companyId=<Alfa>`                     | 200, `total 5`                                                                                                        |
| R12 | `GET /health-exams?companyId=<Gama>`                     | 200, `total 0` (RLS de módulo)                                                                                        |
| R13 | `GET /medicine/overview` como `org_qa_b`                 | 200, 1 empresa                                                                                                        |

## 5. Jornada no navegador (Chrome via DevTools MCP)

Capturas em [`capturas/`](capturas/), só com dados fictícios.

| #   | Passo                                                                         | Resultado                                                                                                                                                                                                                       | Evidência                                   |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| N1  | `/medicine` antes do seed (tenant pessoal sem empresa com Medicina)           | Estado vazio de owner com link "Ir para Empresas"                                                                                                                                                                               | `q02-vazio-owner-1440.png`                  |
| N2  | `/medicine` com o seed                                                        | 2 empresas (Gama ausente). Cartões: 27 funcionários, 1 vencido, 1 a vencer, 22 sem exame. Confere com o seed: 25 + 2 funcionários, 5 com exame                                                                                  | `q01-painel-1440.png`                       |
| N3  | Seleção da Alfa                                                               | Resumo da empresa (25 funcionários), grade com tipo, data, validade informada e situação; "Sem exame registrado" nos demais. Rodapé "1 a 20 de 25"; o link da página 2 preserva `companyId`                                     | snapshot                                    |
| N4  | Página 2                                                                      | Trabalhadores 21–25, "21 a 25 de 25"                                                                                                                                                                                            | snapshot                                    |
| N5  | Busca "Trabalhador 07"                                                        | 1 linha, campo preenchido                                                                                                                                                                                                       | snapshot                                    |
| N6  | `?companyId=<Gama>`                                                           | Aviso "Empresa inexistente ou sem Medicina habilitada", com cartões e filtro mantidos (ver observação O1)                                                                                                                       | snapshot                                    |
| N7  | Ficha do Trabalhador 01                                                       | Seção "Saúde ocupacional": 2 exames, o mais recente primeiro; médico, aptidão, validade informada, badge; links "Abrir". Nenhum marcador de `notes`/certificado no HTML                                                         | snapshot                                    |
| N8  | Ficha de funcionário da Gama                                                  | Seção **ausente** (h2: EPI, Treinamentos)                                                                                                                                                                                       | snapshot                                    |
| N9  | `/employees/<id de org_qa_b>`                                                 | 404 "Página não encontrada", sem vazar o nome                                                                                                                                                                                   | snapshot                                    |
| N10 | Ficha do Trabalhador 05 (sem exame)                                           | "Nenhum exame registrado para este funcionário." + "Registrar exame" → `/health-exams/new?employeeId=…`                                                                                                                         | snapshot                                    |
| N11 | `/health-exams/new?employeeId=<05>`                                           | Funcionário pré-selecionado; lista só da Alfa; Voltar e Cancelar levam à ficha                                                                                                                                                  | snapshot                                    |
| N12 | Registrar Admissional, apto, 20/10/2026, validade 20/10/2027, sem observações | Voltou à ficha com o exame na linha do tempo                                                                                                                                                                                    | snapshot                                    |
| N13 | **F5** na ficha (cache ignorado)                                              | Exame continua lá. No banco local: `admissional / 2026-10-20 / 2027-10-20 / fit / notes nulo`                                                                                                                                   | `q08-ficha-apos-f5-1440.png` + consulta SQL |
| N14 | `localStorage` / `sessionStorage`                                             | Só `__clerk_environment` / vazio. Nenhum dado médico                                                                                                                                                                            | snapshot                                    |
| N15 | `/health-exams?employeeId=invalido`                                           | `ListErrorState` "Filtro inválido" (`role="alert"`, `h2`), com faixa de filtro e "Limpar filtro"                                                                                                                                | snapshot                                    |
| N16 | `/health-exams?companyId=<Beta>`                                              | Só o exame da Beta, "1 a 1 de 1"                                                                                                                                                                                                | snapshot                                    |
| N17 | `/health-exams/new?employeeId=<Gama>`                                         | "Medicina não habilitada para a empresa deste funcionário"; sem formulário; descrição genérica, sem o nome (correção do INFO-1)                                                                                                 | snapshot                                    |
| N18 | `/health-exams/new?employeeId=<org_qa_b>`                                     | 404, sem vazar o nome                                                                                                                                                                                                           | snapshot                                    |
| N19 | Medicina desligada na Beta (UPDATE no banco local)                            | Beta sai do painel; com uma empresa só, a Alfa vem pré-selecionada; a ficha de funcionário da Beta fica **sem** a seção. Religada depois                                                                                        | snapshot                                    |
| N20 | Menu "Medicina do Trabalho"                                                   | Itens: Painel (`/medicine`), Exames e ASO, Médicos                                                                                                                                                                              | snapshot                                    |
| N21 | Payload das páginas tocadas (HTML + flight do RSC)                            | `/medicine`, `/health-exams`, `/health-exams?employeeId=`, `/health-exams/new`: nenhum `notes`, `certificatePath`, marcador nem CPF. `/employees/[id]`: só o CPF que a ficha **já exibia antes** do lote (PLAN §3.4: não mexer) | script                                      |
| N22 | Console                                                                       | 0 erros. Avisos que já existiam: chaves de dev do Clerk e preload de fonte                                                                                                                                                      | `list_console_messages`                     |
| N23 | Rede                                                                          | 0 respostas 4xx/5xx nas navegações verificadas                                                                                                                                                                                  | `list_network_requests`                     |
| N24 | Lighthouse (snapshot, desktop) em `/medicine?companyId=<Alfa>`                | Acessibilidade **100**, boas práticas 100, SEO 100; 35 auditorias aprovadas, 0 falhas                                                                                                                                           | relatório no scratchpad da sessão           |
| N25 | `/dashboard` após promover o `StatCard`                                       | Os 4 KPIs continuam links. Classes da variante com link idênticas às da develop (diff das classes); só entraram duas variantes sem link, usadas pelo painel                                                                     | `q18-dashboard-1440.png` + diff             |

### Responsividade (viewport emulado; `scrollWidth` × `clientWidth` do documento)

| Largura | Telas medidas                                                                          | Rolagem horizontal da página                                                                                                          |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1440    | `/medicine`                                                                            | não (capturas N2/N13)                                                                                                                 |
| 768     | `/medicine?companyId=<Alfa>`                                                           | não (753 = 753) — `q16-painel-768.png`                                                                                                |
| 375     | `/medicine?companyId=<Alfa>`, `/employees/<01>`, `/health-exams?employeeId=<01>`       | não (375 = 375). Select de empresa com 44px de altura — `q16-painel-375.png`                                                          |
| 320     | `/medicine?companyId=<Beta>` (razão social longa), `/health-exams/new?employeeId=<06>` | não (320 = 320). A razão social trunca no select e quebra no resumo; a grade rola dentro do cartão — `q16-painel-razao-longa-320.png` |

Uma primeira tentativa por iframes **foi descartada**: o anti-framing do app impede ler o documento, e o resultado "sem rolagem"
não provava nada. As medidas acima vêm de emulação real do viewport.

### Observações

- **O1.** Na 1ª tentativa de N6, a página mostrou o estado "Nenhuma empresa com Medicina". O log do servidor registra, nesse
  intervalo, navegações extras para a URL anterior e de volta, o que indica interação simultânea na mesma janela. Nas tentativas
  seguintes a tela ficou correta. A hipótese é renderização antiga pelo histórico, de antes do seed; ela não foi provada. Vale
  repetir N6 na homologação.
- **O2.** O cabeçalho do `ListErrorState` diz "Falha na leitura · FORBIDDEN" também quando a situação é bloqueio por módulo
  (N17), não uma falha. É ajuste de texto, de severidade baixa. Fica registrado no [REVIEW](REVIEW.md).

## 6. Cenários planejados × situação

| #   | Cenário                                                          | Situação                                                                                                                    | Evidência                                                     |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Q01 | Painel só com empresas com Medicina, contagens pelo último exame | **PASS**                                                                                                                    | `overview` (I); R1; N2                                        |
| Q02 | Escritório sem empresa com Medicina                              | **PASS** owner (U, I, navegador). Collaborator só em U (`medicine-empty-state.test`): não há conta collaborator no ambiente | N1                                                            |
| Q03 | Desligar Medicina numa empresa de teste                          | **PASS**                                                                                                                    | `overview`, `medicine-employees`, `health-exams-filters`; N19 |
| Q04 | Busca e paginação no servidor                                    | **PASS**                                                                                                                    | `medicine-employees`; R2–R4; N3–N5                            |
| Q05 | Empresa sem Medicina por `companyId`                             | **PASS**                                                                                                                    | R5; N6                                                        |
| Q06 | Empresa de outro tenant                                          | **PASS**                                                                                                                    | R6                                                            |
| Q07 | Ficha com a seção, sem `notes`                                   | **PASS**                                                                                                                    | `occupational-health-section.test`; N7, N21                   |
| Q08 | Registrar exame pela ficha, salvar, F5                           | **PASS**                                                                                                                    | N10–N13                                                       |
| Q09 | Funcionário de outra organização por ID                          | **PASS**                                                                                                                    | R9; N9, N18                                                   |
| Q10 | Erro de leitura                                                  | **PASS**                                                                                                                    | `list-error-state.test`, `health-exams-filters`; R7, R10; N15 |
| Q11 | Filtro `companyId` não vaza no mesmo escritório                  | **PASS**                                                                                                                    | `health-exams-filters`; R11; N16                              |
| Q12 | Criar exame para funcionário sem Medicina                        | **PASS**                                                                                                                    | `health-exams-filters` (create e update → `FORBIDDEN`); N17   |
| Q13 | Papel `client`                                                   | **PASS** em I e REST (R8). A página `forbidden()` **não foi vista** no navegador: não há conta `client`                     | `overview`, `medicine-employees`, `rest-medicine`             |
| Q14 | Isolamento RLS de `health_exams`                                 | **PASS**                                                                                                                    | `health-exams-isolation` (6 asserções)                        |
| Q15 | Regressão das suítes existentes                                  | **PASS**                                                                                                                    | Integração completa: 0 falhas                                 |
| Q16 | Responsividade 320/375/768/1440                                  | **PASS**                                                                                                                    | Tabela de responsividade                                      |
| Q17 | Console, Network, Application, Lighthouse                        | **PASS**                                                                                                                    | N14, N21–N24                                                  |
| Q18 | Dashboard após promover o `StatCard`                             | **PASS** (diff de classes + captura posterior). Não há captura "antes": trocar de branch com o dev server no ar foi evitado | N25                                                           |
| Q19 | Contagem de suítes skipped                                       | **PASS**: 0 nas suítes de Medicina                                                                                          | §3                                                            |

**Não verificado:**

- o `loading.tsx` visualmente (só aparece com rede lenta);
- a tela de `client` no navegador;
- o estado vazio de collaborator no navegador;
- o spec Playwright automatizado.
