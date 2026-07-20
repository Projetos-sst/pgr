# Issue #33 · Modelo de dados — Documentos, Pastas e Jobs

**Objetivo:** 3 tabelas (`documents`, `folders`, `jobs`) + enums, com RLS, análoga às
fatias 006/008 (schema puro + migration + testes, sem UI).

**Depende de:** #32 (✅). **Destrava:** #34, #35, #38, #39.

## ⚠️ Tradução para o Modelo B (o corpo da issue é da era "Modelo A")

- `lib/db/schema/*` → `src/shared/db/schema/{documents,folders,jobs}.ts`
- `organization_id` → `org_id text NOT NULL → orgs.id` + `pgPolicy(...).enableRLS()`
  (template: `src/shared/db/schema/companies.ts`)
- Migration provável `0017_*` com GRANT + triggers `set_updated_at` como SQL custom
- Testes de integração: **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite
- Lembrar do event trigger `ensure_rls` de produção: tabela nova sem policy explícita → leitura vazia

## Decisões a cravar no spec (antes da migration)

1. **Versionamento de documento — a decisão de modelagem mais importante da fase:**
   - (a) 1 linha por versão (histórico = linhas irmãs agrupadas por `document_group_id`); ou
   - (b) 1 linha mutável + tabela `document_versions`.
   - O #34 assume "incrementa `version` preservando histórico, sem trigger" — compatível
     com ambas; precisa ser cravado aqui. A opção (a) dá download de versão antiga de
     graça no #35.
2. **`documents.status` — não persistir o derivável:** o repo já tem o padrão
   `classifyTrainingStatus` (fatia 017): derivar válido/a vencer/vencido de `valid_until`
   na leitura. Reservar `status` para **ciclo de vida** (`generating|ready|archived` —
   útil para o #38) ou nem criar. Persistir "vencido" exigiria cron de atualização
   (anti-padrão já evitado na 017).
3. **`folders`:**
   - `ON DELETE` do `parent_id`: sugerido `RESTRICT` em pasta com filhos (resolver na app).
   - `UNIQUE(org_id, parent_id, name)`: `parent_id NULL` não participa de UNIQUE padrão →
     índice parcial para a raiz.
   - Prevenção de ciclo (mover pasta para dentro de si) = invariante de aplicação; documentar.
4. **`jobs` já pensando no #39:**
   - Enums `job_type` / `job_status` (`pending|processing|done|failed`); `payload jsonb`,
     `result jsonb`, `attempts int default 0`.
   - Prever `locked_at` (recuperação de stale claim) e claim atômico
     (`FOR UPDATE SKIP LOCKED`).
   - O cron processa jobs de **todos** os tenants: o repositório de jobs precisará de
     leitura administrativa fora de `withOrg` (precedente `caepi-upsert.ts`) ou de policy
     dedicada de worker. Registrar agora evita retrabalho.
5. **Vínculo polimórfico** (`related_entity_type` + `related_entity_id`, sem FK):
   índice composto + enum/união TS dos tipos permitidos (não deixar string livre).
6. **Detalhes:** `size` em `bigint`; tipo de documento enum vs. texto livre (paridade ePGR) — clarificar.

## Riscos

- Testes de RLS nas 3 tabelas (padrão `tenant_probe`).
- ON DELETE da cadeia `folders → documents` (pasta excluída no futuro): definir já na migration.

## Insumos para o /speckit-specify

- **Branch:** `feature/documents-data-model`
- **User story (P1):** como plataforma, preciso do modelo de `documents`/`folders`/`jobs`
  isolado por tenant para suportar GED, downloads e geração assíncrona de PDF.
- **Success criteria:** 3 tabelas migradas com RLS; hierarquia de pastas funcional;
  vínculo polimórfico sem FK; jobs com claim seguro modelado.
- **Edge cases:** pasta raiz (parent NULL); nome duplicado na mesma pasta; job reclamado
  em concorrência; documento sem validade.
- **Restrições:** Princípios I (isolamento) e V; zero UI nesta fatia.
