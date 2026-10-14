import {
  googleBackoffDelay,
  googleErrorStatus,
  isRetriableGoogleStatus,
  withGoogleRetry,
} from "@/shared/integrations/google/retry";

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });

describe("googleErrorStatus", () => {
  it("lê o status em qualquer formato do gaxios", () => {
    expect(googleErrorStatus({ response: { status: 429 } })).toBe(429);
    expect(googleErrorStatus({ response: { data: { error: { code: 503 } } } })).toBe(503);
    expect(googleErrorStatus({ code: 408 })).toBe(408);
    expect(googleErrorStatus({ status: 404 })).toBe(404);
    expect(googleErrorStatus({ code: "ECONNRESET" })).toBeUndefined();
    expect(googleErrorStatus(null)).toBeUndefined();
  });
});

describe("política de retry (espelho do Salesbud)", () => {
  it("só 429/503/408 são transitórios", () => {
    expect([429, 503, 408].every(isRetriableGoogleStatus)).toBe(true);
    expect([400, 401, 403, 404, 500, undefined].some(isRetriableGoogleStatus)).toBe(
      false,
    );
  });

  it("backoff exponencial de 1,5s com teto de 60s", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => googleBackoffDelay(n))).toEqual([
      1500, 3000, 6000, 12000, 24000, 48000, 60000,
    ]);
  });
});

describe("withGoogleRetry", () => {
  const sleep = jest.fn(async () => undefined);
  beforeEach(() => sleep.mockClear());

  it("repete erro transitório e devolve o sucesso", async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValue("ok");
    await expect(withGoogleRetry(operation, { sleep, random: () => 0 })).resolves.toBe(
      "ok",
    );
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1500], [3000]]);
  });

  it("erro definitivo sobe na hora, sem esperar", async () => {
    const operation = jest.fn().mockRejectedValue(httpError(403));
    await expect(withGoogleRetry(operation, { sleep })).rejects.toThrow("HTTP 403");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("desiste após o máximo de tentativas", async () => {
    const operation = jest.fn().mockRejectedValue(httpError(429));
    await expect(
      withGoogleRetry(operation, { sleep, maxAttempts: 3, random: () => 0.5 }),
    ).rejects.toThrow("HTTP 429");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1650], [3150]]);
  });
});
