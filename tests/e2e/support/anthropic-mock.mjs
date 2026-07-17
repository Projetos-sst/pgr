/**
 * Mock local do provedor Anthropic para E2E — responde a `POST /v1/messages` com um bloco
 * `tool_use` 5W2H determinístico. Apontado por `ANTHROPIC_BASE_URL` (config padrão do SDK);
 * **nunca** chama a Anthropic real. Sem segredos: a chave enviada pelo app é ignorada.
 * Uso: `node tests/e2e/support/anthropic-mock.mjs` (porta via `AI_MOCK_PORT`, default 54999).
 */
import http from "node:http";

const PORT = Number(process.env.AI_MOCK_PORT || 54999);

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url && req.url.includes("/v1/messages")) {
    console.log(`[mock] hit ${req.method} ${req.url}`);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let toolName = "record_action_plan";
      try {
        const parsed = JSON.parse(body || "{}");
        if (parsed?.tool_choice?.name) toolName = parsed.tool_choice.name;
      } catch {
        // ignora corpo inválido — devolve o default
      }
      const payload = {
        id: "msg_e2e_mock",
        type: "message",
        role: "assistant",
        model: "claude-e2e-mock",
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "toolu_e2e_mock",
            name: toolName,
            input: {
              what: "Instalar enclausuramento acustico na fonte de ruido",
              why: "Reduzir a exposicao ocupacional ao ruido continuo",
              who: "SESMT / Engenharia de Seguranca",
              where: "Setor de usinagem",
              how: "Projeto acustico + barreira na fonte + manutencao mensal",
              when: "2026-12-01",
              howMuch: 5000,
              priority: 2,
            },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
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
  console.log(`anthropic-mock listening on http://localhost:${PORT}`);
});
