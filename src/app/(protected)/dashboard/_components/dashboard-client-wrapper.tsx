"use client";

import { useState } from "react";

import { withBarPercents } from "@/shared/domains/platform/dashboard";
import type { DashboardSummary } from "@/shared/domains/platform/dashboard";
import type { ActionResult } from "@/shared/server/result";

import { CustomizeViewModal, useDashboardViewConfig } from "./customize-view-modal";
import {
  ActionPlanDonutChart,
  IncidentVerticalChart,
  PendingPanel,
  PsicossocialBanner,
  RiskCategoryChart,
  ServiceOrderDonutChart,
  StatCard,
} from "./dashboard-widgets";

export function DashboardClientWrapper({
  orgName,
  result,
}: {
  orgName: string;
  result: ActionResult<DashboardSummary>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { config, updateConfig, resetConfig } = useDashboardViewConfig();

  if (!result.ok) {
    return (
      <div className="glass-card flex flex-col items-center justify-center p-12 text-center text-sm text-[#8c91a8]">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mb-2 text-red-500"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Não foi possível carregar os indicadores no momento.
      </div>
    );
  }

  const data = result.data;
  const pgrCount = data.kpis.pgrs;
  const companyCount = data.kpis.companies;
  const employeeCount = data.kpis.employees;
  const gesCount = data.kpis.ges;
  const activeEmployees = data.employeesBreakdown.active;
  const inactiveEmployees = data.employeesBreakdown.inactive;
  const serviceOrdersTotal = data.serviceOrdersSummary?.total ?? 0;
  const serviceOrdersSigned = data.serviceOrdersSummary?.signed ?? 0;

  return (
    <>
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1b1f2e] sm:text-[26px]">
            Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-[#8c91a8] sm:text-sm">
            Visão geral · Organização ativa:{" "}
            <strong className="font-semibold text-[#1b1f2e]">{orgName}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-primary inline-flex h-[42px] items-center gap-2 rounded-[12px] px-[18px] text-[13px] font-bold shadow-[0_8px_20px_rgba(91,99,245,0.35)] transition-all hover:scale-[1.02]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Personalizar Visão
          </button>
        </div>
      </header>

      {/* Top 4 KPI Cards Grid */}
      {config.kpis ? (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            eyebrow="PGRS"
            label="PGRs"
            value={pgrCount}
            href="/pgr"
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M12 3l9 5-9 5-9-5 9-5z" />
                <path d="M3 13l9 5 9-5" />
              </svg>
            }
          />
          <StatCard
            eyebrow="EMPRESAS"
            label="Empresas"
            value={companyCount}
            subtext={`${gesCount} GES ativos`}
            href="/companies"
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="4" y="3" width="10" height="18" rx="1" />
                <path d="M14 8h5v13H4M7 7h2M7 11h2M7 15h2" />
              </svg>
            }
          />
          <StatCard
            eyebrow="EQUIPE"
            label="Funcionários"
            value={employeeCount}
            subtext={
              employeeCount > 0 ? (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="rounded-full bg-[#10b981]/12 px-2.5 py-0.5 text-[10px] font-bold text-[#0e9f6e]">
                    {activeEmployees} ativos
                  </span>
                  <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-[10px] font-bold text-[#797e96]">
                    {inactiveEmployees} inativos
                  </span>
                </div>
              ) : undefined
            }
            href="/employees"
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <circle cx="9" cy="8" r="3" />
                <path d="M3 20a6 6 0 0 1 12 0" />
                <path d="M16 6a3 3 0 0 1 0 6" />
              </svg>
            }
          />
          <StatCard
            eyebrow="OS FUNCIONAL"
            label="OS Funcional"
            value={serviceOrdersTotal}
            subtext={
              serviceOrdersTotal > 0 ? `${serviceOrdersSigned} assinadas` : "Ordens de serviço"
            }
            href="/service-orders"
            highlight
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 9h6M9 13h6M9 17h4" />
              </svg>
            }
          />
        </section>
      ) : null}

      {/* Banner: Saúde Preventiva */}
      {config.psicossocial ? <PsicossocialBanner /> : null}

      {/* Grid Row 1: Riscos por Categoria & Planos de Ação */}
      {config.risks || config.actionPlans ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {config.risks ? (
            <RiskCategoryChart segments={withBarPercents(data.risksByAgentType)} />
          ) : null}
          {config.actionPlans ? (
            <ActionPlanDonutChart segments={withBarPercents(data.actionPlansByLevel)} />
          ) : null}
        </div>
      ) : null}

      {/* Grid Row 2: Status de OS & Status de Incidentes */}
      {config.serviceOrders || config.incidents ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {config.serviceOrders ? (
            <ServiceOrderDonutChart summary={data.serviceOrdersSummary} />
          ) : null}
          {config.incidents ? (
            <IncidentVerticalChart summary={data.accidentsSummary} />
          ) : null}
        </div>
      ) : null}

      {/* Painel de Pendências */}
      {config.pending ? (
        <PendingPanel
          items={[
            {
              label: "PGRs vencidos",
              count: data.pending.pgrsExpired,
              href: "/pgr",
            },
            {
              label: "Controles em atraso",
              count: data.pending.controlsOverdue,
              href: "/risks",
            },
            {
              label: "EPIs abaixo do mínimo",
              count: data.pending.episLowStock,
              href: "/epi-stock",
            },
            {
              label: "EPIs a devolver",
              count: data.pending.episPendingReturn,
              href: "/epi-returns",
            },
            {
              label: "Treinamentos vencidos",
              count: data.pending.trainingsExpired,
              href: "/training-expiry",
            },
            {
              label: "Treinamentos a vencer",
              count: data.pending.trainingsDueSoon,
              href: "/training-expiry",
            },
          ]}
        />
      ) : null}

      {/* Modal de Personalização da Visão */}
      <CustomizeViewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        config={config}
        onSave={updateConfig}
        onReset={resetConfig}
      />
    </>
  );
}
