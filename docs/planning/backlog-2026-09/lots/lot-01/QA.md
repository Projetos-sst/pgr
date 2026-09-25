# Lote 1 — roteiro de QA manual

Teste de aceitação do que a PR #93 entregou: **#56** (histórico de versões do GED, versão antiga
somente leitura) e **#42** (cobertura do plano do PGR por risco). Os testes automatizados já cobrem a
regra; aqui se prova o comportamento na tela, com dado real. Estimativa: 40 a 60 minutos.

Os links usam `http://localhost:3001`. Se o `npm run dev` subir noutra porta, troque o número.

---

## 0. Preparação

```bash
cd C:\Users\carlo\OneDrive\Documentos\pgr
git checkout develop && git pull --ff-only origin develop   # deve estar em c97ef48 ou posterior
npm run dev
```

Para a seção D (PDF), suba também o worker e o Gotenberg:

```bash
docker compose up -d --build worker
```

Se o `docker compose` reclamar de `services.worker.env_file.0 must be a string`, sua versão do
Compose (< 2.24) não entende a sintaxe longa de `env_file` do `docker-compose.yml`. Nesse caso suba
os dois contêineres na mão — o Gotenberg publica na **3010** porque a 3001 é a do `npm run dev`:

```bash
docker network create sst-net
docker run -d --name sst-gotenberg --network sst-net --network-alias gotenberg -p 3010:3000   gotenberg/gotenberg:8 gotenberg --api-timeout=120s --chromium-max-queue-size=0
docker build -f Dockerfile.worker -t sst-pdf-worker:local .
docker run -d --name sst-pdf-worker --network sst-net --env-file .env.local   -e GOTENBERG_URL=http://gotenberg:3000 -e WORKER_POLL_IDLE_MS=2000   -e WORKER_STALE_AFTER_SECONDS=300 -e WORKER_MAX_ATTEMPTS=3 sst-pdf-worker:local
docker logs sst-pdf-worker   # esperado: {"level":"info","worker":"pdf_batch","msg":"started"}
```

Dois detalhes que travam o worker: o `--env-file` do `docker run` **não remove aspas**, então as
linhas do `.env.local` usadas por ele (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`) precisam estar sem
`"` — senão o worker morre com `DATABASE_URL is not a valid URL`. E o `GOTENBERG_URL` do `.env` (o
que o `npm run dev` lê, usado pelo **Baixar agora** do D1) tem de apontar para o host,
`http://localhost:3010`; o `http://gotenberg:3000` só vale dentro da rede do Docker.

Faça login e confirme, no topo da tela, que está na **organização de teste** — nunca em dados de
cliente real. Tudo criado aqui é descartável; a limpeza está na seção H.

---

## 1. Massa de dados

Crie nesta ordem. Só os campos listados importam; o resto pode ficar em branco.

### 1.1 Empresa — [/companies/new](http://localhost:3001/companies/new)

| Campo                 | Valor            |
| --------------------- | ---------------- |
| Razão social          | `QA Lote 1 Ltda` |
| Grau de Risco (NR-04) | `2`              |

### 1.2 Unidade de obra — [/work-units/new](http://localhost:3001/work-units/new)

| Campo              | Valor                                                |
| ------------------ | ---------------------------------------------------- |
| Empresa            | QA Lote 1 Ltda                                       |
| Nome               | `Obra QA Lote 1`                                     |
| Escopo do Contrato | `Massa de teste do Lote 1`                           |
| Tipo               | `Obra / Canteiro`                                    |
| Gestor/Preposto    | `Fulano Preposto` (usado no PDF pelo #47, no Lote 2) |

### 1.3 GES — [/ges/new](http://localhost:3001/ges/new)

| Campo           | Valor             |
| --------------- | ----------------- |
| Empresa         | QA Lote 1 Ltda    |
| Unidade de obra | Obra QA Lote 1    |
| Nome do GES     | `GES Montagem QA` |

### 1.4 Quatro riscos — [/risks/new](http://localhost:3001/risks/new)

Todos no GES Montagem QA. O nome já diz o resultado esperado, para facilitar a conferência.

| #   | Grupo do agente | Descrição                         |
| --- | --------------- | --------------------------------- |
| R1  | Físico          | `R1 ruido - deve ficar COBERTO`   |
| R2  | Acidentes       | `R2 queda - vai virar INCOMPLETO` |
| R3  | Químico         | `R3 poeira - SEM MEDIDA`          |
| R4  | Ergonômico      | `R4 postura - NAO AVALIADO`       |

### 1.5 Avaliações — `/risks/<id>/assessments/new`

Pela lista [/risks](http://localhost:3001/risks), abra cada risco e cadastre. **R4 não recebe avaliação.**

| Risco | Critério    | Probabilidade | Severidade | Data | Nível     |
| ----- | ----------- | ------------- | ---------- | ---- | --------- |
| R1    | Qualitativo | 2             | 2          | hoje | 4 (baixo) |
| R2    | Qualitativo | 2             | 2          | hoje | 4 (baixo) |
| R3    | Qualitativo | 1             | 2          | hoje | 2 (baixo) |

### 1.6 Medidas de controle — `/risks/<id>/control-measures/new`

**R3 e R4 não recebem medida.**

| Risco | Nível NR-01            | Aplicável | O quê                    | Como                    | Responsável         | Prazo           |
| ----- | ---------------------- | --------- | ------------------------ | ----------------------- | ------------------- | --------------- |
| R1    | II — Proteção Coletiva | sim       | `Enclausurar compressor` | `Cabine acustica`       | `Eng. de Seguranca` | uma data futura |
| R2    | IV — EPI               | sim       | `Cinto paraquedista`     | `Entrega e treinamento` | **deixe vazio**     | **deixe vazio** |

R2 é aceito sem responsável e prazo porque o risco ainda está baixo. É esse o caso que a seção B
reclassifica.

### 1.7 PGR — [/pgr/new](http://localhost:3001/pgr/new)

| Campo                         | Valor                |
| ----------------------------- | -------------------- |
| Empresa                       | QA Lote 1 Ltda       |
| Obra / Unidade                | Obra QA Lote 1       |
| Nome do responsável           | `Fulano Responsavel` |
| Tipo de registro profissional | `Não aplicável`      |
| Data de emissão               | hoje                 |
| Data de validade              | daqui a um ano       |

Depois abra o PGR e, na etapa **2. Vínculos de GES**, vincule o **GES Montagem QA**.

### 1.8 Documento — [/documents/new](http://localhost:3001/documents/new)

| Campo             | Valor                          |
| ----------------- | ------------------------------ |
| Arquivo           | qualquer PDF ou imagem pequena |
| Nome              | `QA Lote 1 - laudo`            |
| Tipo do documento | `Laudo`                        |
| Validade          | opcional                       |

---

## 2. Cenários

### A. #56 — Histórico de versões · [/documents](http://localhost:3001/documents)

| #   | Passo                                                                     | Esperado                                                                                                                                                |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Envie **2 novas versões** do documento (ícone de seta para cima na linha) | A lista continua com **uma linha só**, agora `v3`                                                                                                       |
| A2  | Abra **Histórico de versões** (ícone de relógio)                          | 3 itens do mais novo para o mais antigo; **v3 "Vigente"**, v2 e v1 "Somente leitura"; cada um com data de envio, tamanho e validade                     |
| A3  | Baixe a **v1** pelo histórico                                             | Abre o arquivo **antigo**, não o atual                                                                                                                  |
| A4  | Baixe a **v3**                                                            | Abre o arquivo atual                                                                                                                                    |
| A5  | Edite o nome pela linha da lista (ícone de lápis)                         | Salva normalmente — é a versão vigente                                                                                                                  |
| A6  | Reabra o histórico                                                        | Anote o que aparece no nome das versões antigas. A edição altera só a linha vigente; divergência aqui é **achado para discutir**, não defeito declarado |
| A7  | Envie mais uma versão e confira nome, tipo e validade da `v4`             | Herda os dados **da vigente**, nunca de uma versão antiga                                                                                               |
| A8  | Exclua o documento (ícone de lixeira)                                     | Some o grupo inteiro, não só uma versão                                                                                                                 |

**Prova de API — o defeito que a #56 fechou.** Copie o id de uma versão antiga (aparece na URL do
download ou no histórico) e tente editá-la por fora da tela:

```bash
curl -i -X PUT http://localhost:3001/api/v1/documents/<ID_DA_V1> ^
  -H "content-type: application/json" -d "{\"name\":\"tentativa\"}"
```

Esperado: **409** com `DOCUMENT_VERSION_READ_ONLY`, e o nome **não muda**. Antes deste lote, isso
reescrevia o histórico em silêncio.

### B. #42 — Cobertura do plano · `/pgr/<id>` → etapa **3. Inventário de Riscos**

| #   | Passo                                                                               | Esperado                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Abra a etapa Inventário                                                             | Resumo "Plano de ação:" com **Não avaliado 1 · Sem medida 1 · Incompleto 0 · Coberto 2**, e a coluna **Plano** em cada linha                         |
| B2  | Olhe R2                                                                             | **Coberto** — no nível baixo, responsável e prazo não são exigidos                                                                                   |
| B3  | Reavalie **R2 para 4 × 4** (`/risks/<id>/assessments/new`) e volte ao Inventário    | R2 vira **Incompleto**; o resumo passa a 1 incompleto e 1 coberto                                                                                    |
| B4  | Expanda o detalhe de R2                                                             | Bloco "Plano de ação" com a orientação sobre responsável e prazo, link **Revisar medidas**, e o **status da medida inalterado** (nada foi reescrito) |
| B5  | Complete responsável e prazo na medida de R2                                        | Volta para **Coberto**                                                                                                                               |
| B6  | Reavalie R2 de novo para 1 × 2 (baixo)                                              | Continua **Coberto**; responsável, prazo e status **permanecem**                                                                                     |
| B7  | No detalhe de R3, clique em **Cadastrar medida**                                    | Abre o formulário do risco certo                                                                                                                     |
| B8  | No detalhe de R4, clique em **Avaliar risco**                                       | Abre a avaliação do risco certo                                                                                                                      |
| B9  | Crie medida em R2 (agora moderado+) com "aplicável" marcado e sem responsável/prazo | Aviso âmbar antes do envio, asterisco nos dois campos, erro em cada um e **nada é enviado**                                                          |
| B10 | Desmarque "aplicável" e salve                                                       | Salva sem exigir os campos                                                                                                                           |

**Prova de API — a autoridade é o servidor:**

```bash
curl -i -X POST http://localhost:3001/api/v1/risks/<ID_DO_R2>/control-measures ^
  -H "content-type: application/json" ^
  -d "{\"controlLevel\":\"administrative\",\"applicable\":true,\"actionWhat\":\"x\",\"actionHow\":\"y\"}"
```

Esperado: **422 VALIDATION**. Se criar, é defeito grave.

### C. Nada pode nascer sozinho

Depois de toda a seção B, confira [/action-plans](http://localhost:3001/action-plans) e a lista de
medidas de cada risco: a quantidade tem de ser **exatamente** a que você criou. A cobertura é
calculada na leitura; plano ou medida que ninguém cadastrou é defeito.

### D. Regressão — o que não podia quebrar

| #   | Passo                                      | Esperado                                                                               |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| D1  | No PGR, etapa 6, **Baixar agora**          | PDF sai como antes: capa, inventário, plano, hierarquia. **O PDF não muda neste lote** |
| D2  | **Arquivar no GED** com o worker no ar     | O documento nasce e fica pronto; aparece na aba Documentos do PGR                      |
| D3  | Abra o histórico desse PDF arquivado       | Uma versão, marcada como vigente                                                       |
| D4  | Anexe um documento ao PGR e a um risco     | Continua funcionando                                                                   |
| D5  | Em /documents, crie pasta, mova e renomeie | Sem erro                                                                               |

### E. Permissão e isolamento

| #   | Passo                                                                                | Esperado                           |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| E1  | Troque de organização e acesse `/api/v1/documents/<ID_DE_OUTRO_ESCRITORIO>/versions` | **404** — nunca o histórico alheio |
| E2  | Com usuário de papel `client`, tente abrir o GED                                     | Bloqueado, como antes              |

### F. Responsivo

Abra a etapa Inventário e o histórico do GED em **375**, **768** e **1440**: sem rolagem horizontal,
modal e tabela legíveis no celular.

---

## 3. Critério de aceite

O lote passa se saírem como descrito: **A2, A3, A7 e o 409**; **B1, B3, B4, B6, B9 e o 422**; **C**;
**D1 e D2**.

## 4. Como registrar defeito

Tela, passo a passo, o que esperava, o que aconteceu, print, e o que apareceu no console do navegador
ou no terminal do `npm run dev`. Sendo de API, cole o comando e a resposta.

## 5. Limpeza (seção H)

Apague na ordem inversa: documento → PGR → medidas → riscos → GES → unidade → empresa. Confira que
nenhum plano de ação sobrou em [/action-plans](http://localhost:3001/action-plans).

---

# Execução Playwright

**Data:** 25/09/2026 · **Executor:** Claude Code (Playwright MCP + REST + Postgres)
**Base:** `develop` em `c97ef48` (PR #93 mergeada); branch de execução `docs/lot-01-qa`, que só
acrescenta este documento — o código sob teste é idêntico ao da `develop`.

**Ambiente**

| Peça                | Estado na execução                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------- |
| App (`npm run dev`) | http://localhost:3001                                                                     |
| Gotenberg           | contêiner `sst-gotenberg`, host **3010** (a 3001 é o dev server)                          |
| Worker de PDF       | contêiner `sst-pdf-worker` (rede `sst-net`, `GOTENBERG_URL=http://gotenberg:3000`)        |
| Banco               | Supabase de desenvolvimento                                                               |
| Tenant              | organização pessoal do usuário de E2E (`7d53a236…`), nunca dado de cliente                |
| Autenticação        | sign-in **ticket** do Clerk (mesmo caminho de `tests/e2e/auth.setup.ts`) — sem burlar MFA |

**Massa sintética** — empresa `QA Lote 1 Ltda` → obra `Obra QA Lote 1` → `GES Montagem QA` → cinco
riscos cobrindo os quatro estados de cobertura (RA tolerável com medida, RB reclassificado, RC sem
medida, RD sem avaliação, RE moderado+ com plano completo) → PGR com o GES vinculado → documento
`QA Lote 1 - laudo` com versões v1…v5. Tudo removido na seção de limpeza.

## Resultado por caso

| Caso                                                        | Resultado         | Evidência                                                          | Observações                                                                                               |
| ----------------------------------------------------------- | ----------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| #42 — resumo de cobertura reflete a massa                   | PASS              | `042-.../desktop/01-inventario-resumo.png`                         | DOM: Não avaliado 1 · Sem medida 1 · Incompleto 0 · Coberto 3                                             |
| #42 — todos os riscos aparecem                              | PASS              | mesma captura                                                      | 5 de 5, inclusive o sem avaliação e o sem medida                                                          |
| #42 — status da medida (Manter/Introduzida)                 | PASS              | `desktop/01-inventario-resumo.png`                                 | `Manter` nas toleráveis, `Introduzida` na moderado+; `Aprimorada` não ocorre nesta massa                  |
| #42 — reclassificação ↑ (tolerável → substancial)           | PASS              | `desktop/02-risco-incompleto.png`                                  | risco vira `Incompleto`; medida, status, responsável e prazo **intactos**                                 |
| #42 — orientação + link "Revisar medidas"                   | PASS              | `desktop/02-risco-incompleto.png`                                  | links de correção apontam para o risco certo (também "Cadastrar medida" e "Avaliar risco")                |
| #42 — completar responsável/prazo → Coberto                 | PASS              | resumo volta a 0 incompleto / 3 cobertos                           | —                                                                                                         |
| #42 — reclassificação ↓ (substancial → trivial)             | PASS              | consulta REST das medidas                                          | responsável, prazo e status **permanecem**                                                                |
| #42 — UI bloqueia submit inválido                           | PASS              | `desktop/03-formulario-moderado.png`                               | aviso âmbar, `*` nos dois campos, erro por campo e **nenhuma requisição de criação** (network monitorado) |
| #42 — API rejeita medida inválida                           | PASS              | `422 VALIDATION`                                                   | "Risco moderado ou superior exige responsável e prazo…"; contagem de medidas antes/depois = 0             |
| #42 — nada nasce sozinho                                    | PASS com ressalva | contagens antes/depois                                             | nenhuma medida automática; os `action_plans` criados vêm da **ponte #51** já existente (ver achado 3)     |
| #56 — uma linha por documento lógico                        | PASS              | `056-.../desktop/03-lista-ged.png`                                 | lista mostra só a vigente (v3 → v5)                                                                       |
| #56 — histórico completo e ordenado                         | PASS              | `desktop/01-historico-3-versoes.png`, `02-historico-5-versoes.png` | mais nova → mais antiga, **uma** `Vigente`, demais `Somente leitura`, com data/tamanho/validade           |
| #56 — download por versão                                   | PASS              | conteúdo conferido byte a byte                                     | v1→"VERSAO 1", v2→2, v3→3; download pela UI da v1 trouxe o arquivo antigo                                 |
| #56 — edição só na vigente                                  | PASS              | consulta ao banco                                                  | editar nome/tipo/validade alterou **apenas** a v3                                                         |
| #56 — nova versão herda da vigente                          | PASS              | v4 = metadados da v3                                               | não herdou de v1/v2                                                                                       |
| #56 — PUT em versão antiga                                  | PASS              | `409 DOCUMENT_VERSION_READ_ONLY`                                   | nome da v1 inalterado depois da tentativa                                                                 |
| #56 — `GET /versions`                                       | PASS              | `200`                                                              | 4 versões, ordem correta, exatamente uma vigente                                                          |
| #56 — isolamento cross-tenant                               | PASS              | `404 NOT_FOUND`                                                    | `GET /versions` e `PUT` com outro tenant                                                                  |
| #56 — conflito de upload simultâneo                         | PASS              | `409 DUPLICATE` + `201`                                            | um envio vence, o outro recebe erro de domínio; nenhuma versão corrompida                                 |
| #56 — exclusão remove o grupo                               | PASS              | banco + Storage                                                    | 5 versões e todos os binários removidos                                                                   |
| Regressão — PDF "Baixar agora"                              | PASS              | `pgr-….pdf`, 41 160 bytes                                          | PDF válido (assinatura + `%%EOF`), gerado pelo Gotenberg                                                  |
| Regressão — Arquivar no GED + worker                        | PASS              | log do worker `job_done`                                           | job `done` em 8 s, 1 tentativa; documento `ready`, ligado ao PGR, 1 versão vigente                        |
| Regressão — GED (pasta, mover, renomear, baixar, histórico) | PASS              | `desktop/03-lista-ged.png`                                         | mover levou **todas** as versões do grupo junto                                                           |
| Responsivo 1440 / 768 / 375                                 | PASS              | `desktop                                                           | tablet                                                                                                    | mobile/\*` | `scrollWidth == clientWidth` nas quatro telas; modal dentro da viewport (328 px no 375); nenhum badge cortado |
| `npm run check`                                             | PASS              | —                                                                  | 0 erros, 4 warnings pré-existentes, 1 256 testes unitários                                                |
| `npm run build`                                             | PASS              | —                                                                  | compila em 45 s; 264 rotas                                                                                |
| Integração (documents, pgr-editor, control-measures)        | PASS              | —                                                                  | 21 suítes / 157 testes em Postgres efêmero                                                                |

## Achados (nenhum é regressão do Lote 1)

1. **`DEV_API_AUTH_BYPASS=true` + `DEV_TENANT_ID` sequestram a sessão nas rotas `/api/v1`.** Com a
   flag ligada, `resolveContext` ignora a sessão do Clerk e usa o tenant da env — o "Baixar agora"
   do PGR respondeu **404** no navegador enquanto funcionava por cURL com `x-dev-tenant`. Some com
   `DEV_API_AUTH_BYPASS=false` (o `playwright.config.ts` já recomenda a flag desligada para UI).
   Configuração local, não defeito de produto — mas convém não deixar a flag ligada ao testar a UI.
2. **404 nas duas páginas de edição aninhadas** (`/risks/[id]/control-measures/[measureId]/edit` e
   `/risks/[id]/assessments/[assessmentId]/edit`) num dev server que já rodava havia horas. **Não
   reproduziu** depois de reiniciar o `npm run dev`, e as duas rotas aparecem no `npm run build`.
   Artefato do servidor de desenvolvimento.
3. **Ponte #51 inventa texto.** Cada medida de controle gera automaticamente um `action_plan`
   (`origin_type=control_measure`); quando a medida não tem responsável, o plano nasce com
   `who = "Responsável não definido"`. Comportamento **pré-existente e intencional** (issue #51),
   fora do escopo do Lote 1, mas é dado fabricado — vale decidir se o campo deve ficar vazio.
4. **Revalidação atrasada na lista do GED.** Logo após enviar versão ou excluir, a tabela ainda
   mostra o estado anterior por alguns segundos; recarregar corrige. Cosmético.
5. **`status` da medida é re-derivado no update.** Um `PUT` que não envia `status` faz a regra
   recalcular (`maintain` → `introduced`). A **reclassificação do risco**, sozinha, não altera nada
   — o que o Lote 1 promete. Vale saber ao integrar por API.
6. **502 nas integrações CNPJ/CEP no primeiro acesso** (cold start do dev server); depois `200`.
   O CNPJ `11.222.333/0001-81` usado como fictício **existe** na Receita — ao sair do campo, a
   consulta pode sobrescrever a razão social.

## Limpeza

Massa sintética removida por completo (empresa, obra, GES, 5 riscos, 6 avaliações, 4 medidas,
4 planos da ponte, PGR, job, 2 documentos com 6 versões, pasta) e binários do Storage conferidos
vazios. As contagens do tenant voltaram exatamente ao estado anterior ao teste. A organização
Clerk criada para o login de QA foi apagada.
