# Issue #37 · Cliente de geração de PDF (integração Gotenberg)

**Objetivo:** módulo server-only que recebe HTML → POST ao Gotenberg → PDF → grava no
Supabase Storage particionado por org.

**Depende de:** #36. **Destrava:** #38, #39, #40.

## ⚠️ Tradução para o Modelo B

- `lib/pdf.ts` não existe no layout atual → `src/shared/pdf/` (cliente + tipos) e
  `src/shared/storage/` (helper Supabase Storage).
- Testes: Postgres efêmero/mocks — nunca SQLite.

## Setup escondido — primeiro uso de Supabase Storage no projeto

Hoje o repo fala com o Supabase só via Postgres. Esta fatia carrega:

- Criar bucket **privado** (ex.: `documents`).
- Nova dependência `@supabase/supabase-js` com service role key **server-only**.
- Novas envs: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

Merece destaque no spec (nova infra + novas envs).

## Decisões a cravar

1. **Fluxo:** template React → `renderToStaticMarkup` (isolar em módulo `server-only` —
   cuidado com o boundary do App Router) → `FormData` (`files: index.html`) →
   `POST {GOTENBERG_URL}/forms/chromium/convert/html` → `Buffer` → upload
   `<org_id>/documentos/...`.
2. **Contrato de erro:** novo código de domínio no padrão da casa — reusar o precedente
   `AI_UNAVAILABLE` (502, fatia 016) ou criar `PDF_UNAVAILABLE`. Timeout explícito
   (30–60s) + 1 retry de rede; nada de exceção crua vazando do `officeAction`.
3. **Separação testável (3 funções):**
   - `renderHtml(template, data)`
   - `convertHtmlToPdf(html)` — fetch mockável
   - `storePdf(orgId, path, buffer)`
     Unit sem Gotenberg/Supabase reais; integração com fetch mockado (padrão do LLM
     mockado da 016).
4. **Particionamento:** path **sempre** derivado do tenant da sessão no servidor,
   nunca do cliente (mesmo princípio do `withOrg`).
5. **Contrato para o #40:** expor parâmetros `header.html`/`footer.html` do multipart
   (cabeçalho ISO do #88, posicionamento topo/rodapé/ambos) — alinhar a assinatura do
   cliente com o template desde já.

## Risco a decidir agora

Assets no HTML (logo, fontes): o HTML precisa ser self-contained — imagens inline
(data URI) ou arquivos extras no multipart. O #40 (capa com logo) depende dessa decisão.

## Insumos para o /speckit-specify

- **Branch:** `feature/pdf-generation-client` (da issue)
- **User story (P1):** como sistema, preciso converter HTML em PDF para gerar os
  documentos da empresa.
- **Success criteria:** PDF salvo no Storage particionado por org; falha de serviço
  reportada como erro de domínio sem quebrar a aplicação.
- **Edge cases:** Gotenberg indisponível/timeout; HTML com asset externo; documento sem
  dados suficientes para o template.
- **Restrições:** Storage particionado por organização; chaves server-only.
