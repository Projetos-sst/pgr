import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  PLAN_FEATURES,
  PLAN_LABEL,
  TRIAL_DAYS,
  type PlanKey,
} from "@/shared/domains/platform/billing";
import { isBillingEnabled } from "@/shared/integrations/stripe/config";

import { PageHeader } from "../_ui/list";
import { ManageBillingButton } from "./_components/manage-billing-button";
import { UpgradeButton } from "./_components/upgrade-button";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const ctx = await requireOfficeStaffPage();
  const currentPlan = ctx.plan as PlanKey;
  const billingOn = isBillingEnabled();
  const canUpgrade = ctx.role === "owner" && currentPlan === "free";

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Planos e assinatura"
        description={`Seu plano atual: ${PLAN_LABEL[currentPlan] ?? currentPlan}.`}
      />

      <div className="glass-card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="text-text-muted border-b border-white/50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Recurso</th>
              <th className="px-4 py-3 text-center font-semibold">
                {PLAN_LABEL.free}
                {currentPlan === "free" ? " (atual)" : ""}
              </th>
              <th className="px-4 py-3 text-center font-semibold">
                {PLAN_LABEL.pro}
                {currentPlan === "pro" ? " (atual)" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((row) => (
              <tr key={row.label} className="border-t border-white/50">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-4 py-2 text-center">{row.free}</td>
                <td className="px-4 py-2 text-center font-medium">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentPlan === "pro" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green-700">Você já está no plano Pro.</p>
          {ctx.role === "owner" && billingOn ? <ManageBillingButton /> : null}
        </div>
      ) : canUpgrade && billingOn ? (
        <div className="flex flex-col gap-2">
          <UpgradeButton />
          <span className="text-text-subtle text-xs">
            Teste grátis de {TRIAL_DAYS} dias. Cancele quando quiser.
          </span>
        </div>
      ) : canUpgrade && !billingOn ? (
        <p className="rounded-card border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A assinatura online ainda não está configurada neste ambiente (
          <code>STRIPE_SECRET_KEY</code>).
        </p>
      ) : (
        <p className="text-text-subtle text-sm">
          Apenas o administrador da organização pode gerenciar a assinatura.
        </p>
      )}
    </div>
  );
}
