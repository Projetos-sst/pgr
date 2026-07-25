import "@testing-library/jest-dom";

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_placeholder";

jest.mock("server-only", () => ({}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(async () => ({
    isAuthenticated: false,
    userId: null,
    sessionId: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
  })),
  clerkClient: jest.fn(async () => ({
    organizations: {
      getOrganization: jest.fn(async () => ({ id: "org_mock", name: "Org Mock" })),
    },
  })),
  clerkMiddleware: jest.fn((handler) => handler),
  createRouteMatcher: jest.fn((patterns: string[]) => {
    const regexes = patterns.map(
      (p) => new RegExp("^" + p.replace(/\(\.\*\)/g, ".*").replace(/\//g, "\\/") + "$"),
    );
    return (req: { url: string }) =>
      regexes.some((r) => r.test(new URL(req.url).pathname));
  }),
}));
