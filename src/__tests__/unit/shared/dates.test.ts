/**
 * Datas no fuso do negócio (America/Sao_Paulo). Um carimbo gravado à noite em Brasília já está no
 * dia seguinte em UTC: a data exibida (ex.: última validação de risco no PCMSO) é a de Brasília.
 */
import { dateInSaoPaulo } from "@/shared/dates";

describe("dateInSaoPaulo", () => {
  it("instante da noite em Brasília (já dia seguinte em UTC) fica no dia de Brasília", () => {
    expect(dateInSaoPaulo("2026-11-08T01:30:00.000Z")).toBe("2026-11-07");
    expect(dateInSaoPaulo(new Date("2026-11-08T02:59:59.000Z"))).toBe("2026-11-07");
  });

  it("depois da meia-noite em Brasília vira o dia seguinte", () => {
    expect(dateInSaoPaulo("2026-11-08T03:00:00.000Z")).toBe("2026-11-08");
    expect(dateInSaoPaulo("2026-11-08T15:00:00.000Z")).toBe("2026-11-08");
  });

  it("instante inválido → null", () => {
    expect(dateInSaoPaulo("não é data")).toBeNull();
  });
});
