import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { REPORT_TYPES } from "@/shared/domains/platform/reports";
import { isPdfGenerationEnabled } from "@/shared/integrations/pdf/config";

import { PageHeader } from "../_ui/list";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  await requireOfficeStaffPage();
  const pdfEnabled = isPdfGenerationEnabled();

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Relatórios"
        description="Gere e baixe documentos consolidados da organização."
      />

      {!pdfEnabled ? (
        <p className="rounded-card border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A geração de PDF ainda não está configurada neste ambiente (
          <code>GOTENBERG_URL</code>). Os relatórios disponíveis aparecem abaixo e serão
          gerados assim que o serviço estiver ativo.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((report) => (
          <div key={report.key} className="glass-card flex flex-col gap-2 p-5">
            <span className="text-text font-medium tracking-tight">{report.title}</span>
            <span className="text-text-muted flex-1 text-sm">{report.description}</span>
            {report.available && pdfEnabled ? (
              <a
                href={`/api/v1/reports/${report.key}`}
                className="btn-primary rounded-pill mt-2 inline-block px-4 py-2 text-center text-sm font-semibold transition-colors"
              >
                Gerar PDF
              </a>
            ) : (
              <span className="glass-panel text-text-subtle rounded-pill mt-2 inline-block px-4 py-2 text-center text-sm">
                {report.available ? "Indisponível" : "Em breve"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
