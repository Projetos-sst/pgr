# Research — Modelo de dados: Documentos, Pastas e Jobs

**Feature**: `.specs/023-documents-data-model/` · **Date**: 2026-07-18

Decisões técnicas da fatia. As clarificações de produto (Q1/Q2/Q3) foram resolvidas no
`/speckit-specify` (2026-07-18) e aqui recebem a forma técnica final.

## 1. Versionamento de documento — 1 linha por versão (Q1)

- **Decision**: cada versão é uma linha em `documents`, agrupada por
  `document_group_id uuid NOT NULL`. Na primeira versão a aplicação gera o grupo (novo uuid);
  nas seguintes reusa o grupo e incrementa `version`. Unicidade
  `UNIQUE (org_id, document_group_id, version)`; versão corrente = `MAX(version)` do grupo,
  derivada na leitura (sem flag `is_current` materializada).
- **Rationale**: histórico preservado por construção; download de versão antiga (#35) é um
  SELECT comum, sem estrutura extra; sem trigger nem sincronização de flag; espelha o padrão
  "derivar o corrente na leitura" já usado na 017 (último registro por janela).
- **Alternatives considered**: (a) linha mutável + tabela `document_versions` — 2 tabelas,
  escrita em 2 passos, duplicação de metadados; rejeitada por complexidade sem ganho para o
  MVP. (b) flag `is_current` materializada — exige UPDATE em cadeia a cada nova versão
  (anti-padrão "persistir o derivável"); rejeitada.

## 2. Status de validade derivado — `classifyDocumentValidity`

- **Decision**: função pura em `src/shared/domains/documents/validity.ts`, espelho de
  `classifyTrainingStatus` (fatia 017): assinatura
  `classifyDocumentValidity(validUntil: string | null, { today, dueWindowDays }): "ok" | "due_soon" | "expired" | "no_expiry"`,
  datas como `date` ISO (comparação lexicográfica), `today` calculado por `todayInSaoPaulo()`
  (`src/shared/dates.ts`), janelas reusando `DUE_WINDOW_DAYS_OPTIONS` (30/60/90) — **promovido**
  de `domains/pgr/trainings.ts` para `src/shared/dates.ts` nesta fatia (re-export em
  `trainings.ts` para compat), evitando import cross-domain `documents → pgr` (mesmo precedente
  da promoção de `todayInSaoPaulo` na 017).
  `valid_until date` nullable no banco; **nenhuma coluna materializada de validade**.
- **Rationale**: FR-002/SC-004; padrão já provado no repo; zero rotina agendada.
- **Alternatives considered**: coluna `expired boolean` + cron — rejeitada (anti-padrão já
  evitado na 017); view computada — desnecessária para o volume, YAGNI.

A coluna `status` de `documents` é **ciclo de vida**: enum `document_status`
(`generating | ready`), `NOT NULL DEFAULT 'ready'`. Nasce agora para a #38 gravar `generating`
sem migration futura; nenhum consumidor nesta fatia além do default.

## 3. Unicidade de nome entre pastas irmãs (inclusive raiz)

- **Decision**: `UNIQUE (org_id, parent_id, name)` com **`NULLS NOT DISTINCT`**
  (Postgres ≥15; Drizzle: `unique(...).nullsNotDistinct()`, suportado na versão do repo).
  Um único constraint cobre irmãs de qualquer nível **e** a raiz (`parent_id NULL`).
- **Rationale**: 1 constraint em vez de 2 índices parciais; declarativo no schema Drizzle
  (o índice parcial exigiria SQL custom adicional); FR-007 atendido pelo banco.
- **Alternatives considered**: par de índices parciais (`WHERE parent_id IS NOT NULL` +
  `WHERE parent_id IS NULL`) — funciona em qualquer PG, mas dobra os objetos e sai do caminho
  declarativo; rejeitada. **Fallback registrado**: se o Postgres efêmero/produção acusar
  versão <15 (não esperado no Supabase atual), voltar aos índices parciais.

## 4. ON DELETE da cadeia (Q3 — RESTRICT)

- **Decision**: `folders.parent_id → folders.id ON DELETE RESTRICT` e
  `documents.folder_id → folders.id ON DELETE RESTRICT`. `org_id → orgs.id ON DELETE CASCADE`
  em todas (padrão do repo — apagar o tenant leva tudo). `documents.folder_id` nullable
  (documento na raiz).
- **Rationale**: pasta não-vazia (subpastas **ou** documentos) não pode ser excluída — postura
  conservadora contra perda de acervo (FR-008); a UX de esvaziar/mover é da #34.
- **Alternatives considered**: CASCADE (perda silenciosa de acervo — rejeitada); SET NULL
  (documentos "vazariam" para a raiz sem intenção do usuário — rejeitada).

**Invariante de aplicação (documentado, não é do banco)**: prevenção de ciclo ao mover pasta
(pasta não pode virar descendente de si mesma). O banco não impede; a #34 valida subindo a
cadeia de pais antes do UPDATE. Registrado em data-model.md §Invariantes.

## 5. Fila de jobs — claim atômico e recuperação

- **Decision**: enums `job_type` (`pdf_batch`) e `job_status`
  (`pending | processing | done | failed`); colunas `payload jsonb NOT NULL DEFAULT '{}'`,
  `result jsonb` (sucesso **ou** erro estruturado), `attempts int NOT NULL DEFAULT 0`
  (CHECK `>= 0`), `locked_at timestamptz` (carimbo de reivindicação). Índice
  `(status, created_at)` para o poll da fila. **Contrato de claim** (documentado em
  contracts/, exercitado nos testes de integração):

  ```sql
  UPDATE jobs SET status = 'processing', locked_at = now(), attempts = attempts + 1
  WHERE id = (
    SELECT id FROM jobs WHERE status = 'pending'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
  ```

  Recuperação de claim travado: job `processing` com `locked_at < now() - <limite>` é
  identificável e retornável a `pending` (UPDATE guardado pelas mesmas condições).

- **Rationale**: `FOR UPDATE SKIP LOCKED` é o padrão Postgres para fila sem execução dupla
  (SC-003) e sem infra nova (Princípio II); `locked_at` resolve o processador morto sem
  heartbeat.
- **Alternatives considered**: fila dedicada (SQS/Upstash) — violaria o Princípio II sem
  emenda; `SELECT ... FOR UPDATE` sem SKIP LOCKED — serializa os workers (bloqueio, não
  exclusão); advisory locks — mais frágeis em serverless (conexão via pooler). Rejeitadas.

## 6. Leitura administrativa da fila (FR-011) — nenhuma policy nova

- **Decision**: esta fatia **não cria** policy nem role adicional. As 3 tabelas têm apenas a
  policy de isolamento `app_runtime`. O worker (#39) fará o claim cross-tenant por conexão
  **server-only fora do `app_runtime`** — precedentes já existentes no repo:
  `repositories/caepi-upsert.ts` (handle Drizzle owner injetado, `server-only`) e
  `repositories/admin.ts` (service client que bypassa RLS). Como o claim exige
  `FOR UPDATE SKIP LOCKED` (SQL, não PostgREST), o caminho provável do #39 é o handle Drizzle
  injetado; a escolha final é dele. Toda escrita de **resultado** (documentos gerados) usa
  `withOrg(job.org_id)`.
- **Rationale**: adicionar uma policy permissiva de worker no `app_runtime` enfraqueceria o
  isolamento de TODO o runtime para servir um consumidor que ainda não existe (anti-YAGNI e
  risco do Princípio I). O modelo não bloqueia nenhuma abordagem; os testes de integração
  provam o claim usando a conexão admin do harness (que já existe).
- **Alternatives considered**: role `app_worker` com policy própria — decisão prematura sem o
  worker real; policy `USING (true)` para service role — o service role já bypassa RLS,
  redundante. Adiadas/rejeitadas.

## 7. Vínculo polimórfico sem FK

- **Decision**: `related_entity_type text` + `related_entity_id uuid`, ambos nullable, com
  CHECK **completo-ou-vazio** (`(related_entity_type IS NULL) = (related_entity_id IS NULL)`);
  índice parcial `(org_id, related_entity_type, related_entity_id) WHERE related_entity_type
IS NOT NULL`; conjunto fechado na aplicação via zod
  (`documentRelatedEntityTypeSchema = z.enum(["pgr"])` em `domains/documents/validity.ts` —
  mesmo módulo de domínio), ampliável por código sem migration (FR-005).
- **Rationale**: novos consumidores (OS etc.) sem migration; o CHECK impede vínculo pela
  metade; texto (não enum de banco) porque o conjunto fechado é de aplicação por decisão do
  spec.
- **Alternatives considered**: FK real por tipo (uma coluna por entidade) — explosão de
  colunas e migration por consumidor; enum de banco — migration a cada tipo novo, contradiz
  FR-005. Rejeitadas.

## 8. Detalhes de tipos

- **`size_bytes`**: `bigint` no banco (arquivos >2 GiB — FR-001); no Drizzle,
  `bigint("size_bytes", { mode: "number" })` — `number` é seguro até 2^53−1 (~8 EiB é
  inalcançável para arquivo real; 9 PB de folga) e evita `BigInt` na camada de app. CHECK
  `size_bytes >= 0`.
- **`version`**: `integer NOT NULL DEFAULT 1`, CHECK `version >= 1`.
- **`doc_type`**: `text NOT NULL` (Q2 — texto livre; nome da coluna evita colisão com a
  palavra `type` genérica e espelha o filtro por igualdade previsto na #34).
- **`valid_until`**: `date` nullable (validade é dia civil, não instante — mesmo racional da
  017).
- **Migration**: `0025_documents_data_model` gerada por `npm run db:generate`; GRANT +
  triggers `set_updated_at` + (se necessário) ajustes de índice como SQL custom apendado —
  padrão `0023_schedule_events.sql`.
