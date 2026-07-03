import { fetchBrasilApiCnpj } from "@/shared/integrations/providers/brasilapi";

function mockFetchResolve(status: number, body: unknown) {
  (global as { fetch: unknown }).fetch = jest.fn(async () => ({
    status,
    json: async () => body,
  }));
}

function mockFetchReject(error: Error) {
  (global as { fetch: unknown }).fetch = jest.fn(async () => {
    throw error;
  });
}

const BRASILAPI_OK = {
  cnpj: "11444777000161",
  razao_social: "Empresa Exemplo Ltda",
  nome_fantasia: "Exemplo",
  cnae_fiscal: 4712100,
  cnae_fiscal_descricao: "Comércio varejista",
  descricao_situacao_cadastral: "ATIVA",
  cep: "01001000",
  logradouro: "Praça da Sé",
  numero: "100",
  complemento: "sala 1",
  bairro: "Sé",
  municipio: "São Paulo",
  uf: "SP",
};

describe("fetchBrasilApiCnpj", () => {
  afterEach(() => jest.restoreAllMocks());

  it("mapeia payload para o DTO de empresa + endereço", async () => {
    mockFetchResolve(200, BRASILAPI_OK);
    const result = await fetchBrasilApiCnpj("11444777000161");
    expect(result).toEqual({
      ok: true,
      data: {
        cnpj: "11444777000161",
        razaoSocial: "Empresa Exemplo Ltda",
        nomeFantasia: "Exemplo",
        cnae: "4712100",
        mainActivity: "Comércio varejista",
        situacao: "ATIVA",
        address: {
          zipCode: "01001000",
          street: "Praça da Sé",
          number: "100",
          complement: "sala 1",
          district: "Sé",
          city: "São Paulo",
          state: "SP",
        },
      },
    });
  });

  it("MEI sem dados completos → sucesso parcial", async () => {
    mockFetchResolve(200, { cnpj: "11444777000161", razao_social: "MEI Fulano" });
    const result = await fetchBrasilApiCnpj("11444777000161");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.razaoSocial).toBe("MEI Fulano");
      expect(result.data.nomeFantasia).toBe("");
      expect(result.data.address.city).toBe("");
    }
  });

  it("HTTP 404 → not_found", async () => {
    mockFetchResolve(404, { message: "CNPJ não encontrado" });
    expect(await fetchBrasilApiCnpj("11444777000161")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("AbortError → timeout", async () => {
    mockFetchReject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(await fetchBrasilApiCnpj("11444777000161")).toEqual({
      ok: false,
      reason: "timeout",
    });
  });

  it("erro de rede → upstream_error", async () => {
    mockFetchReject(new Error("network down"));
    expect(await fetchBrasilApiCnpj("11444777000161")).toEqual({
      ok: false,
      reason: "upstream_error",
    });
  });

  it("payload inesperado → invalid_payload", async () => {
    mockFetchResolve(200, { razao_social: 999 });
    expect(await fetchBrasilApiCnpj("11444777000161")).toEqual({
      ok: false,
      reason: "invalid_payload",
    });
  });
});
