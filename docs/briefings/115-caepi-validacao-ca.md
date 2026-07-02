# Briefing — Validação/consulta de CA no CAEPI/MTE

> **Issues**: #115 (Validação de CA — desmembrada da #68) · cobre também **#75** (Consulta de CA)
> — recomenda-se **fechar #75 como duplicada de #115**.
> **Fase**: 02 — EPIs · **Branch da fatia**: `feature/caepi-ca-validation`
> **Depende de**: cadastro de EPI (`epi_catalog`, já modelado na 008 com `ca`, `ca_valid_until`,
> `manufacturer`, `norm`) e da camada de integrações da #68 (`docs/briefings/008-integracoes-externas.md`).

---

## 0. Contexto de domínio (para quem nunca viu)

- **EPI** = Equipamento de Proteção Individual (capacete, luva, bota, óculos, máscara, protetor
  auricular…).
- **CA** = **Certificado de Aprovação** emitido pelo **MTE** (Ministério do Trabalho e Emprego).
  Pela NR-6, todo EPI usado/comercializado no Brasil precisa de um número de CA válido. O CA tem
  **data de validade** e pode estar **vigente, vencido ou cancelado**.
- **CAEPI** = base/sistema do MTE que registra todos os CAs.
- **Objetivo no produto**: ao cadastrar um EPI e informar o número do CA, (a) **validar** se o CA
  existe e está vigente e (b) **autopreencher** fabricante, norma e validade. CA vencido/inexistente
  gera aviso, mas **nunca bloqueia** o cadastro (campos permanecem editáveis).

---

## 1. Achado técnico que define a arquitetura

**O CAEPI/MTE não expõe API REST oficial estável.** As únicas fontes oficiais são:

1. **Portal web** de consulta (`caepi.mte.gov.br/internet/ConsultaCAInternet.aspx`) — lento, sem
   contrato de integração, sujeito a captcha/instabilidade. **Scraping é frágil e desencorajado.**
2. **Download da base completa** — "Base de dados do sistema CAEPI (Download)", publicada pelo MTE:
   um **arquivo TXT delimitado por `|`** contendo **todos os CAs** (número, validade, situação,
   fabricante/CNPJ, descrição do equipamento, natureza, normas). Atualizado periodicamente pelo MTE.

Terceiros (ex.: `consultaca.com`, projetos open-source que espelham a base, APIs pagas tipo
Infosimples) existem, mas são **não-oficiais e/ou pagos, sem SLA garantido**.

### Decisão: **ingestão periódica do dataset oficial + validação local** ✅

| Critério             | Ingestão da base oficial (escolhida)                            | API de terceiros         | Scraping do portal       |
| -------------------- | --------------------------------------------------------------- | ------------------------ | ------------------------ |
| Oficialidade         | ✅ fonte é o próprio MTE                                        | ❌ intermediário         | ✅/⚠️ oficial mas frágil |
| Confiabilidade       | ✅ não depende de uptime externo no request                     | ❌ sem SLA               | ❌ quebra fácil          |
| Custo                | ✅ zero por consulta                                            | ⚠️/❌ pago ou rate-limit | ✅ zero                  |
| Latência da consulta | ✅ query local (ms)                                             | ⚠️ rede externa          | ❌ lento                 |
| Esforço              | ⚠️ maior (tabela + job + parser)                                | ✅ baixo                 | ⚠️ médio e instável      |
| Multi-tenant         | ✅ tabela **global/compartilhada** (dado público, sem `org_id`) | n/a                      | n/a                      |

A consulta de CA passa a ser **local** (contra a tabela ingerida), não um fetch externo no `blur`.
O fetch externo acontece **só no job de ingestão**, fora do caminho do usuário.

---

## 2. Arquitetura (camadas)

```
src/shared/integrations/caepi/
  types.ts            # CaCertificate (DTO interno), CaStatus = "valid"|"expired"|"not_found"
  parse.ts            # parser do TXT delimitado por "|" → linhas tipadas (Zod, sem `any`)
  validate-ca.ts      # função pura: dado registro + data atual → CaStatus (valid/expired)
  normalize.ts        # normaliza número de CA (só dígitos)

src/shared/db/schema/
  caepi-certificates.ts  # tabela GLOBAL (sem org_id) — espelho da base oficial

src/shared/db/repositories/
  caepi-repository.ts    # getByCa(ca) → registro | null ; upsertMany(rows) (usado no job)

src/shared/server/actions/epi/
  lookup-ca.ts           # Server Action: lookupCa(ca) → ActionResult<CaLookupResult>

src/app/api/integrations/caepi/[ca]/route.ts   # GET opcional, guardado por sessão
src/app/api/cron/caepi-sync/route.ts           # job de ingestão (Vercel Cron, CRON_SECRET)

src/shared/integrations/caepi/client/
  use-caepi-validation.ts  # hook consumido no form de cadastro de EPI

src/app/(protected)/epis/_components/ca-field.tsx  # campo CA + feedback (valid/expired/not_found)
```

### 2.1 Tabela `caepi_certificates` (espelho da base oficial)

- **Global / compartilhada entre tenants** — CA é dado **público** do MTE, não dado do cliente.
  **Sem `org_id`, sem RLS de tenant** (é a exceção justificada ao Princípio I: não há dado de
  cliente trafegando, não há cruzamento de tenants a proteger). Documentar essa exceção na spec.
- Colunas mínimas: `ca` (PK lógica / unique), `valid_until` (date), `situation` (text — situação
  cadastral do MTE), `manufacturer_name`, `manufacturer_cnpj`, `equipment_name`/`description`,
  `nature`, `norms`, `synced_at`.
- Índice por `ca`. Migration nova (drizzle-kit) — **esta fatia introduz 1 tabela**.

### 2.2 Job de ingestão (`/api/cron/caepi-sync`)

- **Vercel Cron** (ex.: 1×/dia), guardado por `CRON_SECRET` (padrão já descrito em
  `docs/produto/04-integracoes-e-servicos.md`).
- Baixa o TXT oficial → `parse.ts` (split por `|`, validação Zod linha a linha, descarta inválidas
  com log) → **upsert em lote** na tabela (`onConflictDoUpdate` por `ca`), atualizando `synced_at`.
- Tratamento de falha: se o download falhar, **não derruba** a base existente (job idempotente,
  loga e sai). Concorrência de inserção em lote com `p-limit` se necessário.
- **Bootstrap**: primeira carga pode ser manual (script único) para não estourar o tempo do cron.

### 2.3 Consulta de CA (`lookupCa`)

- **Server Action** `lookupCa(ca: string)` (ou Route Handler `GET`), guardada por sessão
  (`requireOfficeStaff()` — quem cadastra EPI é staff do escritório). Reusa `ActionResult<T>`
  (`ok`/`fail`) e o wrapper `officeAction`.
- Fluxo: `normalize.ts` → valida formato (só dígitos, não vazio) → `caepi-repository.getByCa` →
  `validate-ca.ts` compara `valid_until` com a data atual → devolve:

```ts
type CaLookupResult =
  | {
      status: "valid";
      ca: string;
      manufacturer: string;
      norm: string;
      validUntil: string;
      equipmentName?: string;
    }
  | {
      status: "expired";
      ca: string;
      manufacturer: string;
      norm: string;
      validUntil: string;
      equipmentName?: string;
    }
  | { status: "not_found"; ca: string };
```

- Formato inválido → `fail("VALIDATION", …)` (422). Base nunca sincronizada (vazia) → tratar como
  `not_found` com aviso "base CAEPI ainda não sincronizada" (não como erro fatal).

### 2.4 Hook + UI

- `useCaepiValidation()` → `{ status: "idle"|"loading"|"valid"|"expired"|"not_found"|"error", data?, lookup(ca) }`.
- Dispara no `blur` do campo CA (ou botão "Consultar") **só se** o formato for válido; aborta
  request anterior (AbortController) em digitação rápida.
- **CA válido** → preenche `manufacturer`, `norm`, `ca_valid_until` no form de EPI + badge verde.
- **CA vencido** → badge "CA Vencido" + aviso (distinto de inexistente); ainda preenche os dados.
- **CA inexistente** → erro inline "CA não encontrado".
- **Erro/timeout** → estado silencioso; campos seguem editáveis; **sem exceção não capturada**.
- O salvamento do EPI **não depende** da consulta (auxiliar, não obrigatória).

---

## 3. Validação (lógica de negócio — alvo de teste unitário)

- `normalizeCa` — remove máscara/espaços, mantém dígitos.
- `validateCa(record, today)` — `valid` se `valid_until >= today`; `expired` caso contrário.
- `parseCaepiLine` — mapeia linha do TXT (`|`) para DTO; rejeita linhas malformadas.
- Distinção dos 3 estados: **válido / vencido / inexistente**.

---

## 4. Edge cases

| Caso                                       | Comportamento                                                         |
| ------------------------------------------ | --------------------------------------------------------------------- |
| CA não existe na base                      | `not_found` → erro inline; cadastro segue manual                      |
| CA vencido                                 | `expired` → badge + aviso; preenche dados mesmo assim                 |
| Base ainda não sincronizada (tabela vazia) | trata como `not_found` + aviso de base não sincronizada; não bloqueia |
| Download do MTE falhou no cron             | mantém base anterior; loga; não derruba dados                         |
| Formato de CA inválido                     | 422 sem consultar; hook não dispara                                   |
| Digitação rápida (vários blur)             | aborta request anterior                                               |
| Linha corrompida no TXT                    | descartada com log; não aborta a carga toda                           |

---

## 5. Testes (obrigatório)

- **Unit**: `normalizeCa`; `validateCa` (válido/vencido, limite de data = hoje); `parseCaepiLine`
  (linha ok, linha corrompida, campos faltando); mapeamento registro → `CaLookupResult` nos 3 estados.
- **Integração** (Postgres efêmero `INTEGRATION_*`, **nunca SQLite**):
  - `lookupCa` com base semeada → `valid` / `expired` / `not_found`;
  - guard de sessão → `FORBIDDEN`/`UNAUTHORIZED` sem staff;
  - job de ingestão com **download mockado** (`fetch` global) → upsert correto + idempotência
    (rodar 2×, sem duplicar);
  - download falho → base preservada.
- `npm run test` + `npm run test:integration` verdes; `npm run lint` + types verdes.

---

## 6. Critérios de aceite (das #115 e #75)

- [ ] CA válido/vigente confirmado no cadastro de EPI + autopreenche fabricante, norma, validade.
- [ ] CA vencido exibe aviso claro, **distinto** de inexistente.
- [ ] CA inexistente exibe aviso claro.
- [ ] Falha na fonte externa / base não sincronizada **não bloqueia** o cadastro (campo editável).
- [ ] Consulta é local (rápida) e não gera chamada externa por request do usuário.
- [ ] Job de ingestão idempotente e protegido por `CRON_SECRET`.

---

## 7. Fora de escopo

- UI completa do cadastro de EPI (é da sua própria fatia; aqui só o campo CA + hook).
- Histórico de versões de um CA / notificação proativa de vencimento (futuro).
- Fallback para API de terceiros (só se a ingestão oficial se mostrar inviável — registrar como
  alternativa, não implementar agora).

---

## 8. Ordem de implementação sugerida

1. `types.ts` + `normalize.ts` + `validate-ca.ts` (+ unit).
2. `parse.ts` do TXT oficial (+ unit com amostra de linhas).
3. Schema `caepi_certificates` + migration + `caepi-repository` (`getByCa`, `upsertMany`).
4. Job `/api/cron/caepi-sync` (download + parse + upsert) + script de bootstrap (+ integração mockada).
5. `lookupCa` (Server Action guardada) (+ integração).
6. Hook `use-caepi-validation` + campo `ca-field.tsx` no form de EPI.
7. Lint/types/test verdes.

---

## 9. Referências no repo

- Camada base de integrações: `docs/briefings/008-integracoes-externas.md`.
- Modelo de EPI (campos `ca`, `ca_valid_until`, `manufacturer`, `norm`): `src/shared/db/schema/epis.ts`.
- Contrato de retorno / gate: `src/shared/server/result.ts`, `src/shared/server/office-action.ts`.
- Padrão de migration com SQL custom (GRANT/triggers): migrations `0001`/`0003`/`0005`.
- Cron + `CRON_SECRET`: `docs/produto/04-integracoes-e-servicos.md` (seção "Pipeline assíncrono de jobs").
- Fonte oficial CAEPI: portal `https://caepi.mte.gov.br/` → "Base de dados do sistema CAEPI (Download)".
