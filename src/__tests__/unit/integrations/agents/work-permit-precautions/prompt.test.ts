import {
  WORK_PERMIT_PRECAUTIONS_INSTRUCTIONS,
  buildWorkPermitPrecautionsPrompt,
  workPermitPrecautionsOutputSchema,
} from "@/shared/integrations/agents/work-permit-precautions/prompt";
import type { WorkPermitPrecautionsContext } from "@/shared/domains/work-permits/ai-precautions-fill";

const CTX: WorkPermitPrecautionsContext = {
  typeLabel: "Trabalho em altura",
  area: "Telhado do galpão 2",
  description: "Troca de telhas",
  existingPrecautions: ["Usar cinto paraquedista"],
};

describe("buildWorkPermitPrecautionsPrompt", () => {
  it("leva tipo, área, descrição e as precauções que já existem", () => {
    const prompt = buildWorkPermitPrecautionsPrompt(CTX);
    expect(prompt).toContain("Trabalho em altura");
    expect(prompt).toContain("Telhado do galpão 2");
    expect(prompt).toContain("Troca de telhas");
    expect(prompt).toContain("não repita");
    expect(prompt).toContain("Usar cinto paraquedista");
  });

  it("sem área nem precauções, não manda linha vazia", () => {
    const prompt = buildWorkPermitPrecautionsPrompt({
      ...CTX,
      area: null,
      existingPrecautions: [],
    });
    expect(prompt).not.toContain("Área");
    expect(prompt).not.toContain("não repita");
  });
});

describe("instruções do agente de precauções", () => {
  it("proíbe dado pessoal e valor medido inventado", () => {
    expect(WORK_PERMIT_PRECAUTIONS_INSTRUCTIONS).toContain("NUNCA cite nome de pessoa");
    expect(WORK_PERMIT_PRECAUTIONS_INSTRUCTIONS).toContain("Nunca invente valor medido");
  });

  it("o schema de saída aceita lista vazia", () => {
    expect(workPermitPrecautionsOutputSchema.safeParse({ precautions: [] }).success).toBe(
      true,
    );
  });
});
