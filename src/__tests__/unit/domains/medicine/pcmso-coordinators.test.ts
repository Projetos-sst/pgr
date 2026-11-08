import {
  assessCoordinatorEligibility,
  coordinatorClosingSchema,
  coordinatorDesignationSchema,
  coordinatorInForceOn,
  coordinatorOn,
  designationHeading,
  designationStatusOn,
  planCoordinatorSwitch,
  previousIsoDay,
  type CoordinatorInForce,
} from "@/shared/domains/medicine/pcmso-coordinators";

const physician = {
  status: "active" as const,
  profession: "physician" as const,
  registrationUf: "MA",
  rqe: "901",
};

describe("assessCoordinatorEligibility", () => {
  it("accepts an active physician with UF and RQE, ignoring any exception reason", () => {
    expect(assessCoordinatorEligibility(physician, "qualquer texto longo")).toEqual({
      ok: true,
      rqeExceptionReason: null,
    });
  });
  it("without RQE, requires the NR-7 7.5.2 justification", () => {
    const noRqe = { ...physician, rqe: null };
    const refused = assessCoordinatorEligibility(noRqe, undefined);
    expect(refused).toMatchObject({ ok: false });
    expect(!refused.ok && refused.message).toContain("7.5.2");
    expect(
      assessCoordinatorEligibility(noRqe, "Sem médico do trabalho na localidade"),
    ).toEqual({
      ok: true,
      rqeExceptionReason: "Sem médico do trabalho na localidade",
    });
  });
  it.each([
    [{ ...physician, status: "inactive" as const }, "inativo"],
    [{ ...physician, profession: "psychologist" as const, rqe: null }, "Somente médico"],
    [{ ...physician, registrationUf: null }, "UF do CRM"],
  ])("refuses %o", (medico, message) => {
    const result = assessCoordinatorEligibility(medico, "Justificativa suficiente aqui");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain(message);
  });
});

describe("previousIsoDay", () => {
  it.each([
    ["2026-03-01", "2026-02-28"],
    ["2028-03-01", "2028-02-29"],
    ["2026-01-01", "2025-12-31"],
  ])("%s → %s", (input, expected) => {
    expect(previousIsoDay(input)).toBe(expected);
  });
});

describe("planCoordinatorSwitch", () => {
  it("first designation closes nothing", () => {
    expect(planCoordinatorSwitch([], "2026-01-01")).toEqual({
      ok: true,
      closeOpenOn: null,
    });
  });
  it("closes the open designation on the previous day", () => {
    expect(
      planCoordinatorSwitch([{ startsOn: "2026-01-01", endsOn: null }], "2026-01-02"),
    ).toEqual({
      ok: true,
      closeOpenOn: "2026-01-01",
    });
  });
  it("refuses a start on or before the open designation", () => {
    expect(
      planCoordinatorSwitch([{ startsOn: "2026-01-01", endsOn: null }], "2026-01-01").ok,
    ).toBe(false);
  });
  it("refuses overlapping a closed designation", () => {
    const history = [{ startsOn: "2026-01-01", endsOn: "2026-06-30" }];
    expect(planCoordinatorSwitch(history, "2026-06-30").ok).toBe(false);
    expect(planCoordinatorSwitch(history, "2026-07-01")).toEqual({
      ok: true,
      closeOpenOn: null,
    });
  });
});

describe("coordinatorOn", () => {
  const history = [
    { id: "b", startsOn: "2026-03-01", endsOn: null },
    { id: "a", startsOn: "2026-01-01", endsOn: "2026-02-28" },
  ];
  it.each([
    ["2025-12-31", null],
    ["2026-01-01", "a"],
    ["2026-02-28", "a"],
    ["2026-03-01", "b"],
    ["2030-01-01", "b"],
  ])("on %s → %s", (day, expected) => {
    expect(coordinatorOn(history, day)?.id ?? null).toBe(expected);
  });
});

describe("coordinatorInForceOn (NOB-109: vigente na data, não só aberta)", () => {
  const TODAY = "2026-11-07";
  type Row = { id: string; startsOn: string; endsOn: string | null };
  const ids = (r: CoordinatorInForce<{ id: string }>) =>
    r.kind === "in_force" ? r.assignment.id : r.kind;
  const on = (history: Row[], day = TODAY) => ids(coordinatorInForceOn(history, day));

  it("designação aberta iniciada antes da data está em vigor", () => {
    expect(on([{ id: "a", startsOn: "2026-01-01", endsOn: null }])).toBe("a");
  });
  it("designação que começa depois da data não conta (sucessor agendado)", () => {
    expect(on([{ id: "f", startsOn: "2026-12-01", endsOn: null }])).toBe("none");
  });
  it("designação encerrada antes da data não conta", () => {
    expect(on([{ id: "a", startsOn: "2026-01-01", endsOn: "2026-11-06" }])).toBe("none");
  });
  it("encerramento agendado (fim depois da data, ou na própria data) segue em vigor", () => {
    expect(on([{ id: "a", startsOn: "2026-01-01", endsOn: "2026-12-31" }])).toBe("a");
    expect(on([{ id: "a", startsOn: "2026-01-01", endsOn: TODAY }])).toBe("a");
  });
  it("troca agendada: a atual vale até a véspera do sucessor; o sucessor só depois", () => {
    const history = [
      { id: "b", startsOn: "2026-11-08", endsOn: null },
      { id: "a", startsOn: "2026-01-01", endsOn: "2026-11-07" },
    ];
    expect(on(history)).toBe("a");
    expect(on(history, "2026-11-08")).toBe("b");
  });
  it("sem designação → none; sobreposição → overlap, sem escolher uma", () => {
    expect(coordinatorInForceOn([], TODAY)).toEqual({ kind: "none" });
    const overlap = coordinatorInForceOn(
      [
        { id: "a", startsOn: "2026-01-01", endsOn: null },
        { id: "b", startsOn: "2026-06-01", endsOn: "2026-12-31" },
      ],
      TODAY,
    );
    expect(overlap.kind).toBe("overlap");
    expect(overlap.kind === "overlap" && overlap.assignments.map((a) => a.id)).toEqual([
      "a",
      "b",
    ]);
  });
  it("a troca planejada pelo app nunca produz sobreposição", () => {
    const plan = planCoordinatorSwitch(
      [{ startsOn: "2026-01-01", endsOn: null }],
      "2026-12-01",
    );
    if (!plan.ok) throw new Error(plan.message);
    const history = [
      { id: "a", startsOn: "2026-01-01", endsOn: plan.closeOpenOn },
      { id: "b", startsOn: "2026-12-01", endsOn: null },
    ];
    for (const day of ["2026-01-01", "2026-11-30", "2026-12-01", "2027-06-01"])
      expect(coordinatorInForceOn(history, day).kind).toBe("in_force");
  });
});

describe("designationStatusOn / designationHeading (NOB-109: tela do coordenador)", () => {
  const TODAY = "2026-11-07";
  it.each([
    [{ startsOn: "2026-11-08", endsOn: null }, "scheduled"],
    [{ startsOn: TODAY, endsOn: null }, "in_force"],
    [{ startsOn: "2026-01-01", endsOn: null }, "in_force"],
    [{ startsOn: "2026-01-01", endsOn: TODAY }, "in_force"],
    [{ startsOn: "2026-01-01", endsOn: "2026-12-31" }, "in_force"],
    [{ startsOn: "2026-01-01", endsOn: "2026-11-06" }, "ended"],
  ] as const)("%o → %s", (period, expected) => {
    expect(designationStatusOn(period, TODAY)).toBe(expected);
  });

  it("designação que só começa no futuro é rotulada como agendada, não vigente", () => {
    // Antes da correção a tela dizia "Designação vigente" para qualquer designação aberta.
    expect(designationHeading({ startsOn: "2026-11-08", endsOn: null }, TODAY)).toBe(
      "Designação agendada (a partir de 2026-11-08)",
    );
  });
  it("vigente sem fim, vigente com encerramento agendado e encerrada", () => {
    expect(designationHeading({ startsOn: "2026-01-01", endsOn: null }, TODAY)).toBe(
      "Designação vigente",
    );
    expect(
      designationHeading({ startsOn: "2026-01-01", endsOn: "2026-12-31" }, TODAY),
    ).toBe("Designação vigente (encerramento agendado para 2026-12-31)");
    expect(
      designationHeading({ startsOn: "2026-01-01", endsOn: "2026-11-06" }, TODAY),
    ).toBe("Designação encerrada (em 2026-11-06)");
  });
});

describe("schemas", () => {
  it("normalizes an empty exception reason to undefined", () => {
    const parsed = coordinatorDesignationSchema.parse({
      medicoId: "aaaaaaaa-0000-4000-8000-000000000001",
      startsOn: "2026-01-01",
      rqeExceptionReason: "  ",
    });
    expect(parsed.rqeExceptionReason).toBeUndefined();
  });
  it("rejects impossible dates and short reasons", () => {
    expect(
      coordinatorDesignationSchema.safeParse({
        medicoId: "aaaaaaaa-0000-4000-8000-000000000001",
        startsOn: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      coordinatorClosingSchema.safeParse({ endsOn: "2026-01-01", endReason: "curto" })
        .success,
    ).toBe(false);
  });
});
