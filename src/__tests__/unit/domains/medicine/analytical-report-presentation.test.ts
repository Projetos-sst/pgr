/**
 * Apresentação e discussão do relatório analítico (NOB-168): entradas, CIPA, datas e situação
 * derivada (sem finalização, pendente, discussão pendente, registradas; nova versão). Fictício.
 */
import {
  occurredOnProblem,
  reportEventInputSchema,
  summarizeReportPresentation,
  type ReportEventLike,
} from "@/shared/domains/medicine/analytical-report-presentation";

const presented = {
  kind: "presented",
  occurredOn: "2026-11-03",
  modality: "in_person",
  participants: [{ role: "cipa" }, { role: "sst_responsible", name: "Fulano Fictício" }],
  cipaSituation: "participated",
};

describe("reportEventInputSchema", () => {
  it("apresentação: CIPA participou exige representante; sem CIPA exige a verificação", () => {
    expect(reportEventInputSchema.parse(presented)).toMatchObject({ kind: "presented" });
    expect(() =>
      reportEventInputSchema.parse({
        ...presented,
        participants: [{ role: "employer" }],
      }),
    ).toThrow(/representante da CIPA/);
    expect(() =>
      reportEventInputSchema.parse({ ...presented, cipaSituation: "not_constituted" }),
    ).toThrow(/verificado/);
    expect(
      reportEventInputSchema.parse({
        ...presented,
        cipaSituation: "not_constituted",
        cipaReference: "Cadastro conferido",
        participants: [{ role: "employer" }],
      }),
    ).toMatchObject({ cipaSituation: "not_constituted" });
  });
  it("participantes: só função e nome; campo extra (ex.: CPF) é recusado; lista vazia também", () => {
    expect(() =>
      reportEventInputSchema.parse({
        ...presented,
        participants: [{ role: "cipa", cpf: "1" }],
      }),
    ).toThrow();
    expect(() =>
      reportEventInputSchema.parse({ ...presented, participants: [] }),
    ).toThrow();
  });
  it("discussão: síntese obrigatória; medidas com responsável e prazo opcionais", () => {
    const parsed = reportEventInputSchema.parse({
      kind: "discussed",
      occurredOn: "2026-11-03",
      participants: [{ role: "pcmso_coordinator" }],
      summary: "Síntese agregada fictícia.",
      measures: [{ description: "Revisar cronograma", dueDate: "" }],
    });
    expect(parsed).toMatchObject({ measures: [{ description: "Revisar cronograma" }] });
    expect(() =>
      reportEventInputSchema.parse({
        kind: "discussed",
        occurredOn: "2026-11-03",
        participants: [{ role: "cipa" }],
        summary: "curta",
      }),
    ).toThrow();
  });
});

describe("occurredOnProblem", () => {
  it("não futura e não anterior à geração da versão (limites inclusivos)", () => {
    expect(occurredOnProblem("2026-11-03", "2026-11-03", "2026-11-03")).toBeNull();
    expect(occurredOnProblem("2026-11-04", "2026-11-01", "2026-11-03")).toMatch(/futura/);
    expect(occurredOnProblem("2026-10-31", "2026-11-01", "2026-11-03")).toMatch(
      /anterior/,
    );
  });
});

describe("summarizeReportPresentation", () => {
  let n = 0;
  const ev = (o: Partial<ReportEventLike>): ReportEventLike => ({
    id: `e${(n += 1)}`,
    reportId: "r2",
    kind: "finalized",
    cipaSituation: null,
    voidsId: null,
    recordedAt: `2026-11-03T10:00:0${n % 10}.000Z`,
    ...o,
  });
  it("sem relatório, sem finalização, pendente, discussão pendente e registradas", () => {
    expect(summarizeReportPresentation([], null).state).toBe("no_report");
    expect(summarizeReportPresentation([], "r2").state).toBe("not_finalized");
    const fin = ev({});
    expect(summarizeReportPresentation([fin], "r2").state).toBe("pending_presentation");
    const pres = ev({ kind: "presented", cipaSituation: "participated" });
    expect(summarizeReportPresentation([fin, pres], "r2")).toMatchObject({
      state: "discussion_pending",
      cipaRequirementMet: true,
    });
    expect(
      summarizeReportPresentation([fin, pres, ev({ kind: "discussed" })], "r2").state,
    ).toBe("presented_and_discussed");
  });
  it("CIPA desconhecida não atende; correção tira o efeito; nova versão não herda", () => {
    const fin = ev({});
    const pres = ev({ kind: "presented", cipaSituation: "unknown" });
    expect(summarizeReportPresentation([fin, pres], "r2").cipaRequirementMet).toBe(false);
    expect(
      summarizeReportPresentation(
        [fin, pres, ev({ kind: "voided", voidsId: pres.id })],
        "r2",
      ).state,
    ).toBe("pending_presentation");
    expect(
      summarizeReportPresentation(
        [fin, pres, ev({ kind: "voided", voidsId: fin.id })],
        "r2",
      ).state,
    ).toBe("not_finalized");
    const old = ev({ reportId: "r1", kind: "presented", cipaSituation: "participated" });
    expect(summarizeReportPresentation([old], "r2")).toMatchObject({
      state: "not_finalized",
      previousVersionPresented: true,
    });
  });
});
