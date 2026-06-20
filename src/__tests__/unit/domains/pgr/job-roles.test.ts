import { jobRoleInputSchema } from "@/shared/domains/pgr/job-roles";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

describe("jobRoleInputSchema (US3)", () => {
  const base = { companyId: COMPANY_ID, title: "Pedreiro" };

  it("aceita entrada mínima (CBO opcional)", () => {
    const parsed = jobRoleInputSchema.parse(base);
    expect(parsed.title).toBe("Pedreiro");
    expect(parsed.cbo).toBeUndefined();
  });

  it("exige título não-vazio", () => {
    expect(() => jobRoleInputSchema.parse({ ...base, title: " " })).toThrow();
  });

  it("exige empresa (uuid)", () => {
    expect(() => jobRoleInputSchema.parse({ title: "X" })).toThrow();
  });

  it("mantém CBO como texto livre", () => {
    expect(jobRoleInputSchema.parse({ ...base, cbo: "7152-10" }).cbo).toBe("7152-10");
  });
});
