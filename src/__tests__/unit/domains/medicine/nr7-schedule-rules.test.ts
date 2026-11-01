import {
  addDays,
  addMonths,
  daysBetween,
  suggestDismissalExam,
  suggestPeriodicInterval,
  suggestReturnToWorkExam,
} from "@/shared/domains/medicine/nr7-schedule-rules";

describe("date helpers", () => {
  it("counts calendar days across leap years and month ends", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
  });
  it("adds calendar months clamping to the last day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonths("2026-05-10", 24)).toBe("2028-05-10");
  });
  it("rejects impossible dates", () => {
    expect(() => daysBetween("2026-02-30", "2026-03-01")).toThrow(RangeError);
  });
});

describe("suggestDismissalExam (NR-7 7.5.11, regra 2 da MED-20)", () => {
  const end = "2026-06-30";
  // Caso 17: graus 1 e 2 com 134 e 135 dias.
  it.each([1, 2] as const)("grau %i: 134 dias dispensa, 135 não", (riskGrade) => {
    const at134 = suggestDismissalExam({
      contractEndOn: end,
      lastClinicalExamOn: addDays(end, -134),
      riskGrade,
    });
    expect(at134).toMatchObject({
      waivable: true,
      daysSinceLastClinicalExam: 134,
      limitDays: 135,
    });
    const at135 = suggestDismissalExam({
      contractEndOn: end,
      lastClinicalExamOn: addDays(end, -135),
      riskGrade,
    });
    expect(at135).toMatchObject({ waivable: false, daysSinceLastClinicalExam: 135 });
  });
  // Caso 18: graus 3 e 4 com 89 e 90 dias.
  it.each([3, 4] as const)("grau %i: 89 dias dispensa, 90 não", (riskGrade) => {
    expect(
      suggestDismissalExam({
        contractEndOn: end,
        lastClinicalExamOn: addDays(end, -89),
        riskGrade,
      }).waivable,
    ).toBe(true);
    expect(
      suggestDismissalExam({
        contractEndOn: end,
        lastClinicalExamOn: addDays(end, -90),
        riskGrade,
      }).waivable,
    ).toBe(false);
  });
  it("uses 135 days, not the 120 days in the MED-19 note", () => {
    expect(
      suggestDismissalExam({
        contractEndOn: end,
        lastClinicalExamOn: addDays(end, -125),
        riskGrade: 1,
      }).waivable,
    ).toBe(true);
  });
  it("deadline is 10 days after the contract end; always a suggestion", () => {
    const s = suggestDismissalExam({
      contractEndOn: end,
      lastClinicalExamOn: null,
      riskGrade: 3,
    });
    expect(s).toMatchObject({
      deadline: "2026-07-10",
      waivable: false,
      requiresMedicalConfirmation: true,
      reference: "NR-7 7.5.11",
    });
  });
  it("does not guess without the company risk grade or with inconsistent dates", () => {
    expect(
      suggestDismissalExam({
        contractEndOn: end,
        lastClinicalExamOn: "2026-06-01",
        riskGrade: null,
      }).waivable,
    ).toBeNull();
    expect(
      suggestDismissalExam({
        contractEndOn: end,
        lastClinicalExamOn: "2026-07-05",
        riskGrade: 2,
      }).waivable,
    ).toBeNull();
  });
});

describe("suggestReturnToWorkExam (NR-7 7.5.9, regra 3 da MED-20)", () => {
  // Caso 19: afastamento com 29 e 30 dias.
  it("29 days of absence: not required; 30 days: required", () => {
    expect(
      suggestReturnToWorkExam({
        absenceStartOn: "2026-03-01",
        lastAbsenceDayOn: "2026-03-29",
      }),
    ).toMatchObject({ required: false, absenceDays: 29 });
    expect(
      suggestReturnToWorkExam({
        absenceStartOn: "2026-03-01",
        lastAbsenceDayOn: "2026-03-30",
      }),
    ).toMatchObject({ required: true, absenceDays: 30, mustBeDoneBefore: "2026-03-31" });
  });
  it("rejects an end before the start", () => {
    expect(() =>
      suggestReturnToWorkExam({
        absenceStartOn: "2026-03-10",
        lastAbsenceDayOn: "2026-03-01",
      }),
    ).toThrow(RangeError);
  });
});

describe("suggestPeriodicInterval (NR-7 7.5.8, II)", () => {
  it("exposed or chronic: up to 12 months", () => {
    expect(
      suggestPeriodicInterval({ exposure: "exposed", lastClinicalExamOn: "2026-01-15" }),
    ).toMatchObject({ maxIntervalMonths: 12, nextDueOn: "2027-01-15" });
    expect(
      suggestPeriodicInterval({
        exposure: "not_exposed",
        chronicDiseaseIncreasingSusceptibility: true,
        lastClinicalExamOn: "2026-01-15",
      }).maxIntervalMonths,
    ).toBe(12);
  });
  // Caso 13: sem riscos aplicáveis declarados.
  it("declared not exposed: 24 months", () => {
    expect(
      suggestPeriodicInterval({
        exposure: "not_exposed",
        lastClinicalExamOn: "2026-01-15",
      }),
    ).toMatchObject({ maxIntervalMonths: 24, nextDueOn: "2028-01-15" });
  });
  // Caso 14: risco ainda não cadastrado não vira "sem risco" (MED-09).
  it("unknown exposure never becomes 'no risk'", () => {
    expect(
      suggestPeriodicInterval({ exposure: "unknown", lastClinicalExamOn: "2026-01-15" }),
    ).toMatchObject({ maxIntervalMonths: null, nextDueOn: null });
  });
});
