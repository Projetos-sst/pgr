# #33 — [EPI] Assinatura digital ou QR Code na entrega de EPI

https://github.com/Projetos-sst/pgr/issues/33

> **Auditoria específica (2026-09-16, `develop` @ `690ec1b`) — prevalece sobre a classificação
> inicial.** Categoria: **A — FUNCIONALMENTE RESOLVIDA.** Decisão de 2026-09-16: **não migrar**; validar
> critérios, comentar e fechar, sem código.

## Pedido real da issue

"**Avaliar** reaproveitar a infraestrutura de assinatura digital genérica (`signature_requests` /
`signature_captures`) como consumidor novo (`target_type = epi_delivery`), em vez de criar mecanismo
próprio." Critérios: gerar pedido link/QR; capturar confirmação do funcionário; status visível no
histórico do item/funcionário; `npm run check`.

A issue pede avaliação, não migração obrigatória.

## Verificação dos critérios de aceite

Revalidada em 2026-09-16 na branch do Lote 1 (base `develop` @ `690ec1b`). Referências conferidas no
código; suítes executadas contra Postgres 16 efêmero: `epi-sign-public.test.ts` + `epi-deliveries.test.ts`
**18/18**; `unit/epi-signature-token.test.ts` verde (suíte unitária completa 1242/1242).

| Critério                                          | Implementação                                                                                                                                                                                      | Teste                                                                                                            | Resultado |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| Entrega gera pedido de assinatura por **link**    | `generateSignTokenAction` monta `/sign/{token}` (`server/actions/pgr/epi-deliveries.ts:124,133`); rota pública liberada no `proxy.ts:70`                                                           | `epi-sign-public.test.ts` — método `link` vira `signed_link`                                                     | Atendido  |
| Entrega gera pedido de assinatura por **QR Code** | `qrSvgFor(url)` (`integrations/epi-signature/qr.ts:10`); botão "Gerar QR" (`employees/[id]/_components/delivery-signature.tsx:105`)                                                                | `epi-sign-public.test.ts` — assinatura via QR sem sessão                                                         | Atendido  |
| Captura a **confirmação do funcionário**          | Página `src/app/(public)/sign/[token]/page.tsx` (link expirado, inválido, já confirmado, pad de assinatura); `signByToken` condicional `pending → signed_*` (`repositories/epi-deliveries.ts:427`) | `epi-sign-public.test.ts` — QR, link, já assinada, cross-org, expirado, adulterado                               | Atendido  |
| Alternativa presencial                            | `signDeliveryManual` (`repositories/epi-deliveries.ts:254`) + REST `api/v1/epi-deliveries/[id]/sign`                                                                                               | `epi-deliveries.test.ts` — manual; repetida → `ALREADY_SIGNED`                                                   | Atendido  |
| **Status visível no histórico da entrega**        | Badge com data (`delivery-signature.tsx:80`); `signedAt` derivado (`epi-deliveries.ts:206`); enum `pending/signed_qr/signed_link/signed_manual` (`schema/epis.ts:48-53`)                           | `epi-deliveries.test.ts` — transições de status                                                                  | Atendido  |
| **Status visível no histórico do funcionário**    | Coluna "Assinatura" na Ficha de EPI (`employees/[id]/_components/epi-record-table.tsx:157,172`)                                                                                                    | Coberto pela leitura da entrega (`employee-epi-record.ts`)                                                       | Atendido  |
| Integridade da evidência                          | Token HMAC com TTL de 72h (`token.ts:16`), uso único, revogável; entrega assinada não pode ser excluída                                                                                            | `epi-sign-public.test.ts` (adulterado/revogado/expirado); `epi-deliveries.test.ts` (DELETE assinada → FORBIDDEN) | Atendido  |
| `npm run check`                                   | —                                                                                                                                                                                                  | Verde no Lote 1                                                                                                  | Atendido  |

**Resultado:** 3/3 critérios de aceite atendidos pela infraestrutura própria do EPI. Nenhum código alterado.

## Pergunta 1 — Critérios funcionais

| Critério                   | Código                                                                                                                                                                | Teste                                                                                    | Atendido?                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Link                       | `generateSignTokenAction` monta `/sign/{token}` (`server/actions/pgr/epi-deliveries.ts:124-140`); botão em `employees/[id]/_components/delivery-signature.tsx:91-114` | `epi-sign-public.test.ts:99` (método link)                                               | Sim                                                           |
| QR Code                    | SVG no servidor (`integrations/epi-signature/qr.ts:10-12`), exibido no painel (`delivery-signature.tsx:118-141`)                                                      | `epi-sign-public.test.ts:78` (via QR)                                                    | Sim                                                           |
| Confirmação do funcionário | Página pública `src/app/(public)/sign/[token]/page.tsx` + `signByToken` condicional `pending → signed_*` (`repositories/epi-deliveries.ts:427-468`)                   | `:78`, `:107` (já assinada)                                                              | Sim                                                           |
| Assinatura                 | Pad exigido como gesto de consentimento; **imagem não persistida** por decisão registrada (`signature-pad.tsx:8-12`)                                                  | —                                                                                        | Sim (consentimento), sem imagem                               |
| Assinatura manual          | `signDeliveryManual` (`epi-deliveries.ts:255-282`) + REST `api/v1/epi-deliveries/[id]/sign`                                                                           | `epi-deliveries.test.ts:149`                                                             | Sim                                                           |
| Status                     | Enum `pending/signed_qr/signed_link/signed_manual` (`schema/epis.ts:48-53`); badge (`delivery-signature.tsx:76-83`)                                                   | `:78`, `:149`                                                                            | Sim                                                           |
| Histórico do funcionário   | Coluna "Assinatura" na Ficha de EPI (`epi-record-table.tsx:159,172`; `employee-epi-record.ts:69,89`)                                                                  | coberto indiretamente                                                                    | Sim                                                           |
| Data                       | `signedAt` derivado de `updated_at` (`epi-deliveries.ts:206`)                                                                                                         | —                                                                                        | Sim (derivada; ver risco)                                     |
| Funcionário                | Entrega pertence ao funcionário; página pública mostra itens                                                                                                          | —                                                                                        | Sim                                                           |
| Segurança do token         | HMAC com orgId/deliveryId/método, TTL 72h (`token.ts:16,58-100`); uso único (limpa `auth_token`); revogável                                                           | `:122` cross-org, `:144` expirado, `:162` adulterado; `unit/epi-signature-token.test.ts` | Sim                                                           |
| Imutabilidade              | Entrega assinada não pode ser apagada                                                                                                                                 | `epi-deliveries.test.ts:190`                                                             | Sim                                                           |
| Auditoria persistida       | Só log de console (`officeAction`)                                                                                                                                    | —                                                                                        | **Não** (também não existe na infra genérica além da captura) |

**Critérios de aceite da issue: 3/3 atendidos.**

## Pergunta 2 — Existe motivo concreto para substituir?

### Modelo real de `target_type`

- `signature_requests.target_type` é **`text NOT NULL`**, sem enum e sem CHECK (`schema/signatures.ts`,
  migration `0010_digital_signature_infra.sql:19`).
- Allowlist **na aplicação**: `SIGNATURE_TARGET_TYPES = demo|inspection|pgr|service_order`
  (`domains/signatures/contract.ts:13-18`) + registry de payload + registry de formulário
  (`ui/signature/form-registry.tsx`).
- Adicionar `epi_delivery`: **sem migration de schema** para o tipo, mas exige payload schema, formulário
  público e adaptador de servidor.
- Consumidores com comportamento específico: `service-orders.ts:64-79` filtra por `target_type` em SQL; PGR
  e OS têm adaptadores próprios (`pgr-signature-core.ts`, `service-order-signature-core.ts`).

### Comparação

| Aspecto              | A — manter infra própria            | B — migrar para `signature_requests`                                                                                                                                                          |
| -------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicação           | Dois mecanismos de assinatura       | Um mecanismo                                                                                                                                                                                  |
| **Cota do plano**    | EPI ilimitado                       | **Regressão:** o core genérico aplica `FREE_SIGNATURE_MONTHLY_QUOTA = 10`/mês (`create-request-core.ts:48`), compartilhado com PGR, OS e inspeções — um cliente free travaria entregas de EPI |
| Imagem da assinatura | Não guardada                        | Guardada (`image_data`)                                                                                                                                                                       |
| Data de assinatura   | Derivada de `updated_at`            | `signed_at` próprio                                                                                                                                                                           |
| Tokens               | HMAC stateless, 72h, orgId no token | Aleatório, só hash no banco, `used_at`, policy RLS de capability                                                                                                                              |
| Dados históricos     | Intactos                            | **Não migráveis sem inventar:** `signature_captures.image_data` e `signer_name` são NOT NULL e o EPI nunca guardou imagem                                                                     |
| Links/QR já emitidos | Válidos até 72h                     | Exige coexistência das duas rotas por ≥72h ou invalida links em circulação                                                                                                                    |
| Rota pública         | `/sign/[token]`                     | `/signature-requests/[token]` (+ formulário novo)                                                                                                                                             |
| RLS                  | Tenant via token → `withOrg`        | Tenant + capability (mais robusto)                                                                                                                                                            |
| Migration            | Nenhuma                             | Dados (+ decisão sobre `epi_deliveries.signature_status/auth_token`)                                                                                                                          |
| Rollback             | —                                   | Difícil depois que as capturas novas existirem                                                                                                                                                |
| Tela `/signatures`   | EPI não aparece                     | Aparece                                                                                                                                                                                       |
| Risco                | Baixo                               | Alto — prova legal de entrega de EPI em produção                                                                                                                                              |
| Ganho real           | —                                   | Imagem + `signed_at` + consistência arquitetural                                                                                                                                              |

## Tokens e evidência existentes

- **Links/QR já enviados:** expiram sozinhos em ≤72h (`SIGN_TOKEN_TTL_MS`). Qualquer corte de rota precisa
  de janela de coexistência.
- **Entregas assinadas:** a evidência é `signature_status` + `updated_at`. Todas as escritas em
  `epi_deliveries` exigem `signature_status = 'pending'` (`epi-deliveries.ts:262,299,438`), então nenhum
  código altera a linha depois de assinada. Mas o trigger `set_updated_at` (migration 0007) mudaria a data
  num UPDATE manual ou de migration futura.
- **Pendentes:** podem gerar novo token a qualquer momento.
- **Trilha de auditoria:** não persistida em nenhuma das duas infras além da própria captura.

Nenhuma proposta abaixo invalida evidência registrada.

## Classificação

**A — FUNCIONALMENTE RESOLVIDA.** Os três critérios são atendidos com testes de integração. A opção B tem
custo concreto (cota do plano free, dados históricos não migráveis, coexistência de links) sem que a issue
exija a unificação.

## Recomendação

1. Fechar #33 como resolvida, com comentário de evidência (tabela acima).
2. **Opcional**, como issue separada de endurecimento (não bloqueia o fechamento): coluna `signed_at` em
   `epi_deliveries` preenchida na transição (tira a dependência de `updated_at`) e, se o produto quiser,
   persistir a imagem do pad. Ambos com migration.
3. Corrigir o comentário desatualizado `tests/e2e/public-signature.spec.ts:70` (cita `/assinar`) quando
   alguém tocar nesse arquivo.

## Decisão definitiva (2026-09-16)

**Não migrar** para `signature_requests`/`signature_captures` nesta issue ("avaliar reaproveitar" não é
"migrar obrigatoriamente"). Motivos: cota genérica de 10 assinaturas/mês no plano free; assinaturas antigas
sem os dados exigidos pela infra genérica (migrar exigiria fabricar dados); links/QR antigos válidos por até
72h; risco maior sem requisito funcional. `signed_at` próprio, se desejado, vira melhoria separada.

Ação: tabela de evidências → comentário na issue → fechar → card Done. Sem branch funcional, sem migration.

## Testes

- **Para fechar:** nenhum novo; rodar os existentes como evidência (`epi-sign-public.test.ts`,
  `epi-deliveries.test.ts`, `unit/epi-signature-token.test.ts`).
- **Se endurecer (`signed_at`):** INTEGRATION — transição grava `signed_at`; UPDATE posterior não altera
  `signed_at`; backfill de assinadas a partir de `updated_at`; REST/ACTION — `signedAt` no DTO vem da
  coluna; RLS — isolamento inalterado.
- **Se migrar (B):** UNIT — payload `epi_delivery`; INTEGRATION — criação respeita/isenta cota,
  coexistência `/sign` × `/signature-requests`, entregas assinadas legadas continuam exibindo status e data,
  token legado válido até 72h; RLS — capability; E2E — assinatura pública ponta a ponta (hoje não há E2E
  de EPI).

## Riscos

Fechar: nenhum. Migrar: alto (ver tabela).

## Dificuldade

**1/5** para fechar · 2/5 para `signed_at` · 4/5 para migrar.

## Prontidão

**RESOLVIDA — VALIDAR E FECHAR.**

## Cobertura atual

75% — 100% dos critérios de aceite; o restante é a unificação opcional.

## Lote recomendado

**1C** — segunda do Lote 1; sem código.

## Execução

| Branch         | PR  | Migration | Testes                                 | CI  | Decisão                           | Status                |
| -------------- | --- | --------- | -------------------------------------- | --- | --------------------------------- | --------------------- |
| — (sem código) | —   | —         | EPI 18/18 integração; token unit verde | —   | Não migrar; fechar como resolvida | Fechada em 2026-09-16 |
