import {
  assessCoordinatorEligibility,
  coordinatorClosingSchema,
  coordinatorDesignationSchema,
  coordinatorOn,
  planCoordinatorSwitch,
  previousIsoDay,
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
