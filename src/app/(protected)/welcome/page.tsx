import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import { getTenantSwitcher } from "@/shared/tenant/switcher";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

export default async function BoasVindasPage() {
  const [user, switcher] = await Promise.all([currentUser(), getTenantSwitcher()]);
  const firstName = user?.firstName?.trim();
  const activeOrg = switcher?.options.find((option) => option.isActive);
  const orgName = activeOrg?.name ?? "sua organização";
  const today = dateFormatter.format(new Date());

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
            Gerencie riscos ocupacionais de forma prática, segura e conforme a
            legislação — transformando a gestão de segurança do trabalho em um processo
            eficiente.
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
            className="text-text-muted hover:text-text inline-flex items-center justify-center px-4 py-3 text-sm font-semibold transition-colors"
          >
            Ver primeiros passos
          </Link>
        </div>
      </div>
    </div>
  );
}
