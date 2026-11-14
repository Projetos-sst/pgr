import { forbidden, notFound } from "next/navigation";
import { Suspense } from "react";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { isCommercialCatalogEnabledFor } from "@/shared/domains/commercial/offer";
import { commercialEnvironment } from "@/shared/server/commercial/environment";

import { PageSkeleton } from "../_components/commercial/page-skeleton";
import { SubscriptionLoader } from "../_components/commercial/subscription-loader";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  if (!isCommercialCatalogEnabledFor(commercialEnvironment())) return notFound();
  const ctx = await requireOfficeStaffPage();
  if (ctx.role !== "owner") return forbidden();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <h1 className="text-text text-3xl font-black">Minha assinatura</h1>
      <Suspense fallback={<PageSkeleton label="Carregando a assinatura" />}>
        <SubscriptionLoader />
      </Suspense>
    </div>
  );
}
