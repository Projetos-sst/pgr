import { requiredString, requiredUuid } from "@/shared/domains/pgr/form-fields";
import { companyInputSchema } from "@/shared/domains/pgr/companies";
import { workUnitInputSchema } from "@/shared/domains/pgr/work-units";
import { employeeInputSchema } from "@/shared/domains/pgr/employees";
import { gesJobRoleInputSchema } from "@/shared/domains/pgr/ges";
import { z } from "zod";

function firstMessage(schema: z.ZodTypeAny, input: unknown): string | null {
  const result = schema.safeParse(input);
  return result.success ? null : result.error.issues[0].message;
}

function messageByField(schema: z.ZodTypeAny, input: unknown): Record<string, string> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("requiredString — mensagem custom em todos os modos de falha", () => {
  const schema = requiredString("Campo é obrigatório");

  it.each([
    ["ausente", undefined],
    ["null", null],
    ["vazio", "   "],
  ])("%s usa a mensagem custom (não a crua do Zod)", (_label, input) => {
    expect(firstMessage(schema, input)).toBe("Campo é obrigatório");
  });
});

describe("requiredUuid — mensagem custom em todos os modos de falha", () => {
  const schema = requiredUuid("Empresa é obrigatória");

  it.each([
    ["ausente", undefined],
    ["null", null],
    ["formato inválido", "not-a-uuid"],
  ])("%s usa a mensagem custom", (_label, input) => {
    expect(firstMessage(schema, input)).toBe("Empresa é obrigatória");
  });
});

describe("contrato 422 por entidade — campo obrigatório ausente é pt-BR", () => {
  it("companies: razaoSocial ausente", () => {
    expect(messageByField(companyInputSchema, { riskGrade: "2" }).razaoSocial).toBe(
      "Razão social é obrigatória",
    );
  });

  it("work-units: companyId ausente", () => {
    expect(
      messageByField(workUnitInputSchema, { name: "x", description: "y" }).companyId,
    ).toBe("Empresa é obrigatória");
  });

  it("employees: companyId ausente", () => {
    expect(
      messageByField(employeeInputSchema, { fullName: "x", cpf: "39053344705" }).companyId,
    ).toBe("Empresa é obrigatória");
  });

  it("employees: cpf ausente é pt-BR", () => {
    expect(messageByField(employeeInputSchema, { companyId: undefined, fullName: "x" }).cpf).toBe(
      "CPF é obrigatório",
    );
  });

  it("companies: riskGrade numérico ausente é pt-BR (não 'received NaN')", () => {
    expect(messageByField(companyInputSchema, { razaoSocial: "Acme" }).riskGrade).toBe(
      "Grau de risco é obrigatório (1 a 4)",
    );
  });

  it("ges_job_role: workerCount ausente é pt-BR", () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    expect(
      messageByField(gesJobRoleInputSchema, { gesId: uuid, jobRoleId: uuid }).workerCount,
    ).toBe("Quantidade de trabalhadores é obrigatória");
  });
});
