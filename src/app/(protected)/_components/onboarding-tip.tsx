import Link from "next/link";

import {
  ONBOARDING_STEPS,
  type OnboardingStep,
} from "@/shared/domains/platform/onboarding";

/**
 * Instrução contextual injetada na própria tela de ação (ex: `/companies/new`)
 * quando o usuário chega vindo da Trilha de Sucesso (`?onboarding=1`). Sem
 * isso, o link da trilha só derruba o usuário num formulário em branco sem
 * explicar o que preencher.
 */
export function OnboardingTip({
  stepKey,
  show,
}: {
  stepKey: OnboardingStep["key"];
  show: boolean;
}) {
  if (!show) return null;
  const step = ONBOARDING_STEPS.find((s) => s.key === stepKey);
  if (!step) return null;

  return (
    <div className="glass-panel flex flex-col gap-2.5 rounded-2xl border border-[#5b63f5]/25 bg-[#5b63f5]/5 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5b63f5] text-[11px] font-bold text-white">
          ?
        </span>
        <span className="text-xs font-bold tracking-wide text-[#5b63f5] uppercase">
          Trilha de Sucesso — {step.title}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 pl-1">
        {step.tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-xs text-[#3d4258]">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#5b63f5]/70" />
            {tip}
          </li>
        ))}
      </ul>
      <Link
        href="/getting-started"
        className="self-start text-xs font-semibold text-[#5b63f5] hover:underline"
      >
        ← Voltar para a Trilha de Sucesso
      </Link>
    </div>
  );
}
