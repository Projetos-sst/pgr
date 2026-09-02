# Agents (IA)

Camada de agentes de IA da plataforma. **Um framework** (Mastra), **um provedor**
(OpenRouter) e **uma pasta por agente**. Um agente é uma definição declarativa; quem
executa é o `MastraAiService`.

```
agents/
├── index.ts                     entrada: liga cada definição ao executor (os cores importam daqui)
├── config.ts                    server-only: chave e cadeia de modelos, tudo vindo do .env
├── core/
│   ├── sst-agent.ts             classe abstrata — o contrato de um agente (puro)
│   ├── model-chain.ts           montagem da cadeia primário → fallbacks (puro)
│   └── mastra-ai-service.ts     executor: retry, fallback, timeout, saída estruturada
├── risk-suggestion/             agente 1 — riscos ocupacionais de um GES (NR-01/GRO)
│   ├── prompt.ts                instruções, schema de saída e mensagem (puro)
│   └── agent.ts                 class RiskSuggestionAgent extends SstAgent (puro)
└── action-plan/                 agente 2 — plano de ação 5W2H para risco/incidente
    ├── prompt.ts
    └── agent.ts
```

## Como um agente roda

```
core (tenant + cota)  →  index.ts  →  MastraAiService.run(definição, input)
                                        ├─ retry no mesmo modelo   (Mastra)
                                        ├─ fallback para o próximo (Mastra)
                                        ├─ timeout por agente
                                        └─ saída estruturada validada por Zod
```

Resiliência em camadas, da mais barata para a mais cara: **retry** no mesmo modelo →
**fallback** para o próximo da cadeia → **timeout** cobrindo os dois → `AiUnavailableError`,
e a UI degrada para o preenchimento manual. Nenhuma dessas mecânicas se repete por agente.

## Adicionar um novo agente

1. `agents/<nome>/prompt.ts` — `INSTRUCTIONS` (papel e regras, fixo), `outputSchema` (Zod,
   com `.describe()` em cada campo) e `build<Nome>Prompt(input)` (o caso concreto).
2. `agents/<nome>/agent.ts` — `class <Nome>Agent extends SstAgent<TInput, TRaw, TOutput>`,
   preenchendo `id`, `name`, `instructions`, `outputSchema`, `buildPrompt` e `parseOutput`.
   Ajuste `maxOutputTokens`/`timeoutMs` se a saída for maior que o default.
3. `agents/index.ts` — exporte a fachada que chama `mastraAiService.run(...)`.

Nada de rede, retry, timeout ou escolha de modelo entra num agente novo.

## Regras da camada

- **`prompt.ts` e `agent.ts` são puros** (sem `server-only`, sem Mastra): é o que os testes
  unitários exercitam. O framework só aparece em `core/mastra-ai-service.ts` e `index.ts` —
  por isso o executor é injetado na entrada, e não importado pela definição.
- **Schema do agente tolerante, validação estrita no domínio.** O `outputSchema` valida a
  forma; `parseOutput` traduz para o domínio e absorve a variação do modelo (chave em
  snake_case, item inválido no meio da lista). Um item ruim não pode derrubar o lote.
- **Nada de PII no prompt.** Riscos usam só contexto do GES (processo, ambiente, títulos de
  função); o plano de ação recebe input já sanitizado por allowlist no core.
- **Cota e isolamento ficam no core**, não aqui: os cores em `shared/server/**` checam
  tenant e cota do plano **antes** de chamar o agente, e registram uso só após sucesso.
- **O front nunca nomeia o provedor nem o framework.** Para o usuário a IA é a **IA pgr-e**.
  Cuidado com `AppError.message`, que `toActionError` devolve ao cliente: motivo técnico vai
  para o log do servidor, e o usuário recebe a mensagem genérica de `AiUnavailableError`.
- **A espera tem feedback.** As chamadas levam ~5–20s. A UI monta `AgentProgress`
  (`app/(protected)/_ui/`) com o roteiro fixo daquele agente + esqueleto do conteúdo que
  vem — nunca só um botão desabilitado.

## Por que `jsonPromptInjection: "auto"`

Os modelos gratuitos da OpenRouter não anunciam suporte nativo a `response_format`, e o
caminho nativo do Mastra devolvia objeto vazio. No modo automático o Mastra injeta o schema
no prompt quando o modelo não suporta o nativo — foi o que fez a saída estruturada
funcionar de fato no tier gratuito.

## Ambiente

| Variável                    | Papel                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`        | Chave do provedor. **Server-only**; ausente → `AI_UNAVAILABLE`.     |
| `AI_SUGGESTION_MODEL`       | Modelo primário (id do catálogo da OpenRouter).                     |
| `AI_FALLBACK_MODEL`         | Modelo usado quando o primário esgota os retries.                   |
| `OPENROUTER_BASE_URL`       | Override da base URL. Só em teste/E2E, apontando ao mock local.     |
| `MASTRA_TELEMETRY_DISABLED` | `1` — a plataforma trata dado de saúde e não exporta para terceiro. |

Mock local para E2E: `node tests/e2e/support/openrouter-mock.mjs`.
