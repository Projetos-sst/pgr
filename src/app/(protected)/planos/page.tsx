import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  PLAN_FEATURES,
  PLAN_LABEL,
  TRIAL_DAYS,
  type PlanKey,
} from "@/shared/domains/platform/billing";
import { isBillingEnabled } from "@/shared/integrations/stripe/config";

import { PageHeader } from "../_ui/list";
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

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-black/3 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 font-medium">Recurso</th>
              <th className="px-4 py-2 text-center font-medium">
                {PLAN_LABEL.free}
                {currentPlan === "free" ? " (atual)" : ""}
              </th>
              <th className="px-4 py-2 text-center font-medium">
                {PLAN_LABEL.pro}
                {currentPlan === "pro" ? " (atual)" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((row) => (
              <tr key={row.label} className="border-t border-black/5 dark:border-white/5">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-4 py-2 text-center">{row.free}</td>
                <td className="px-4 py-2 text-center font-medium">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentPlan === "pro" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Você já está no plano Pro. 🎉
        </p>
      ) : canUpgrade && billingOn ? (
        <div className="flex flex-col gap-2">
          <UpgradeButton />
          <span className="text-xs text-zinc-500">
            Teste grátis de {TRIAL_DAYS} dias. Cancele quando quiser.
          </span>
        </div>
      ) : canUpgrade && !billingOn ? (
        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          A assinatura online ainda não está configurada neste ambiente (
          <code>STRIPE_SECRET_KEY</code>).
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          Apenas o administrador da organização pode gerenciar a assinatura.
        </p>
      )}
    </div>
  );
}
