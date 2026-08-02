import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getOnboardingProgressAction } from "@/shared/server/actions/platform/onboarding";

export const dynamic = "force-dynamic";

export default async function PrimeirosPassosPage() {
  await requireOfficeStaffPage();
  const result = await getOnboardingProgressAction();
  const progress = result.ok
    ? result.data
    : { total: 0, completed: 0, percent: 0, allDone: false, steps: [] };

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-[30px] pt-8 pb-10">
      {/* Hero — gradiente indigo com barra + anel de progresso */}
      <div
        className="relative overflow-hidden rounded-[22px] p-[26px_28px] text-white"
        style={{
          background: "linear-gradient(140deg, #4f46e5, #5b63f5 55%, #7c7bf7)",
          boxShadow: "0 18px 40px rgba(91,99,245,0.32)",
        }}
      >
        <span
          aria-hidden
          className="absolute -top-[90px] -right-10 h-[220px] w-[220px] rounded-full bg-white/10"
        />
        <div className="relative flex items-center gap-6">
          <div className="flex-1">
            <div className="mb-2 font-mono text-[11px] tracking-[0.16em] text-white/70 uppercase">
              Trilha de Sucesso
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.02em]">
              Primeiros Passos no SST Manager
            </h1>
            <p className="mt-1.5 max-w-[420px] text-[13px] text-white/80">
              Selecione um tópico abaixo para iniciar o passo a passo e configurar sua
              operação.
            </p>
            <div className="mt-[18px] max-w-[420px]">
              <div className="mb-[7px] flex justify-between text-xs font-semibold">
                <span>
                  {progress.completed} de {progress.total} tópicos concluídos
                </span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-white/20">
                <div
                  className="h-full rounded-md bg-white transition-all duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          </div>
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#fff 0 ${progress.percent}%, rgba(255,255,255,0.25) ${progress.percent}% 100%)`,
            }}
          >
            <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-[#5b63f5]">
              <div className="text-[22px] font-extrabold">
                {progress.completed}/{progress.total}
              </div>
              <div className="text-[10px] text-white/70">etapas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Passos */}
      <div className="flex flex-col gap-3">
        {progress.steps.map((step, idx) => (
          <Link
            key={step.key}
            href={step.href}
            className="glass-card hover-lift flex items-center gap-4 rounded-2xl p-[18px_20px] transition-all"
          >
            <span
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl"
              style={
                step.done
                  ? { background: "rgba(16,185,129,0.14)", color: "#0e9f6e" }
                  : { background: "rgba(91,99,245,0.12)", color: "#5b63f5" }
              }
              aria-hidden
            >
              {step.done ? (
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12l3 3 5-6" />
                </svg>
              ) : (
                <span className="text-[15px] font-extrabold">{idx + 1}</span>
              )}
            </span>
            <div className="flex-1">
              <div className="text-text text-[15px] font-bold">{step.title}</div>
              <div
                className="mt-0.5 text-xs font-medium"
                style={{ color: step.done ? "#0e9f6e" : "#7a7f97" }}
              >
                {step.done ? "Concluído" : step.description}
              </div>
            </div>
            <span
              aria-hidden
              className="text-text-subtle flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[rgba(120,120,150,0.08)]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
