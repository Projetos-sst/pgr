import { classifyTrainingStatus } from "@/shared/domains/pgr/trainings";

const TODAY = "2026-07-08";
const WINDOW_30 = { today: TODAY, dueWindowDays: 30 };

describe("classifyTrainingStatus (D2)", () => {
  it("sem registro (latest == null) → missing", () => {
    expect(classifyTrainingStatus(null, WINDOW_30)).toBe("missing");
  });

  it("valid_until null (single realizado) → ok, nunca vencido", () => {
    expect(classifyTrainingStatus({ validUntil: null }, WINDOW_30)).toBe("ok");
  });

  it("valid_until < hoje → expired", () => {
    expect(classifyTrainingStatus({ validUntil: "2026-07-07" }, WINDOW_30)).toBe(
      "expired",
    );
    expect(classifyTrainingStatus({ validUntil: "2020-01-01" }, WINDOW_30)).toBe(
      "expired",
    );
  });

  it("fronteira: vence HOJE → ainda não vencido (inclusivo) → due_soon", () => {
    expect(classifyTrainingStatus({ validUntil: TODAY }, WINDOW_30)).toBe("due_soon");
  });

  it("dentro da janela → due_soon", () => {
    expect(classifyTrainingStatus({ validUntil: "2026-07-20" }, WINDOW_30)).toBe(
      "due_soon",
    );
  });

  it("fronteira: vence exatamente em hoje+30 → due_soon (janela inclusiva)", () => {
    expect(classifyTrainingStatus({ validUntil: "2026-08-07" }, WINDOW_30)).toBe(
      "due_soon",
    );
  });

  it("um dia além da janela de 30 → ok", () => {
    expect(classifyTrainingStatus({ validUntil: "2026-08-08" }, WINDOW_30)).toBe("ok");
  });

  it("janela de 60/90 muda o corte (fronteira inclusiva por janela)", () => {
    const at90 = { validUntil: "2026-10-06" }; // hoje + 90
    expect(classifyTrainingStatus(at90, { today: TODAY, dueWindowDays: 60 })).toBe("ok");
    expect(classifyTrainingStatus(at90, { today: TODAY, dueWindowDays: 90 })).toBe(
      "due_soon",
    );
  });

  it("bem além de qualquer janela → ok", () => {
    expect(classifyTrainingStatus({ validUntil: "2030-01-01" }, WINDOW_30)).toBe("ok");
  });
});
