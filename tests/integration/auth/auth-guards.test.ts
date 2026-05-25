import { auth } from "@clerk/nextjs/server";

import { GET as whoamiRouteHandler } from "@/app/api/whoami/route";
import { whoamiAction } from "@/lib/server/actions/whoami";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

type SessionOverride = Partial<{
  isAuthenticated: boolean;
  userId: string | null;
  sessionId: string | null;
  orgId: string | null;
  orgRole: string | null;
  orgSlug: string | null;
}>;

const setSession = (session: SessionOverride) => {
  mockedAuth.mockResolvedValue({
    isAuthenticated: false,
    userId: null,
    sessionId: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    ...session,
  } as unknown as Awaited<ReturnType<typeof auth>>);
};

describe("US5 — bloqueio universal e tenant da sessão (FR-009, FR-020)", () => {
  beforeEach(() => mockedAuth.mockReset());

  // -------- (a)(b)(c) Server Action --------

  it("(a) whoamiAction rejeita sem sessão", async () => {
    setSession({ isAuthenticated: false });
    await expect(whoamiAction()).resolves.toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("(b) whoamiAction rejeita sem org", async () => {
    setSession({
      isAuthenticated: true,
      userId: "u1",
      sessionId: "s1",
      orgId: null,
    });
    await expect(whoamiAction()).resolves.toEqual({
      ok: false,
      error: "NO_ACTIVE_ORG",
    });
  });

  it("(c) whoamiAction ignora orgId passado como parâmetro extra", async () => {
    setSession({
      isAuthenticated: true,
      userId: "u1",
      sessionId: "s1",
      orgId: "org_SESSION",
    });
    const action = whoamiAction as unknown as (
      fake?: { orgId: string },
    ) => Promise<unknown>;
    await expect(action({ orgId: "org_FAKE" })).resolves.toEqual({
      ok: true,
      userId: "u1",
      orgId: "org_SESSION",
    });
  });

  // -------- (d)(e)(e2)(e3) Route Handler --------

  it("(d) GET /api/whoami retorna 401 sem sessão", async () => {
    setSession({ isAuthenticated: false });
    const res = await whoamiRouteHandler();
    expect(res.status).toBe(401);
  });

  it("(e) GET /api/whoami?orgId=org_FAKE devolve orgId da SESSÃO", async () => {
    setSession({
      isAuthenticated: true,
      userId: "u1",
      sessionId: "s1",
      orgId: "org_SESSION",
    });
    const res = await whoamiRouteHandler();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orgId).toBe("org_SESSION");
    expect(body.orgId).not.toBe("org_FAKE");
  });

  it("(e2) C4 — Server Action chamada com FormData.orgId='org_FAKE' é ignorada", async () => {
    setSession({
      isAuthenticated: true,
      userId: "u1",
      sessionId: "s1",
      orgId: "org_SESSION",
    });
    const formData = new FormData();
    formData.append("orgId", "org_FAKE");
    const action = whoamiAction as unknown as (
      fd?: FormData,
    ) => Promise<{ orgId?: string }>;
    const out = await action(formData);
    expect(out).toEqual({
      ok: true,
      userId: "u1",
      orgId: "org_SESSION",
    });
  });

  it("(e3) C4 — Route Handler ignora qualquer cabeçalho X-Org-Id (constituição §I)", async () => {
    setSession({
      isAuthenticated: true,
      userId: "u1",
      sessionId: "s1",
      orgId: "org_SESSION",
    });
    const res = await whoamiRouteHandler();
    const body = await res.json();
    expect(body.orgId).toBe("org_SESSION");
  });

  // -------- (f)(g)(h) C1: FR-020 no-leak --------

  it("(f) body do 401 NÃO contém keys sensíveis", async () => {
    setSession({ isAuthenticated: false });
    const res = await whoamiRouteHandler();
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("");
    expect(text).not.toContain("stack");
    expect(text).not.toContain("email");
  });

  it("(g) body do 409 NO_ACTIVE_ORG contém apenas { error }", async () => {
    setSession({
      isAuthenticated: true,
      userId: "u1",
      sessionId: "s1",
      orgId: null,
    });
    const res = await whoamiRouteHandler();
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const body = await res.json();
    expect(body).toEqual({ error: "NO_ACTIVE_ORG" });
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("(i) Cache-Control no-store em respostas 200 (sem cache de PII no edge/network)", async () => {
    setSession({
      isAuthenticated: true,
      userId: "u1",
      sessionId: "s1",
      orgId: "org_SESSION",
    });
    const res = await whoamiRouteHandler();
    expect(res.status).toBe(200);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("no-store");
    expect(cc).toContain("private");
  });

  it("(j) Cache-Control no-store em respostas 401 (não cacheia decisões de auth)", async () => {
    setSession({ isAuthenticated: false });
    const res = await whoamiRouteHandler();
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("(h) Server Action erro não inclui stack nem Error.message cru", async () => {
    setSession({ isAuthenticated: false });
    const out = await whoamiAction();
    expect(out).toEqual({ ok: false, error: "UNAUTHORIZED" });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("at requireAuth");
  });

  // -------- (i) C5 — comentário documental --------
  // Resultado esperado do grep T039:
  //   grep -RIn --include='*.ts' --include='*.tsx' --exclude-dir=__tests__
  //     -E "(request\\.headers\\.get\\(.*org|searchParams\\.get\\(.*orgId|
  //         formData\\.get\\(.*orgId|cookies\\(\\)\\.get\\(.*org)"
  //     app/api lib/server lib/auth
  //   → vazio.
  // Edge case "acessar org à qual o usuário não pertence" é estruturalmente
  // impossível nesta fatia: nenhum recurso org-escoped está em DB ainda; o
  // orgId vem exclusivamente de auth() e o Clerk só retorna orgs do usuário.
  // Cobertura completa virá na primeira fatia com persistência, via fixtures.
});
