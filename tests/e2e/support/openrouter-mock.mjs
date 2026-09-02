/**
 * Mock local do provedor para E2E — responde a `POST /chat/completions` com o JSON que os
 * agentes esperam. Apontado por `OPENROUTER_BASE_URL` (o roteador de modelos do Mastra
 * honra essa variável); **nunca** chama a OpenRouter real. Sem segredos: a chave enviada
 * pelo app é ignorada.
 *
 * O conteúdo vai como **texto JSON na mensagem**, não como `tool_call`: com
 * `jsonPromptInjection` o schema é injetado no prompt e o Mastra lê a resposta do conteúdo.
 *
 * Uso: `node tests/e2e/support/openrouter-mock.mjs` (porta via `AI_MOCK_PORT`, default 54999).
 */
import http from "node:http";

const PORT = Number(process.env.AI_MOCK_PORT || 54999);

const ACTION_PLAN = {
  what: "Instalar enclausuramento acustico na fonte de ruido",
  why: "Reduzir a exposicao ocupacional ao ruido continuo",
  who: "SESMT / Engenharia de Seguranca",
  where: "Setor de usinagem",
  how: "Projeto acustico + barreira na fonte + manutencao mensal",
  when: "2026-12-01",
  howMuch: 5000,
  priority: 2,
};

const RISKS = {
  risks: [
    {
      agentType: "physical",
      hazard: "Ruido continuo",
      description: "Exposicao a ruido acima do limite de tolerancia",
      sources: "Maquinas do setor de usinagem",
    },
  ],
};

/**
 * O agente de riscos é reconhecido pelo schema que o Mastra injeta no prompt. A busca é
 * pelo termo solto porque o schema chega escapado dentro do JSON da requisição.
 */
function payloadFor(body) {
  return body.includes("risks") ? RISKS : ACTION_PLAN;
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url && req.url.includes("/chat/completions")) {
    console.log(`[mock] hit ${req.method} ${req.url}`);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const payload = {
        id: "chatcmpl_e2e_mock",
        object: "chat.completion",
        model: "openrouter-e2e-mock",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify(payloadFor(body)),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not-found" }));
});

server.listen(PORT, () => {
  console.log(`openrouter-mock listening on http://localhost:${PORT}`);
});
