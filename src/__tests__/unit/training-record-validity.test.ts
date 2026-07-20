jest.mock("@/shared/db/with-org", () => ({ withOrg: jest.fn() }));
jest.mock("@/shared/db/repositories/audited-write", () => ({
  auditedTenantWrite: jest.fn((_orgId, _op, write: () => Promise<unknown>) => write()),
}));

import { withOrg } from "@/shared/db/with-org";
import { createTrainingRecord } from "@/shared/db/repositories/training-records";
import { trainingRecordInputSchema } from "@/shared/domains/pgr/trainings";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { employees, trainingCatalog } from "@/shared/db/schema";

type FakeRows = {
  employee: { id: string } | null;
  training: { periodicity: string } | null;
};

/**
 * Transação Drizzle falsa: reproduz as cadeias usadas pelo create
 * (select→from→where→limit distinguido pela tabela; insert→values→returning)
 * e registra o que foi inserido para asserção.
 */
function fakeTx(rows: FakeRows) {
  const inserted: Record<string, unknown>[] = [];
  const tx = {
    select: jest.fn(() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === employees) return rows.employee ? [rows.employee] : [];
            if (table === trainingCatalog) return rows.training ? [rows.training] : [];
            return [];
          },
        }),
      }),
    })),
    insert: jest.fn(() => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v);
        return { returning: async () => [{ id: "rec-1", ...v }] };
      },
    })),
  };
  return { tx, inserted };
}

const mockedWithOrg = withOrg as jest.MockedFunction<typeof withOrg>;

function useTx(rows: FakeRows) {
  const { tx, inserted } = fakeTx(rows);
  mockedWithOrg.mockImplementation(async (_orgId, fn) =>
    fn(tx as unknown as Parameters<typeof fn>[0]),
  );
  return inserted;
}

const INPUT = {
  employeeId: "11111111-1111-1111-1111-111111111111",
  trainingId: "22222222-2222-2222-2222-222222222222",
  completedAt: "2026-03-15",
} as const;

describe("createTrainingRecord — valid_until via D1 no servidor (US2)", () => {
  beforeEach(() => mockedWithOrg.mockReset());

  it("periodicidade biennial → valid_until = completed_at + 2 anos", async () => {
    const inserted = useTx({
      employee: { id: INPUT.employeeId },
      training: { periodicity: "biennial" },
    });
    await createTrainingRecord("org_a", INPUT);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].validUntil).toBe("2028-03-15");
    expect(inserted[0].certificatePath).toBeNull();
  });

  it("periodicidade single → valid_until = null (não expira)", async () => {
    const inserted = useTx({
      employee: { id: INPUT.employeeId },
      training: { periodicity: "single" },
    });
    await createTrainingRecord("org_a", INPUT);
    expect(inserted[0].validUntil).toBeNull();
  });

  it("funcionário fora do tenant → FK_NOT_FOUND, nada é inserido", async () => {
    const inserted = useTx({ employee: null, training: { periodicity: "annual" } });
    await expect(createTrainingRecord("org_a", INPUT)).rejects.toBeInstanceOf(
      ReferenceNotFoundError,
    );
    expect(inserted).toHaveLength(0);
  });

  it("treinamento fora do tenant → FK_NOT_FOUND, nada é inserido", async () => {
    const inserted = useTx({ employee: { id: INPUT.employeeId }, training: null });
    await expect(createTrainingRecord("org_a", INPUT)).rejects.toBeInstanceOf(
      ReferenceNotFoundError,
    );
    expect(inserted).toHaveLength(0);
  });

  it("completed_at futuro é barrado pelo schema ANTES do repositório", () => {
    const result = trainingRecordInputSchema.safeParse({
      ...INPUT,
      completedAt: "2099-01-01",
    });
    expect(result.success).toBe(false);
  });
});
