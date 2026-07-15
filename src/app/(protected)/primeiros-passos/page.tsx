import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getOnboardingProgressAction } from "@/shared/server/actions/platform/onboarding";
import { getTenantSwitcher } from "@/shared/tenant/switcher";

import { EmptyState, PageHeader } from "../_ui/list";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { href: "/dashboard", label: "Painel" },
  { href: "/companies", label: "Empresas" },
  { href: "/employees", label: "Funcionários" },
  { href: "/pgr", label: "PGR" },
];

export default async function PrimeirosPassosPage() {
  await requireOfficeStaffPage();
  const switcher = await getTenantSwitcher();
  const orgName = switcher?.options.find((o) => o.isActive)?.name ?? "sua organização";
  const result = await getOnboardingProgressAction();

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
      <PageHeader
        title="Primeiros passos"
        description={`Bem-vindo(a)! Vamos configurar ${orgName} em poucos passos.`}
      />

      {!result.ok ? (
        <EmptyState message="Não foi possível carregar seu progresso." />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {result.data.completed} de {result.data.total} concluídos
              </span>
              <span className="text-zinc-500">{result.data.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-black/70 transition-all dark:bg-white/70"
                style={{ width: `${result.data.percent}%` }}
              />
            </div>
            {result.data.allDone ? (
              <p className="text-sm text-green-700 dark:text-green-400">
                Tudo pronto! Sua organização está configurada. 🎉
              </p>
            ) : null}
          </section>

          <ol className="flex flex-col gap-2">
            {result.data.steps.map((step, index) => (
              <li
                key={step.key}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
                  step.done
                    ? "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                    step.done
                      ? "bg-green-600 text-white"
                      : "bg-black/5 text-zinc-500 dark:bg-white/10"
                  }`}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{step.title}</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {step.description}
                  </span>
                </div>
                {step.done ? (
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    Concluído
                  </span>
                ) : (
                  <Link
                    href={step.href}
                    className="shrink-0 rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:bg-white dark:text-black"
                  >
                    Começar
                  </Link>
                )}
              </li>
            ))}
          </ol>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Ações rápidas</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition-colors hover:bg-black/3 dark:border-white/10 dark:hover:bg-white/5"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
