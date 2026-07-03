# Brainstorming — Ingestão da base CAEPI (download periódico do MTE)

> **Escopo desta etapa:** pensar a solução. Nada de código. Depois este documento + o briefing
> [`115-caepi-validacao-ca.md`](./115-caepi-validacao-ca.md) viram o anexo do prompt para o Specify.
>
> **Norte:** KISS · DRY · YAGNI. A solução mais simples que resolve; reusar o que já existe; **não**
> construir nada especulativo.
>
> **Contexto:** por que ingestão local (e não consulta ao vivo) já está decidido e provado em
> [`caepi-logica-de-negocio.md`](./caepi-logica-de-negocio.md) — o proxy ao vivo do ePGR está
> **403-quebrado**. Aqui tratamos só do **robô que forma a nossa base**.
>
> ⚠️ **Este documento foi atualizado após o Spike 0 (02/07/2026).** A investigação real mudou o
> desenho: a fonte **não** é baixável por `fetch` simples e **não** é um TXT `|` — ver §3.

---

## 1. Problema

Manter uma tabela **global** `caepi_certificates` (espelho do MTE, sem `org_id`, só leitura para o
app) **atualizada de tempos em tempos**, a partir do **arquivo oficial** ("Base de dados do sistema
CAEPI — Download"), para que a consulta de CA do usuário seja um `SELECT` local rápido.

**Uma frase:** obter o arquivo oficial → transformar em linhas → gravar/atualizar na nossa base, de
forma **idempotente** e **à prova de falha**, fora do caminho do usuário.

---

## 2. O que já sabemos (restrições e fatos)

- A fonte **não é uma API** — é um **arquivo** gerado sob demanda pelo portal do MTE.
- A tabela é **global e pública** → **sem `withOrg`, sem RLS de tenant** (exceção justificada). Só o
  robô escreve; o app só lê.
- O portal **bloqueia clientes não-browser** (Cloudflare) — confirmado no Spike 0.

---

## 3. Spike 0 — RESULTADO (concluído em 02/07/2026)

Investigação real (curl + browser). **Como a fonte funciona hoje:**

1. **Redirecionamento de domínio:** `caepi.mte.gov.br` → `301` → **`caepi.trabalho.gov.br`**.
2. **Cloudflare com desafio JS:** requisição não-browser recebe `403` com `cf-mitigated: challenge`.
   `curl`/`fetch`/`undici` **não passam** (é o mesmo bloqueio que quebra o proxy do ePGR). Um
   **browser real** (Chromium) resolve o desafio e obtém o cookie `cf_clearance`.
3. **Download = postback ASP.NET WebForms:** na página
   `https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx`, o link "Base de dados do sistema
   CAEPI (Download)" é `__doPostBack('ctl00$PlaceHolderConteudo$LinkButton1','')`. Exige os campos
   ocultos **`__VIEWSTATE`** (~349 KB), `__VIEWSTATEGENERATOR` e `__EVENTVALIDATION` da página.
4. **Resposta:** `HTTP 200`, `Content-Type: application/gzip`,
   `Content-Disposition: attachment; filename=RelatorioCA_AAAAMMDD_HHMMSS.csv.gz` (gerado na hora,
   com timestamp). Assinatura de bytes `1f 8b 08` = **gzip** válido.
5. **Conteúdo descompactado:** um **CSV**, com estas características **confirmadas**:
   - **Separador `;`** (ponto e vírgula), **campos entre aspas `"`** com escape `""` (há `;` e
     quebras de linha _dentro_ das aspas → **exige parser CSV de verdade**, não `split`).
   - **Encoding UTF-8 com BOM** (aparece BOM no início; decodificar como UTF-8 e **remover o BOM**).
   - **19 colunas** (cabeçalho real):

   ```
   NR Registro CA ; DATA DE VALIDADE ; SITUACAO ; NR DO PROCESSO ; CNPJ ; RAZAO SOCIAL ;
   NATUREZA ; EQUIPAMENTO ; DESCRICAO EQUIPAMENTO ; MARCA CA ; REFERENCIA ; COR ;
   APROVADO PARA LAUDO ; RESTRICAO LAUDO ; OBSERVACAO ANALISE LAUDO ; CNPJ LABORATORIO ;
   RAZAO SOCIAL LABORATORIO ; NR LAUDO ; NORMA
   ```

   - `DATA DE VALIDADE` = `dd/mm/aaaa`. `SITUACAO` ∈ {`VÁLIDO`, `VENCIDO`, …}.

### O que o Spike 0 derrubou

- ❌ "**`download.ts` = `fetch` com User-Agent**" — **não funciona**: precisa de **browser real** para
  vencer o Cloudflare + fazer o postback com VIEWSTATE.
- ❌ "**parser split por `|`**" — **errado**: é **CSV `;` com aspas**, UTF-8 BOM. Precisa de parser CSV
  que respeite aspas/escape.

### Risco residual a confirmar na implementação

- **Risco 1 — headless em IP de datacenter passar o Cloudflare.** O browser **headed** (via MCP, IP
  residencial) passou. Falta confirmar **headless** num **runner de CI**. Mitigações: `playwright` +
  browser real (não `--headless=old`), user-agent/locale coerentes, retry. **Baixa frequência
  (semanal/quinzenal — ver D6) reduz a exposição** a ser sinalizado como bot. Se ainda assim não
  passar → fallback semi-manual (§8).
- **Risco 3 — o portal mudar (ASP.NET/Cloudflare/nome de campo) — ACEITO, sem prevenção.** É inerente
  a depender de um portal de terceiro sem contrato. Não dá pra evitar; o que fazemos é **conter o
  dano**: (a) toda a fragilidade fica isolada em `collect.ts` (só um arquivo a consertar quando
  quebrar); (b) o job **falha alto** (log/alerta) quando a coleta quebra, para alguém perceber e
  ajustar — em vez de servir base defasada em silêncio; (c) enquanto isso, o **fail-safe** (D5) mantém
  a base anterior e a **validação nunca bloqueia** o cadastro → **usuário não é afetado**; (d)
  fallback semi-manual (§8) sempre disponível.

---

## 4. Arquitetura proposta (revisada pós-Spike)

Duas responsabilidades, decopladas por um **arquivo intermediário** (o `.csv.gz`):

```
  ┌──────────────────────── COLETOR (precisa de browser) ────────────────────────┐
  │ Playwright/Chromium:                                                          │
  │   1. abre ConsultaCAInternet.aspx (passa Cloudflare, pega VIEWSTATE)          │
  │   2. dispara o postback do "Download"                                         │
  │   3. captura o RelatorioCA_*.csv.gz                                           │
  └───────────────────────────────┬──────────────────────────────────────────────┘
                                   │  arquivo .csv.gz
                                   ▼
  ┌──────────────────────── INGESTOR (puro + banco, testável) ───────────────────┐
  │  gunzip  →  parse CSV (";", aspas, UTF-8 BOM)  →  map p/ CaCertificate (Zod)  │
  │          →  caepi-repository.upsertMany(rows)  (onConflictDoUpdate por `ca`)  │
  └──────────────────────────────────────────────────────────────────────────────┘
```

Peças (cada uma com **uma** responsabilidade):

- **`caepi/collect.ts`** — o **único** passo que usa browser. Isola toda a fragilidade
  (Cloudflare/ASP.NET) num lugar só. Entrada: nada; saída: caminho do `.csv.gz` (ou stream).
- **`caepi/parse.ts`** — **função pura**, sem I/O: recebe o conteúdo (stream de texto) e devolve
  linhas tipadas (Zod), descartando linha corrompida com log. **Coração testável (unit).** Usa um
  parser CSV que respeita aspas/escape (lib madura, ver §6 — não escrever CSV na mão).
- **`caepi-repository.ts`** — `getByCa(ca)` (consulta do usuário) + `upsertMany(rows)` (o robô). Todo
  SQL fica aqui.
- **`scripts/caepi-sync.ts`** — orquestra `collect → parse → upsertMany`. **É o job agendado.**
- **Bootstrap** = o **mesmo** `scripts/caepi-sync.ts` rodado à mão uma vez. **DRY** total.

> **Mudança de decisão (KISS/YAGNI):** o rascunho previa um Route Handler `/api/cron/caepi-sync`
> guardado por `CRON_SECRET`, disparado por Vercel Cron. **Descartado:** uma função serverless
> **não** roda Chromium com conforto nem cabe no timeout para baixar+parsear a base inteira. Um
> **script agendado com browser** é mais simples e não expõe endpoint nenhum — então **não há
> endpoint HTTP nem `CRON_SECRET`** para este job. Menos peças.

---

## 5. Decisões de design (opções + recomendação KISS)

### D1 · Como escrever: **upsert idempotente** ✅

`INSERT … ON CONFLICT (ca) DO UPDATE`. Rodar 2× não duplica; a base **nunca fica vazia** no meio.
Descartados truncate-reload (janela vazia) e diff incremental (over-engineering — o arquivo já é o
snapshot completo). **YAGNI.**

### D2 · Como ler: **streaming** ✅ (definido pelo Spike)

O CSV é grande (base nacional; gzip transmitido em chunks, sem `content-length`). Ler
**descompactando + parseando em stream, linha a linha**, sem carregar tudo na memória. Node faz
gunzip nativo (`zlib.createGunzip()`); o parser CSV consome o stream.

### D3 · Onde roda: **runner com browser agendado** ✅ (definido pelo Spike)

Precisa de Chromium → **não** é Vercel serverless. Recomendado: **workflow agendado (ex.: GitHub
Actions cron)** rodando `scripts/caepi-sync.ts` com Playwright, credenciais de banco como secrets.
Alternativas equivalentes: container/VM com cron. **Confirmar com o time** onde jobs agendados devem
morar — mas o formato (script + browser + schedule) está fechado.

### D4 · Carga inicial (bootstrap): **o mesmo script**, rodado à mão

Sem lógica nova. Roda `caepi-sync.ts` uma vez para popular; depois o schedule cuida do refresh.

### D5 · Falha: **idempotente e não-destrutivo** ✅

Coleta falhou (Cloudflare/timeout/gzip truncado) → **loga e sai**, **mantém** a base anterior. Próxima
execução tenta de novo, sem efeito colateral.

### D6 · Cadência: **1× por semana (ou a cada 15 dias)** ✅

A base do MTE **atualiza devagar** — sincronizar diariamente é desperdício. **Semanal ou quinzenal**
é o suficiente e é a decisão certa por si só (KISS/YAGNI).

Efeito colateral positivo no risco de bloqueio: **menos requisições = menor exposição** a ser
sinalizado como bot (reputação de IP/tráfego). ⚠️ Ressalva honesta: baixa frequência **não** deixa
cada desafio individual do Cloudflare mais fácil — todo request ainda enfrenta o desafio, que o
browser real resolve. Ou seja, ajuda a **não chamar atenção**, não a **passar mais fácil**.

### D7 · CA cancelado/vencido: **coluna `situation`, sem delete** ✅

O CSV traz `SITUACAO` + `DATA DE VALIDADE` por linha. O upsert atualiza in-place. **Não deletamos** —
"vencido/cancelado" é estado. A regra válido/vencido é derivada na **consulta** (`validate-ca.ts`),
com base em `situation` + `valid_until` vs. hoje. **YAGNI** para soft-delete.

### D8 · Colunas que guardamos: **só o que a consulta usa** (YAGNI)

Das 19 do CSV, mapeamos o essencial; o resto é ignorado:

| Coluna no CSV                                                    | Campo na tabela          | Uso                   |
| ---------------------------------------------------------------- | ------------------------ | --------------------- |
| `NR Registro CA`                                                 | `ca` (unique)            | chave da consulta     |
| `DATA DE VALIDADE`                                               | `valid_until` (date)     | válido vs vencido     |
| `SITUACAO`                                                       | `situation`              | estado cadastral      |
| `CNPJ` / `RAZAO SOCIAL`                                          | `manufacturer_cnpj/name` | autofill fabricante   |
| `NATUREZA`                                                       | `nature`                 | contexto              |
| `EQUIPAMENTO`                                                    | `equipment_name`         | contexto/descrição    |
| `DESCRICAO EQUIPAMENTO`                                          | `description`            | contexto              |
| `NORMA`                                                          | `norms`                  | autofill norma        |
| _(demais: processo, marca, referência, cor, laudo, laboratório)_ | —                        | **ignoradas (YAGNI)** |

---

## 6. Design patterns (e o que evitamos)

**Aplicam:**

- **Idempotent upsert** — rodar N vezes = 1 vez (D1).
- **Pure function + adapter** — `parse.ts` puro (testável) separado do I/O (`collect`, repo). Espelha
  a separação de CEP/CNPJ. **DRY.**
- **Fail-safe job** — falha preserva o último estado bom (D5).
- **Anti-corruption / isolamento da fonte** — `collect.ts` esconde toda a bagunça
  (Cloudflare/VIEWSTATE/gzip); trocar a origem (Plano B) não toca no resto.
- **Reuse de parser maduro** — usar uma lib de CSV consolidada (respeita aspas/escape/encoding) em vez
  de parsear CSV na mão. **DRY / não reinventar.**

**Evitamos de propósito (YAGNI):**

- ❌ Endpoint HTTP + `CRON_SECRET` (não há função serverless neste job — ver §4).
- ❌ Fila/broker, worker dedicado, microserviço.
- ❌ Engine de diff/versionamento de CA; histórico de mudanças.
- ❌ Cache/CDN/réplica da base; UI administrativa.
- ❌ Burlar Cloudflare por engenharia reversa de token — usamos **browser real** (honesto e robusto),
  não replicação de `cf_clearance`.

---

## 7. Tabela `caepi_certificates` (mínimo — detalhe no briefing 115)

Global, sem `org_id`, sem RLS de tenant. Colunas: `ca` (unique), `valid_until` (date), `situation`
(text), `manufacturer_name`, `manufacturer_cnpj`, `equipment_name`, `description`, `nature`, `norms`,
`synced_at`. Índice por `ca`. **1 migração nova.** `synced_at` = marcador de frescor (permite avisar
"base nunca sincronizada" / "defasada" sem lógica extra).

---

## 8. Plano B (registrar, não implementar)

Se o runner headless **não** passar o Cloudflare de forma estável:

1. Mirror/dataset aberto que espelhe a base (validar procedência/atualidade). `dados.gov.br` não
   retornou dataset direto no spike — investigar se há distribuição oficial alternativa.
2. Última opção: API paga de terceiro (sem SLA). Só se 1 falhar.

Nenhuma muda o desenho — troca **só** o `collect.ts` (origem do arquivo). Por isso ele fica isolado.

---

## 9. Testes (o que exigir)

- **Unit:** `parse.ts` com **amostra real** do CSV (linha ok; aspas com `;` e quebra de linha
  internas; BOM; acento UTF-8; linha corrompida → descartada); mapeamento CSV→`CaCertificate` (3
  estados); `validate-ca.ts` (válido/vencido no limite = hoje); `normalize.ts`.
- **Integração (Postgres efêmero, nunca SQLite):** `upsertMany` **idempotente** (2× sem duplicar);
  falha de coleta → base preservada; `getByCa` → válido/vencido/inexistente.
- **Coleta (`collect.ts`):** difícil de testar em unit (depende de browser/rede) → validar por
  execução real no bootstrap; no CI, mockar a saída (arquivo `.csv.gz` de amostra) para exercitar
  parse+upsert de ponta a ponta.

---

## 10. Perguntas em aberto (para o Specify)

1. **Runner headless passa o Cloudflare?** (único risco técnico restante — validar no início da
   implementação, antes de tudo).
2. **Onde os jobs agendados moram** (GitHub Actions? container?) — decisão de infra do time.
3. **Colunas finais** — a lista de §5/D8 está fechada salvo ajuste do time.

---

## 11. Próximos passos

1. Fechar item 1 de §10 (spike do headless em CI) — é o que resta de risco.
2. Montar o **prompt do Specify** anexando **este brainstorming + o briefing 115**.
3. Implementar na fatia própria (branch `feature/caepi-ca-validation`), com a migração da tabela.
