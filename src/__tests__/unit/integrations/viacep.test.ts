import { fetchViaCep } from "@/shared/integrations/providers/viacep";

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

const VIACEP_OK = {
  cep: "01001-000",
  logradouro: "Praça da Sé",
  complemento: "lado ímpar",
  bairro: "Sé",
  localidade: "São Paulo",
  uf: "SP",
};

describe("fetchViaCep", () => {
  afterEach(() => jest.restoreAllMocks());

  it("mapeia payload para o DTO de endereço", async () => {
    mockFetchResolve(200, VIACEP_OK);
    const result = await fetchViaCep("01001000");
    expect(result).toEqual({
      ok: true,
      data: {
        zipCode: "01001000",
        street: "Praça da Sé",
        complement: "lado ímpar",
        district: "Sé",
        city: "São Paulo",
        state: "SP",
      },
    });
  });

  it("preenche parcialmente quando falta logradouro (CEP de grande usuário)", async () => {
    mockFetchResolve(200, {
      cep: "01000-000",
      localidade: "São Paulo",
      uf: "SP",
    });
    const result = await fetchViaCep("01000000");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.street).toBe("");
      expect(result.data.city).toBe("São Paulo");
    }
  });

  it("erro:true → not_found", async () => {
    mockFetchResolve(200, { erro: true });
    expect(await fetchViaCep("00000000")).toEqual({ ok: false, reason: "not_found" });
  });

  it("erro:'true' (string) → not_found", async () => {
    mockFetchResolve(200, { erro: "true" });
    expect(await fetchViaCep("00000000")).toEqual({ ok: false, reason: "not_found" });
  });

  it("HTTP 400 → not_found", async () => {
    mockFetchResolve(400, null);
    expect(await fetchViaCep("123")).toEqual({ ok: false, reason: "not_found" });
  });

  it("AbortError → timeout", async () => {
    mockFetchReject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(await fetchViaCep("01001000")).toEqual({ ok: false, reason: "timeout" });
  });

  it("erro de rede → upstream_error", async () => {
    mockFetchReject(new Error("network down"));
    expect(await fetchViaCep("01001000")).toEqual({
      ok: false,
      reason: "upstream_error",
    });
  });

  it("payload em formato inesperado → invalid_payload", async () => {
    mockFetchResolve(200, { logradouro: 123 });
    expect(await fetchViaCep("01001000")).toEqual({
      ok: false,
      reason: "invalid_payload",
    });
  });
});
