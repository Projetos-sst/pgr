"use server";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type {
  MedicineEmployeeItem,
  MedicineEmployeesQuery,
} from "@/shared/domains/medicine/employees";
import type { MedicineOverview } from "@/shared/domains/medicine/overview";
import type { Paginated } from "@/shared/pagination";
import {
  getMedicineOverview,
  listMedicineEmployees,
} from "@/shared/server/medicine/overview-core";

// Leituras: sem `audit` (padrão do repositório — só escritas auditam).

export async function getMedicineOverviewAction(): Promise<
  ActionResult<MedicineOverview>
> {
  return officeAction("medicine.overview.get", (ctx) => getMedicineOverview(ctx));
}

export async function listMedicineEmployeesAction(
  input: MedicineEmployeesQuery,
): Promise<ActionResult<Paginated<MedicineEmployeeItem>>> {
  return officeAction("medicine.employees.list", (ctx) =>
    listMedicineEmployees(ctx, input),
  );
}
