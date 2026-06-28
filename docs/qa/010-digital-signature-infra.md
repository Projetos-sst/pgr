# QA & Handoff — Infraestrutura de assinatura digital (fatia 010 · #67)

Documento de entrega + plano de testes da fatia **010 — assinatura digital por link público
com token + QR + captura**. Conteúdo PT-BR; código em inglês.

- Spec: `.specs/010-digital-signature-infra/spec.md`
- Plano/contratos/data-model: `.specs/010-digital-signature-infra/`
- Briefing (fonte da verdade): `docs/briefings/briefing-digital-signature-infra.md`

---

## 1. O que foi entregue

Camada de plataforma **transversal e reutilizável (DRY)** para coletar assinatura de um
terceiro **sem login**, via link público + QR Code protegido por token, isolada por tenant e
respeitando o plano free/pro. Consumidor de demonstração (`target_type: 'demo'`) exercita o
contrato ponta a ponta.

### Fluxo resumido

```
Interno (com sessão)                         Público (sem sessão)
─────────────────────                        ────────────────────
/signatures (painel)                         /assinar/[token]
  └─ createSignatureRequest                    └─ resolvePublicSignature(token)
       gera token (cru só na URL/QR)                valida estado (inválido/expirado/usado)
       grava token_hash (sha-256)                   renderiza form do target_type
       QR (qrcode) + publicUrl                 └─ submitPublicSignature(token, {name, png})
  └─ getSignatureStatus (polling ~3s)               withSignatureToken → policy capability
       pending → signed (<5s)                       deriva org → withOrg → consome + captura
  └─ signManually (fallback)
```

### Isolamento multi-tenant (ponto sensível)

- **Interno**: tenant da sessão (`requireOfficeStaff` → `ctx.tenantId`) + `withOrg` + RLS de tenant.
- **Público**: sem sessão. O tenant vem **do token**, nunca do cliente:
  - `signature_requests` tem 2 policies RLS PERMISSIVE (combinam por OR):
    - tenant: `FOR ALL ... org_id = current_setting('app.current_org', true)`
    - capability: `FOR SELECT ... token_hash = current_setting('app.signature_token', true)`
  - `withSignatureToken(rawToken)` seta `app.signature_token = sha256(token)` → lê só a linha do token.
  - A gravação usa `withOrg(orgId)` com o `org_id` derivado da linha lida.

### Arquivos principais

| Camada            | Arquivo                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Schema + RLS      | `src/shared/db/schema/signatures.ts`                                                                         |
| Migration         | `src/shared/db/migrations/0009_digital_signature_infra.sql`                                                  |
| Domínio           | `src/shared/domains/signatures/{token,schemas,contract,types,public-url}.ts`, `targets/demo.ts`              |
| Helper capability | `src/shared/db/with-signature-token.ts`                                                                      |
| Repositório       | `src/shared/db/repositories/signature-requests.ts`                                                           |
| Actions internas  | `src/shared/server/actions/signatures.ts`                                                                    |
| Action pública    | `src/shared/server/actions/public-signatures.ts`                                                             |
| Plano/quota       | `src/shared/tenant/plan.ts`, `src/shared/errors/quota-exceeded-error.ts`, `src/shared/api/rest.ts`           |
| UI                | `src/shared/ui/signature/*`, `src/app/(public)/assinar/[token]/page.tsx`, `src/app/(protected)/signatures/*` |

### Regras travadas

- Token ≥256 bits, persistido só **hasheado** (sha-256); cru só na URL/QR; **uso único** (`used_at`,
  UPDATE atômico `WHERE used_at IS NULL`); TTL configurável (**default 72h**).
- Imagem da assinatura: data-URL base64 PNG no Postgres, **máx. 256 KB**; nome do signatário máx. 120.
- "expired" é **derivado na leitura** (não persistido). `cancelled` é estado dormente.
- Plano: **free = 10 pedidos criados/mês** (contagem derivada por mês corrente, sem cron),
  **pro = ilimitado**; gate só na **criação** (interno). A rota pública **nunca** checa plano.

---

## 2. Pré-requisitos para rodar / testar

1. Deps já instaladas (`qrcode`, `signature_pad`, `@types/qrcode`).
2. **Aplicar a migration** no banco (owner unpooled): `npm run db:migrate` _(tarefa T007, pendente)_.
3. `.env.local`: `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, Clerk, e **`NEXT_PUBLIC_APP_URL`**
   (sem ela o link/QR sai relativo).
4. Integração: `INTEGRATION_DATABASE_URL` (admin/owner) + `INTEGRATION_APP_RUNTIME_URL`
   (role `app_runtime`) apontando para um **Postgres efêmero** (nunca SQLite).

---

## 3. Status atual dos testes

- ✅ **Unit** (`npm run test`): 199/199 (inclui token, schemas, quota desta fatia). _Obs.: rodar
  com `--runInBand` evita um SIGSEGV flaky de worker num teste não relacionado (`categories`)._
- ⏳ **Integração** (`npm run test:integration`): 9 suites prontas; **skipam** sem `INTEGRATION_*`.
  Precisam do Postgres efêmero para validar RLS/capability/quota de verdade.

Comandos:

```bash
npm run test -- --runInBand          # unit
npm run test:integration             # integração (requer INTEGRATION_*)
npm run check                        # format + lint + typecheck + unit
```

---

## 4. Casos de teste manuais (E2E — fazer depois, com a app rodando)

> Pré: `npm run db:migrate` aplicado, `npm run dev`, logado como office staff (owner/collaborator).

### TC-01 — Gerar link/QR e assinar sem login (SC-001, SC-003) · P1

1. Acesse `/signatures`. Defina um título e clique **Gerar link/QR**.
2. **Esperado**: aparecem o link público, botão **Copiar link** e o **QR Code**; status = "Aguardando".
3. Abra o link em uma **aba anônima** (sem sessão) ou leia o QR no celular.
4. **Esperado**: o formulário do `demo` é exibido (título + campo de nome + área de assinatura).
5. Preencha o nome, desenhe a assinatura, clique **Assinar**.
6. **Esperado**: mensagem "Assinatura registrada com sucesso".
7. Volte ao `/signatures` (sem recarregar manualmente).
8. **Esperado**: status muda para **"Assinado"** sozinho em **< 5 s**.

### TC-02 — Tempo real (SC-001) · P1

1. Com um pedido "Aguardando" aberto em `/signatures`, conclua a assinatura na outra aba.
2. **Esperado**: o painel reflete "Assinado" sem ação manual, em < 5 s (polling ~3 s).

### TC-03 — Token de uso único (SC-002) · P1

1. Reabra o **mesmo** link já assinado.
2. **Esperado**: página "Link já utilizado"; não permite assinar de novo.

### TC-04 — Token expirado (SC-002) · P1

1. Crie um pedido e aguarde além do TTL (ou gere um com TTL curto / ajuste em base de teste).
2. Abra o link.
3. **Esperado**: página "Link expirado"; sem gravação.

### TC-05 — Token inválido · P1

1. Acesse `/assinar/um-token-qualquer-invalido`.
2. **Esperado**: página "Link inválido"; nenhum dado exposto.

### TC-06 — Assinatura manual (US4) · P2

1. Em um pedido "Aguardando", clique **Registrar assinatura manual**, informe um nome.
2. **Esperado**: status vira "Assinado"; a captura fica registrada como método manual.

### TC-07 — Validação no envio público · P1

1. No formulário público, tente enviar **sem desenhar** a assinatura.
2. **Esperado**: erro "Desenhe sua assinatura antes de enviar." (sem chamada gravada).
3. Tente enviar **sem nome** → o campo é obrigatório.

### TC-08 — Gate de plano free/pro (SC-006, US5) · P3

1. Em um tenant **free**, gere 10 pedidos no mês.
2. **Esperado**: o 11º retorna erro de quota excedida.
3. Em um tenant **pro**, gere acima de 10.
4. **Esperado**: nunca bloqueia.
5. Com o free no limite, assine um link **já existente** pela rota pública.
6. **Esperado**: assinatura conclui normalmente (a rota pública não checa plano).

### TC-09 — Isolamento multi-tenant (SC-005) · P1 (crítico)

1. Gere um pedido no tenant A; copie o token.
2. **Esperado**: o link só resolve dados do tenant A; nenhuma referência ao tenant B.
3. (DB) Confirme que a captura gravada tem `org_id` do tenant A.

### TC-10 — Reuso/DRY (SC-004) · P1

1. Confirme no código que adicionar um novo `target_type` é registry + payloadSchema + FormRenderer.
2. **Esperado**: nenhuma migração nova é necessária (ver `extensibility.test.ts` como prova automatizada).

---

## 5. Casos de teste automatizados (a executar quando houver Postgres efêmero)

Rodar `npm run test:integration` com `INTEGRATION_*` configurado. Suites e o que provam:

| Suite                              | Prova                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `signatures/create.test.ts`        | persiste escopado ao org; grava `token_hash`, nunca o cru; payload inválido → VALIDATION |
| `signatures/submit-public.test.ts` | captura via token + transição pending→signed                                             |
| `signatures/public-states.test.ts` | token inexistente/expirado/usado → estado correto, sem gravação                          |
| `signatures/cross-tenant.test.ts`  | **crítico**: token de A não lê/grava em B; sem token → nada                              |
| `signatures/forbidden.test.ts`     | papel `client` → FORBIDDEN nas 3 actions internas                                        |
| `signatures/status.test.ts`        | pending→signed; expired derivado; inexistente → NOT_FOUND                                |
| `signatures/extensibility.test.ts` | novo `target_type` usa as mesmas tabelas (zero migração)                                 |
| `signatures/manual.test.ts`        | método manual; rejeita já assinado (uso único)                                           |
| `signatures/quota.test.ts`         | free bloqueado no 11º; pro ilimitado; público não checa plano                            |

Unit (já verdes): `signatures-token`, `signatures-schemas`, `signatures-quota`.

### Sugestões de testes adicionais (futuro)

- Concorrência: dois `submitPublicSignature` simultâneos no mesmo token → só um grava (corrida do `used_at`).
- Limite de tamanho real do PNG (imagem perto de 256 KB aceita; acima rejeita) ponta a ponta.
- E2E de browser (Playwright) da rota pública: desenhar no canvas e submeter.

---

## 6. Rastreabilidade (aceite)

| Critério                        | Onde é coberto                        |
| ------------------------------- | ------------------------------------- |
| SC-001 (<5s)                    | TC-01/02 (manual) + polling no painel |
| SC-002 (uso único/expiração)    | TC-03/04 + `public-states.test.ts`    |
| SC-003 (persistência vinculada) | TC-01 + `submit-public.test.ts`       |
| SC-004 (reuso sem schema)       | TC-10 + `extensibility.test.ts`       |
| SC-005 (isolamento)             | TC-09 + `cross-tenant.test.ts`        |
| SC-006 (plano)                  | TC-08 + `quota.test.ts`               |
| FR-026 (FORBIDDEN client)       | `forbidden.test.ts`                   |

---

## 7. Pendências / follow-ups

- **T007**: `npm run db:migrate` para aplicar a `0009` no banco real.
- Definir **`NEXT_PUBLIC_APP_URL`** em produção/staging (link/QR absoluto).
- Rodar a suíte de integração no Postgres efêmero (CI).
- Fora de escopo (fatias futuras): envio por WhatsApp/SMS/e-mail (#66), storage externo da imagem,
  integração com a entrega de EPI real (branch irmã), SSE.
