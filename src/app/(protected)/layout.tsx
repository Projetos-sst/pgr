import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";

import { NotificationsBell } from "./_ui/notifications-bell";

const PGR_NAV = [
  { href: "/dashboard", label: "Painel" },
  { href: "/primeiros-passos", label: "Primeiros passos" },
  { href: "/companies", label: "Empresas" },
  { href: "/work-units", label: "Unidades de obra" },
  { href: "/job-roles", label: "Funções" },
  { href: "/ges", label: "GES" },
  { href: "/risk-methodology", label: "Metodologia de Risco" },
  { href: "/employees", label: "Funcionários" },
  { href: "/pgr", label: "PGR" },
  { href: "/risks", label: "Riscos" },
  { href: "/categories", label: "Categorias" },
  { href: "/epi-catalog", label: "Catálogo de EPI" },
  { href: "/epi-stock", label: "Estoque de EPI" },
  { href: "/training-catalog", label: "Treinamentos" },
  { href: "/training-expiry", label: "Vencimentos" },
  { href: "/training-compliance", label: "Conformidade" },
  { href: "/signatures", label: "Assinaturas" },
  { href: "/epi-returns", label: "Devoluções de EPI" },
  { href: "/planos", label: "Planos" },
  { href: "/veiculos", label: "Veículos" },
  { href: "/planos-inspecao", label: "Planos de inspeção" },
  { href: "/inspecoes-veiculares", label: "Inspeções veiculares" },
  { href: "/inspecoes-equipamentos", label: "Inspeções de equipamentos" },
  { href: "/inspecoes-seguranca", label: "Inspeções de segurança" },
  { href: "/permissoes-trabalho", label: "Permissões de trabalho" },
  { href: "/equipe", label: "Equipe" },
  { href: "/perfil", label: "Perfil" },
];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireTenantContext();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const h = await headers();
      const pathname = h.get("x-pathname") ?? "/dashboard";
      redirect(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
    }
    if (err instanceof NoTenantContextError) {
      redirect("/sign-in");
    }
    throw err;
  }

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex flex-wrap gap-1 border-b border-black/10 px-6 py-3 text-sm dark:border-white/10">
        {PGR_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-1.5 font-medium text-zinc-700 transition-colors hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            {item.label}
          </Link>
        ))}
        <NotificationsBell />
      </nav>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
