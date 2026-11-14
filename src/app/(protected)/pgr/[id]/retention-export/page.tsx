import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDateTime } from "@/shared/dates";
import type { RetentionExportStatus } from "@/shared/domains/retention/export-manifest";
import { listPgrRetentionExportsAction } from "@/shared/server/actions/retention/retention";

import { PageHeader } from "../../../_ui/list";
import { StatusBadge, type StatusTone } from "../../../_ui/status-badge";
import { PgrRetentionExportForm } from "./export-form";

export const dynamic = "force-dynamic";

const STATUS: Record<RetentionExportStatus, { tone: StatusTone; label: string }> = {
  complete: { tone: "green", label: "Completa" },
  incomplete: { tone: "amber", label: "Incompleta" },
  failed: { tone: "red", label: "Falhou" },
};

export default async function PgrRetentionExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const history = await listPgrRetentionExportsAction(id);
  if (!history.ok)
    return (
      <p role="alert" className="p-6">
        {history.error.message}
      </p>
    );
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Pacote de guarda do PGR"
        backHref={`/pgr/${id}`}
        description="Exporta os documentos e versões deste PGR, os pareceres, os eventos de revisão e emissão e as evidências de assinatura, com um manifesto que traz o SHA-256 de cada item e do conjunto."
      />
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5">
        <p className="text-sm">
          Repetir a exportação sem mudança no acervo gera o mesmo SHA-256 do conjunto.
          Arquivo ausente ou diferente do registrado na emissão aparece no manifesto e
          marca o pacote como incompleto. Nada é apagado.
        </p>
        <PgrRetentionExportForm pgrId={id} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Exportações registradas ({history.data.total})</h2>
        {history.data.rows.length === 0 ? <p>Nenhuma exportação registrada.</p> : null}
        {history.data.rows.map((row) => (
          <article key={row.id} className="glass-card flex flex-col gap-1 rounded-xl p-4">
            <StatusBadge {...STATUS[row.status]} />
            <p className="text-sm">
              {formatInstantDateTime(row.createdAt)} · por {row.exportedBy} ·{" "}
              {row.itemCount} itens, {row.missingCount} ausentes, {row.hashMismatchCount}{" "}
              divergentes
            </p>
            <p className="font-mono text-xs break-all">
              Conjunto: {row.contentSha256 ?? "pacote não gerado"}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
