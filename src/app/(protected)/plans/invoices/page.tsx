import { forbidden, notFound } from "next/navigation";
import { Suspense } from "react";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { INVOICE_NOTICE } from "@/shared/domains/commercial/subscription-sheet";
import { isCommercialCatalogEnabledFor } from "@/shared/domains/commercial/offer";
import { commercialEnvironment } from "@/shared/server/commercial/environment";

import { InvoicesLoader } from "../_components/commercial/invoices-loader";
import { PageSkeleton } from "../_components/commercial/page-skeleton";
import { pageOf } from "../_components/commercial/sheet-format";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  if (!isCommercialCatalogEnabledFor(commercialEnvironment())) return notFound();
  const ctx = await requireOfficeStaffPage();
  if (ctx.role !== "owner") return forbidden();
  const page = pageOf((await searchParams).page);
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <h1 className="text-text text-3xl font-black">Faturas</h1>
      <p role="note" className="glass-card rounded-[16px] p-4 text-sm font-semibold">
        {INVOICE_NOTICE}
      </p>
      <Suspense key={page} fallback={<PageSkeleton label="Carregando as faturas" />}>
        <InvoicesLoader page={page} />
      </Suspense>
    </div>
  );
}
