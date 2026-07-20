import {
  scheduleEventInputSchema,
  scheduleEventTypeLabel,
} from "@/shared/domains/platform/scheduling";

describe("scheduleEventInputSchema", () => {
  it("aceita evento válido", () => {
    const r = scheduleEventInputSchema.safeParse({
      eventType: "inspection",
      title: "Inspeção do canteiro",
      eventDate: "2026-08-01",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo fora do enum", () => {
    expect(
      scheduleEventInputSchema.safeParse({
        eventType: "party",
        title: "x",
        eventDate: "2026-08-01",
      }).success,
    ).toBe(false);
  });

  it("rejeita título vazio e data inválida", () => {
    expect(
      scheduleEventInputSchema.safeParse({
        eventType: "other",
        title: "",
        eventDate: "2026-13-45",
      }).success,
    ).toBe(false);
  });
});

describe("scheduleEventTypeLabel", () => {
  it("rotula em pt-BR e cai para o próprio valor se desconhecido", () => {
    expect(scheduleEventTypeLabel("exam")).toBe("Exame médico");
    expect(scheduleEventTypeLabel("weird")).toBe("weird");
  });
});
