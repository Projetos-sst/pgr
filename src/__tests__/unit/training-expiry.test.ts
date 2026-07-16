import {
  classifyTrainingStatus,
  statusForDueWindow,
} from "@/shared/domains/pgr/trainings";

const TODAY = "2026-07-08";

describe("statusForDueWindow — mapeamento linha→status da US3", () => {
  it("valid_until IS NULL (single realizado) NUNCA produz status de vencimento", () => {
    for (const dueWithinDays of [30, 60, 90]) {
      expect(statusForDueWindow(null, { today: TODAY, dueWithinDays })).toBe("ok");
    }
  });

  it("repassa a janela recebida (30/60/90) verbatim como dueWindowDays de D2", () => {
    const at45Days = "2026-08-22"; // hoje + 45
    for (const dueWithinDays of [30, 60, 90] as const) {
      expect(statusForDueWindow(at45Days, { today: TODAY, dueWithinDays })).toBe(
        classifyTrainingStatus(
          { validUntil: at45Days },
          { today: TODAY, dueWindowDays: dueWithinDays },
        ),
      );
    }
    expect(statusForDueWindow(at45Days, { today: TODAY, dueWithinDays: 30 })).toBe("ok");
    expect(statusForDueWindow(at45Days, { today: TODAY, dueWithinDays: 60 })).toBe(
      "due_soon",
    );
    expect(statusForDueWindow(at45Days, { today: TODAY, dueWithinDays: 90 })).toBe(
      "due_soon",
    );
  });

  it("vencido / a vencer / em dia espelham D2 (fronteiras inclusivas)", () => {
    expect(statusForDueWindow("2026-07-07", { today: TODAY, dueWithinDays: 30 })).toBe(
      "expired",
    );
    expect(statusForDueWindow(TODAY, { today: TODAY, dueWithinDays: 30 })).toBe(
      "due_soon",
    );
    expect(statusForDueWindow("2026-08-07", { today: TODAY, dueWithinDays: 30 })).toBe(
      "due_soon",
    );
    expect(statusForDueWindow("2026-08-08", { today: TODAY, dueWithinDays: 30 })).toBe(
      "ok",
    );
  });
});
