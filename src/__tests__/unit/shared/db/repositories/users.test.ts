jest.mock("@/shared/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: jest.fn(),
}));

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import { upsertUser } from "@/shared/db/repositories/users";

function chainable(returnedRow: Record<string, unknown> | null) {
  const upsert = jest.fn().mockReturnThis();
  const select = jest.fn().mockReturnThis();
  const single = jest.fn(async () => ({ data: returnedRow, error: null }));
  const from = jest.fn(() => ({ upsert, select, single }));
  (upsert as jest.Mock).mockReturnValue({ select, single });
  (select as jest.Mock).mockReturnValue({ single });
  return { from, upsert, select, single };
}

describe("upsertUser", () => {
  it("calls from('users').upsert with onConflict:id and strips null fields", async () => {
    const baseRow = {
      id: "u1",
      email: null,
      first_name: null,
      last_name: null,
      image_url: null,
      created_at: "2026-05-25T00:00:00Z",
      updated_at: "2026-05-25T00:00:00Z",
    };
    const c = chainable(baseRow);
    (getRlsBypassingSupabaseClient as jest.Mock).mockReturnValue({ from: c.from });

    await upsertUser({ id: "u1" });

    expect(c.from).toHaveBeenCalledWith("users");
    const [mergedArg, opts] = c.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "id" });
    expect(mergedArg).toEqual({ id: "u1" });
  });

  it("preserves populated fields and maps the result", async () => {
    const c = chainable({
      id: "u2",
      email: "x@y.com",
      first_name: "X",
      last_name: "Y",
      image_url: null,
      created_at: "2026-05-25T00:00:00Z",
      updated_at: "2026-05-25T00:00:01Z",
    });
    (getRlsBypassingSupabaseClient as jest.Mock).mockReturnValue({ from: c.from });

    const result = await upsertUser({
      id: "u2",
      email: "x@y.com",
      firstName: "X",
      lastName: "Y",
    });

    const [mergedArg] = c.upsert.mock.calls[0];
    expect(mergedArg).toEqual({
      id: "u2",
      email: "x@y.com",
      first_name: "X",
      last_name: "Y",
    });
    expect(result.email).toBe("x@y.com");
    expect(result.firstName).toBe("X");
  });
});
