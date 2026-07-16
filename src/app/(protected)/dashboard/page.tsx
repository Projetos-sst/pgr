import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { withBarPercents } from "@/shared/domains/platform/dashboard";
import { getDashboardSummaryAction } from "@/shared/server/actions/platform/dashboard";
import { getTenantSwitcher } from "@/shared/tenant/switcher";

import { BarChart, PendingPanel, StatCard } from "./_components/dashboard-widgets";

export const dynamic = "force-dynamic";

const PGR_MODULES = [
  { href: "/companies", title: "Empresas" },
  { href: "/ges", title: "GES" },
  { href: "/risks", title: "Riscos" },
  { href: "/pgr", title: "PGR" },
  { href: "/epi-stock", title: "Estoque de EPI" },
  { href: "/training-compliance", title: "Conformidade" },
];

export default async function DashboardPage() {
  await requireOfficeStaffPage();
  const switcher = await getTenantSwitcher();
  const orgName = switcher?.options.find((o) => o.isActive)?.name ?? "Minha organização";

  const result = await getDashboardSummaryAction();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <header>
        <h1 className="text-text text-[26px] font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-text-subtle mt-1 text-sm">
          Organização ativa: <strong>{orgName}</strong>.
        </p>
      </header>

      {!result.ok ? (
        <div className="glass-card text-text-subtle px-6 py-12 text-center text-sm">
          Não foi possível carregar os indicadores.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Empresas"
              value={result.data.kpis.companies}
              href="/companies"
            />
            <StatCard
              label="Funcionários"
              value={result.data.kpis.employees}
              href="/employees"
            />
            <StatCard
              label="Unidades"
              value={result.data.kpis.workUnits}
              href="/work-units"
            />
            <StatCard label="GES" value={result.data.kpis.ges} href="/ges" />
            <StatCard label="Riscos" value={result.data.kpis.risks} href="/risks" />
            <StatCard label="PGRs" value={result.data.kpis.pgrs} href="/pgr" />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <BarChart
              title="Riscos por tipo de agente"
              segments={withBarPercents(result.data.risksByAgentType)}
            />
            <BarChart
              title="Planos de ação por nível de controle"
              segments={withBarPercents(result.data.actionPlansByLevel)}
            />
          </div>

          <PendingPanel
            items={[
              {
                label: "PGRs vencidos",
                count: result.data.pending.pgrsExpired,
                href: "/pgr",
              },
              {
                label: "Controles em atraso",
                count: result.data.pending.controlsOverdue,
                href: "/risks",
              },
              {
                label: "EPIs abaixo do mínimo",
                count: result.data.pending.episLowStock,
                href: "/epi-stock",
              },
              {
                label: "EPIs a devolver",
                count: result.data.pending.episPendingReturn,
                href: "/epi-returns",
              },
              {
                label: "Treinamentos vencidos",
                count: result.data.pending.trainingsExpired,
                href: "/training-expiry",
              },
              {
                label: "Treinamentos a vencer",
                count: result.data.pending.trainingsDueSoon,
                href: "/training-expiry",
              },
            ]}
          />
        </>
      )}

      <section className="flex flex-col gap-4">
        <span className="text-text-subtle font-mono text-[11px] tracking-[0.16em] uppercase">
          Atalhos
        </span>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PGR_MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="glass-card text-text px-4 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
            >
              {m.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
