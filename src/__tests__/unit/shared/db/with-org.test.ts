import { PgDialect } from "drizzle-orm/pg-core";

const executeMock = jest.fn();
const txObj = { execute: executeMock };
const transactionMock = jest.fn(async (cb: (tx: typeof txObj) => Promise<unknown>) =>
  cb(txObj),
);

jest.mock("@/shared/db/index", () => ({
  db: {
    transaction: (cb: (tx: unknown) => Promise<unknown>) => transactionMock(cb),
  },
}));

import { withOrg } from "@/shared/db/with-org";

describe("withOrg", () => {
  beforeEach(() => {
    executeMock.mockReset();
    transactionMock.mockClear();
  });

  it("abre uma transação e fixa o tenant com set_config parametrizado antes do callback", async () => {
    const calls: string[] = [];
    executeMock.mockImplementation(() => calls.push("set_config"));

    const result = await withOrg("org_a", async () => {
      calls.push("fn");
      return "done";
    });

    expect(result).toBe("done");
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["set_config", "fn"]);
  });

  it("usa orgId como bind parameter (sem interpolação em SQL)", async () => {
    await withOrg("org_a", async () => null);

    const query = new PgDialect().sqlToQuery(executeMock.mock.calls[0][0]);
    expect(query.sql).toBe("select set_config('app.current_org', $1, true)");
    expect(query.params).toEqual(["org_a"]);
  });
});
