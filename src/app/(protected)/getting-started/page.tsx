import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getOnboardingProgressAction } from "@/shared/server/actions/platform/onboarding";
import { getTenantSwitcher } from "@/shared/tenant/switcher";
import type { OnboardingStepView } from "@/shared/domains/platform/onboarding";

export const dynamic = "force-dynamic";

function StepCard({ step, idx }: { step: OnboardingStepView; idx: number }) {
  return (
    <div
      className={`glass-panel flex flex-col gap-3 rounded-2xl border p-5 shadow-md transition-all sm:flex-row sm:items-center sm:justify-between ${
        step.done ? "border-[#5b63f5]/20 bg-[#5b63f5]/5" : "border-white/60"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            step.done
              ? "bg-[#5b63f5] text-white shadow-md shadow-[#5b63f5]/30"
              : "bg-[#5b63f5]/15 text-[#5b63f5]"
          }`}
        >
          {step.done ? "✓" : idx + 1}
        </span>
        <div>
          <h3 className="text-base font-bold text-[#1b1f2e]">{step.title}</h3>
          <p className="mt-0.5 text-xs font-medium text-[#7a7f97]">{step.description}</p>
          {!step.done ? (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {step.tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-xs text-[#52576e]">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#5b63f5]/60" />
                  {tip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {step.done ? (
        <span className="rounded-full border border-[#5b63f5]/30 bg-[#5b63f5]/10 px-3.5 py-1 text-xs font-bold text-[#5b63f5]">
          ✓ Concluído
        </span>
      ) : (
        <Link
          href={step.href}
          className="self-start rounded-xl bg-[#5b63f5] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#5b63f5]/30 transition-all hover:scale-[1.02] hover:bg-[#4a52e3] sm:self-auto"
        >
          Iniciar Guia →
        </Link>
      )}
    </div>
  );
}

export default async function PrimeirosPassosPage() {
  await requireOfficeStaffPage();
  const switcher = await getTenantSwitcher();
  const activeOrg = switcher?.options.find((o) => o.isActive);
  const orgName = activeOrg?.name ?? "sua organização";
  const result = await getOnboardingProgressAction();

  const progress = result.ok
    ? result.data
    : {
        total: 0,
        completed: 0,
        percent: 0,
        allDone: false,
        steps: [] as OnboardingStepView[],
        bonusSteps: [] as OnboardingStepView[],
      };

  const bonusDone = progress.bonusSteps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      {/* Top Header Banner com o Indigo principal (#5b63f5) */}
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5b63f5]/15 text-[#5b63f5] shadow-xs">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1b1f2e]">
            Trilha de Sucesso — {orgName}
          </h1>
          <p className="text-xs font-medium text-[#7a7f97]">
            Acompanhe o progresso real de configuração e implantação dos módulos.
          </p>
        </div>
      </div>

      {progress.allDone ? (
        <div className="glass-panel flex items-center gap-4 rounded-2xl border border-[#10b981]/30 bg-[#10b981]/10 p-5 shadow-lg">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-lg font-bold text-white shadow-md shadow-[#10b981]/30">
            ✓
          </span>
          <div>
            <h2 className="text-base font-bold text-[#0e9f6e]">
              Tudo pronto! Os passos essenciais estão concluídos.
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#3d4258]">
              Sua organização já tem a cadeia completa do PGR cadastrada.{" "}
              {bonusDone < progress.bonusSteps.length
                ? "Os passos opcionais abaixo cobrem outros módulos de alto uso."
                : "Você também concluiu os passos opcionais — bom trabalho."}
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-2xl border border-white/60 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-[#52576e]">
            <span>
              {progress.completed} de {progress.total} passos concluídos
            </span>
            <span className="font-extrabold text-[#5b63f5]">{progress.percent}%</span>
          </div>
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-[#5b63f5] shadow-sm shadow-[#5b63f5]/40 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Passos essenciais — cadeia núcleo do PGR */}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-extrabold tracking-wider text-[#9095ad] uppercase">
          Essenciais
        </span>
        {progress.steps.map((step, idx) => (
          <StepCard key={step.key} step={step} idx={idx} />
        ))}
      </div>

      {/* Passos opcionais — módulos de alto uso fora da cadeia núcleo */}
      {progress.bonusSteps.length > 0 ? (
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-extrabold tracking-wider text-[#9095ad] uppercase">
            Opcionais — {bonusDone} de {progress.bonusSteps.length} concluídos
          </span>
          {progress.bonusSteps.map((step, idx) => (
            <StepCard key={step.key} step={step} idx={idx} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
