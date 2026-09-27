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

> Preenchido após a execução.
