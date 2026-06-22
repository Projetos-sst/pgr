import {
  gesInputSchema,
  gesJobRoleInputSchema,
  toGesListItem,
} from "@/shared/domains/pgr/ges";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const WORK_UNIT_ID = "11111111-1111-1111-1111-1111111111a1";
const GES_ID = "11111111-1111-1111-1111-1111111111a2";
const JOB_ROLE_ID = "11111111-1111-1111-1111-1111111111a3";

describe("gesInputSchema (US4)", () => {
  const base = { companyId: COMPANY_ID, workUnitId: WORK_UNIT_ID, name: "GES Pintura" };

  it("aceita empresa + obra + nome", () => {
    expect(gesInputSchema.parse(base).name).toBe("GES Pintura");
  });

  it.each(["companyId", "workUnitId"])("exige %s", (field) => {
    expect(() => gesInputSchema.parse({ ...base, [field]: "" })).toThrow();
  });
});

describe("gesJobRoleInputSchema", () => {
  const base = { gesId: GES_ID, jobRoleId: JOB_ROLE_ID, workerCount: "3" };

  it("coage workerCount para número positivo", () => {
    expect(gesJobRoleInputSchema.parse(base).workerCount).toBe(3);
  });

  it.each(["0", "-2"])("rejeita workerCount <= 0 (%s)", (workerCount) => {
    expect(() => gesJobRoleInputSchema.parse({ ...base, workerCount })).toThrow();
  });
});

describe("toGesListItem (derivação de expostos)", () => {
  const row = { id: GES_ID, name: "GES", processDescription: "proc" };

  it("0 quando não há vínculos (total nulo)", () => {
    expect(toGesListItem(row, { total: null }).exposedWorkers).toBe(0);
  });

  it("reflete a soma quando há vínculos", () => {
    expect(toGesListItem(row, { total: 10 }).exposedWorkers).toBe(10);
  });

  it("0 quando o agregado está ausente", () => {
    expect(toGesListItem(row, undefined).exposedWorkers).toBe(0);
  });
});
