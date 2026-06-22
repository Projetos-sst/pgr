import Link from "next/link";

import { getTenantSwitcher } from "@/shared/tenant/switcher";

export const dynamic = "force-dynamic";

const PGR_MODULES = [
  {
    href: "/companies",
    title: "Empresas",
    description: "Empresas-cliente do escritório — raiz da cadeia do PGR.",
  },
  {
    href: "/work-units",
    title: "Unidades de obra",
    description: "Frentes e canteiros vinculados a cada empresa.",
  },
  {
    href: "/job-roles",
    title: "Funções",
    description: "Cargos/funções (CBO) usados nos GES e funcionários.",
  },
  {
    href: "/ges",
    title: "GES",
    description: "Grupos de exposição similar e funções associadas.",
  },
  {
    href: "/employees",
    title: "Funcionários",
    description: "Trabalhadores das empresas-cliente.",
  },
];

export default async function DashboardPage() {
  const switcher = await getTenantSwitcher();
  const activeOrg = switcher?.options.find((option) => option.isActive);
  const orgName = activeOrg?.name ?? "Minha organização";

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Organização ativa: <strong>{orgName}</strong>. Escolha um cadastro para começar.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PGR_MODULES.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group flex flex-col gap-1 rounded-lg border border-black/10 px-5 py-4 transition-colors hover:border-black/25 hover:bg-black/3 dark:border-white/10 dark:hover:border-white/25 dark:hover:bg-white/5"
          >
            <span className="font-medium tracking-tight group-hover:underline">
              {module.title}
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {module.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
