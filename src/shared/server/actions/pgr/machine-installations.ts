"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/pgr/machine-installation-core";
import type { PageParams } from "@/shared/pagination";
export async function listMachinesAction(
  companyId: string,
  page: PageParams & { includeInactive?: boolean } = {},
) {
  return officeAction("pgr.machine.list", (ctx) =>
    core.listMachines(ctx, companyId, page),
  );
}
export async function machineOptionsAction(companyId: string) {
  return officeAction("pgr.machine.options", (ctx) =>
    core.machineOptions(ctx, companyId),
  );
}
export async function getMachineAction(
  companyId: string,
  id: string,
  page: PageParams = {},
) {
  return officeAction("pgr.machine.get", (ctx) =>
    core.getMachine(ctx, companyId, id, page),
  );
}
export async function createMachineAction(companyId: string, input: unknown) {
  return officeAction(
    "pgr.machine.create",
    async (ctx) => {
      const row = await core.createMachine(ctx, companyId, input);
      revalidatePath(`/companies/${companyId}/machines`);
      return row;
    },
    { audit: true },
  );
}
export async function updateMachineAction(companyId: string, id: string, input: unknown) {
  return officeAction(
    "pgr.machine.update",
    async (ctx) => {
      const row = await core.updateMachine(ctx, companyId, id, input);
      revalidatePath(`/companies/${companyId}/machines`);
      return row;
    },
    { audit: true },
  );
}
export async function archiveMachineAction(
  companyId: string,
  id: string,
  input: unknown,
) {
  return officeAction(
    "pgr.machine.archive",
    async (ctx) => {
      const row = await core.archiveMachine(ctx, companyId, id, input);
      revalidatePath(`/companies/${companyId}/machines`);
      return row;
    },
    { audit: true },
  );
}
