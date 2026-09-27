# Lote 3 — QA

Roteiro escrito **antes** da execução e preenchido depois com o resultado real. Escopo: **#40**
(avaliação ergonômica NR-17), **#47** (seção NR-17 no PDF, fechando a issue) e **#48** (documentos
complementares da NR-18 + relação derivada de EPIs, também no PDF).

## Ambiente

| Peça          | Como subir                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------- |
| App           | `npm run dev -- -p 3001` com **`DEV_API_AUTH_BYPASS=false`** (o bypass sequestra `/api/v1` na UI)  |
| Gotenberg     | contêiner `sst-gotenberg`, host **3010** (a 3001 é o dev server)                                   |
| Worker de PDF | contêiner `sst-pdf-worker`, reconstruído a partir do código do lote                                |
| Banco         | Supabase de desenvolvimento; **tenant de QA**, nunca cliente real                                  |
| Migration     | `0051_ergonomic_evaluations` aplicada pela conexão owner (journal do dev defasado — dívida antiga) |
| Autenticação  | ticket do Clerk pelo mesmo caminho de `tests/e2e/auth.setup.ts` (sem burlar MFA, sem token fixo)   |
| Provas de API | `fetch` do próprio navegador autenticado (sem bypass, sem token manual)                            |

Procedimento de Docker: o do [Lote 1](../lot-01/QA.md) — `docker run`, sem editar arquivo versionado.

## Massa sintética

Criada **só** no tenant de QA e removida ao fim (seção de limpeza), com todos os IDs registrados:

- empresa `QA Lote 3 Ltda`;
- unidade **`Obra QA Lote 3`** com `type = site` (canteiro) **e** unidade `Escritório QA Lote 3`
  com `type = branch` (prova negativa do painel NR-18);
- `GES Montagem QA` (na obra) e `GES Escritório QA` (na unidade não-site);
- riscos: **RE1 ergonômico** (recebe a avaliação NR-17), **RQ2 físico** (fica sem avaliação
  ergonômica, para provar o estado honesto) e **RP3 psicossocial**;
- PGR da obra com o GES vinculado; PGR do escritório com o GES da unidade não-site;
- campanha psicossocial **encerrada** da obra, com respostas e fatores sintéticos, + uma campanha
  **ativa** e uma campanha **de outra unidade** (provas negativas);
- EPI 1 com CA **válido** e EPI 2 com CA **vencido**, ambos vinculados a riscos (um deles a dois
  riscos, para provar a deduplicação);
- documentos NR-18 dos quatro tipos, com **duas versões** em um deles.

## Casos planejados

### #40 — NR-17

| #   | Caso                                                                         | Esperado                                                  |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| A1  | Seção NR-17 aparece no detalhe do risco, vazia                               | "Sem avaliação ergonômica registrada"                     |
| A2  | "Nova avaliação" abre o formulário centralizado de 940 px                    | wrapper central, cartões por tema, botão Voltar do padrão |
| A3  | Criar avaliação com estados variados (adequado, inadequado, N/A e em branco) | salva; reabrir traz exatamente o que foi gravado          |
| A4  | Detalhe do risco passa a mostrar a vigente com badge por dimensão            | dados reais, "Não avaliado" no que ficou em branco        |
| A5  | Segunda avaliação com data mais nova                                         | duas linhas; a nova é **Vigente**, a antiga é consultável |
| A6  | Editar a vigente                                                             | persiste; histórico continua com duas linhas              |
| A7  | Excluir uma avaliação                                                        | remove só ela; a outra permanece                          |
| A8  | Vincular campanha psicossocial encerrada compatível                          | salva; detalhe e PDF mostram o **agregado**               |
| A9  | API: campanha de outro tenant                                                | `FK_NOT_FOUND` (422), vínculo não persiste                |
| A10 | API: campanha de outra unidade                                               | `VALIDATION` (422)                                        |
| A11 | API: campanha ainda não encerrada                                            | `VALIDATION` (422)                                        |
| A12 | Atalho "Anexar laudo (AET)"                                                  | abre o GED com vínculo ao risco e `doc_type` preenchidos  |
| A13 | Nenhuma resposta individual da campanha no DOM nem na API consolidada        | zero ocorrências dos ids de resposta                      |

### #47 — PDF

| #   | Caso                                                 | Esperado                                                           |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| B1  | PDF pela rota síncrona                               | arquivo `%PDF-` válido, com as 7 seções na ordem                   |
| B2  | Seção NR-17 entre a NR-09 e o plano de ação          | ordem confirmada no texto extraído                                 |
| B3  | Conteúdo da NR-17                                    | risco, data, responsável, método, seis dimensões e observações     |
| B4  | Risco sem avaliação                                  | "Sem avaliação ergonômica registrada: <descrição>"                 |
| B5  | Agregado psicossocial                                | campanha, período, nº de respostas e fatores — sem escore COPSOQ   |
| B6  | Nenhuma resposta individual nem nome de participante | zero ocorrências                                                   |
| B7  | PDF pelo worker ("Arquivar no GED")                  | job processado, documento `ready`, conteúdo equivalente ao da rota |
| B8  | Regressão NR-09 e 5W2H                               | seções intactas                                                    |

### #48 — NR-18 e EPIs

| #   | Caso                                               | Esperado                                                  |
| --- | -------------------------------------------------- | --------------------------------------------------------- |
| C1  | PGR de unidade `site`: painel NR-18 presente       | 4 tipos, todos **Faltando** antes dos uploads             |
| C2  | Anexar os quatro tipos                             | cada linha vira **Anexado**                               |
| C3  | O que conta é o `doc_type`, não o nome do arquivo  | arquivo com nome enganoso e tipo errado não satisfaz      |
| C4  | Nova versão de um dos documentos                   | continua **Anexado**, agora com "(v2)"; v1 preservada     |
| C5  | Excluir o grupo documental                         | volta a **Faltando**; Storage limpo                       |
| C6  | PGR de unidade **não-site**                        | painel NR-18 **não** aparece                              |
| C7  | Relação de EPIs reflete o cadastro                 | nome, CA, validade, fabricante, norma, specs, contextos   |
| C8  | EPI ligado a dois riscos                           | **uma** linha, dois contextos                             |
| C9  | Badges de CA                                       | válido (verde), vencido (vermelho), sem validade (neutro) |
| C10 | Seção "Relação de EPIs" no PDF                     | mesmos dados do cadastro, deduplicados                    |
| C11 | Documento de outro tenant não satisfaz o checklist | requisito continua faltando                               |
| C12 | EPI de outro tenant não aparece na relação         | ausente                                                   |

### Transversais

| #   | Caso                                                             | Esperado                                      |
| --- | ---------------------------------------------------------------- | --------------------------------------------- |
| D1  | Avaliação NR-17 de outro tenant (GET/PUT/DELETE)                 | 404 `NOT_FOUND`                               |
| D2  | Criar avaliação em risco de outro tenant                         | 422 `FK_NOT_FOUND`                            |
| D3  | Checklist NR-18 / relação de EPIs de PGR de outro tenant         | 404 `NOT_FOUND`                               |
| D4  | Papel `client` nas leituras/escritas novas                       | 403 `FORBIDDEN`                               |
| E1  | Responsividade 1440×900, 768×1024 e 375×812 nas telas do lote    | `scrollWidth <= clientWidth`, nada cortado    |
| E2  | Formulário ocupa o centro da tela (sem `max-w-2xl` encostado)    | wrapper de 940 px centralizado                |
| E3  | Comparação visual com tela aprovada (Riscos Psicossociais / EPI) | mesma tipografia, badges, toolbar e paginação |
| F1  | Console e rede sem erro inesperado                               | só os 4xx dos testes negativos                |

## Evidências

`C:/Users/carlo/OneDrive/Documentos/redesign/validacao_full/` (pasta **não versionada**, padrão dos
lotes anteriores), em `040-nr17-ergonomia/` e `048-nr18-pgr/`, com subpastas `desktop/`, `tablet/`,
`mobile/` e `pdf/`.

## Limpeza

Ao final, remover **toda** a massa criada (documentos + objetos no Storage, PGRs, avaliações
ergonômicas, avaliações de risco, vínculos e itens de EPI, riscos, campanhas/respostas/fatores, GES,
unidades, empresa e jobs), conferindo o tenant antes de excluir e comparando as contagens antes e
depois. Também remover os temporários da execução (PDFs baixados, scripts de QA, cópias de env,
storage state).

## Critérios de aceite

- #40 só passa com criar/editar/excluir, histórico, vigência, seis dimensões, responsável, método,
  campanha opcional, agregado seguro, RLS, cross-tenant, UI no padrão, responsivo, consolidado e PDF.
- #47 só passa com NR-17 no PDF, na ordem, com conteúdo real, estado vazio honesto, rota e worker
  verdes, sumário correto, nenhuma resposta individual, nenhum escore inventado e NR-09/5W2H intactos.
- #48 só passa com os tipos, checklist, upload, versão, exclusão, unidade site e não-site,
  isolamento, relação deduplicada, validade de CA, seção no PDF e responsividade.

---

## Execução

Rodada em **27/09/2026**. App em `localhost:3001` com **`DEV_API_AUTH_BYPASS=false`** para toda a
parte de UI; Gotenberg no contêiner `sst-gotenberg` (host 3010); worker de PDF executado **a partir
do código do lote** (`npm run worker` no host — o contêiner `sst-pdf-worker` roda a imagem do Lote 2
e por isso foi parado durante o QA e religado ao fim). Autenticação pelo ticket do Clerk, mesmo
caminho de `tests/e2e/auth.setup.ts`. As provas de API partiram do **navegador autenticado**; só a
extração dos PDFs e as provas de papel `client` usaram o bypass DEV, num intervalo em que a UI não
estava sendo testada.

Tenant de QA: organização Clerk **“QA Lote 3”** (`org_3JvNvFZ4cmYGU0tETVYkAXaMIet`) → tenant
`b7862e5e-6418-4708-8147-c49b8c8c743e`. Nenhum dado de cliente foi tocado.

**Massa criada (todos os IDs registrados e removidos ao fim):** empresa `QA Lote 3 Ltda`
(`ddb64ad7…`), unidade **`Obra QA Lote 3`** `type=site` (`90aef882…`) e `Escritorio QA Lote 3`
`type=branch` (`08c06d33…`), `GES Montagem QA` (`0faa46c2…`) e `GES Escritorio QA` (`abff87da…`),
riscos RE1 ergonômico (`44625b99…`), RQ2 físico (`6a5599ce…`), RP3 psicossocial (`049c4650…`) e RB4
no escritório (`eaf3b62e…`), PGR da obra (`a857b1d3…`) e do escritório (`1cea16f9…`), três campanhas
psicossociais (encerrada `9950012c…`, ativa `4b7b3283…`, de outra unidade `2d002e8d…`) com 3
respostas e 1 fator derivado, EPI com CA válido (`64d369c0…`) e com CA vencido (`d48b3d71…`),
8 documentos (4 tipos NR-18 + 2ª versão do elétrico + ART de nome enganoso + laudo AET + PDF
arquivado) e 2 jobs `pdf_batch`.

### #40 — NR-17

| #   | Caso                                                              | Resultado | Evidência                                                                                      |
| --- | ----------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| A1  | Seção NR-17 no detalhe do risco, vazia                            | PASS      | `040-…/desktop/01-risco-sem-avaliacao.png` — “Sem avaliação ergonômica registrada para …”      |
| A2  | Formulário centralizado de 940 px, cartões por tema, botão Voltar | PASS      | `040-…/desktop/02-form-nova-avaliacao.png`                                                     |
| A3  | Criar com estados variados e reabrir                              | PASS      | `03-historico-uma-avaliacao.png`; reabertura devolveu os 17 campos exatamente como gravados    |
| A4  | Vigente no detalhe com badge por dimensão                         | PASS      | `04-risco-com-vigente.png` — “Não avaliado” nas duas em branco                                 |
| A5  | Segunda avaliação (data mais nova)                                | PASS      | `05-historico-duas-avaliacoes.png` — 2026-08-10 **Vigente**, 2026-05-04 **Histórico** intacta  |
| A6  | Editar a vigente                                                  | PASS      | `GET /api/v1/ergonomic-evaluations/{id}` → `physicalEnvironment: "adequate"` + observação nova |
| A7  | Excluir uma avaliação                                             | PASS      | 3 → 2 linhas; a excluída passa a 404; as outras duas intactas                                  |
| A8  | Campanha psicossocial encerrada compatível                        | PASS      | vínculo salvo; agregado no detalhe e no PDF                                                    |
| A9  | API: campanha de outro tenant                                     | PASS      | `422 FK_NOT_FOUND` (`psychosocial_campaign`); nada persistido                                  |
| A10 | API: campanha de outra unidade                                    | PASS      | `422 VALIDATION` — “pertence a outra unidade…”                                                 |
| A11 | API: campanha ainda não encerrada                                 | PASS      | `422 VALIDATION` — “Só campanha psicossocial encerrada…”                                       |
| A12 | Atalho “Anexar laudo (AET)”                                       | PASS      | abre o GED com `docType=Análise Ergonômica do Trabalho (AET)` e vínculo ao risco; upload v1 OK |
| A13 | Nenhuma resposta individual no DOM/API/PDF                        | PASS      | busca pelos 3 ids de resposta: zero ocorrências no consolidado e no texto do PDF               |

### #47 — PDF

| #   | Caso                                | Resultado | Evidência                                                                                                |
| --- | ----------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| B1  | PDF pela rota síncrona              | PASS      | `047-…/lote-03/pgr-rota-sincrona.pdf` — `application/pdf`, `%PDF-1.4`, 53 788 bytes, 5 páginas           |
| B2  | NR-17 entre NR-09 e o plano de ação | PASS      | 7 seções na ordem; posições crescentes no texto extraído                                                 |
| B3  | Conteúdo da NR-17                   | PASS      | risco, 2026-08-10, “Ergonomista Beltrana QA”, “COPSOQ”, as seis dimensões e as observações               |
| B4  | Risco sem avaliação                 | PASS      | “Sem avaliação ergonômica registrada: Ruido continuo de esmerilhadeira; Sobrecarga de trabalho…”         |
| B5  | Agregado psicossocial               | PASS      | “Resultado agregado da campanha psicossocial · Clima Obra QA L3 · 2026-01-06 a 2026-03-31 · 3 respostas” |
| B6  | Sem resposta individual/escore      | PASS      | nenhum UUID no texto; `/escore/i` não casa em nenhum ponto do documento                                  |
| B7  | PDF pelo worker (“Arquivar no GED”) | PASS      | job `done` em 1 tentativa, documento `ready`, 53 788 bytes — **texto idêntico** ao da rota               |
| B8  | Regressão NR-09 e 5W2H              | PASS      | as duas seções intactas, com preposto na identificação                                                   |
| B9  | Estados distintos das dimensões     | PASS      | no mesmo PDF: “Adequado”, “Inadequado”, “Não aplicável” e 4× “Não avaliado” (avaliação parcial)          |

### #48 — NR-18 e EPIs

| #   | Caso                                      | Resultado | Evidência                                                                            |
| --- | ----------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| C1  | Painel NR-18 em unidade `site`            | PASS      | `048-…/desktop/01b-nr18-e-epi-corrigido.png` — 4 tipos, “0 DE 4 ANEXADOS”            |
| C2  | Anexar os quatro tipos                    | PASS      | `02-nr18-todos-anexados.png` — “4 DE 4 ANEXADOS”                                     |
| C3  | Conta o `doc_type`, não o nome do arquivo | PASS      | “Projeto de SPIQ (nome enganoso, tipo ART)” não satisfez requisito nenhum            |
| C4  | Nova versão de um documento               | PASS      | elétrico v2: continua **Anexado**, uma linha só (“v2”); total de vigentes segue 5    |
| C5  | Excluir o grupo documental                | PASS      | proteção coletiva volta a **Faltando** (4 → 3 anexados); objetos do Storage apagados |
| C6  | PGR de unidade **não-site**               | PASS      | `03-unidade-nao-site-sem-nr18.png` — painel NR-18 ausente                            |
| C7  | Relação de EPIs reflete o cadastro        | PASS      | nome, CA, validade, fabricante, norma, material/tamanho/unidade/vida útil            |
| C8  | EPI ligado a dois riscos                  | PASS      | uma linha, `contexts: 2` (Postura… e Ruído…)                                         |
| C9  | Badges de CA                              | PASS      | `valid` (verde) e `expired` (vermelho) pela data real do cadastro                    |
| C10 | Seção “Relação de EPIs” no PDF            | PASS      | seção 6 com os mesmos dados, deduplicada (1 ocorrência do auricular) e com a nota    |
| C11 | Documento de outro tenant no checklist    | PASS      | linha inserida no org do dev apontando para o PGR de QA: requisito continua faltando |
| C12 | EPI de outro tenant na relação            | PASS      | `GET /epi-relation` devolve só os 2 EPIs de QA                                       |
| C13 | `docType` pré-preenchido no upload        | PASS      | `04-upload-doctype-preenchido.png`                                                   |

### Transversais

| #   | Caso                                             | Resultado | Evidência                                                                          |
| --- | ------------------------------------------------ | --------- | ---------------------------------------------------------------------------------- |
| D1  | Avaliação de outro tenant (GET/PUT/DELETE)       | PASS      | 404 nos três; a linha do outro tenant **não** foi alterada nem removida            |
| D2  | Criar avaliação em risco de outro tenant         | PASS      | `422 FK_NOT_FOUND` (`risk`); listar também                                         |
| D3  | Checklist / relação / PDF de PGR de outro tenant | PASS      | `404 NOT_FOUND` nos três                                                           |
| D4  | Papel `client` nos endpoints novos               | PASS      | `403` em GET (histórico, detalhe, checklist, relação), POST e DELETE               |
| E1  | Responsividade 1440 / 768 / 375                  | PASS      | `scrollWidth == clientWidth` nas 6 telas do lote, nos 3 viewports (após correções) |
| E2  | Formulário centralizado (sem `max-w-2xl` torto)  | PASS      | wrapper de 940 px no criar/editar e também no upload do GED                        |
| E3  | Comparação visual com tela aprovada              | PASS      | `06-referencia-psicossociais.png` × `03-historico-uma-avaliacao.png` — mesmo kit   |
| F1  | Console e rede                                   | PASS      | 0 erro inesperado; só os 4xx dos testes negativos (ver abaixo)                     |

**Console/rede.** Todas as telas do lote carregaram com **0 erro** de console. Os erros que
aparecem no log são exatamente os 4xx **provocados** pelas provas negativas (422 de campanha
inválida, 404 cross-tenant, 403 de papel `client`) e um `tenant.context blocked` **pré-existente**,
emitido uma única vez no primeiro login enquanto o tenant pessoal é auto-provisionado (logo em
seguida sai `tenant.provisioned ok`). Nenhum 500, nenhuma falha de hidratação, nenhum erro do
worker.

### Bugs encontrados e corrigidos (todos do lote, na mesma branch)

| Bug                                                                                                                  | Correção                                                               |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Relação de EPIs cortava a coluna “Riscos / GES” no desktop (`minWidth` 1040 numa coluna de ~915 px)                  | `minWidth` 860 + template mais enxuto (commit `fix(ui)`)               |
| Os dois `DataGrid` novos empurravam a página inteira no 375 px (flex column sem `min-w-0`)                           | `min-w-0` nos wrappers                                                 |
| Barra de ações do detalhe do risco estourava a largura no 375 px (a NR-17 entrou numa barra cheia)                   | `flex-wrap` na barra                                                   |
| Lista “Documentos vinculados no GED” também estourava no 375 px — **código pré-existente**, exposto pela massa de QA | `min-w-0` no item da lista (1 linha, na mesma tela entregue pelo lote) |

Nenhum bug de dado, de isolamento ou de conteúdo do documento foi encontrado.

### Limpeza

| Item                                  | Situação                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Massa no banco                        | **removida** — 49 linhas antes, **0 depois** (contagem por tabela, script)                                                             |
| Objetos no Storage                    | **removidos** — 8 objetos do bucket `documents`                                                                                        |
| Campanhas / respostas / fatores de QA | **removidos** (3 campanhas, 6 perguntas, 3 respostas, 6 answers, 1 fator)                                                              |
| Jobs `pdf_batch` de QA                | **removidos** (2)                                                                                                                      |
| Linhas de sondagem em outro tenant    | **removidas** (1 avaliação e 1 documento inseridos só para as provas negativas)                                                        |
| Tenant de QA                          | organização Clerk “QA Lote 3” **excluída**; linha `orgs` correspondente removida                                                       |
| Temporários                           | PDFs e scripts no scratchpad; `pdf-parse` (instalado com `--no-save`) desinstalado; fixtures e capturas movidas para `validacao_full/` |
| Contêiner `sst-pdf-worker`            | parado durante o QA (imagem do Lote 2) e **religado** ao fim                                                                           |
| Working tree                          | limpa — nenhum arquivo de QA versionado                                                                                                |

### Veredito

- **#40 — PASS.**
- **#47 — PASS.**
- **#48 — PASS.**
