import Link from "next/link";

import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { getDashboardKpis } from "@/shared/server/dashboard/kpis";

import { PGR_MODULES } from "../_components/modules";

export const dynamic = "force-dynamic";

type Kpi = {
  label: string;
  value: number;
  hint: string;
  href: string;
  emphasis?: boolean;
};

/** Widgets de gráfico sem fonte de agregação pronta → empty-state honesto (FR-008). */
const EMPTY_WIDGETS = [
  { title: "Riscos por Categoria", note: "Sem agregação disponível nesta versão." },
  { title: "Planos de Ação", note: "Sem agregação disponível nesta versão." },
  { title: "Status de OS", note: "Módulo de Ordens de Serviço ainda não disponível." },
  {
    title: "Categorias de Incidentes",
    note: "Módulo de Incidentes ainda não disponível.",
  },
];

export default async function DashboardPage() {
  const { tenantId } = await requireTenantContext();
  const kpis = await getDashboardKpis(tenantId);

  const cards: Kpi[] = [
    {
      label: "EMPRESAS",
      value: kpis.companies,
      hint: "Empresas-cliente",
      href: "/companies",
    },
    {
      label: "PGRS",
      value: kpis.pgrs,
      hint: "Programas de gestão de risco",
      href: "/pgr",
    },
    {
      label: "EQUIPE",
      value: kpis.employees,
      hint: "Funcionários cadastrados",
      href: "/employees",
    },
    {
      label: "EPIS ABAIXO DA MÍNIMA",
      value: kpis.epiBelowMinimum,
      hint: "Itens que demandam reposição",
      href: "/epi-stock",
      emphasis: true,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-text text-[26px] font-extrabold tracking-tight">
            Dashboard
          </h1>
          <p className="text-text-subtle mt-1 text-sm">
            Visão geral do escritório · dados do tenant ativo.
          </p>
        </div>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={
              card.emphasis
                ? "rounded-glass shadow-primary bg-primary flex flex-col gap-3 p-5 text-white transition-transform hover:-translate-y-0.5"
                : "glass-card flex flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5"
            }
          >
            <span
              className={
                card.emphasis
                  ? "font-mono text-[10px] tracking-[0.12em] text-white/70"
                  : "text-text-subtle font-mono text-[10px] tracking-[0.12em]"
              }
            >
              {card.label}
            </span>
            <span
              className={
                card.emphasis
                  ? "text-4xl font-extrabold tracking-tight text-white"
                  : "text-primary-strong text-4xl font-extrabold tracking-tight"
              }
            >
              {card.value}
            </span>
            <span
              className={
                card.emphasis
                  ? "text-xs font-semibold text-white/85"
                  : "text-text-muted text-xs font-semibold"
              }
            >
              {card.hint}
            </span>
          </Link>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <span className="text-text-subtle font-mono text-[11px] tracking-[0.16em] uppercase">
          Acesso rápido aos cadastros
        </span>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PGR_MODULES.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="glass-card group flex flex-col gap-1 p-5 transition-transform hover:-translate-y-0.5"
            >
              <span className="text-text font-bold tracking-tight">{module.title}</span>
              <span className="text-text-muted text-sm">{module.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <span className="text-text-subtle font-mono text-[11px] tracking-[0.16em] uppercase">
          Indicadores
        </span>
        <div className="grid gap-5 sm:grid-cols-2">
          {EMPTY_WIDGETS.map((widget) => (
            <div key={widget.title} className="glass-card flex flex-col gap-4 p-6">
              <span className="text-text text-[15px] font-bold">{widget.title}</span>
              <div className="text-text-subtle flex flex-col items-center gap-2 py-8 text-center text-sm">
                <span
                  aria-hidden
                  className="bg-primary-ring text-primary flex h-9 w-9 items-center justify-center rounded-full font-bold"
                >
                  i
                </span>
                <span>{widget.note}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
