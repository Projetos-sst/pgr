import { toExamTimeline } from "@/shared/domains/medicine/timeline";
import { examBadge, type HealthExamListItem } from "@/shared/domains/pgr/health-exams";

const OPTS = { today: "2026-08-02", dueWindowDays: 30 };

function row(overrides: Partial<HealthExamListItem>): HealthExamListItem {
  return {
    id: "e1",
    employeeId: "emp",
    employeeName: "EXEMPLO Funcionário",
    doctorId: null,
    doctorName: null,
    examType: "periodic",
    performedAt: "2026-01-10",
    validUntil: null,
    aptitude: "fit",
    ...overrides,
  };
}

describe("toExamTimeline", () => {
  it("lista vazia → lista vazia", () => {
    expect(toExamTimeline([], OPTS)).toEqual([]);
  });

  it("preserva a ordem do servidor (não reordena por data)", () => {
    const rows = [
      row({ id: "b", performedAt: "2025-01-01" }),
      row({ id: "a", performedAt: "2026-05-01" }),
      row({ id: "c", performedAt: "2024-01-01" }),
    ];
    expect(toExamTimeline(rows, OPTS).map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("badge igual ao de examBadge (mesmas fronteiras de /health-exams)", () => {
    const rows = [
      row({ id: "1", validUntil: "2026-08-01", aptitude: "fit" }),
      row({ id: "2", validUntil: "2026-09-01", aptitude: "fit" }),
      row({ id: "3", validUntil: "2026-09-02", aptitude: "fit_with_restrictions" }),
      row({ id: "4", validUntil: null, aptitude: "unfit" }),
    ];
    for (const item of toExamTimeline(rows, OPTS))
      expect(item.badge).toEqual(examBadge(item.validUntil, item.aptitude, OPTS));
  });

  it("validade e rótulo da validade informada", () => {
    const items = toExamTimeline(
      [
        row({ id: "1", validUntil: "2026-08-01" }),
        row({ id: "2", validUntil: "2026-08-02" }),
        row({ id: "3", validUntil: "2026-09-02" }),
        row({ id: "4", validUntil: null }),
      ],
      OPTS,
    );
    expect(items.map((i) => [i.validity, i.validityLabel])).toEqual([
      ["expired", "Vencido"],
      ["due_soon", "A vencer"],
      ["ok", "Vigente"],
      ["no_expiry", "Sem validade informada"],
    ]);
  });

  it("mantém os campos da linha e não acrescenta notes/certificatePath", () => {
    const source = row({ id: "x", doctorId: "d", doctorName: "EXEMPLO Dra." });
    const [item] = toExamTimeline([source], OPTS);
    expect(item).toMatchObject(source);
    expect(item).not.toHaveProperty("notes");
    expect(item).not.toHaveProperty("certificatePath");
  });
});
