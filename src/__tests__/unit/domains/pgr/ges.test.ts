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

describe("gesInputSchema — ceilingHeight (issue #12)", () => {
  const base = { companyId: COMPANY_ID, workUnitId: WORK_UNIT_ID, name: "GES Pintura" };

  it("aceita ponto como separador decimal", () => {
    expect(gesInputSchema.parse({ ...base, ceilingHeight: "2.50" }).ceilingHeight).toBe(
      "2.50",
    );
  });

  it("aceita vírgula e normaliza para ponto", () => {
    expect(gesInputSchema.parse({ ...base, ceilingHeight: "2,50" }).ceilingHeight).toBe(
      "2.50",
    );
  });

  it("aceita número inteiro sem separador", () => {
    expect(gesInputSchema.parse({ ...base, ceilingHeight: "3" }).ceilingHeight).toBe("3");
  });

  it('string vazia ("não aplicável") não gera erro e vira undefined', () => {
    expect(
      gesInputSchema.parse({ ...base, ceilingHeight: "" }).ceilingHeight,
    ).toBeUndefined();
  });

  it("ausência do campo não gera erro", () => {
    expect(gesInputSchema.parse(base).ceilingHeight).toBeUndefined();
  });

  it("rejeita valor não numérico com mensagem específica", () => {
    const result = gesInputSchema.safeParse({ ...base, ceilingHeight: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Pé-direito deve ser um número válido (ex: 2.50 ou 2,50)",
      );
    }
  });

  it("rejeita zero/negativo com mensagem específica", () => {
    const result = gesInputSchema.safeParse({ ...base, ceilingHeight: "0" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Pé-direito deve ser maior que zero");
    }
  });
});

describe("gesInputSchema — roof (issue #13)", () => {
  const base = { companyId: COMPANY_ID, workUnitId: WORK_UNIT_ID, name: "GES Pintura" };

  it.each(["none", "partial", "total"])("aceita a opção fechada %s", (roof) => {
    expect(gesInputSchema.parse({ ...base, roof }).roof).toBe(roof);
  });

  it("string vazia vira undefined (opcional)", () => {
    expect(gesInputSchema.parse({ ...base, roof: "" }).roof).toBeUndefined();
  });

  it("rejeita valor fora da lista fechada", () => {
    expect(() => gesInputSchema.parse({ ...base, roof: "translucent" })).toThrow();
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
