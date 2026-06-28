# Quickstart — Entrega de EPI com assinatura digital (011)

Guia de validação ponta a ponta. Detalhes de contrato/modelo em `contracts/` e `data-model.md`.

## Pré-requisitos

- Branch `feature/ppe-delivery-with-signature` (empilhada sobre 008→009→010).
- Modelo 008 aplicado (migration `0007`) — **zero migration** nesta fatia.
- `npm install`; `.env.local` configurado (Clerk + Supabase). Para integração: `INTEGRATION_*`
  apontando para **Postgres efêmero** (nunca o banco de dev).

## Subir o app

```bash
npm run dev   # http://localhost:3000
```

## Cenário 1 — MVP interno (US1 + US3): entrega + assinatura manual + baixa

1. Garanta itens de `epi_stock` com `balance > 0` (use a UI da 009/010 ou o seed de teste).
2. Acesse o funcionário → "Entregar EPI" (`/employees/[id]/epi-delivery`).
3. Selecione 2 itens, informe quantidades, "Revisar e confirmar" → "Autenticar".
4. Aba **Assinatura Manual** → "Registrar assinatura manual".
5. **Esperado**: status `signed_manual`; 1 `stock_movements(employee_delivery)` por item (com
   `delivery_id`); `epi_stock.balance` de cada item reduzido pela quantidade; aviso se ficar abaixo da
   mínima. Tente quantidade > saldo → **recusa + rollback total** (nada gravado).

## Cenário 2 — QR + rota pública (US2)

1. Crie a entrega (passos 2–3) e abra a aba **QR Code** → painel "Aguardando confirmação…" (polling).
2. Abra `/epi-deliveries/sign/[token]` em uma aba **anônima** (sem login).
3. **Esperado**: a página mostra apenas funcionário/itens/data; "Confirmar recebimento" baixa o
   estoque na org correta e marca `signed_qr`; o painel do gestor reflete a confirmação.
4. Token inexistente → 404; reusar token após assinar → 409; token > 72h → 410.

## Cenário 3 — Enviar Link (US2, sem provider)

1. Aba **Enviar Link** → o sistema **gera/exibe** o link (não envia). Funcionário sem e-mail/telefone
   → orienta completar o cadastro.

## Quality gate

```bash
npm run lint
npx tsc --noEmit
npm run test               # unit: schemas, helper de baixa, máquina de estados, token/expiração
npm run test:integration   # Postgres efêmero: actions internas + rota pública + ISOLAMENTO (interno e público)
```

Critérios em `spec.md` › Success Criteria (SC-001…SC-006) e Acceptance Scenarios.
