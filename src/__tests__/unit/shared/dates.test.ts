/**
 * Datas no fuso do negócio (America/Sao_Paulo). Um carimbo gravado à noite em Brasília já está no
 * dia seguinte em UTC: a data exibida (ex.: última validação de risco no PCMSO) é a de Brasília.
 */
import {
  dateInSaoPaulo,
  formatCivilDate,
  formatInstantDate,
  formatInstantDateTime,
} from "@/shared/dates";

describe("dateInSaoPaulo", () => {
  it("instante da noite em Brasília (já dia seguinte em UTC) fica no dia de Brasília", () => {
    expect(dateInSaoPaulo("2026-11-08T01:30:00.000Z")).toBe("2026-11-07");
    expect(dateInSaoPaulo(new Date("2026-11-08T02:59:59.000Z"))).toBe("2026-11-07");
  });

  it("depois da meia-noite em Brasília vira o dia seguinte", () => {
    expect(dateInSaoPaulo("2026-11-08T03:00:00.000Z")).toBe("2026-11-08");
    expect(dateInSaoPaulo("2026-11-08T15:00:00.000Z")).toBe("2026-11-08");
  });

  it("instante inválido → null", () => {
    expect(dateInSaoPaulo("não é data")).toBeNull();
  });
});

/**
 * Exibição nas telas da Medicina (NOB-112/109/110): instante → dia de Brasília; data civil → como
 * está. Brasília é UTC-3 o ano todo (sem horário de verão desde 2019).
 */
describe("formatInstantDate", () => {
  it("20:59 de Brasília fica no mesmo dia (ainda o mesmo dia em UTC)", () => {
    expect(formatInstantDate("2026-11-07T23:59:00.000Z")).toBe("2026-11-07");
  });

  it("21:00 e 23:59 de Brasília (já dia seguinte em UTC) ficam no dia de Brasília", () => {
    expect(formatInstantDate("2026-11-08T00:00:00.000Z")).toBe("2026-11-07");
    expect(formatInstantDate("2026-11-08T02:59:00.000Z")).toBe("2026-11-07");
  });

  it("00:00 de Brasília já é o dia seguinte", () => {
    expect(formatInstantDate("2026-11-08T03:00:00.000Z")).toBe("2026-11-08");
  });

  it("virada de mês e de ano à noite em Brasília não avança a data", () => {
    expect(formatInstantDate("2026-12-01T01:30:00.000Z")).toBe("2026-11-30");
    expect(formatInstantDate("2027-01-01T02:30:00.000Z")).toBe("2026-12-31");
  });

  it("verão (sem horário de verão): janeiro continua UTC-3", () => {
    // Com a regra antiga (UTC-2 no verão) 02:30Z já seria 00:30 do dia 15.
    expect(formatInstantDate("2027-01-15T02:30:00.000Z")).toBe("2027-01-14");
  });

  it("aceita Date, ISO com offset e o formato DD/MM/AAAA", () => {
    expect(formatInstantDate(new Date("2026-11-08T01:30:00.000Z"))).toBe("2026-11-07");
    expect(formatInstantDate("2026-11-07T22:30:00-03:00")).toBe("2026-11-07");
    expect(formatInstantDate("2026-11-08T01:30:00.000Z", "br")).toBe("07/11/2026");
  });

  it("ausente ou inválido → travessão", () => {
    expect(formatInstantDate(null)).toBe("—");
    expect(formatInstantDate(undefined)).toBe("—");
    expect(formatInstantDate("")).toBe("—");
    expect(formatInstantDate("não é data")).toBe("—");
    expect(formatInstantDate(new Date(Number.NaN))).toBe("—");
  });
});

describe("formatInstantDateTime", () => {
  it("data e hora de Brasília, não de UTC", () => {
    expect(formatInstantDateTime("2026-11-03T01:30:00.000Z")).toBe("2026-11-02 22:30");
    expect(formatInstantDateTime("2026-11-07T23:59:00.000Z")).toBe("2026-11-07 20:59");
  });

  it("meia-noite de Brasília é 00:00 (nunca 24:00)", () => {
    expect(formatInstantDateTime("2026-11-08T03:00:00.000Z")).toBe("2026-11-08 00:00");
  });

  it("virada de ano e verão sem horário de verão", () => {
    expect(formatInstantDateTime("2027-01-01T02:30:00.000Z")).toBe("2026-12-31 23:30");
    expect(formatInstantDateTime("2027-01-15T02:30:00.000Z")).toBe("2027-01-14 23:30");
  });

  it("ausente ou inválido → travessão", () => {
    expect(formatInstantDateTime(null)).toBe("—");
    expect(formatInstantDateTime("")).toBe("—");
    expect(formatInstantDateTime("x")).toBe("—");
  });
});

describe("formatCivilDate", () => {
  it("data civil é exibida como está, sem passar por UTC", () => {
    expect(formatCivilDate("2026-03-10")).toBe("2026-03-10");
    expect(formatCivilDate("2026-12-31")).toBe("2026-12-31");
    expect(formatCivilDate("2026-03-10", "br")).toBe("10/03/2026");
    // A armadilha que o helper evita: tratar a data civil como instante volta um dia.
    expect(dateInSaoPaulo("2026-03-10")).toBe("2026-03-09");
  });

  it("29 de fevereiro só em ano bissexto", () => {
    expect(formatCivilDate("2028-02-29")).toBe("2028-02-29");
    expect(formatCivilDate("2026-02-29")).toBe("—");
  });

  it("ausente, fora do padrão, com hora ou dia inexistente → travessão", () => {
    expect(formatCivilDate(null)).toBe("—");
    expect(formatCivilDate(undefined)).toBe("—");
    expect(formatCivilDate("")).toBe("—");
    expect(formatCivilDate("10/03/2026")).toBe("—");
    expect(formatCivilDate("2026-03-10T00:00:00.000Z")).toBe("—");
    expect(formatCivilDate("2026-13-01")).toBe("—");
    expect(formatCivilDate("2026-04-31")).toBe("—");
  });
});
