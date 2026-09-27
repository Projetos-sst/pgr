# Lote 2 — QA

Roteiro escrito **antes** da execução e preenchido depois com o resultado real. Escopo: #39
(avaliação quantitativa NR-09) e as partes desbloqueadas da #47 (identificação, inventário NR-01,
NR-09 e plano 5W2H). A seção NR-17 não é testada — não existe, depende da #40.

## Ambiente

| Peça          | Como subir                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------- |
| App           | `npm run dev -- -p 3001` com **`DEV_API_AUTH_BYPASS=false`** (o bypass sequestra `/api/v1` na UI) |
| Gotenberg     | contêiner `sst-gotenberg`, host **3010** (a 3001 é o dev server)                                  |
| Worker de PDF | imagem rebuildada do código do lote e contêiner `sst-pdf-worker` na rede `sst-net`                |
| Banco         | Supabase de desenvolvimento; tenant de QA, nunca cliente real                                     |
| Provas de API | `fetch` do próprio navegador autenticado (sem bypass, sem token manual)                           |

Procedimento de Docker: o do [Lote 1](../lot-01/QA.md#0-preparação) — `docker run`, sem editar
arquivos versionados.

## Massa sintética

Empresa `QA Lote 2 Ltda` → obra `Obra QA Lote 2` (com preposto) → `GES Compressores QA` →
riscos: **RQ1 físico** (ruído, com medição NR-09), **RQ2 químico** (sem medição) e **RQ3 ergonômico**
(agente não elegível) → PGR com o GES vinculado → medida de controle com os 7 campos do 5W2H.
Tudo removido ao fim (seção de limpeza).

## Casos

| #   | Caso                                                                                    | Resultado | Evidência                                                                          |
| --- | --------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| A1  | Avaliação qualitativa **não** mostra o bloco NR-09                                      | PASS      | `039-.../desktop/01-form-qualitativo-sem-bloco.png`                                |
| A2  | Critério quantitativo em agente elegível revela o bloco NR-09                           | PASS      | `039-.../desktop/02-bloco-nr09-com-sugestao.png`                                   |
| A3  | Sugestão de conclusão aparece com valor + limite e é rotulada como sugestão             | PASS      | mesma captura — aviso âmbar com “Usar sugestão”                                    |
| A4  | Conclusão confirmada pelo profissional é a que persiste (mesmo contrariando a sugestão) | PASS      | banco: `nr09_conclusion = below_limit` com medição 87,5 × limite 85                |
| A5  | Reabrir a avaliação traz os campos preenchidos                                          | PASS      | `039-.../desktop/04-form-no-padrao-global.png`                                     |
| A6  | Agente não elegível (ergonômico) não mostra o bloco; API recusa com 422                 | PASS      | `422 VALIDATION` — “Agente ergonômico não é objeto da NR-09…”                      |
| A7  | Medição sem unidade → 422                                                               | PASS      | `422 VALIDATION`                                                                   |
| A8  | Bloco NR-09 em avaliação qualitativa → 422                                              | PASS      | `422 VALIDATION`                                                                   |
| B1  | Medida de controle grava os 7 campos do 5W2H                                            | PASS      | `047-.../desktop/01-form-5w2h.png` + banco com os 7 campos                         |
| B2  | Medida antiga sem por quê/custo continua salvável                                       | PASS      | medida em risco tolerável salva com `action_why`/`action_cost` nulos               |
| C1  | PDF pela rota síncrona: arquivo válido com as 5 seções na ordem                         | PASS      | `047-.../pdf/pgr-rota-sincrona.pdf` — 3 páginas, 48 521 bytes                      |
| C2  | PDF traz identificação com CNPJ, endereço, responsável técnico e preposto               | PASS      | texto do PDF: CNPJ, Av. Rio Branco, responsável e preposto + cargo                 |
| C3  | PDF traz NR-09 com medição e "sem medição" para o risco elegível sem dados              | PASS      | NHO-01 · 87.5 dB(A) · 85 dB(A) · “Abaixo do limite”; RQ2 “Sem medição registrada”  |
| C4  | PDF traz 5W2H completo e **nenhum** texto da ponte #51                                  | PASS      | 7 colunas 5W2H, R$ 15.000,00 e “não informado”; zero literal da ponte #51          |
| C5  | PDF **não** traz seção NR-17                                                            | PASS      | busca por “NR-17” no texto do PDF não retorna nada                                 |
| C6  | Arquivar no GED: worker processa e o documento nasce `ready` com o mesmo conteúdo       | PASS      | worker `job_done` em 1 tentativa; documento `ready`; texto **idêntico** ao da rota |
| D1  | Cross-tenant: avaliação/medida de outro escritório → 404                                | PASS      | `404 NOT_FOUND`                                                                    |
| D2  | PDF de PGR de outro tenant → 404                                                        | PASS      | `404 NOT_FOUND`                                                                    |
| E1  | Responsivo 1440 / 768 / 375 nas telas alteradas                                         | PASS      | `scrollWidth == clientWidth` nos 3 viewports; capturas em desktop, tablet e mobile |
| F1  | Console/rede sem erro inesperado (só os 4xx dos testes negativos)                       | PASS      | só os 4xx dos testes negativos; 500s explicados (ver Execução)                     |

## Execução

Rodada em **27/09/2026**, app em `localhost:3001` com `DEV_API_AUTH_BYPASS=false`, Gotenberg em 3010 e
worker reconstruído a partir do código do lote. Autenticação pelo ticket do Clerk (mesmo caminho de
`tests/e2e/auth.setup.ts`); todas as chamadas de API partiram do **navegador autenticado**, sem bypass
e sem token manual.

**Massa criada e removida:** empresa `QA Lote 2 Ltda` (CNPJ 11.444.777/0001-61), obra `Obra QA Lote 2`
(preposto “Fulano Preposto QA”), `GES Compressores QA`, riscos RQ1 (físico, com medição), RQ2 (químico,
elegível sem medição) e RQ3 (ergonômico, não elegível), PGR vinculado ao GES, duas medidas de controle
e o PDF arquivado no GED.

**Erros observados e explicados**

1. `500` em `/dashboard` no primeiro acesso — `getaddrinfo ENOTFOUND` do pooler do Supabase logo após o
   Docker Desktop reiniciar a rede. Não reproduziu.
2. `500` ao salvar a primeira avaliação — as migrations do lote ainda não estavam no banco de
   desenvolvimento (ver dívida do journal no [REVIEW](REVIEW.md#dívidas-registradas-pré-existentes-fora-do-escopo)).
   Depois de aplicá-las, o fluxo passou.
3. `500` numa recarga do formulário — `useUser can only be used within the <ClerkProvider />`, artefato
   de HMR do dev server; sumiu ao reiniciar o `npm run dev`.
4. CSP bloqueou o `fetch` da URL assinada do Storage feito **de dentro da página** durante a
   conferência — comportamento esperado do navegador, não do produto (o download normal da UI usa
   `window.open`).

Nenhum erro de hidratação, nenhuma exceção de React, nenhum vazamento entre tenants.

**Achado tratado dentro do lote:** o formulário de avaliação (e, pelo mesmo motivo, os de risco e
medida) não seguia o padrão visual do sistema — `max-w-2xl` encostado à esquerda, ocupando menos da
metade de uma tela de 1440px. Corrigido na mesma branch com as primitives de `_ui/form`; comparação em
`039-.../desktop/03-antes-do-ajuste-visual.png` × `04-form-no-padrao-global.png`.

## Limpeza

Massa removida na ordem inversa (documento → PGR → medidas → avaliações → riscos → GES → unidade →
empresa) e o PDF gerado apagado do Storage. As contagens do tenant voltaram ao estado anterior ao
teste (as 2 empresas, 1 obra e 1 GES que já existiam seguem intactos; riscos, avaliações, medidas,
planos, documentos, PGRs e jobs em zero).
