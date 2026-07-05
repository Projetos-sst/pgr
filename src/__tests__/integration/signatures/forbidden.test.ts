jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  createSignatureRequest,
  getSignatureStatus,
  signManually,
} from "@/shared/server/actions/signatures";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

/**
 * FR-026: o papel `client` é barrado pelo gate de office staff. Como o gate é o
 * `requireOfficeStaff` (que lança ForbiddenError para não-office), mocká-lo
 * rejeitando reproduz fielmente o bloqueio para as três actions internas.
 */
(shouldRun ? describe : describe.skip)("US1 — gate de office staff (FORBIDDEN)", () => {
  beforeEach(() => mockedGate.mockReset());

  it("papel client → FORBIDDEN em create/getStatus/signManually", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());

    const create = await createSignatureRequest({
      targetType: "demo",
      payload: { title: "T" },
    });
    const status = await getSignatureStatus("00000000-0000-0000-0000-000000000000");
    const manual = await signManually("00000000-0000-0000-0000-000000000000", {
      signerName: "F",
    });

    for (const r of [create, status, manual]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    }
  });
});
