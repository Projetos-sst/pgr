import { notFound } from "next/navigation";

import { requireMasterPage } from "@/shared/auth/require-master";
import { isCommercialCatalogEnabledFor } from "@/shared/domains/commercial/offer";
import { listAdminSubscriptionsAction } from "@/shared/server/actions/commercial/admin-subscriptions";
import { commercialEnvironment } from "@/shared/server/commercial/environment";

import { EmptyState, ListCard, PageHeader, Pagination } from "../../_ui/list";
import { SubscriptionFilters } from "./_components/subscription-filters";
import { SubscriptionTable } from "./_components/subscription-table";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function singleValues(params: SearchParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isCommercialCatalogEnabledFor(commercialEnvironment())) notFound();
  await requireMasterPage();
  const params = singleValues(await searchParams);
  const result = await listAdminSubscriptionsAction(params);
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Assinaturas"
        backHref="/admin-global"
        description="Visão da plataforma entre escritórios: espelho do provedor, direitos de uso e divergências. Dados mínimos, sem nomes de empresa."
      />
      <SubscriptionFilters filters={params} />
      {!result.ok ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
          {result.error.message}
        </p>
      ) : result.data.rows.length === 0 ? (
        <EmptyState message="Nenhuma assinatura encontrada para os filtros informados." />
      ) : (
        <ListCard>
          <SubscriptionTable rows={result.data.rows} />
          <Pagination
            basePath="/admin-global/subscriptions"
            page={Number(params.page ?? 1)}
            pageSize={Number(params.pageSize ?? 20)}
            total={result.data.total}
            params={params}
          />
        </ListCard>
      )}
    </div>
  );
}
