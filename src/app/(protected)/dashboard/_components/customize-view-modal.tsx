"use client";

import { useSyncExternalStore, useState } from "react";

export type DashboardViewConfig = {
  kpis: boolean;
  psicossocial: boolean;
  risks: boolean;
  actionPlans: boolean;
  serviceOrders: boolean;
  incidents: boolean;
  pending: boolean;
};

export const DEFAULT_VIEW_CONFIG: DashboardViewConfig = {
  kpis: true,
  psicossocial: true,
  risks: true,
  actionPlans: true,
  serviceOrders: true,
  incidents: true,
  pending: true,
};

const STORAGE_KEY = "sst_dashboard_view_config";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

export function useDashboardViewConfig() {
  const rawSaved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [userConfig, setUserConfig] = useState<Partial<DashboardViewConfig>>({});

  let savedParsed: Partial<DashboardViewConfig> = {};
  if (rawSaved) {
    try {
      savedParsed = JSON.parse(rawSaved) as Partial<DashboardViewConfig>;
    } catch {
      // ignore
    }
  }

  const config: DashboardViewConfig = {
    ...DEFAULT_VIEW_CONFIG,
    ...savedParsed,
    ...userConfig,
  };

  function updateConfig(newConfig: DashboardViewConfig) {
    setUserConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
  }

  function resetConfig() {
    updateConfig(DEFAULT_VIEW_CONFIG);
  }

  return { config, updateConfig, resetConfig };
}

export function CustomizeViewModal({
  open,
  onClose,
  config,
  onSave,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  config: DashboardViewConfig;
  onSave: (newConfig: DashboardViewConfig) => void;
  onReset: () => void;
}) {
  const [prevOpen, setPrevOpen] = useState(false);
  const [draft, setDraft] = useState<DashboardViewConfig>(config);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(config);
    }
  }

  if (!open) return null;

  const items: { key: keyof DashboardViewConfig; label: string; desc: string }[] = [
    {
      key: "kpis",
      label: "Indicadores Principais (KPIs)",
      desc: "Cards de PGRs, Empresas, Equipe e OS Funcional",
    },
    {
      key: "psicossocial",
      label: "Saúde Preventiva",
      desc: "Banner de Monitoramento Psicossocial e Campanhas",
    },
    {
      key: "risks",
      label: "Riscos por Categoria",
      desc: "Distribuição de agentes físicos, químicos, ergonômicos, etc.",
    },
    {
      key: "actionPlans",
      label: "Planos de Ação",
      desc: "Proporção de medidas de eliminação, proteção coletiva, EPI",
    },
    {
      key: "serviceOrders",
      label: "Status de Ordens de Serviço",
      desc: "Donut com ordens assinadas, pendentes e recusadas",
    },
    {
      key: "incidents",
      label: "Status de Incidentes",
      desc: "Gráfico de barras de acidentes e ocorrências",
    },
    {
      key: "pending",
      label: "Painel de Pendências",
      desc: "Resumo de vencimentos e itens críticos da empresa",
    },
  ];

  function toggle(key: keyof DashboardViewConfig) {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    onSave(draft);
    onClose();
  }

  function handleReset() {
    onReset();
    setDraft(DEFAULT_VIEW_CONFIG);
    onClose();
  }

  return (
    <div className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="glass-menu animate-modal-pop relative w-full max-w-lg overflow-hidden rounded-[20px] border border-white/80 bg-white/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/5 pb-4">
          <div>
            <h3 className="text-lg font-bold text-[#1b1f2e]">
              Personalizar Visão da Dashboard
            </h3>
            <p className="text-xs text-[#8c91a8]">
              Escolha quais blocos exibir no seu painel principal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#8c91a8] hover:bg-black/5 hover:text-[#1b1f2e]"
          >
            ✕
          </button>
        </div>

        <div className="my-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const active = draft[item.key];
            return (
              <div
                key={item.key}
                onClick={() => toggle(item.key)}
                className="flex cursor-pointer items-center justify-between rounded-[14px] border border-black/5 bg-white/60 p-3.5 transition-all hover:bg-white"
              >
                <div>
                  <div className="text-xs font-bold text-[#1b1f2e]">{item.label}</div>
                  <div className="text-[11px] text-[#8c91a8]">{item.desc}</div>
                </div>
                <div
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    active ? "bg-[#5b63f5]" : "bg-black/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-[#8c91a8] hover:text-[#1b1f2e]"
          >
            Restaurar Padrão
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] px-4 py-2 text-xs font-bold text-[#797e96] hover:bg-black/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary rounded-[10px] px-4 py-2 text-xs font-bold shadow-md"
            >
              Salvar Visão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
