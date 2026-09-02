import {
  ACCIDENT_SEVERITY_LABELS,
  accidentCreateSchema,
  accidentFiltersSchema,
  accidentSeveritySchema,
  formatIncidentNumber,
  nextAccidentNumber,
  toAccidentListItem,
} from "@/shared/domains/safety/accident";

describe("nextAccidentNumber", () => {
  it("começa em 1 quando não há incidente (null/undefined)", () => {
    expect(nextAccidentNumber(null)).toBe(1);
    expect(nextAccidentNumber(undefined)).toBe(1);
  });

  it("incrementa o máximo atual e é defensivo", () => {
    expect(nextAccidentNumber(0)).toBe(1);
    expect(nextAccidentNumber(41)).toBe(42);
    expect(nextAccidentNumber(-3)).toBe(1);
    expect(nextAccidentNumber(Number.NaN)).toBe(1);
  });
});

describe("formatIncidentNumber", () => {
  it("formata como INC-0001 com zero-padding", () => {
    expect(formatIncidentNumber(1)).toBe("INC-0001");
    expect(formatIncidentNumber(219)).toBe("INC-0219");
    expect(formatIncidentNumber(12345)).toBe("INC-12345");
  });
});

describe("accidentSeveritySchema / labels (inclui Sem lesão)", () => {
  it("aceita no_injury e mantém os demais níveis", () => {
    expect(accidentSeveritySchema.parse("no_injury")).toBe("no_injury");
    expect(accidentSeveritySchema.parse("severe")).toBe("severe");
    expect(() => accidentSeveritySchema.parse("bogus")).toThrow();
  });

  it("rotula no_injury como 'Sem lesão'", () => {
    expect(ACCIDENT_SEVERITY_LABELS.no_injury).toBe("Sem lesão");
    expect(ACCIDENT_SEVERITY_LABELS.minor).toBe("Leve");
  });

  it("filtro aceita severity no_injury", () => {
    expect(accidentFiltersSchema.parse({ severity: "no_injury" }).severity).toBe(
      "no_injury",
    );
  });
});

describe("accidentCreateSchema", () => {
  const base = {
    companyId: "11111111-1111-1111-1111-111111111111",
    occurredAt: "2026-07-10T12:00:00Z",
    type: "typical",
    category: "without_leave",
    severity: "no_injury",
  };

  it("aceita conteúdo mínimo com severity no_injury", () => {
    const parsed = accidentCreateSchema.parse(base);
    expect(parsed.severity).toBe("no_injury");
  });

  it("rejeita `number` vindo do cliente (server-only, strict)", () => {
    expect(() => accidentCreateSchema.parse({ ...base, number: 5 })).toThrow();
  });
});

describe("toAccidentListItem", () => {
  it("expõe number + numberLabel e severityLabel", () => {
    const item = toAccidentListItem({
      id: "id-1",
      number: 219,
      occurredAt: new Date("2026-07-02T00:00:00Z"),
      type: "typical",
      category: "without_leave",
      severity: "no_injury",
      status: "registered",
      companyName: "ACME LTDA",
    });
    expect(item.number).toBe(219);
    expect(item.numberLabel).toBe("INC-0219");
    expect(item.severityLabel).toBe("Sem lesão");
    expect(item.statusLabel).toBe("Registrado");
  });
});
