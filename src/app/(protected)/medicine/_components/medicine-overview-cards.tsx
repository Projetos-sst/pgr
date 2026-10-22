import type { ExamValidityCounts } from "@/shared/domains/medicine/overview";

import { StatCard } from "../../_ui/stat-card";

const ICON_PROPS = {
  width: "18",
  height: "18",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.7",
  "aria-hidden": true,
} as const;

/**
 * KPIs do painel — só dado real (regra da fatia 019). A situação é a do ÚLTIMO
 * exame de cada funcionário pela validade INFORMADA (sem periodicidade calculada).
 * Só "Empresas" tem destino: não há filtro por validade em `/health-exams`, e um
 * link que não filtra enganaria.
 */
export function MedicineOverviewCards({
  companies,
  employees,
  validity,
  dueWindowDays,
  companyName,
}: {
  companies: number;
  employees: number;
  validity: ExamValidityCounts;
  dueWindowDays: number;
  /** Empresa selecionada: os números (exceto Empresas) são só dela. */
  companyName?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        eyebrow="EMPRESAS"
        label="Empresas com Medicina"
        value={companies}
        href="/companies"
        icon={
          <svg {...ICON_PROPS}>
            <rect x="4" y="3" width="10" height="18" rx="1" />
            <path d="M14 8h5v13H4M7 7h2M7 11h2M7 15h2" />
          </svg>
        }
      />
      <StatCard
        eyebrow="FUNCIONÁRIOS"
        label="Funcionários"
        value={employees}
        subtext={companyName ? `Em ${companyName}` : "Em empresas com Medicina"}
        icon={
          <svg {...ICON_PROPS}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20a6 6 0 0 1 12 0" />
            <path d="M16 6a3 3 0 0 1 0 6" />
          </svg>
        }
      />
      <StatCard
        eyebrow="VENCIDOS"
        label="Vencidos"
        value={validity.expired}
        subtext="Pela validade informada no último exame"
        icon={
          <svg {...ICON_PROPS}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5M12 16h.01" />
          </svg>
        }
      />
      <StatCard
        eyebrow={`A VENCER (${dueWindowDays} DIAS)`}
        label="A vencer"
        value={validity.dueSoon}
        subtext="Pela validade informada no último exame"
        icon={
          <svg {...ICON_PROPS}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        }
      />
      <StatCard
        eyebrow="SEM EXAME"
        label="Sem exame registrado"
        value={validity.withoutExam}
        subtext="Funcionários sem nenhum exame"
        icon={
          <svg {...ICON_PROPS}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        }
      />
    </div>
  );
}
