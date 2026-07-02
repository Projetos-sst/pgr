/**
 * Mapeamento registro → CaLookupResult nos 3 estados, com repositório mockado
 * (data-model §3: coalesce de nulos, equipmentName opcional, baseUnsynced só
 * em not_found com base vazia).
 */
import { lookupCaRecord } from "@/shared/integrations/caepi/lookup";
import { getByCa } from "@/shared/db/repositories/caepi";
import { todayInSaoPaulo } from "@/shared/integrations/caepi/validate-ca";

jest.mock("@/shared/db/repositories/caepi", () => ({ getByCa: jest.fn() }));

const mockGetByCa = getByCa as jest.Mock;

function record(overrides: Record<string, unknown> = {}) {
  return {
    ca: "31469",
    validUntil: "2027-01-15",
    situation: "VÁLIDO",
    manufacturerName: "3M do Brasil Ltda",
    manufacturerCnpj: "45985371000108",
    equipmentName: "Respirador purificador de ar",
    description: "Peça semifacial filtrante",
    nature: "Nacional",
    norms: "ABNT NBR 13698:2011",
    syncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("lookupCaRecord", () => {
  afterEach(() => jest.resetAllMocks());

  it("registro vigente → valid com autofill completo", async () => {
    mockGetByCa.mockResolvedValue({ record: record() });
    const result = await lookupCaRecord("31469");
    expect(result).toEqual({
      status: "valid",
      ca: "31469",
      manufacturer: "3M do Brasil Ltda",
      norm: "ABNT NBR 13698:2011",
      validUntil: "2027-01-15",
      equipmentName: "Respirador purificador de ar",
    });
  });

  it("registro vencido → expired, ainda com os dados de autofill", async () => {
    mockGetByCa.mockResolvedValue({
      record: record({ situation: "VENCIDO", validUntil: "2020-01-01" }),
    });
    const result = await lookupCaRecord("31469");
    expect(result.status).toBe("expired");
    if (result.status === "expired") {
      expect(result.manufacturer).toBe("3M do Brasil Ltda");
      expect(result.validUntil).toBe("2020-01-01");
    }
  });

  it("colunas anuláveis viram string vazia; equipmentName ausente fica undefined", async () => {
    mockGetByCa.mockResolvedValue({
      record: record({ manufacturerName: null, norms: null, equipmentName: null }),
    });
    const result = await lookupCaRecord("31469");
    expect(result).toEqual({
      status: "valid",
      ca: "31469",
      manufacturer: "",
      norm: "",
      validUntil: "2027-01-15",
    });
    expect("equipmentName" in result).toBe(false);
  });

  it("sem registro com base populada → not_found sem baseUnsynced", async () => {
    mockGetByCa.mockResolvedValue({ record: null, baseEmpty: false });
    expect(await lookupCaRecord("99999")).toEqual({ status: "not_found", ca: "99999" });
  });

  it("sem registro com base vazia → not_found + baseUnsynced (base não sincronizada)", async () => {
    mockGetByCa.mockResolvedValue({ record: null, baseEmpty: true });
    expect(await lookupCaRecord("31469")).toEqual({
      status: "not_found",
      ca: "31469",
      baseUnsynced: true,
    });
  });

  it("limite: valid_until == hoje (São Paulo) → valid", async () => {
    mockGetByCa.mockResolvedValue({ record: record({ validUntil: todayInSaoPaulo() }) });
    expect((await lookupCaRecord("31469")).status).toBe("valid");
  });
});
