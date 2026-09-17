# #56 — [Qualidade/GED] Controle de versões de documentos

https://github.com/Projetos-sst/pgr/issues/56

> **Auditoria específica (2026-09-16, `develop` @ `690ec1b`) — prevalece sobre a classificação
> inicial.** Resultado: continua pequena, mas a prontidão passa de READY para **READY COM PREMISSAS**:
> "somente leitura" das versões antigas **não é aplicado no backend** hoje, e o conceito de "versão ativa"
> vai conflitar com a aprovação futura (#54).

## Pedido real da issue

Autor cria nova versão; Revisor/Aprovador validam; sistema mantém histórico e destaca a versão ativa.
Critérios: nova versão não apaga o histórico; passa a ser a ativa; versões antigas continuam consultáveis;
integração Postgres; `npm run check`. A issue aponta como falta: gate "só publica com aprovação" e
versões antigas somente leitura na UI.

## Fluxo real

```
POST /documents (multipart)  → createDocument: grupo novo, v1          repositories/documents.ts:198-236
POST /documents/{id}/versions → addDocumentVersion: MAX+1 no grupo     :269-323
listagem / KPIs               → só a versão vigente (currentVersionPredicate) :72-86, :108, :160
GET  /documents/{id}          → qualquer versão por id                  :177-189
PUT  /documents/{id}          → edita metadados DA LINHA do id           :239-262
GET  /documents/{id}/download → URL assinada da linha do id (TTL 60s)
POST /documents/{id}/move     → move o GRUPO inteiro                     :326-357
DELETE /documents/{id}        → apaga o GRUPO inteiro (+ Storage pós-commit) :366-407
Worker PDF                    → update direto por documentId (status generating→ready)  server/platform/pdf-batch-core.ts:38-45
```

Autor, revisão, aprovação e publicação **não existem** em `documents`.

## A. Workflow de aprovação já existe?

**Não.** Não há colunas de autor/revisor/aprovador, transições, permissões por papel nem publicação em
`documents`. `document_status` = `generating | ready` é estado **técnico** do worker de PDF
(`schema/documents.ts:23`), não lifecycle documental. A infra de assinatura genérica não tem consumidor de
documento (`domains/signatures/contract.ts:13-18`). O lifecycle só nasce com #52/#53/#54/#55.

## B. O que é "versão ativa" hoje

**Maior número de versão do grupo.** `currentVersionPredicate` = `NOT EXISTS` de outra linha no mesmo
`(org_id, document_group_id)` com `version` maior. Não usa status, flag nem data. É uma função privada do
repositório.

## C. Conflito "nova versão vira ativa" × "só publica com aprovação"

**Existe, mas é latente:** hoje não há aprovação, então "ativa = maior versão" é consistente com os
critérios. Quando #54 existir, `v1 aprovada` + `v2 rascunho` faria a v2 virar ativa pela regra atual — o
que é errado. O comportamento esperado (v1 segue oficial até v2 ser aprovada) é o mais provável, mas
**pertence a #54/#62**.

Premissa para #56: manter "ativa = maior versão" e **centralizar a definição em um único ponto
exportado**, para que #54 troque a regra ("maior versão aprovada/publicada") em um lugar só.

## D. Histórico

| Peça                                   | Existe?                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POST /api/v1/documents/{id}/versions` | Sim (`versions/route.ts`, só POST)                                                                    |
| `GET /api/v1/documents/{id}/versions`  | **Não**                                                                                               |
| Repositório que lista versões do grupo | **Não**                                                                                               |
| Server Action de listagem de versões   | **Não**                                                                                               |
| UI de histórico                        | **Não** — a lista mostra `v{doc.version}` (`documents/page.tsx:221`); `new-version-modal.tsx` só cria |

Versões antigas só são consultáveis via API **se o id for conhecido** (GET e download funcionam por id),
mas nada expõe esses ids.

## E. Somente leitura

**Não aplicado no backend.** Pela API, com o id de uma versão antiga:

| Operação                              | Comportamento atual                              | Problema                                           |
| ------------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| `PUT /documents/{idAntigo}`           | Edita metadados só daquela linha                 | Versões divergem; histórico alterado               |
| `POST /documents/{idAntigo}/versions` | Nova versão herda metadados **da versão antiga** | Regressão silenciosa de nome/tipo/validade/vínculo |
| `POST /documents/{idAntigo}/move`     | Move o grupo                                     | Coerente (operação de grupo)                       |
| `DELETE /documents/{idAntigo}`        | Apaga o grupo                                    | Coerente com o design atual (#57 revisará)         |

Recomendação: proteção **no repositório** (serve Action e REST): `updateDocument` rejeita versão não
vigente (409); `addDocumentVersion` resolve o grupo e herda sempre da versão vigente. A UI só reflete.
**Não** aplicar a guarda no update do worker (`pdf-batch-core.ts`), que escreve por id na própria v1.

## F. Concorrência

`addDocumentVersion` calcula `MAX+1` numa transação, faz o upload e só depois insere em outra transação.
Dois autores podem calcular a mesma versão.

- **Nomes de arquivo diferentes:** o segundo INSERT falha no UNIQUE → `409 DUPLICATE`; compensação remove
  só o próprio objeto; nada se perde. **Já testado** (`documents-update.test.ts:120`, Storage mockado).
- **Mesmo nome de arquivo:** path determinístico `…/v{N}-{slug}` com `upsert: false`
  (`documents-storage.ts:40,59`) → o segundo **upload** falha antes do INSERT com erro genérico (não
  `DUPLICATE`). Sem perda de dado, mas com erro errado para o cliente. Não coberto (Storage mockado).

Solução correta, mínima: mapear o conflito de upload para `DUPLICATE`, **ou** incluir um sufixo aleatório no
path. Lock (`FOR UPDATE`/advisory) não resolve sozinho, porque o upload ocorre fora da transação.

## G. Gotenberg / PDF

Nada proposto toca geração, template ou download:

- PDF arquivado nasce como grupo novo v1 (`repositories/pdf-batch.ts`) → sempre vigente.
- Worker atualiza por id via `pdf-batch-core.ts`, fora de `updateDocument` → guarda de somente leitura não o afeta.
- Download continua por id (serve versões antigas, que é o que o histórico precisa).
- Documentos existentes não mudam de forma (zero migration).

## H. Migration

**Zero.** Nenhum gate desta issue exige schema. (Aprovação/publicação exigirão, em #54/#55.)

## Matriz de estados

**Lifecycle documental insuficiente** — só existem estados técnicos:

| Estado real           | Autor pode editar?        | Revisor atua?     | Aprovador atua?   | Oficial?                      | Somente leitura? |
| --------------------- | ------------------------- | ----------------- | ----------------- | ----------------------------- | ---------------- |
| `generating` (worker) | Sim, via PUT (sem guarda) | Papel inexistente | Papel inexistente | Vigente se for a maior versão | Não              |
| `ready`               | Sim, via PUT (sem guarda) | Papel inexistente | Papel inexistente | Vigente se for a maior versão | Não              |

A matriz de verdade (rascunho → revisão → aprovado → publicado) depende de #52–#55.

## Arquitetura recomendada

1. Repositório: `listDocumentVersions(orgId, documentId)` — resolve o grupo pelo id, lista versões desc
   com `isCurrent`; id inexistente/outro tenant → `NOT_FOUND`.
2. Exportar a definição de vigente (`isCurrentVersion`/predicate) de um único módulo.
3. Guarda de versão não vigente em `updateDocument` → erro de domínio 409 (código novo mapeado em
   `shared/api/rest.ts`, ou reuso de código existente — decidir no PLAN).
4. `addDocumentVersion` herda metadados da versão vigente do grupo, não da linha apontada.
5. Conflito de upload do Storage → `DUPLICATE`.
6. Server Action + `GET /api/v1/documents/{id}/versions` + `api-design.md` + Postman.
7. UI: "Histórico de versões" na linha do documento (versão, data, tamanho, badge vigente, download);
   ações de edição só na vigente.

## Testes

- **UNIT:** mapeamento de versões com `isCurrent`; decisão de vigência.
- **INTEGRATION:** 3 versões listadas em ordem desc, só a maior vigente; listar pelo id antigo devolve o
  mesmo grupo; PUT em versão antiga → 409 sem mutação; nova versão via id antigo herda da vigente; race
  existente continua 409; conflito de upload com mesmo nome → `DUPLICATE`; delete continua apagando o grupo.
- **REST/ACTION:** `GET /documents/{id}/versions` 200 + 404 cross-tenant; `PUT` em versão antiga → 409.
- **RLS:** consulta de versões sob `app_runtime` não enxerga outro tenant.
- **E2E:** modal de histórico com badge vigente e download de versão antiga (Playwright 375/768/1440).
- **Regressão:** `pdf-batch-core.test.ts` e `jobs-worker.test.ts` intactos.

Aprovação não é testável nesta issue (não existe).

## Premissa definitiva (2026-09-16)

- Até existir aprovação (#54): **versão vigente = maior versão do `document_group_id`**.
- Não criar agora revisor, aprovador, workflow nem status documental novo.
- A definição de vigente fica em **um único ponto**, para #54 substituí-la depois.
- Código de erro de escrita em versão antiga: definido no PLAN do lote.

## Riscos

Baixo. Mudança de comportamento: clientes REST que editavam versão antiga passam a receber 409 (não há
uso conhecido na UI).

## Dificuldade

**2/5.**

## Prontidão

**READY COM PREMISSAS.**

## Cobertura atual

50% — criar versão, preservar histórico e vigência prontos e testados; listagem, UI e somente leitura ausentes.

## Lote recomendado

**1A** — primeira do Lote 1, na PR única do lote.

## Execução

| Branch                                             | PR           | Migration | Testes                                                             | CI       | Decisão                                                                          | Status                                       |
| -------------------------------------------------- | ------------ | --------- | ------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| `lot-01-feat/document-versions-risk-plan-coverage` | #93 (Lote 1) | Nenhuma   | unit 8 novos; integração 8/8; REST 4/4; regressão GED+worker 90/90 | pendente | Vigente = maior versão (centralizada); antiga → 409 `DOCUMENT_VERSION_READ_ONLY` | Implementada (`aa5605e`), aguardando revisão |
