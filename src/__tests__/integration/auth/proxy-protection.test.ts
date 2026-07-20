import { createRouteMatcher } from "@clerk/nextjs/server";

const mockedCreateRouteMatcher = createRouteMatcher as jest.MockedFunction<
  typeof createRouteMatcher
>;

describe("proxy.ts — deny-by-default", () => {
  beforeEach(() => {
    mockedCreateRouteMatcher.mockReset();
    mockedCreateRouteMatcher.mockImplementation(((routes: string[]) => {
      const regexes = routes.map(
        (p) => new RegExp("^" + p.replace(/\(\.\*\)/g, ".*").replace(/\//g, "\\/") + "$"),
      );
      return ((req: { url: string }) =>
        regexes.some((r) => r.test(new URL(req.url).pathname))) as unknown as ReturnType<
        typeof createRouteMatcher
      >;
    }) as unknown as typeof createRouteMatcher);
  });

  const isPublic = (pathname: string) => {
    const matcher = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);
    return matcher({ url: `http://localhost${pathname}` } as never);
  };

  it.each(["/", "/sign-in", "/sign-in/factor-one", "/sign-up"])(
    "rota pública %s não dispara auth.protect()",
    (path) => {
      expect(isPublic(path)).toBe(true);
    },
  );

  it.each(["/dashboard", "/select-organization", "/api/me", "/api/anything"])(
    "rota privada %s exige auth.protect()",
    (path) => {
      expect(isPublic(path)).toBe(false);
    },
  );

  // Espelha a lista real de `src/proxy.ts` (fatia 022: `/signature-requests/(.*)` liberada) SEM o bypass dev.
  const REAL_PUBLIC = [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/sign/(.*)",
    "/signature-requests/(.*)",
    "/api/webhooks/(.*)",
  ];
  const isPublicReal = (pathname: string) =>
    createRouteMatcher(REAL_PUBLIC)({ url: `http://localhost${pathname}` } as never);

  it.each(["/signature-requests/abc123", "/sign/xyz", "/api/webhooks/clerk"])(
    "rota pública de assinatura %s é liberada (sem Clerk)",
    (path) => {
      expect(isPublicReal(path)).toBe(true);
    },
  );

  it.each(["/api/v1/pgr/1/signature", "/api/v1/anything", "/pgr", "/pgr/1"])(
    "%s continua protegida mesmo com /signature-requests liberado",
    (path) => {
      expect(isPublicReal(path)).toBe(false);
    },
  );
});
