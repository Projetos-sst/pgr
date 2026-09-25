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
