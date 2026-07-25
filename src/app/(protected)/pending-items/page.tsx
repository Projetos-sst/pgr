import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getDashboardSummaryAction } from "@/shared/server/actions/platform/dashboard";
import { getPendingItemsAction } from "@/shared/server/actions/platform/pending-items";
import { listTeamMembers } from "@/shared/server/actions/platform/team";
import { EmptyState, PageHeader } from "../_ui/list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ filter?: string; search?: string; view?: string }>;

type RenderedTask = {
  id: string;
  category: string;
  primary: string;
  secondary: string;
  href: string;
  status: "overdue" | "duesoon" | "ontime";
  badgeColor: string;
};

export default async function MinhasTarefasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const currentFilter = sp.filter ?? "all";
  const searchQuery = (sp.search ?? "").toLowerCase().trim();

  const [summaryRes, itemsRes, teamRes] = await Promise.all([
    getDashboardSummaryAction(),
    getPendingItemsAction(),
    listTeamMembers(),
  ]);

  // Bug #1: early return when core actions fail — avoids masking errors as "tudo em dia"
  if (!summaryRes.ok || !itemsRes.ok) {
    return (
      <div className="flex flex-col gap-6 px-6 py-8">
        <PageHeader title="Pendências e vencimentos" />
        <EmptyState message="Não foi possível carregar as pendências. Tente novamente em instantes." />
      </div>
    );
  }

  const teamTotal = teamRes.ok ? teamRes.data.total : 0;
  const hasActiveTeam = teamTotal > 1;
  const activeView = sp.view === "team" && hasActiveTeam ? "team" : "my";

  const p = summaryRes.data.pending;
  const items = itemsRes.data;

  // Monta a lista unificada de tarefas REAIS vindas do banco de dados
  const allRealTasks: RenderedTask[] = [];

  if (items) {
    items.pgrsExpired.forEach((r) => {
      allRealTasks.push({
        id: `pgr-${r.id}`,
        category: "PGR",
        primary: `PGR Vencido: ${r.primary}`,
        secondary: r.secondary,
        href: r.href,
        status: "overdue",
        badgeColor: "bg-red-500/10 text-red-600 border-red-200",
      });
    });

    items.controlsOverdue.forEach((r) => {
      allRealTasks.push({
        id: `control-${r.id}`,
        category: "Plano de Ação",
        primary: `Controle Em Atraso: ${r.primary}`,
        secondary: r.secondary,
        href: r.href,
        status: "overdue",
        badgeColor: "bg-red-500/10 text-red-600 border-red-200",
      });
    });

    items.episLowStock.forEach((r) => {
      allRealTasks.push({
        id: `epi-stock-${r.id}`,
        category: "Estoque de EPI",
        primary: `Estoque Crítico: ${r.primary}`,
        secondary: r.secondary,
        href: r.href,
        status: "duesoon",
        badgeColor: "bg-amber-500/10 text-amber-600 border-amber-200",
      });
    });
  }

  if (p) {
    if (p.episPendingReturn > 0) {
      allRealTasks.push({
        id: "epi-return-summary",
        category: "Devolução de EPI",
        primary: `${p.episPendingReturn} EPI(s) com devolução pendente`,
        secondary: "Verifique as entregas ativas para baixa",
        href: "/epi-returns",
        status: "ontime",
        badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
      });
    }

    if (p.trainingsExpired > 0) {
      allRealTasks.push({
        id: "training-expired-summary",
        category: "Treinamentos",
        primary: `${p.trainingsExpired} treinamento(s) vencido(s)`,
        secondary: "Funcionários necessitam de reciclagem de NR",
        href: "/training-expiry",
        status: "overdue",
        badgeColor: "bg-red-500/10 text-red-600 border-red-200",
      });
    }

    if (p.trainingsDueSoon > 0) {
      allRealTasks.push({
        id: "training-duesoon-summary",
        category: "Treinamentos",
        primary: `${p.trainingsDueSoon} treinamento(s) a vencer nos próximos 30 dias`,
        secondary: "Agende as turmas de reciclagem",
        href: "/training-expiry",
        status: "duesoon",
        badgeColor: "bg-amber-500/10 text-amber-600 border-amber-200",
      });
    }
  }

  // Bug #2: KPI counts use aggregate data from dashboard (full counts, not capped list)
  // allRealTasks.length is capped at 5 per category — use p (summaryRes aggregate) instead
  const totalCount =
    p.pgrsExpired + p.controlsOverdue + p.episLowStock +
    (p.episPendingReturn > 0 ? 1 : 0) +
    (p.trainingsExpired > 0 ? 1 : 0) +
    (p.trainingsDueSoon > 0 ? 1 : 0);
  const overdueCount = p.pgrsExpired + p.controlsOverdue + (p.trainingsExpired > 0 ? 1 : 0);
  const dueSoonCount = p.episLowStock + (p.trainingsDueSoon > 0 ? 1 : 0);
  const onTimeCount = p.episPendingReturn > 0 ? 1 : 0;
  const completedCount = 0;

  // Bug #4: helper to build URLs safely with URLSearchParams (preserves all params)
  function buildUrl(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    if (overrides.view ?? (activeView !== "my" ? activeView : undefined))
      params.set("view", overrides.view ?? activeView);
    const filter = overrides.filter ?? (currentFilter !== "all" ? currentFilter : undefined);
    if (filter && filter !== "all") params.set("filter", filter);
    const search = overrides.search ?? (searchQuery || undefined);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/pending-items${qs ? `?${qs}` : ""}`;
  }

  // Filtragem por busca e por status
  const filteredTasks = allRealTasks.filter((t) => {
    if (currentFilter === "overdue" && t.status !== "overdue") return false;
    if (currentFilter === "duesoon" && t.status !== "duesoon") return false;
    if (currentFilter === "ontime" && t.status !== "ontime") return false;
    if (currentFilter === "completed") return false;

    if (searchQuery) {
      return (
        t.primary.toLowerCase().includes(searchQuery) ||
        t.secondary.toLowerCase().includes(searchQuery) ||
        t.category.toLowerCase().includes(searchQuery)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      {/* Top Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5b63f5]/15 text-[#5b63f5] shadow-xs">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1b1f2e]">
              {activeView === "team" ? "Tarefas da Equipe" : "Minhas Tarefas"}
            </h1>
            <p className="text-xs font-medium text-[#8c91a8]">
              {activeView === "team"
                ? `Acompanhe os prazos e pendências de todos os ${teamTotal} membros da equipe.`
                : "Acompanhe todos os seus prazos e atividades ativas no sistema."}
            </p>
          </div>
        </div>

        {/* Visão da Equipe Toggle Pill */}
        {hasActiveTeam ? (
          <Link
            href={buildUrl({ view: activeView === "team" ? "my" : "team" })}
            title={
              activeView === "team"
                ? "Alternar para minhas tarefas"
                : "Alternar para visão de toda a equipe"
            }
            className="flex items-center gap-2.5 rounded-full border border-white/60 bg-white/50 px-3.5 py-1.5 shadow-xs backdrop-blur-md transition-all hover:scale-105 hover:bg-white/80 active:scale-95"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={activeView === "team" ? "#5b63f5" : "#52576e"}
              strokeWidth="1.8"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span
              className={`text-xs font-bold ${activeView === "team" ? "text-[#5b63f5]" : "text-[#52576e]"}`}
            >
              Visão da Equipe
            </span>
            <div
              className={`h-4 w-7 rounded-full p-0.5 transition-colors ${activeView === "team" ? "bg-[#5b63f5]" : "bg-black/15"}`}
            >
              <div
                className={`h-3 w-3 rounded-full bg-white shadow-xs transition-transform ${activeView === "team" ? "translate-x-3" : "translate-x-0"}`}
              />
            </div>
          </Link>
        ) : (
          <div
            title="Visão da equipe disponível apenas para organizações com equipe ativa (mais de 1 membro)."
            className="flex cursor-not-allowed items-center gap-2.5 rounded-full border border-white/40 bg-white/20 px-3.5 py-1.5 opacity-60 backdrop-blur-md select-none"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7a7f97"
              strokeWidth="1.8"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-xs font-bold text-[#7a7f97]">Visão da Equipe</span>
            <div className="h-4 w-7 rounded-full bg-slate-200 p-0.5">
              <div className="h-3 w-3 rounded-full bg-slate-400 shadow-xs" />
            </div>
          </div>
        )}
      </div>

      {/* 5 KPI Metric Cards REAIS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* TOTAL */}
        <div className="glass-card flex items-center justify-between p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-[#1b1f2e]">{totalCount}</div>
              <div className="font-mono text-[10px] tracking-wider text-[#9095ad] uppercase">
                TOTAL
              </div>
            </div>
          </div>
        </div>

        {/* VENCIDAS */}
        <div className="glass-card flex items-center justify-between p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-red-600">{overdueCount}</div>
              <div className="font-mono text-[10px] tracking-wider text-[#9095ad] uppercase">
                VENCIDAS
              </div>
            </div>
          </div>
        </div>

        {/* PRÓX. VENC. */}
        <div className="glass-card flex items-center justify-between p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-amber-600">{dueSoonCount}</div>
              <div className="font-mono text-[10px] tracking-wider text-[#9095ad] uppercase">
                PRÓX. VENC.
              </div>
            </div>
          </div>
        </div>

        {/* NO PRAZO */}
        <div className="glass-card flex items-center justify-between p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-emerald-600">{onTimeCount}</div>
              <div className="font-mono text-[10px] tracking-wider text-[#9095ad] uppercase">
                NO PRAZO
              </div>
            </div>
          </div>
        </div>

        {/* CONCLUÍDAS */}
        <div className="glass-card flex items-center justify-between p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-teal-600">{completedCount}</div>
              <div className="font-mono text-[10px] tracking-wider text-[#9095ad] uppercase">
                CONCLUÍDAS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Glass Table Container */}
      <div className="glass-panel overflow-hidden rounded-2xl border border-white/60 p-6 shadow-xl">
        {/* Search & Filter Bar */}
        <form
          method="GET"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="relative flex-1">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9095ad"
              strokeWidth="2"
              className="absolute top-1/2 left-3.5 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              name="search"
              defaultValue={sp.search ?? ""}
              placeholder="Buscar por descrição..."
              className="w-full rounded-xl border border-white/60 bg-white/50 py-2.5 pr-4 pl-10 text-xs font-medium text-[#1b1f2e] placeholder-[#9095ad] backdrop-blur-md transition-all outline-none focus:border-[#5b63f5]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-xs font-semibold text-[#52576e] backdrop-blur-md transition-colors hover:bg-white/70"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5b63f5"
                strokeWidth="2"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filtrar
            </button>
          </div>
        </form>

        {/* Filter Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-black/5 pb-4">
          <Link
            href={buildUrl({ filter: "all" })}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              currentFilter === "all"
                ? "bg-[#5b63f5] text-white shadow-md shadow-[#5b63f5]/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            Todas ({totalCount})
          </Link>
          <Link
            href={buildUrl({ filter: "overdue" })}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              currentFilter === "overdue"
                ? "bg-red-600 text-white shadow-md shadow-red-500/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            Vencidas ({overdueCount})
          </Link>
          <Link
            href={buildUrl({ filter: "duesoon" })}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              currentFilter === "duesoon"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            Próx. Venc. ({dueSoonCount})
          </Link>
          <Link
            href={buildUrl({ filter: "ontime" })}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              currentFilter === "ontime"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            No Prazo ({onTimeCount})
          </Link>
          <Link
            href={buildUrl({ filter: "completed" })}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              currentFilter === "completed"
                ? "bg-teal-600 text-white shadow-md shadow-teal-500/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            Concluídas ({completedCount})
          </Link>
        </div>

        {/* LISTA REAL DE TAREFAS VINDAS DO BANCO DE DADOS */}
        {filteredTasks.length > 0 ? (
          <div className="mt-4 flex flex-col divide-y divide-black/5">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-2 py-4 transition-colors hover:bg-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${task.badgeColor}`}
                  >
                    {task.category}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-[#1b1f2e]">{task.primary}</h4>
                    <p className="text-xs font-medium text-[#7a7f97]">{task.secondary}</p>
                  </div>
                </div>

                <Link
                  href={task.href}
                  className="self-start rounded-xl bg-[#5b63f5] px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-[#5b63f5]/25 transition-transform hover:scale-[1.02] sm:self-auto"
                >
                  Ver Origem →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State quando não há pendências reais no banco para o filtro */
          <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5b63f5]/10 text-[#5b63f5]">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="6" x2="9" y2="6.01" />
                <line x1="15" y1="6" x2="15" y2="6.01" />
                <line x1="9" y1="10" x2="9" y2="10.01" />
                <line x1="15" y1="10" x2="15" y2="10.01" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-extrabold text-[#1b1f2e]">
              {totalCount === 0
                ? "Nenhuma tarefa pendente"
                : "Nenhum resultado para este filtro"}
            </h3>
            <p className="mt-1 max-w-sm text-xs font-medium text-[#8c91a8]">
              {totalCount === 0
                ? "Tudo em dia! Nenhuma pendência ou vencimento foi encontrado na organização ativa."
                : "Tente selecionar outro filtro acima ou realizar uma nova busca."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
