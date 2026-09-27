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

| #   | Caso                                                                                    | Resultado  | Evidência |
| --- | --------------------------------------------------------------------------------------- | ---------- | --------- | ------ | ---------- |
| A1  | Avaliação qualitativa **não** mostra o bloco NR-09                                      | a executar | —         |
| A2  | Critério quantitativo em agente elegível revela o bloco NR-09                           | a executar | —         |
| A3  | Sugestão de conclusão aparece com valor + limite e é rotulada como sugestão             | a executar | —         |
| A4  | Conclusão confirmada pelo profissional é a que persiste (mesmo contrariando a sugestão) | a executar | —         |
| A5  | Reabrir a avaliação traz os campos preenchidos                                          | a executar | —         |
| A6  | Agente não elegível (ergonômico) não mostra o bloco; API recusa com 422                 | a executar | —         |
| A7  | Medição sem unidade → 422                                                               | a executar | —         |
| A8  | Bloco NR-09 em avaliação qualitativa → 422                                              | a executar | —         |
| B1  | Medida de controle grava os 7 campos do 5W2H                                            | a executar | —         |
| B2  | Medida antiga sem por quê/custo continua salvável                                       | a executar | —         |
| C1  | PDF pela rota síncrona: arquivo válido com as 5 seções na ordem                         | a executar | —         |
| C2  | PDF traz identificação com CNPJ, endereço, responsável técnico e preposto               | a executar | —         |
| C3  | PDF traz NR-09 com medição e "sem medição" para o risco elegível sem dados              | a executar | —         |
| C4  | PDF traz 5W2H completo e **nenhum** texto da ponte #51                                  | a executar | —         |
| C5  | PDF **não** traz seção NR-17                                                            | a executar | —         |
| C6  | Arquivar no GED: worker processa e o documento nasce `ready` com o mesmo conteúdo       | a executar | —         |
| D1  | Cross-tenant: avaliação/medida de outro escritório → 404                                | a executar | —         |
| D2  | PDF de PGR de outro tenant → 404                                                        | a executar | —         |
| E1  | Responsivo 1440 / 768 / 375 nas telas alteradas                                         | a executar | —         | tablet | mobile/\*` |
| F1  | Console/rede sem erro inesperado (só os 4xx dos testes negativos)                       | a executar | —         |

## Execução

Preenchido após rodar — ver seção "Resultado" no fim deste arquivo.

## Limpeza

Massa removida na ordem inversa (documento → PGR → medidas → avaliações → riscos → GES → unidade →
empresa), com conferência de Storage e das contagens do tenant.
