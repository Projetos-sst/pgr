import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getScheduleEventAction } from "@/shared/server/actions/platform/scheduling";

import { PageHeader } from "../../../_ui/list";
import { ScheduleEventForm } from "../../_components/schedule-event-form";

export const dynamic = "force-dynamic";

export default async function EditScheduleEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getScheduleEventAction(id);
  if (!result.ok) notFound();
  const event = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader backHref="/schedule" title="Editar evento" />
      <ScheduleEventForm
        id={event.id}
        initial={{
          eventType: event.eventType,
          title: event.title,
          eventDate: event.eventDate,
          description: event.description,
          referenceUrl: event.referenceUrl,
        }}
      />
    </div>
  );
}
