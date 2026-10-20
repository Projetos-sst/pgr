"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import {
  getCompanyModuleOverview,
  changeCompanyModule,
} from "@/shared/server/platform/company-module-core";
import type { CompanyModuleChange } from "@/shared/domains/platform/company-modules";
import type { PageParams } from "@/shared/pagination";

export async function getCompanyModuleOverviewAction(
  companyId: string,
  page: PageParams = {},
) {
  return officeAction("platform.company_modules.get", (ctx) =>
    getCompanyModuleOverview(ctx, companyId, page),
  );
}

export async function changeCompanyModuleAction(
  companyId: string,
  input: CompanyModuleChange,
) {
  return officeAction(
    "platform.company_modules.change",
    async (ctx) => {
      const result = await changeCompanyModule(ctx, companyId, input);
      revalidatePath("/companies");
      revalidatePath(`/companies/${companyId}/services`);
      revalidatePath("/pgr");
      revalidatePath("/health-exams");
      return result;
    },
    { audit: true },
  );
}
