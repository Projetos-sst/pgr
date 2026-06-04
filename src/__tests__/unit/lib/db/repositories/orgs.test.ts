jest.mock("@/lib/supabase/admin", () => ({
  getRlsBypassingSupabaseClient: jest.fn(),
}));

import { getRlsBypassingSupabaseClient } from "@/lib/supabase/admin";
import { upsertOrg } from "@/lib/db/repositories/orgs";

function chainable(returnedRow: Record<string, unknown> | null) {
  const upsert = jest.fn().mockReturnThis();
  const select = jest.fn().mockReturnThis();
  const single = jest.fn(async () => ({ data: returnedRow, error: null }));
  const from = jest.fn(() => ({ upsert, select, single }));
  (upsert as jest.Mock).mockReturnValue({ select, single });
  (select as jest.Mock).mockReturnValue({ single });
  return { from, upsert, select, single };
}

describe("upsertOrg", () => {
  it("calls from('orgs').upsert with onConflict:id and strips null fields", async () => {
    const c = chainable({
      id: "o1",
      name: null,
      slug: null,
      image_url: null,
      created_at: "2026-05-25T00:00:00Z",
      updated_at: "2026-05-25T00:00:00Z",
    });
    (getRlsBypassingSupabaseClient as jest.Mock).mockReturnValue({ from: c.from });

    await upsertOrg({ id: "o1" });

    expect(c.from).toHaveBeenCalledWith("orgs");
    const [mergedArg, opts] = c.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "id" });
    expect(mergedArg).toEqual({ id: "o1" });
  });
});
