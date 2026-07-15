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
        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          A geração de PDF ainda não está configurada neste ambiente (
          <code>GOTENBERG_URL</code>). Os relatórios disponíveis aparecem abaixo e serão
          gerados assim que o serviço estiver ativo.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((report) => (
          <div
            key={report.key}
            className="flex flex-col gap-2 rounded-lg border border-black/10 p-5 dark:border-white/10"
          >
            <span className="font-medium tracking-tight">{report.title}</span>
            <span className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
              {report.description}
            </span>
            {report.available && pdfEnabled ? (
              <a
                href={`/api/v1/reports/${report.key}`}
                className="mt-2 inline-block rounded-full bg-black px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-black/85 dark:bg-white dark:text-black"
              >
                Gerar PDF
              </a>
            ) : (
              <span className="mt-2 inline-block rounded-full border border-black/15 px-4 py-2 text-center text-sm text-zinc-500 dark:border-white/15">
                {report.available ? "Indisponível" : "Em breve"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
