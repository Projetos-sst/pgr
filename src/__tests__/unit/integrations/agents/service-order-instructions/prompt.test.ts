import {
  SERVICE_ORDER_INSTRUCTIONS,
  buildServiceOrderInstructionPrompt,
} from "@/shared/integrations/agents/service-order-instructions/prompt";
import type { ServiceOrderInstructionContext } from "@/shared/domains/safety/ai-service-order-instructions";

const CTX: ServiceOrderInstructionContext = {
  title: "OS 42 — Manutenção elétrica",
  osType: "Admissional",
  workUnitName: "Obra Central",
  jobRoleTitle: "Eletricista Industrial",
  gesName: "Manutenção",
  risks: [{ description: "Choque elétrico" }],
  epis: [{ name: "Luva isolante" }],
  existingItems: ["Risco: Choque elétrico"],
};

describe("buildServiceOrderInstructionPrompt", () => {
  it("inclui função, riscos e EPIs", () => {
    const p = buildServiceOrderInstructionPrompt(CTX);
    expect(p).toContain("Eletricista Industrial");
    expect(p).toContain("Choque elétrico");
    expect(p).toContain("Luva isolante");
  });

  it("lista os itens atuais para o agente não repeti-los", () => {
    expect(buildServiceOrderInstructionPrompt(CTX)).toMatch(
      /já contém[\s\S]*Choque elétrico/,
    );
  });

  /**
   * A OS é assinada por uma pessoa concreta, mas o prompt só precisa do **cargo**. Este
   * teste é a barreira: o contexto não tem sequer um campo onde nome ou CPF caberiam.
   */
  it("não tem onde caber dado pessoal do trabalhador designado", () => {
    const chaves = Object.keys(CTX);
    expect(chaves).not.toContain("employeeName");
    expect(chaves).not.toContain("employeeId");
    expect(chaves).not.toContain("cpf");
    expect(chaves).toContain("jobRoleTitle");
  });

  it("marca ausência de risco/EPI em vez de deixar seção vazia", () => {
    const p = buildServiceOrderInstructionPrompt({ ...CTX, risks: [], epis: [] });
    expect(p).toContain("nenhum informado");
  });
});

describe("SERVICE_ORDER_INSTRUCTIONS", () => {
  it("ancora na NR-01 1.4.1 e escreve para o trabalhador", () => {
    expect(SERVICE_ORDER_INSTRUCTIONS).toContain("1.4.1");
    expect(SERVICE_ORDER_INSTRUCTIONS).toMatch(/voz imperativa/);
  });

  it("proíbe dado pessoal", () => {
    expect(SERVICE_ORDER_INSTRUCTIONS).toMatch(/NUNCA cite nome de pessoa/);
  });
});
