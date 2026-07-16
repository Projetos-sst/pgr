import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { ScheduleEventForm } from "../_components/schedule-event-form";

export const dynamic = "force-dynamic";

export default async function NewScheduleEventPage() {
  await requireOfficeStaffPage();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Novo evento" description="Agende um compromisso de SST." />
      <ScheduleEventForm />
    </div>
  );
}
