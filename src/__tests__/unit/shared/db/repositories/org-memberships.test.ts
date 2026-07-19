jest.mock("@/shared/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: jest.fn(),
}));

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import {
  countOwnersByOrg,
  deleteOrgMembership,
  upsertOrgMembership,
} from "@/shared/db/repositories/org-memberships";

function upsertChain(returnedRow: Record<string, unknown> | null) {
  const upsert = jest.fn().mockReturnThis();
  const select = jest.fn().mockReturnThis();
  const single = jest.fn(async () => ({ data: returnedRow, error: null }));
  const from = jest.fn(() => ({ upsert, select, single }));
  (upsert as jest.Mock).mockReturnValue({ select, single });
  (select as jest.Mock).mockReturnValue({ single });
  return { from, upsert, select, single };
}

function deleteChain(error: unknown = null) {
  const match = jest.fn(async () => ({ error }));
  const del = jest.fn(() => ({ match }));
  const from = jest.fn(() => ({ delete: del }));
  return { from, delete: del, match };
}

function selectRolesChain(rows: { role: string }[] | null, error: unknown = null) {
  const eq = jest.fn(async () => ({ data: rows, error }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { from, select, eq };
}

describe("upsertOrgMembership", () => {
  it("uses composite-key conflict target and inserts org_id/user_id/role", async () => {
    const c = upsertChain({
      org_id: "o1",
      user_id: "u1",
      role: "org:member",
      created_at: "2026-05-25T00:00:00Z",
      updated_at: "2026-05-25T00:00:00Z",
    });
    (getRlsBypassingSupabaseClient as jest.Mock).mockReturnValue({ from: c.from });

    await upsertOrgMembership({ orgId: "o1", userId: "u1", role: "org:member" });

    expect(c.from).toHaveBeenCalledWith("org_memberships");
    const [row, opts] = c.upsert.mock.calls[0];
    expect(row).toEqual({ org_id: "o1", user_id: "u1", role: "org:member" });
    expect(opts).toEqual({ onConflict: "org_id,user_id" });
  });
});

describe("deleteOrgMembership", () => {
  it("calls delete().match({org_id,user_id}) and resolves on no rows affected", async () => {
    const c = deleteChain(null);
    (getRlsBypassingSupabaseClient as jest.Mock).mockReturnValue({ from: c.from });

    await expect(
      deleteOrgMembership({ orgId: "o1", userId: "u1" }),
    ).resolves.toBeUndefined();

    expect(c.from).toHaveBeenCalledWith("org_memberships");
    expect(c.match).toHaveBeenCalledWith({ org_id: "o1", user_id: "u1" });
  });
});

describe("countOwnersByOrg", () => {
  // Regressão do bug de QA: contava só `role = 'owner'` no banco, mas orgs
  // Clerk-backed gravam o papel cru do Clerk ("org:admin") — a proteção de
  // "último administrador" nunca disparava para essas orgs. A contagem correta
  // normaliza cada papel antes de comparar.
  it("normaliza o papel cru (org:admin e owner contam; org:member/org:client não)", async () => {
    const c = selectRolesChain([
      { role: "org:admin" },
      { role: "org:member" },
      { role: "owner" },
      { role: "org:client" },
    ]);
    (getRlsBypassingSupabaseClient as jest.Mock).mockReturnValue({ from: c.from });

    await expect(countOwnersByOrg("o1")).resolves.toBe(2);

    expect(c.from).toHaveBeenCalledWith("org_memberships");
    expect(c.select).toHaveBeenCalledWith("role");
    expect(c.eq).toHaveBeenCalledWith("org_id", "o1");
  });

  it("devolve 0 quando não há nenhum administrador", async () => {
    const c = selectRolesChain([{ role: "org:member" }]);
    (getRlsBypassingSupabaseClient as jest.Mock).mockReturnValue({ from: c.from });

    await expect(countOwnersByOrg("o1")).resolves.toBe(0);
  });
});
