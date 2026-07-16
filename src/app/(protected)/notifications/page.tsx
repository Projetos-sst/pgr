import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listNotificationsAction } from "@/shared/server/actions/platform/notifications";

import { EmptyState, PageHeader } from "../_ui/list";
import { NotificationsList } from "./_components/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  await requireOfficeStaffPage();
  const result = await listNotificationsAction();

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Notificações"
        description="Alertas acionáveis da sua organização — prazos, vencimentos e estoque."
      />
      {result.ok ? (
        <NotificationsList notifications={result.data} />
      ) : (
        <EmptyState message="Não foi possível carregar as notificações." />
      )}
    </div>
  );
}
