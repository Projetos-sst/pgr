import { notFound } from "next/navigation";

import { requireMasterPage } from "@/shared/auth/require-master";
import { isCommercialCatalogEnabledFor } from "@/shared/domains/commercial/offer";
import { getAdminSubscriptionAction } from "@/shared/server/actions/commercial/admin-subscriptions";
import { commercialEnvironment } from "@/shared/server/commercial/environment";

import { PageHeader } from "../../../_ui/list";
import { ReconcileForm } from "../_components/reconcile-form";
import {
  ContractSection,
  EntitlementsSection,
  EventsSection,
  HistorySection,
  MirrorSection,
} from "../_components/subscription-detail";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ orgId?: string | string[] }>;
}) {
  if (!isCommercialCatalogEnabledFor(commercialEnvironment())) notFound();
  await requireMasterPage();
  const { contractId } = await params;
  const { orgId } = await searchParams;
  const result = await getAdminSubscriptionAction(
    typeof orgId === "string" ? orgId : "",
    contractId,
  );
  if (!result.ok && result.error.code === "NOT_FOUND") notFound();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Ficha da assinatura"
        backHref="/admin-global/subscriptions"
        description="Preço contratado, identificadores do provedor, direitos de uso, eventos e reconciliações."
      />
      {!result.ok ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
          {result.error.message}
        </p>
      ) : (
        <>
          <ContractSection detail={result.data} />
          <MirrorSection detail={result.data} />
          <EntitlementsSection detail={result.data} />
          <EventsSection detail={result.data} />
          <ReconcileForm orgId={result.data.orgId} contractId={result.data.contractId} />
          <HistorySection detail={result.data} />
        </>
      )}
    </div>
  );
}
