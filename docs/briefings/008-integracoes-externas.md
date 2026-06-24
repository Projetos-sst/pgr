# Briefing — Camada de integrações externas (ViaCEP + CNPJ)

> **Issue**: #68 · [Fase 00] 06 · Camada de integrações externas · `módulo: integrações` · `tipo: infra` · Milestone "Fase 00 — Fundação"
> **Branch da fatia**: `feature/external-integrations-layer`
> **Spec**: 008 (`.specs/008-external-integrations/`) · **Sem migration, sem tabela nova**
> **Consumidores**: formulários da 007 (empresa, unidade de obra, funcionário)

---

## 0. Decisões desta curadoria (o que muda em relação ao texto da issue)

| Tema                      | Texto da issue                                  | Decisão da fatia                                                                                                                                                                                                             | Porquê                                                                                                                                    |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Integrações               | ViaCEP + CNPJ + **CAEPI/MTE**                   | **Só ViaCEP + CNPJ**                                                                                                                                                                                                         | CAEPI valida CA de EPI; **não existe módulo/entidade de EPI** ainda → consumidor inexistente. CAEPI vira issue própria na Fase 02 (EPIs). |
| Provedor de CNPJ          | "receitaws.com.br ou similar"                   | **BrasilAPI** (`brasilapi.com.br/api/cnpj/v1`)                                                                                                                                                                               | Gratuito, **sem API key**, sem cadastro, limite generoso. ReceitaWS grátis é ~3 req/min e costuma exigir token pago.                      |
| Provedor de CEP           | ViaCEP                                          | **ViaCEP** (`viacep.com.br/ws`)                                                                                                                                                                                              | Padrão de mercado, sem key.                                                                                                               |
| Transporte                | Route Handler **ou** Server Action              | **Route Handler `GET`** + hooks `fetch` no `blur`                                                                                                                                                                            | Casa com lookup-on-blur, é cacheável por HTTP/Next, esconde a URL externa. Segue o padrão dos `api/v1`.                                   |
| "Isolamento multi-tenant" | exigido                                         | **N/A para armazenamento** — CEP/CNPJ são **dados públicos**, não dados do tenant. O que se aplica é **exigir sessão autenticada** (`requireAuth`) para o endpoint não virar proxy aberto, e **cache global** (não por org). | Não há dado de cliente trafegando; logo não há cruzamento de tenants a proteger.                                                          |
| Localização               | `features/integrations/` ou `lib/integrations/` | `src/shared/integrations/` + `src/app/api/integrations/`                                                                                                                                                                     | Os caminhos da issue **não existem** no repo; a estrutura real é `src/shared/` + `src/app/`.                                              |
| Teste de integração       | "SQLite em memória"                             | **`fetch` externo mockado, sem banco**                                                                                                                                                                                       | A fatia não persiste nada → não precisa de SQLite nem de Postgres efêmero.                                                                |

---

## 1. Objetivo

Entregar uma **camada de plataforma reutilizável** que, dado um CEP, autocompleta endereço; e dado
um CNPJ, autocompleta os dados cadastrais da empresa. Falha de API externa **nunca** bloqueia o
formulário (campo segue editável). Respostas são cacheadas para não gerar chamadas duplicadas.

---

## 2. Arquitetura (camadas, de dentro pra fora)

```
src/shared/integrations/
  providers/
    types.ts          # CepProvider, CnpjProvider, ProviderResult, DTOs internos
    viacep.ts         # implementa CepProvider
    brasilapi.ts      # implementa CnpjProvider
  cep.ts              # service: provider + unstable_cache (chave cep:<cep>)
  cnpj.ts             # service: provider + unstable_cache (chave cnpj:<cnpj>)
  validation.ts       # isValidCep, isValidCnpj (dígitos verificadores), normalizadores
  client/
    use-cep-lookup.ts   # hook React (blur → fetch /api/integrations/cep/[cep])
    use-cnpj-lookup.ts  # hook React (blur → fetch /api/integrations/cnpj/[cnpj])

src/app/api/integrations/
  cep/[cep]/route.ts    # GET, requireAuth, valida formato, chama service, devolve JSON ActionResult-like
  cnpj/[cnpj]/route.ts  # idem

src/app/(protected)/_ui/
  address-fields.tsx    # componente compartilhado com useCepLookup embutido
```

### 2.1 Providers (`providers/`)

- Interface tipada — **sem `any`**; valida o payload externo com **Zod** (`unknown` → DTO).
- `fetch` com **timeout** via `AbortController` (~3s). Traduz tudo em um resultado fechado:

```ts
type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_found" | "timeout" | "upstream_error" | "invalid_payload" };
```

- **ViaCEP** — `GET https://viacep.com.br/ws/{cep}/json/`
  - Resposta: `{ logradouro, bairro, localidade, uf, cep, complemento, erro? }`
  - `erro: true` (ou 400) → `not_found`.
  - Mapeia para DTO interno → colunas de endereço: `street=logradouro`, `district=bairro`,
    `city=localidade`, `state=uf`, `zipCode=cep`, `complement=complemento`.
- **BrasilAPI CNPJ** — `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
  - Campos úteis: `razao_social`, `nome_fantasia`, `cnae_fiscal`, `cnae_fiscal_descricao`,
    `descricao_situacao_cadastral`, `logradouro`, `numero`, `complemento`, `bairro`, `municipio`,
    `uf`, `cep`.
  - 404 → `not_found`. Mapeia para DTO de empresa + endereço.

### 2.2 Service (`cep.ts`, `cnpj.ts`)

- Orquestra o provider e aplica **cache** com `unstable_cache` do Next.
  - Chave: `["integrations","cep",<cep>]` / `["integrations","cnpj",<cnpj>]`.
  - `revalidate`: **CEP ~30 dias**, **CNPJ ~7 dias** (situação cadastral muda). Cache **global**.
- Só cacheia resultado **`ok`**; `not_found`/erros **não** entram em cache (evita "congelar" falha).

### 2.3 Route Handlers (`app/api/integrations/...`)

- `export const runtime = "nodejs"`.
- **Guard**: `await requireAuth()` (sessão Clerk; **não** precisa de tenant/papel — não há dado de
  cliente). `UnauthorizedError` → 401.
- **Valida o formato ANTES de chamar o service** (`isValidCep`/`isValidCnpj`) — evita request
  externo inútil; formato inválido → `fail("VALIDATION", ...)` (HTTP 422).
- Resposta no formato `ActionResult<T>` (reusar `ok()`/`fail()` de `@/shared/server/result`):
  - sucesso → `ok(dto)`;
  - não encontrado → `fail("NOT_FOUND", "...")` (HTTP 404);
  - timeout/erro upstream → `fail("UPSTREAM_ERROR", "...")` (HTTP 502) — **e o hook trata como
    silencioso, sem travar o form**.
- `Cache-Control` no response para o navegador deduplicar em sequência rápida.

### 2.4 Hooks (`client/`)

- `useCepLookup()` e `useCnpjLookup()` retornam `{ status: "idle"|"loading"|"success"|"error", data?, lookup(value) }`.
- Disparam **no `blur`**, só se `isValidCep/Cnpj` → evita chamada desnecessária.
- **Abortam** request anterior (AbortController) em digitação rápida.
- Erro/timeout → `status: "error"` **silencioso**: o campo permanece editável; sem exceção
  não capturada.

---

## 3. Consumidores nesta fatia

1. **`AddressFields` (novo, compartilhado)** — `src/app/(protected)/_ui/address-fields.tsx`
   - Renderiza CEP/street/number/complement/district/city/state com `useCepLookup` embutido.
   - **Refatora** `company-form.tsx`, `work-unit-form.tsx`, `employee-form.tsx` para usá-lo —
     elimina a duplicação dos campos de endereço (3×) e centraliza o autofill de CEP.
2. **`useCnpjLookup` no `company-form.tsx`** — no `blur` do campo CNPJ, preenche `razao_social`,
   `nome_fantasia`, `cnae`, `main_activity` e o endereço da empresa.

> Os três forms já existem (007). Mapear os campos preenchidos para o estado controlado de cada form.

---

## 4. Validação (lógica de negócio — alvo de teste unitário)

- **CEP**: 8 dígitos (após remover máscara). `isValidCep`.
- **CNPJ**: 14 dígitos + **dígitos verificadores** (algoritmo módulo 11). `isValidCnpj` —
  rejeita sequências repetidas (`00000000000000`).
- Normalizadores: removem máscara antes de validar/consultar.

---

## 5. Edge cases (cobrir nos testes e na UX)

| Caso                                              | Comportamento                                         |
| ------------------------------------------------- | ----------------------------------------------------- |
| CNPJ válido sem dados (MEI incompleto)            | sucesso parcial — preenche o que veio, resto editável |
| CEP válido sem logradouro (CEP de grande usuário) | preenche cidade/UF; street fica editável              |
| Timeout / sem rede                                | `status: error` silencioso; campo editável; sem throw |
| Rate-limit do provider                            | tratado como `upstream_error` (502) → silencioso      |
| Formato inválido                                  | nem chama o provider (422); hook não dispara          |
| Digitação rápida (vários blur)                    | aborta request anterior; cache dedup                  |

---

## 6. Testes (obrigatório — fatia não fecha sem)

- **Unit** (`src/__tests__/unit/...`):
  - `isValidCep` / `isValidCnpj` (incl. dígitos verificadores e sequências repetidas);
  - normalização de máscara;
  - mapeamento payload ViaCEP → DTO endereço; payload BrasilAPI → DTO empresa+endereço;
  - mapeamento de erro do provider (`not_found`/`timeout`/`invalid_payload`).
- **Integração** (`src/__tests__/integration/...`): route handlers com **`fetch` global mockado**
  (`jest.spyOn(global, "fetch")`):
  - sucesso (200) → 200 `ok(dto)`;
  - 404 → 404 `fail("NOT_FOUND")`;
  - timeout (AbortError) → 502 `fail("UPSTREAM_ERROR")`;
  - payload inválido → 502;
  - formato inválido → 422 (sem chamar fetch);
  - **sem sessão → 401** (guard `requireAuth`).
  - **Não toca banco** → sem Postgres efêmero, sem SQLite.
- `npm run test` + `npm run test:integration` verdes; `npm run lint` + types verdes.

---

## 7. Critérios de aceite (da issue, mapeados)

- [ ] CEP válido autocompleta logradouro, bairro, cidade e UF (via `AddressFields`).
- [ ] CNPJ válido autocompleta razão social, nome fantasia e endereço (company-form).
- [ ] Falha da API externa **não bloqueia** o form (campo editável).
- [ ] Respostas cacheadas — sem chamadas duplicadas em sequência rápida.
- [ ] Timeout/erro de rede tratados sem exceção não capturada.
- [ ] Endpoint exige sessão (não é proxy aberto).

---

## 8. Fora de escopo (não fazer nesta fatia)

- **CAEPI/MTE** (validação de CA) → issue própria na Fase 02 — EPIs (criada).
- Persistência de qualquer dado externo (a fatia só lê e preenche).
- Lookup de CBO, upload, ViaCEP reverso.

---

## 9. Ordem de implementação sugerida

1. `providers/types.ts` + `validation.ts` (+ testes unit de validação).
2. `viacep.ts` / `brasilapi.ts` (+ testes unit de mapeamento, fetch mockado).
3. `cep.ts` / `cnpj.ts` (service + `unstable_cache`).
4. Route handlers `cep/[cep]` e `cnpj/[cnpj]` (+ testes integração com fetch mockado).
5. Hooks `use-cep-lookup` / `use-cnpj-lookup`.
6. `AddressFields` compartilhado + refactor dos 3 forms.
7. `useCnpjLookup` no company-form.
8. Lint/types/test verdes.

---

## 10. Referências no repo

- Contrato de retorno: `src/shared/server/result.ts` (`ActionResult`, `ok`, `fail`).
- Auth de sessão: `src/shared/auth/require-auth.ts` (`requireAuth`).
- Padrão de route handler: `src/app/api/v1/companies/route.ts`.
- Endereço (colunas): `src/shared/db/schema/address-columns.ts`.
- Forms consumidores: `src/app/(protected)/{companies,work-units,employees}/_components/*-form.tsx`.
