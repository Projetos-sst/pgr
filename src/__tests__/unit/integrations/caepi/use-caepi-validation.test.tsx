/**
 * O `useLookup` base não tem teste próprio no repo — este cobre, via wrapper
 * CAEPI, a derivação dos estados do payload 200 e os edge cases herdados
 * (US1-7 abort em digitação rápida, US1-8 erro silencioso).
 */
import { act, renderHook, waitFor } from "@testing-library/react";

import { useCaepiValidation } from "@/shared/integrations/caepi/client/use-caepi-validation";
import type { CaLookupResult } from "@/shared/integrations/caepi/types";
import { ok } from "@/shared/server/result";

function mockFetchPayload(result: CaLookupResult) {
  (global as { fetch: unknown }).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ok(result),
  }));
}

const VALID_RESULT: CaLookupResult = {
  status: "valid",
  ca: "31469",
  manufacturer: "3M do Brasil Ltda",
  norm: "ABNT NBR 13698:2011",
  validUntil: "2027-01-15",
};

describe("useCaepiValidation", () => {
  afterEach(() => jest.restoreAllMocks());

  it("payload valid → status valid + onFound com os dados de autofill", async () => {
    mockFetchPayload(VALID_RESULT);
    const onFound = jest.fn();
    const { result } = renderHook(() => useCaepiValidation(onFound));

    act(() => result.current.lookup("31469"));
    await waitFor(() => expect(result.current.status).toBe("valid"));
    expect(onFound).toHaveBeenCalledWith(VALID_RESULT);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/integrations/caepi/31469",
      expect.anything(),
    );
  });

  it("payload expired → status expired e AINDA chama onFound (autofill)", async () => {
    const expired: CaLookupResult = { ...VALID_RESULT, status: "expired" };
    mockFetchPayload(expired);
    const onFound = jest.fn();
    const { result } = renderHook(() => useCaepiValidation(onFound));

    act(() => result.current.lookup("31469"));
    await waitFor(() => expect(result.current.status).toBe("expired"));
    expect(onFound).toHaveBeenCalledWith(expired);
  });

  it("payload not_found → status not_found e NUNCA chama onFound", async () => {
    mockFetchPayload({ status: "not_found", ca: "99999" });
    const onFound = jest.fn();
    const { result } = renderHook(() => useCaepiValidation(onFound));

    act(() => result.current.lookup("99999"));
    await waitFor(() => expect(result.current.status).toBe("not_found"));
    expect(onFound).not.toHaveBeenCalled();
  });

  it("expõe baseUnsynced no data quando a base nunca foi sincronizada", async () => {
    mockFetchPayload({ status: "not_found", ca: "31469", baseUnsynced: true });
    const { result } = renderHook(() => useCaepiValidation(jest.fn()));

    act(() => result.current.lookup("31469"));
    await waitFor(() => expect(result.current.status).toBe("not_found"));
    expect(result.current.data).toEqual({
      status: "not_found",
      ca: "31469",
      baseUnsynced: true,
    });
  });

  it("formato inválido não dispara fetch (herdado do useLookup)", () => {
    (global as { fetch: unknown }).fetch = jest.fn();
    const { result } = renderHook(() => useCaepiValidation(jest.fn()));

    act(() => result.current.lookup("abc"));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("falha de rede → status error silencioso, sem lançar (US1-8)", async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    const onFound = jest.fn();
    const { result } = renderHook(() => useCaepiValidation(onFound));

    act(() => result.current.lookup("31469"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(onFound).not.toHaveBeenCalled();
  });

  it("dois lookups em sequência → o primeiro é abortado (US1-7)", async () => {
    const signals: AbortSignal[] = [];
    (global as { fetch: unknown }).fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) => {
        signals.push(init.signal);
        return new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true, json: async () => ok(VALID_RESULT) }), 10);
        });
      },
    );
    const { result } = renderHook(() => useCaepiValidation(jest.fn()));

    act(() => result.current.lookup("11111"));
    act(() => result.current.lookup("31469"));

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    await waitFor(() => expect(result.current.status).toBe("valid"));
  });
});
