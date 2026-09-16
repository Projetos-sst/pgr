# #33 — [EPI] Assinatura digital ou QR Code na entrega de EPI

https://github.com/Projetos-sst/pgr/issues/33

> **POSSIVELMENTE JÁ RESOLVIDA** — os dois critérios funcionais são atendidos pelo fluxo próprio do EPI.

### Objetivo

Entrega de EPI gera pedido de assinatura (link/QR), captura a confirmação e mostra o status no histórico.
A issue sugere avaliar a infra genérica de assinatura.

### Estado atual no código (evidência)

- **Critério 1 — gerar link/QR e capturar confirmação:** botões em `employees/[id]/_components/delivery-signature.tsx:91-114` → `generateSignTokenAction` (`server/actions/pgr/epi-deliveries.ts:124-140`, URL + QR SVG); página pública `src/app/(public)/sign/[token]/page.tsx` (expirado/inválido/já assinado + pad); `signByToken` condicional em `repositories/epi-deliveries.ts:427-468`; assinatura manual (`signDeliveryManual`) e REST `api/v1/epi-deliveries/[id]/sign`.
- **Critério 2 — status visível no histórico:** badge com data em `delivery-signature.tsx:76-83`; coluna "Assinatura" na Ficha de EPI (`epi-record-table.tsx:159,172`, `repositories/employee-epi-record.ts:69,89`).
- Token HMAC stateless 72h (`integrations/epi-signature/token.ts`), guardado em `auth_token` só para revogação/uso único.
- Testes: `__tests__/unit/epi-signature-token.test.ts`; integração `epi-sign-public.test.ts` (QR, link, já assinado, cross-org, expirado, adulterado) e `epi-deliveries.test.ts` (manual, ALREADY_SIGNED, cross-tenant, não apaga assinada).

### O que já existe

Fluxo completo e testado.

### O que falta (só se decidirem unificar)

Registrar `epi_delivery` como `target_type` (`domains/signatures/contract.ts:13-18` + `ui/signature/form-registry.tsx`), migrar entregas existentes, guardar imagem da assinatura (hoje o pad é só gesto de consentimento, `signature-pad.tsx:8-12`), `signed_at` real (hoje derivado de `updated_at`), aparecer em `/signatures`. Não há E2E de EPI; o comentário em `tests/e2e/public-signature.spec.ts:70` cita rota antiga `/assinar`.

### Arquivos/domínios afetados

Nenhum para fechar. Se unificar: `epis.ts`, `epi-deliveries` (repo/actions/REST), rota pública, registry de assinatura.

### Backend / Frontend

Nenhum para fechar.

### Migration

NÃO para fechar; SIM (com migração de dados) se unificar.

### Testes necessários

Nenhum novo para fechar.

### Dependências

Nenhuma.

### Riscos

Unificação mexe em comprovação legal já emitida e em links distribuídos a funcionários.

### Requisitos faltantes

Decisão: fechar como resolvida ou abrir fatia de unificação.

### Dificuldade

1/5 para fechar (evidência + decisão). 4/5 se virar unificação.

### Prontidão

NEEDS PRODUCT DECISION

### Cobertura atual

75% — 100% dos critérios de aceite; o restante é a unificação arquitetural opcional.

### Lote recomendado

1 (evidência + decisão)

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
