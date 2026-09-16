import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import { getTenantSwitcher } from "@/shared/tenant/switcher";
import { getOnboardingProgressAction } from "@/shared/server/actions/platform/onboarding";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

export default async function BoasVindasPage() {
  const [user, switcher, onboarding] = await Promise.all([
    currentUser(),
    getTenantSwitcher(),
    getOnboardingProgressAction(),
  ]);
  const firstName = user?.firstName?.trim();
  const activeOrg = switcher?.options.find((option) => option.isActive);
  const orgName = activeOrg?.name ?? "sua organização";
  const today = dateFormatter.format(new Date());
  const showOnboardingBadge = onboarding.ok && !onboarding.data.allDone;

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12">
        <div className="flex flex-col gap-3 border-b border-white/50 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-text-subtle font-mono text-[11px] tracking-[0.18em] uppercase">
            {today}
          </span>
          <span className="text-text-muted inline-flex items-center gap-2 self-start font-mono text-[11px] tracking-[0.12em] uppercase sm:self-auto">
            <span className="bg-accent-green h-1.5 w-1.5 rounded-full" aria-hidden />
            {orgName}
          </span>
        </div>

        <div className="flex flex-col gap-7">
          <div className="flex items-start gap-5">
            <span
              className="bg-primary mt-2 h-14 w-1 shrink-0 rounded-full"
              aria-hidden
            />
            <h1 className="text-text text-4xl leading-[1.04] font-extrabold tracking-tight sm:text-5xl">
              {firstName ? (
                <>
                  Bem-vindo de volta,
                  <br />
                  {firstName}.
                </>
              ) : (
                "Bem-vindo de volta."
              )}
            </h1>
          </div>

          <p className="text-text-muted max-w-xl text-base leading-relaxed">
            Gerencie riscos ocupacionais de forma prática, segura e conforme a legislação
            — transformando a gestão de segurança do trabalho em um processo eficiente.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/dashboard"
            className="btn-primary rounded-pill inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-colors"
          >
            Abrir o painel <span aria-hidden>→</span>
          </Link>
          <Link
            href="/getting-started"
            className="text-text-muted hover:text-text inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors"
          >
            Ver primeiros passos
            {showOnboardingBadge ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#f5a524]"
                aria-label="Trilha de Sucesso pendente"
              />
            ) : null}
          </Link>
        </div>

        {/* Ações rápidas (#182) — atalhos para rotas REAIS. Os indicadores
            percentuais do mockup ficam de fora por não terem dado real. */}
        <section className="flex flex-col gap-4">
          <h2 className="text-text-subtle font-mono text-[11px] tracking-[0.16em] uppercase">
            Ações rápidas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="glass-card hover:border-primary/40 group flex items-center gap-4 rounded-[18px] p-4 transition-colors"
              >
                <span className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-[14px]">
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-text block text-sm font-bold">{a.title}</span>
                  <span className="text-text-subtle block text-xs">{a.hint}</span>
                </span>
                <span
                  aria-hidden
                  className="text-primary text-sm font-bold transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  {
    href: "/pgr",
    title: "Acessar PGRs",
    hint: "Programas de gerenciamento de riscos",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    href: "/employees",
    title: "Funcionários",
    hint: "Cadastro e vínculos por GES",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
] as const;
