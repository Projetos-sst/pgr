import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { eventStatusLabel, eventTypeLabel } from "@/shared/domains/esocial/events";
import { getEventAction } from "@/shared/server/actions/esocial/events";

import { PageHeader } from "../../../_ui/list";

export const dynamic = "force-dynamic";

export default async function EsocialDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getEventAction(id);
  if (!result.ok) notFound();
  const event = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={eventTypeLabel(event.eventType)}
        description={`Status: ${eventStatusLabel(event.status)}`}
      />

      {event.governmentResponse ? (
        <div className="glass-card p-4 text-sm">
          <span className="font-medium">Retorno do governo: </span>
          {event.governmentResponse}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Payload (XML)</h2>
        <pre className="glass-card max-h-[28rem] overflow-auto p-3 text-xs">
          {event.payload}
        </pre>
      </div>

      <Link href="/esocial" className="text-text-subtle text-sm hover:underline">
        ← Voltar
      </Link>
    </div>
  );
}
