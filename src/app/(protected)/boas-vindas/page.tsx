import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import { getTenantSwitcher } from "@/shared/tenant/switcher";

import { PGR_MODULES } from "../_components/modules";

export const dynamic = "force-dynamic";

export default async function BoasVindasPage() {
  const [user, switcher] = await Promise.all([currentUser(), getTenantSwitcher()]);
  const firstName = user?.firstName?.trim();
  const activeOrg = switcher?.options.find((option) => option.isActive);
  const orgName = activeOrg?.name ?? "sua organização";

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-8 sm:px-8">
      <header className="flex flex-col justify-center">
        <span className="text-primary font-mono text-[11px] tracking-[0.16em] uppercase">
          Boas-vindas
        </span>
        <h1 className="text-text mt-2 text-4xl font-extrabold tracking-tight">
          {firstName ? `Bem-vindo de volta, ${firstName}` : "Bem-vindo de volta"}
        </h1>
        <p className="text-text-subtle mt-3 text-sm">
          Organização ativa: <strong className="text-text-muted">{orgName}</strong>.
        </p>
      </header>

      <div className="glass-panel rounded-glass flex items-center gap-4 px-6 py-4">
        <span className="bg-primary h-10 w-1 shrink-0 rounded" aria-hidden />
        <p className="text-text-muted text-sm leading-relaxed">
          Gerencie riscos ocupacionais de forma prática, segura e conforme a legislação —
          transformando a gestão de segurança do trabalho em um processo eficiente.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <span className="text-text-subtle font-mono text-[11px] tracking-[0.16em] uppercase">
          Ações rápidas
        </span>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PGR_MODULES.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="glass-card group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5"
            >
              <span className="text-text text-base font-bold tracking-tight">
                {module.title}
              </span>
              <span className="text-text-muted text-sm leading-relaxed">
                {module.description}
              </span>
              <span className="text-primary mt-auto flex items-center gap-1.5 text-sm font-bold">
                Abrir <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
