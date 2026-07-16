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
              <span className="text-text font-semibold">
                {result.data.completed} de {result.data.total} concluídos
              </span>
              <span className="text-text-subtle">{result.data.percent}%</span>
            </div>
            <div className="bg-primary-ring h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${result.data.percent}%` }}
              />
            </div>
            {result.data.allDone ? (
              <p className="text-sm text-green-700">
                Tudo pronto! Sua organização está configurada.
              </p>
            ) : null}
          </section>

          <ol className="flex flex-col gap-2">
            {result.data.steps.map((step, index) => (
              <li
                key={step.key}
                className={`flex items-center gap-4 px-4 py-3 ${
                  step.done
                    ? "rounded-card border border-green-300 bg-green-50"
                    : "glass-card"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                    step.done ? "bg-green-600 text-white" : "text-text-subtle bg-black/5"
                  }`}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-text text-sm font-medium">{step.title}</span>
                  <span className="text-text-muted text-sm">{step.description}</span>
                </div>
                {step.done ? (
                  <span className="text-xs font-medium text-green-700">Concluído</span>
                ) : (
                  <Link
                    href={step.href}
                    className="btn-primary rounded-pill shrink-0 px-4 py-1.5 text-sm font-semibold transition-colors"
                  >
                    Começar
                  </Link>
                )}
              </li>
            ))}
          </ol>

          <section className="flex flex-col gap-3">
            <h2 className="text-text text-sm font-semibold tracking-tight">
              Ações rápidas
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="glass-card text-text px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
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
