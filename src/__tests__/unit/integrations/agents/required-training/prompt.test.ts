import {
  REQUIRED_TRAINING_INSTRUCTIONS,
  buildRequiredTrainingPrompt,
} from "@/shared/integrations/agents/required-training/prompt";
import type { JobRoleTrainingContext } from "@/shared/domains/pgr/ai-training-suggestion";

const CTX: JobRoleTrainingContext = {
  jobRoleTitle: "Eletricista Industrial",
  gesNames: ["Manutenção Elétrica"],
  risks: [
    { agentType: "accident", hazard: "Choque elétrico", description: "Contato direto" },
  ],
  catalog: [
    { id: "c1", name: "Trabalho em Altura", periodicity: "annual", isActive: true },
  ],
  requiredTrainingIds: [],
};

describe("buildRequiredTrainingPrompt", () => {
  it("inclui cargo, GES, riscos e catálogo", () => {
    const p = buildRequiredTrainingPrompt(CTX);
    expect(p).toContain("Eletricista Industrial");
    expect(p).toContain("Manutenção Elétrica");
    expect(p).toContain("Choque elétrico");
    expect(p).toContain("Trabalho em Altura");
  });

  it("marca catálogo e riscos vazios em vez de deixar seção muda", () => {
    const p = buildRequiredTrainingPrompt({ ...CTX, risks: [], catalog: [] });
    expect(p).toContain("nenhum risco cadastrado");
    expect(p).toContain("catálogo vazio");
  });
});

describe("REQUIRED_TRAINING_INSTRUCTIONS", () => {
  /**
   * O catálogo entrou no prompt para reconciliar nomes, mas o modelo passou a tratá-lo
   * como cardápio e devolvia só o que já existia — 1 treinamento por função. A regra
   * precisa dizer as duas coisas separadamente.
   */
  it("diz que o catálogo é vocabulário, não limite", () => {
    expect(REQUIRED_TRAINING_INSTRUCTIONS).toMatch(/NÃO limita a sua resposta/);
    expect(REQUIRED_TRAINING_INSTRUCTIONS).toMatch(/use exatamente o nome de lá/);
  });

  /** Regra conservadora demais fazia o agente devolver zero em 3 de 6 execuções. */
  it("empurra contra a resposta curta demais", () => {
    expect(REQUIRED_TRAINING_INSTRUCTIONS).toMatch(/raramente tem menos de três/);
  });

  it("exige âncora normativa e carga horária da norma", () => {
    expect(REQUIRED_TRAINING_INSTRUCTIONS).toMatch(/Não invente carga horária/);
  });
});
