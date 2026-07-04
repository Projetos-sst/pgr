# Quickstart — Fase 02 (módulo EPI)

Como validar a fatia localmente. Pré-requisito: `.env` com `DATABASE_URL`/`DATABASE_URL_UNPOOLED` (dev) e
`INTEGRATION_DATABASE_URL` (Postgres efêmero) para integração. Novo segredo: `EPI_SIGN_TOKEN_SECRET`
(qualquer string longa aleatória) para o token de assinatura.

## 1. Migration (US4)
```bash
npm run db:generate      # emite 0010 a partir do schema (editar p/ ADD VALUE IF NOT EXISTS + statement-breakpoint)
npm run db:migrate       # aplica via conexão owner (unpooled)
```
Confirme: `stock_movement_type` tem `employee_return`; `epi_delivery_items` tem `returned_at`.

## 2. Rodar
```bash
npm run dev              # http://localhost:3000
```

## 3. Fluxos manuais
- **US1**: `/epi-catalog/new` → digitar um CA vigente → sair do campo → fabricante/norma/validade
  autopreenchidos + badge "CA válido". CA inexistente → aviso, salvar mesmo assim.
- **US2**: página de um funcionário → "Entregar EPI" → selecionar itens com saldo → confirmar → saldo cai;
  entrega criada "pendente" → "Registrar assinatura manual".
- **US3**: na entrega pendente → "Gerar QR/link" → abrir `/sign/<token>` numa aba anônima (sem login) →
  assinar → painel da entrega reflete `signed_qr/link` por polling.
- **US4**: na entrega → "Devolver" um item → saldo sobe; 2ª devolução do mesmo item → barrada.
- **US5**: página do funcionário → "Ficha de EPI" → filtrar por status/período → "Imprimir".

## 4. Testes (gate da constituição)
```bash
npm run check            # format + lint + typecheck + unit
npm run test:integration # Postgres efêmero (INTEGRATION_*), nunca SQLite
```

## 5. API (Postman/cURL)
Importar `docs/api/sst-manager.postman_collection.json` (pastas novas: `epi-deliveries`, `epi-record`,
`sign`). Fora de produção, usar o dev bypass: headers `x-dev-tenant`/`x-dev-role`/`x-dev-user` com
`DEV_API_AUTH_BYPASS=true`. A rota pública `/sign/[token]` **não** usa bypass — só o token.

## Checklist de "fatia pronta"
- [ ] US1–US5 demonstráveis; migration `0010` aplicada e reversível.
- [ ] Cada recurso novo tem os 4: Server Action + REST + `api-design.md` + Postman.
- [ ] `npm run check` e `npm run test:integration` verdes.
- [ ] Nenhum dado cruza tenant (testes de isolamento + `FORBIDDEN` para `client` + GRANT/RLS por papel).
- [ ] Housekeeping: fechar #70/#72; #18/#115 concluídas; #75 duplicada de #115.
