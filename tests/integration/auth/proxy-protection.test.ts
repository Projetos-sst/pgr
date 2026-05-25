import { createRouteMatcher } from "@clerk/nextjs/server";

const mockedCreateRouteMatcher = createRouteMatcher as jest.MockedFunction<
  typeof createRouteMatcher
>;

describe("proxy.ts — deny-by-default", () => {
  beforeEach(() => {
    mockedCreateRouteMatcher.mockReset();
    mockedCreateRouteMatcher.mockImplementation(((routes: string[]) => {
      const regexes = routes.map(
        (p) =>
          new RegExp(
            "^" + p.replace(/\(\.\*\)/g, ".*").replace(/\//g, "\\/") + "$",
          ),
      );
      return ((req: { url: string }) =>
        regexes.some((r) =>
          r.test(new URL(req.url).pathname),
        )) as unknown as ReturnType<typeof createRouteMatcher>;
    }) as unknown as typeof createRouteMatcher);
  });

  const isPublic = (pathname: string) => {
    const matcher = createRouteMatcher([
      "/",
      "/sign-in(.*)",
      "/sign-up(.*)",
    ]);
    return matcher({ url: `http://localhost${pathname}` } as never);
  };

  it.each(["/", "/sign-in", "/sign-in/factor-one", "/sign-up"])(
    "rota pública %s não dispara auth.protect()",
    (path) => {
      expect(isPublic(path)).toBe(true);
    },
  );

  it.each([
    "/dashboard",
    "/select-organization",
    "/api/whoami",
    "/api/anything",
  ])("rota privada %s exige auth.protect()", (path) => {
    expect(isPublic(path)).toBe(false);
  });
});
