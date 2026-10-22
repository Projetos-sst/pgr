import "server-only";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  machineInstallationSchema,
  machineInstallationUpdateSchema,
  machineInstallationArchiveSchema,
} from "@/shared/domains/pgr/machine-installation";
import * as repo from "@/shared/db/repositories/machine-installations";
import type { PageParams } from "@/shared/pagination";
const id = (value: string) => requiredUuid("Identificador inválido.").parse(value);
export const listMachines = (
  ctx: TenantContext,
  companyId: string,
  params: PageParams & { includeInactive?: boolean } = {},
) => repo.listMachineInstallations(ctx.tenantId, id(companyId), params);
export const machineOptions = (ctx: TenantContext, companyId: string) =>
  repo.machineInstallationOptions(ctx.tenantId, id(companyId));
export const getMachine = (
  ctx: TenantContext,
  companyId: string,
  machineId: string,
  page: PageParams = {},
) => repo.getMachineInstallation(ctx.tenantId, id(companyId), id(machineId), page);
export const createMachine = (ctx: TenantContext, companyId: string, input: unknown) =>
  repo.saveMachineInstallation(
    ctx.tenantId,
    id(companyId),
    ctx.userId,
    machineInstallationSchema.parse(input),
  );
export function updateMachine(
  ctx: TenantContext,
  companyId: string,
  machineId: string,
  input: unknown,
) {
  const data = machineInstallationUpdateSchema.parse(input);
  return repo.saveMachineInstallation(
    ctx.tenantId,
    id(companyId),
    ctx.userId,
    data.data,
    { id: id(machineId), expectedVersion: data.expectedVersion },
  );
}
export function archiveMachine(
  ctx: TenantContext,
  companyId: string,
  machineId: string,
  input: unknown,
) {
  const data = machineInstallationArchiveSchema.parse(input);
  return repo.archiveMachineInstallation(
    ctx.tenantId,
    id(companyId),
    id(machineId),
    ctx.userId,
    data.expectedVersion,
    data.reason,
  );
}
