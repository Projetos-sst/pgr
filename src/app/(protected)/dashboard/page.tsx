import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getDashboardSummaryAction } from "@/shared/server/actions/platform/dashboard";
import { getTenantSwitcher } from "@/shared/tenant/switcher";

import { DashboardClientWrapper } from "./_components/dashboard-client-wrapper";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireOfficeStaffPage();
  const switcher = await getTenantSwitcher();
  const orgName = switcher?.options.find((o) => o.isActive)?.name ?? "Minha organização";

  const result = await getDashboardSummaryAction();

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <DashboardClientWrapper orgName={orgName} result={result} />
    </div>
  );
}
