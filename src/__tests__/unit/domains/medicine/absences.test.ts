/**
 * Afastamentos (NOB-139): exame de retorno (NR-7 7.5.9: 29 dias não, 30 sim), afastamento em
 * andamento, outro motivo, retorno não confirmado, sinalização da NR-7 7.5.19.5 c só no contexto
 * relacionado ao trabalho, sobreposição de períodos e validação. Fictício.
 */
import {
  absenceClinicalNoteSchema,
  absenceInputSchema,
  assessAbsence,
  periodsOverlap,
} from "@/shared/domains/medicine/absences";

const EMP = "11111111-1111-4111-8111-111111111111";
const base = {
  cause: "illness" as const,
  workRelation: "not_determined" as const,
  startsOn: "2026-01-01",
  endsOn: null as string | null,
  returnedOn: null as string | null,
  cancelledAt: null,
};
const TODAY = "2026-06-01";

describe("assessAbsence — exame de retorno (NR-7 7.5.9)", () => {
  it("29 dias: não exigido; 30 dias: sugerido; mais de 30: mantém", () => {
    expect(
      assessAbsence({ ...base, endsOn: "2026-01-29" }, [], TODAY).returnExam.state,
    ).toBe("not_required");
    const thirty = assessAbsence({ ...base, endsOn: "2026-01-30" }, [], TODAY).returnExam;
    expect(thirty).toMatchObject({
      state: "required",
      mustBeDoneBefore: "2026-01-31",
      requiresMedicalConfirmation: true,
      reference: "NR-7 7.5.9",
    });
    expect(
      assessAbsence({ ...base, endsOn: "2026-03-10" }, [], TODAY).returnExam.state,
    ).toBe("required");
  });

  it("retorno confirmado usa a véspera como último dia", () => {
    const a = assessAbsence(
      { ...base, endsOn: "2026-01-29", returnedOn: "2026-01-30" },
      [],
      TODAY,
    );
    expect(a.status).toBe("returned");
    expect(a.knownDays).toBe(29);
    expect(a.returnExam.state).toBe("not_required");
  });

  it("em andamento sem fim: acompanha abaixo de 30 e sugere a partir de 30, sem presumir data final", () => {
    const early = assessAbsence(base, [], "2026-01-29");
    expect(early).toMatchObject({ status: "ongoing", elapsedDays: 29, knownDays: null });
    expect(early.returnExam.state).toBe("monitor");
    const late = assessAbsence(base, [], "2026-01-30");
    expect(late.elapsedDays).toBe(30);
    expect(late.returnExam).toMatchObject({ state: "required", mustBeDoneBefore: null });
  });

  it("fim informado mas retorno não confirmado: continua em andamento", () => {
    const a = assessAbsence({ ...base, endsOn: "2026-02-15" }, [], "2026-01-10");
    expect(a.status).toBe("ongoing");
    expect(a.returnExam.state).toBe("required");
    expect(a.returnExam.reason).toContain("o retorno ainda não foi confirmado");
  });

  it("outro motivo: a regra de doença/acidente não se aplica automaticamente", () => {
    const a = assessAbsence({ ...base, cause: "other", endsOn: "2026-03-01" }, [], TODAY);
    expect(a.returnExam.state).toBe("not_applicable");
    expect(a.socialSecurityReferral).toBeNull();
  });

  it("exame de retorno registrado a partir do início é reconhecido; anterior não conta", () => {
    const a = assessAbsence(
      { ...base, endsOn: "2026-02-15" },
      ["2025-12-01", "2026-02-16"],
      TODAY,
    );
    expect(a.returnExam.recordedOn).toBe("2026-02-16");
    expect(
      assessAbsence({ ...base, endsOn: "2026-02-15" }, ["2025-12-01"], TODAY).returnExam
        .recordedOn,
    ).toBeNull();
  });
});

describe("assessAbsence — NR-7 7.5.19.5 c (sinalização informativa)", () => {
  it("só sinaliza doença/acidente informado como relacionado ao trabalho e acima de 15 dias", () => {
    const occ = { ...base, workRelation: "occupational" as const };
    expect(
      assessAbsence({ ...occ, endsOn: "2026-01-15" }, [], TODAY).socialSecurityReferral,
    ).toMatchObject({
      flagged: false,
    });
    const flagged = assessAbsence(
      { ...occ, endsOn: "2026-01-16" },
      [],
      TODAY,
    ).socialSecurityReferral;
    expect(flagged?.flagged).toBe(true);
    expect(flagged?.reason).toContain("não decide nexo");
    expect(flagged?.reason).toContain("não registra o encaminhamento como feito");
    expect(
      assessAbsence(
        { ...base, workRelation: "non_occupational", endsOn: "2026-03-01" },
        [],
        TODAY,
      ).socialSecurityReferral,
    ).toMatchObject({ flagged: false });
    expect(
      assessAbsence({ ...base, endsOn: "2026-03-01" }, [], TODAY).socialSecurityReferral
        ?.flagged,
    ).toBe(false);
  });

  it("cancelado não sinaliza", () => {
    expect(
      assessAbsence(
        {
          ...base,
          workRelation: "occupational",
          endsOn: "2026-03-01",
          cancelledAt: "2026-01-02T00:00:00Z",
        },
        [],
        TODAY,
      ).socialSecurityReferral,
    ).toBeNull();
  });
});

describe("periodsOverlap", () => {
  const p = (
    startsOn: string,
    endsOn: string | null,
    returnedOn: string | null = null,
  ) => ({
    startsOn,
    endsOn,
    returnedOn,
  });
  it("detecta cruzamento, inclusive com fim em aberto", () => {
    expect(
      periodsOverlap(p("2026-01-01", "2026-01-10"), p("2026-01-10", "2026-01-20")),
    ).toBe(true);
    expect(periodsOverlap(p("2026-01-01", "2026-01-10"), p("2026-01-11", null))).toBe(
      false,
    );
    expect(periodsOverlap(p("2026-01-01", null), p("2026-05-01", "2026-05-02"))).toBe(
      true,
    );
    expect(
      periodsOverlap(p("2026-01-01", "2026-01-09", "2026-01-10"), p("2026-01-10", null)),
    ).toBe(false);
  });
});

describe("schemas", () => {
  it("valida datas, causa e relação; outro motivo não aceita relação", () => {
    expect(
      absenceInputSchema.parse({
        employeeId: EMP,
        cause: "illness",
        startsOn: "2026-01-01",
      }),
    ).toMatchObject({ workRelation: "not_determined" });
    expect(
      absenceInputSchema.safeParse({
        employeeId: EMP,
        cause: "illness",
        startsOn: "2026-01-10",
        endsOn: "2026-01-09",
      }).success,
    ).toBe(false);
    expect(
      absenceInputSchema.safeParse({
        employeeId: EMP,
        cause: "other",
        workRelation: "occupational",
        startsOn: "2026-01-10",
      }).success,
    ).toBe(false);
    expect(
      absenceInputSchema.safeParse({
        employeeId: EMP,
        cause: "illness",
        startsOn: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      absenceInputSchema.safeParse({
        employeeId: EMP,
        cause: "illness",
        startsOn: "2026-01-01",
        cid: "M54.5",
      }).success,
    ).toBe(false);
  });

  it("área clínica: CID exige autorização do trabalhador; formato CID-10", () => {
    expect(absenceClinicalNoteSchema.safeParse({ cid: "M54.5" }).success).toBe(false);
    expect(
      absenceClinicalNoteSchema.parse({
        cid: "m54.5",
        workerAuthorization: "Termo fictício 01",
      }),
    ).toMatchObject({ cid: "M54.5" });
    expect(
      absenceClinicalNoteSchema.safeParse({ cid: "XX", workerAuthorization: "Termo" })
        .success,
    ).toBe(false);
    expect(absenceClinicalNoteSchema.safeParse({}).success).toBe(false);
    expect(
      absenceClinicalNoteSchema.parse({ content: "Atestado fictício de 10 dias." }),
    ).toBeTruthy();
  });
});
