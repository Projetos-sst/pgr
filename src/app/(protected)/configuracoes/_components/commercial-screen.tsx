import Link from "next/link";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCommercialOverview } from "@/shared/server/platform/commercial-core";
import { isBillingSimulationEnabled } from "@/shared/domains/billing/contracts";
import { commercialEnvironment } from "@/shared/server/platform/commercial-config";
import {
  getAdminCommercialSubscriptions,
  assertBillingAdministrator,
} from "@/shared/server/platform/billing-admin-core";
import {
  validateCommercialPortal,
  getCommercialPaymentProfile,
} from "@/shared/server/platform/billing-portal-core";
import { getCommercialCheckoutSession } from "@/shared/server/platform/billing-checkout-session-core";
import { getCommercialCharges } from "@/shared/server/platform/billing-charges-core";
import { AppError } from "@/shared/errors/app-error";
import { ZodError } from "zod";
import { CommercialPanel } from "./commercial-panel";
import { CommercialAdmin } from "./commercial-admin";
import { MockPaymentProfile } from "./mock-payment-profile";
export async function CommercialScreen({
  section,
  session,
}: {
  section: "plans" | "subscription" | "invoices" | "simulation" | "admin";
  session?: string;
}) {
  const ctx = await requireOfficeStaffPage();
  if (ctx.role !== "owner" || !isBillingSimulationEnabled(commercialEnvironment()))
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Gestão comercial</h1>
        <p>Área indisponível para seu acesso ou ambiente.</p>
        <Link className="underline" href="/plans">
          Consultar plano atual
        </Link>
      </main>
    );
  if (section === "admin") {
    try {
      assertBillingAdministrator(ctx);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      return <p className="p-6">Permissão administrativa comercial não concedida.</p>;
    }
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="mb-4 rounded border border-amber-400 bg-amber-50 p-4">
          Administração do simulador. Nenhuma cobrança real.
        </p>
        <CommercialAdmin
          key={ctx.tenantId}
          initial={await getAdminCommercialSubscriptions(ctx)}
        />
      </main>
    );
  }
  let portal: Awaited<ReturnType<typeof validateCommercialPortal>> | undefined,
    checkoutContractId: string | undefined;
  if (session)
    try {
      if (section === "invoices") portal = await validateCommercialPortal(ctx, session);
      else if (section === "simulation")
        checkoutContractId = (await getCommercialCheckoutSession(ctx, session))
          .contractId;
    } catch (e) {
      if (!(e instanceof AppError) && !(e instanceof ZodError)) throw e;
      return (
        <main className="p-6">
          <h1 className="text-xl font-bold">Sessão inválida ou expirada</h1>
          <p>Consulte o estado atual e solicite uma nova sessão.</p>
          <Link className="underline" href="/configuracoes/assinatura">
            Consultar assinatura
          </Link>
        </main>
      );
    }
  const data = await getCommercialOverview(ctx);
  if (portal)
    data.invoiceList = await getCommercialCharges(ctx, {
      page: 1,
      companyId: portal.companyId,
    });
  const customer = portal
    ? data.customers.find((c) => c.companyId === portal.companyId)
    : undefined;
  const profile = customer ? await getCommercialPaymentProfile(ctx, customer.id) : null;
  return (
    <>
      {portal && profile && (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <MockPaymentProfile
            key={session}
            sessionId={session!}
            method={profile.paymentMethod}
          />
        </div>
      )}
      <CommercialPanel
        key={ctx.tenantId + ":" + section + ":" + (session ?? "")}
        initial={data}
        section={section}
        portalCompanyId={portal?.companyId}
        checkoutContractId={checkoutContractId}
      />
    </>
  );
}
