import { buildNotifications } from "@/shared/domains/platform/notifications";
import type { DashboardPending } from "@/shared/domains/platform/dashboard";

const zeroPending: DashboardPending = {
  pgrsExpired: 0,
  controlsOverdue: 0,
  episLowStock: 0,
  episPendingReturn: 0,
  trainingsExpired: 0,
  trainingsDueSoon: 0,
  episCaExpired: 0,
  episCaDueSoon: 0,
};

describe("buildNotifications", () => {
  it("warns about declared PGR validity within 30 days without inferring a legal expiry", () => {
    expect(buildNotifications({ ...zeroPending, pgrsDueSoon: 2 })).toEqual([
      expect.objectContaining({
        key: "pgrs_due_soon",
        href: "/pgr",
        severity: "medium",
        description: expect.stringContaining("30 dias"),
      }),
    ]);
  });
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

  it("CA de EPI vencido → alerta 'high' linkando ao filtro caStatus=expired", () => {
    const out = buildNotifications({ ...zeroPending, episCaExpired: 4 });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("epis_ca_expired");
    expect(out[0].severity).toBe("high");
    expect(out[0].href).toBe("/epi-stock?caStatus=expired");
    expect(out[0].title).toContain("4");
  });

  it("CA de EPI a vencer → alerta 'medium' linkando para /epi-stock", () => {
    const out = buildNotifications({ ...zeroPending, episCaDueSoon: 2 });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("epis_ca_due_soon");
    expect(out[0].severity).toBe("medium");
    expect(out[0].href).toBe("/epi-stock");
    expect(out[0].title).toContain("2");
  });

  it("CA de EPI zerado (vencido e a vencer) não gera alerta", () => {
    const out = buildNotifications({
      ...zeroPending,
      episCaExpired: 0,
      episCaDueSoon: 0,
    });
    expect(out.map((n) => n.key)).not.toContain("epis_ca_expired");
    expect(out.map((n) => n.key)).not.toContain("epis_ca_due_soon");
  });
});
