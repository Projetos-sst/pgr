# Roteiro de testes — Release `develop` → `main` (Fase 00 + Fase 02 / EPI)

Checklist manual para validar tudo antes do merge. Cobre os 13 itens do board "In review":
Fase 00 (#67, #68) + Fase 02 / EPI (#17, #73, #18, #70, #72, #19, #20, #21, #75, #115).

> Marque `[x]` conforme for passando. Se algo falhar, anote o item e **não** promova para `main`.

---

## 0. Pré-requisitos (rodar uma vez)

- [x] `.env` com `DATABASE_URL` + `DATABASE_URL_UNPOOLED` (dev) e `EPI_SIGN_TOKEN_SECRET` (string longa aleatória).
- [x] Para testar API via Postman/cURL: `DEV_API_AUTH_BYPASS=true` no `.env`.
- [x] `npm run db:migrate` — confirma que subiu até **`0012_pgr_risk_data_model`** (migrations `0007`→`0012` são deste release).
- [x] `npm run dev` → app em http://localhost:3000, login e tenant ativo OK.
- [x] **CAEPI**: tabela `caepi_certificates` populada (`npx tsx scripts/caepi-sync.ts` ou `--file`). Sem isso, toda consulta de CA volta `not_found` (esperado, mas impede validar autofill).

### Gate automatizado (bloqueia release se vermelho)

- [x] `npm run check` (format + lint + typecheck + unit) — **verde**.
- [x] `npm run test:integration` (Postgres efêmero) — **verde**.

---

## 1. Fase 00 · #68 — Integrações externas (ViaCEP / CNPJ / CAEPI)

Rotas: `GET /api/integrations/cep/[cep]`, `/cnpj/[cnpj]`, `/caepi/[ca]` (session-guarded, sem tenant).

- [x] **CEP válido** — em `/companies/new` (ou `/work-units/new`), digitar CEP existente → endereço autopreenche.
- [x] **CEP inexistente** — não quebra o form; permite digitar manualmente.
- [x] **CNPJ válido** — no cadastro de empresa, consultar CNPJ → razão social/dados autopreenchem.
- [x] **CNPJ inválido** — mensagem de erro amigável, sem travar o cadastro.
- [x] **API direta** — `GET /api/integrations/cep/01001000` autenticado retorna 200 com payload; sem login → 401/redirect.

## 2. Fase 00 · #67 — Infraestrutura de assinatura digital (link + token + QR + captura)

Rota interna: `/signatures` · Rota pública (sem login): `/assinar/[token]`.

- [x] `/signatures` → **"Gerar link/QR"** para o **Termo de demonstração** (`demo`); status inicia **Aguardando**.
- [x] **"Copiar link"** copia a URL; QR Code aparece.
- [x] Abrir `/assinar/<token>` em **aba anônima (sem login)** → assinar no canvas → confirmar.
- [x] Voltar em `/signatures` → status vira **Assinado** (por polling, ~3–5s).
- [x] **Token expirado / reuso** — reabrir o mesmo link após assinado → bloqueado (uso único).
- [x] **Assinatura manual** — registrar nome de quem assinou → status **Assinado**.
- [x] **Quota plano `free`** — no 11º pedido do mês → erro de quota (REST 402); plano `pro` ilimitado.

## 3. Fase 02 · #17 — Modelo de dados (Catálogo / Estoque / Entregas)

Fundação; validar via os CRUDs abaixo + migrations.

- [x] Migrations `0007_epi_data_model` e `0008_epi_catalog_type_fk` aplicadas sem erro.
- [x] Isolamento: nenhuma tela de EPI mostra dado de outro tenant (trocar de tenant no switcher e conferir).

## 4. Fase 02 · #73 — CRUD de Categorias

Menu **Categorias** (`/categories`).

- [x] **Criar** categoria (`epi` ou `machine`) → aparece na lista.
- [x] **Editar** nome → persiste.
- [x] **Duplicada** (mesmo tipo+nome no tenant) → erro **DUPLICATE** (não cria).
- [x] **Filtrar** por tipo e buscar por nome → resultados corretos; paginação (20/página).
- [x] **Excluir** → some da lista.

## 5. Fase 02 · #18 — CRUD de Catálogo de EPI (+ #115 validação de CA embutida)

Menu **Catálogo de EPI** (`/epi-catalog`).

- [x] **Criar** item de catálogo com categoria (`epi`) → salva.
- [x] **Campo CA** — digitar CA **vigente** e sair do campo → fabricante/norma/validade **autopreenchem** + badge **CA válido**.
- [x] CA **vencido** → indica expirado; CA **inexistente** → aviso, **mas permite salvar mesmo assim** (nunca bloqueia).
- [x] **Editar** e **excluir** item do catálogo.

## 6. Fase 02 · #75/#115 — Consulta/validação de CA na CAEPI/MTE

Consulta **100% local** (tabela espelho). REST: `GET /api/integrations/caepi/[ca]`.

- [x] CA existente e vigente → `valid` (200) com fabricante/norma/validade.
- [x] CA existente vencido → `expired` (200).
- [x] CA inexistente → `not_found` (200, payload — não é erro HTTP).
- [x] Regra de vigência respeita fuso `America/Sao_Paulo` (validade = hoje ainda é válido, inclusivo).

## 7. Fase 02 · #70 — CRUD de Estoque de EPI

Menu **Estoque de EPI** (`/epi-stock`).

- [x] **Criar** registro de estoque; `balance` inicia conforme regra (**read-only** na tela).
- [x] **Editar** metadados; **excluir** (checar aviso de dependentes se houver movimentações).
- [x] Não é possível editar `balance` diretamente pela tela.

## 8. Fase 02 · #72 — Movimentações de estoque (entrada / saída + histórico)

Rota: `/epi-stock/[id]/history`. REST: `POST/GET /api/v1/epi-stock/[id]/movements`.

- [x] **Entrada (compra)** com `quantity > 0` → saldo **sobe**.
- [x] **Saída manual** (`adjustment`/`discard`) → saldo **desce**.
- [x] **Saída maior que o saldo** → bloqueada com **INSUFFICIENT_STOCK** (422); saldo **não** muda (rollback).
- [x] **`quantity = 0` ou negativo** → rejeitado.
- [x] **Histórico** mostra a lista com **saldo resultante derivado** por linha, em ordem.

## 9. Fase 02 · #19 — Entrega de EPI com assinatura (manual + QR/link)

Página do funcionário: **Funcionários → [funcionário]** (`/employees/[id]`).

- [x] **"Entregar EPI"** → **"Preparar entrega"** → buscar por CA/nome, marcar itens **com saldo**, definir quantidade → **"Confirmar entrega"**.
- [x] Saldo do estoque dos itens entregues **cai** na hora.
- [x] Entrega criada como **Aguardando confirmação** (`pending`).
- [x] **"Registrar assinatura manual"** → status vira **Assinado**.
- [x] **"Gerar QR"** / **"Gerar link"** → mostra QR + URL + "válido por 72h".
- [x] Abrir `/sign/<token>` em **aba anônima (sem login)** → assinar → painel da entrega reflete **Assinado** por polling.
- [x] **Assinar de novo** o mesmo token → **ALREADY_SIGNED** (409); token inválido → **TOKEN_INVALID** (404); token > 72h → **TOKEN_EXPIRED** (410).

## 10. Fase 02 · #20 — Devolução de EPI (+ reposição de estoque)

Migration `0011_epi_delivery_return`. Menu **Devoluções de EPI** (`/epi-returns`) + botão **"Devolver"** na ficha.

- [x] **"Devolver"** um item entregue → saldo do estoque **sobe** (reposição).
- [x] **2ª devolução do mesmo item** → bloqueada com **ALREADY_RETURNED** (409).
- [x] Item devolvido mostra **Data de Devolução** preenchida.

## 11. Fase 02 · #21 — Histórico / Ficha de EPI por funcionário

Página do funcionário → tabela **Ficha de EPI** (read-only).

- [x] Lista entregas com **Data de Entrega**, **Qtd.**, **Tam.**, **Assinatura**, **Data de Devolução**.
- [x] **Filtro** por status (**Todos / Em uso (não devolvido) / Devolvido**) e por período.
- [x] **Imprimir** gera layout limpo (print CSS).
- [x] REST: `GET /api/v1/employees/[id]/epi-record` retorna a ficha do funcionário.

---

## 12. Isolamento multi-tenant & autorização (transversal — obrigatório)

- [x] Logado no **Tenant A**, nenhuma lista de EPI/estoque/entregas mostra dados do **Tenant B**.
- [x] Papel **`client`** em ação de escrita → **FORBIDDEN** (403).
- [x] Chamada REST **sem login** (e sem bypass) a `/api/v1/*` → **307/redirect** (não vaza dados).
- [x] Rota pública `/sign/[token]` e `/assinar/[token]` **não** exigem login — isolamento vem **do token**, não do cliente.

## 13. Sanidade final antes do merge

- [ ] `git status` limpo; branch = `develop`.
- [x] `npm run build` conclui sem erro.
- [x] Postman: coleção `docs/api/sst-manager.postman_collection.json` importada; pastas `epi-deliveries`, `epi-record`, `sign` respondem.
- [ ] Todos os checkboxes acima marcados → **liberar PR `develop` → `main`**.
