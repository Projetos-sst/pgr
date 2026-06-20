import "server-only";

import { eq } from "drizzle-orm";

import {
  cpfSchema,
  employeeSexSchema,
  maritalStatusSchema,
  employeeStatusSchema,
} from "@/shared/domains/pgr/validation";

import { withOrg } from "../with-org";
import { employees, type Employee } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";

export type NewEmployeeInput = {
  companyId: string;
  fullName: string;
  cpf: string;
  gesId?: string | null;
  jobRoleId?: string | null;
  birthDate?: string | null;
  sex?: string | null;
  maritalStatus?: string | null;
  status?: string | null;
  phone?: string | null;
  email?: string | null;
  rg?: string | null;
  badgeNumber?: string | null;
  badgeValidUntil?: string | null;
  registration?: string | null;
  bloodType?: string | null;
  admissionDate?: string | null;
  dismissalDate?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  photoPath?: string | null;
};

export async function listEmployees(orgId: string): Promise<Employee[]> {
  return withOrg(orgId, (tx) =>
    tx.select().from(employees).where(eq(employees.orgId, orgId)),
  );
}

export async function createEmployee(
  orgId: string,
  input: NewEmployeeInput,
): Promise<Employee> {
  const {
    cpf: rawCpf,
    sex: rawSex,
    maritalStatus: rawMaritalStatus,
    status: rawStatus,
    ...rest
  } = input;

  const cpf = cpfSchema.parse(rawCpf);
  const sex = rawSex == null ? null : employeeSexSchema.parse(rawSex);
  const maritalStatus =
    rawMaritalStatus == null ? null : maritalStatusSchema.parse(rawMaritalStatus);
  const status = rawStatus == null ? undefined : employeeStatusSchema.parse(rawStatus);

  return auditedTenantWrite(orgId, "pgr.employees.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(employees)
        .values({
          ...rest,
          orgId,
          cpf,
          sex,
          maritalStatus,
          ...(status ? { status } : {}),
        })
        .returning();
      return row;
    }),
  );
}
