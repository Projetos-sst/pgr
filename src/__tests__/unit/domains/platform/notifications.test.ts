import { buildNotifications } from "@/shared/domains/platform/notifications";
import type { DashboardPending } from "@/shared/domains/platform/dashboard";

const zeroPending: DashboardPending = {
  pgrsExpired: 0,
  controlsOverdue: 0,
  episLowStock: 0,
  episPendingReturn: 0,
  trainingsExpired: 0,
  trainingsDueSoon: 0,
};

describe("buildNotifications", () => {
  it("sem pendências → lista vazia", () => {
    expect(buildNotifications(zeroPending)).toEqual([]);
  });

  it("um alerta por categoria com contagem > 0, com chave estável e link", () => {
    const out = buildNotifications({ ...zeroPending, pgrsExpired: 2 });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("pgrs_expired");
    expect(out[0].severity).toBe("high");
    expect(out[0].href).toBe("/pgr");
    expect(out[0].title).toContain("2");
  });

  it("categorias zeradas não geram alerta; só as > 0", () => {
    const out = buildNotifications({
      ...zeroPending,
      trainingsDueSoon: 3,
      episPendingReturn: 1,
    });
    expect(out.map((n) => n.key).sort()).toEqual([
      "epis_pending_return",
      "trainings_due_soon",
    ]);
  });
});
