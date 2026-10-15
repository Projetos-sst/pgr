import { z } from "zod";

import { SstAgent } from "@/shared/integrations/agents/core/sst-agent";

class AgenteFake extends SstAgent<string, { ok: string }, string> {
  readonly id: string = "fake";
  readonly name: string = "Fake";
  readonly instructions: string = "Você é um agente de teste.";
  readonly outputSchema = z.object({ ok: z.string() });
  buildPrompt(input: string) {
    return input;
  }
  parseOutput(raw: { ok: string }) {
    return raw.ok;
  }
}

/**
 * Com `jsonPromptInjection`, o schema JSON vai dentro do prompt — e os modelos gratuitos
 * às vezes devolvem a **definição** em vez do dado. Isso derrubava 4 de 5 execuções do
 * agente de medidas de controle. A proteção vive na classe base para que agente novo a
 * herde sem precisar saber que ela existe.
 */
describe("SstAgent.systemPrompt", () => {
  const agente = new AgenteFake();

  it("preserva as instruções do agente", () => {
    expect(agente.systemPrompt).toContain("Você é um agente de teste.");
  });

  it("anexa o contrato que proíbe devolver o schema", () => {
    expect(agente.systemPrompt).toMatch(/NUNCA devolva o schema/);
    expect(agente.systemPrompt).toContain("$schema");
  });

  it("aplica o contrato a qualquer subclasse, sem ela declarar nada", () => {
    class Outro extends AgenteFake {
      readonly id = "outro";
      readonly instructions = "Outro papel.";
    }
    expect(new Outro().systemPrompt).toMatch(/NUNCA devolva o schema/);
  });
});
