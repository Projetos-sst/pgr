/**
 * Mock local do provedor OpenRouter para E2E — responde a `POST /chat/completions` com um
 * `tool_call` 5W2H determinístico. Apontado por `OPENROUTER_BASE_URL`; **nunca** chama a
 * OpenRouter real. Sem segredos: a chave enviada pelo app é ignorada.
 * Uso: `node tests/e2e/support/openrouter-mock.mjs` (porta via `AI_MOCK_PORT`, default 54999).
 */
import http from "node:http";

const PORT = Number(process.env.AI_MOCK_PORT || 54999);

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url && req.url.includes("/chat/completions")) {
    console.log(`[mock] hit ${req.method} ${req.url}`);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let toolName = "record_action_plan";
      try {
        const parsed = JSON.parse(body || "{}");
        if (parsed?.tool_choice?.function?.name) {
          toolName = parsed.tool_choice.function.name;
        }
      } catch {
        // ignora corpo inválido — devolve o default
      }
      const payload = {
        id: "chatcmpl_e2e_mock",
        object: "chat.completion",
        model: "openrouter-e2e-mock",
        choices: [
          {
            index: 0,
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_e2e_mock",
                  type: "function",
                  function: {
                    name: toolName,
                    arguments: JSON.stringify({
                      what: "Instalar enclausuramento acustico na fonte de ruido",
                      why: "Reduzir a exposicao ocupacional ao ruido continuo",
                      who: "SESMT / Engenharia de Seguranca",
                      where: "Setor de usinagem",
                      how: "Projeto acustico + barreira na fonte + manutencao mensal",
                      when: "2026-12-01",
                      howMuch: 5000,
                      priority: 2,
                    }),
                  },
                },
              ],
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
