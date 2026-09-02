# Agents (IA)

Camada de agentes de IA da plataforma. **Um provedor** (OpenRouter, API compatível com
OpenAI Chat Completions) e **uma pasta por agente**, cada uma com o que aquele agente faz.

```
agents/
├── config.ts             env server-only: chave, modelo e base URL do provedor
├── tool-call.ts          contrato puro de tool call (definição + leitura dos argumentos)
├── openrouter-client.ts  transporte único: POST /chat/completions com tool call forçado
├── risk-suggestion/      agente 1 — sugere riscos ocupacionais de um GES (NR-01/GRO)
│   ├── prompt.ts         puro: contexto do GES → mensagens; tool call → riscos validados
│   └── agent.ts          server-only: prompt → provedor → sugestões
└── action-plan/          agente 2 — sugere plano de ação 5W2H para risco/incidente
    ├── prompt.ts         puro: input sanitizado → mensagens; tool call → 5W2H cru
    └── agent.ts          server-only: prompt → provedor → objeto 5W2H (validado no core)
```

## Regras da camada

- **Saída sempre estruturada por tool call** — nunca texto livre para parsear. O schema da
  ferramenta e o schema Zod de saída precisam concordar nas chaves (há teste de regressão).
- **`prompt.ts` é puro** (sem `server-only`, sem rede): é o que os testes unitários exercitam
  para garantir que só o contexto permitido entra no prompt e que saída inválida é descartada.
- **Nada de PII no prompt.** Sugestão de riscos usa só contexto do GES (processo, ambiente,
  títulos de função); plano de ação recebe input já sanitizado por allowlist no core.
- **Falha nunca bloqueia o fluxo.** Chave ausente, HTTP não-2xx, timeout (20s) ou corpo
  inesperado viram `AiUnavailableError` (`AI_UNAVAILABLE` → 502) e o usuário segue no manual.
- **Cota e isolamento ficam no core**, não aqui: os cores em `shared/server/**` checam tenant
  e cota do plano **antes** de chamar o agente, e registram uso só após sucesso.
- **O front nunca nomeia o provedor.** Para o usuário a IA é a **IA pgr-e**; o provedor por
  trás é detalhe de infraestrutura nosso. Cuidado especial com `AppError.message`, que
  `toActionError` devolve ao cliente: motivo técnico (chave ausente, HTTP do provedor) vai
  para o log do servidor, e o usuário recebe a mensagem genérica de `AiUnavailableError`.
- **A espera tem feedback.** As chamadas levam ~5–20s. A UI monta `AgentProgress`
  (`app/(protected)/_ui/`) com o roteiro fixo daquele agente + esqueleto do conteúdo que
  vem — nunca só um botão desabilitado.

## Adicionar um novo agente

1. Crie `agents/<nome>/prompt.ts` (puro): `build<Nome>Tool()` → `ToolDefinition`,
   `build<Nome>Prompt()` → `{ system, user }`, `extract<Nome>()` → lê o tool call.
2. Crie `agents/<nome>/agent.ts` (server-only): junta os três via `runToolCall`.
3. O core que orquestra (tenant, cota, validação Zod, persistência) vive em
   `shared/server/**` — o agente só fala com o provedor.

## Ambiente

| Variável              | Papel                                                           |
| --------------------- | --------------------------------------------------------------- |
| `OPENROUTER_API_KEY`  | Chave do provedor. **Server-only**; ausente → `AI_UNAVAILABLE`. |
| `AI_SUGGESTION_MODEL` | Modelo no catálogo da OpenRouter. Default em `config.ts`.       |
| `OPENROUTER_BASE_URL` | Override da base URL. Só em teste/E2E, apontando ao mock local. |

Mock local para E2E: `node tests/e2e/support/openrouter-mock.mjs`.
