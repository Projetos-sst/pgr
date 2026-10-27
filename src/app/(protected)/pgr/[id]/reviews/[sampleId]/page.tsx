import Link from "next/link";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { ReviewSampleDownloadButton } from "../reviewer-access";
import { getReviewSampleAction } from "@/shared/server/actions/pgr/document-reviews";
import { resolvePageParams } from "@/shared/pagination";
import { PageHeader } from "../../../../_ui/list";
import { NewSampleForm, ReviewDecisionForm } from "../forms";
export const dynamic = "force-dynamic";
export default async function ReviewSamplePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sampleId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireTenantContext();
  const { id, sampleId } = await params;
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const result = await getReviewSampleAction(id, sampleId, { page });
  if (!result.ok)
    return (
      <p role="alert" className="p-6">
        {result.error.message}
      </p>
    );
  const view = result.data;
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Revisão da amostra preservada"
        backHref={`/pgr/${id}/reviews`}
        description="O parecer se refere a este arquivo. Alterar o cadastro do PGR não reescreve a amostra ou decisões anteriores."
      />
      <p>
        {view.sourceChanged
          ? "Os dados atuais mudaram. Gere nova amostra para revalidar o documento corrigido."
          : "Os dados atuais correspondem à amostra."}
      </p>
      <ReviewSampleDownloadButton pgrId={id} sampleId={sampleId} />
      <details>
        <summary>Identificação da versão analisada</summary>
        <p className="text-sm break-all">Arquivo: {view.sample.fileSha256}</p>
        <p className="text-sm break-all">Dados: {view.sample.snapshotSha256}</p>
        <p className="text-sm break-all">Modelo: {view.sample.templateSha256}</p>
      </details>
      {ctx.role !== "client" ? (
        <NewSampleForm pgrId={id} supersedesSampleId={sampleId} />
      ) : null}
      {view.canRecordDecision ? (
        <ReviewDecisionForm
          key={view.latestDecision?.id ?? "new"}
          pgrId={id}
          sampleId={sampleId}
          expectedLatestDecisionId={view.latestDecision?.id ?? null}
          previousFindings={view.previousFindings}
        />
      ) : (
        <p>O administrador registra o parecer recebido do responsável técnico.</p>
      )}
      <section>
        <h2 className="font-semibold">Pareceres e revalidações registrados</h2>
        {view.history.rows.length === 0 && (
          <p>Aguardando parecer. Nenhuma aprovação foi registrada.</p>
        )}
        {view.history.rows.map((d) => (
          <article key={d.id} className="glass-card my-4 rounded-xl p-4">
            <h3 className="font-semibold">
              {d.status === "accepted"
                ? "Parecer favorável recebido"
                : "Correções solicitadas"}
            </h3>
            <p>
              Avaliador informado: {d.data.reviewer.fullName} ·{" "}
              {d.data.reviewer.profession} ·{" "}
              {d.data.reviewer.registration.kind === "registered"
                ? `${d.data.reviewer.registration.council} ${d.data.reviewer.registration.number}`
                : d.data.reviewer.registration.reason}
            </p>
            <p>
              Parecer de{" "}
              {new Date(d.data.reviewedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
              . Registro por {d.recordedBy} em{" "}
              {new Date(d.recordedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
              .
            </p>
            <p>Evidência: {d.data.evidenceReference}</p>
            <p className="whitespace-pre-wrap">{d.data.reason}</p>
            <ul>
              {d.data.findings.map((f) => (
                <li key={f.key} className="my-2 border-t pt-2">
                  {f.key} · {f.location}: {f.description} ·{" "}
                  {f.resolution === "resolved" ? "Corrigido" : "Aberto"}
                  {f.correctionReference ? ` · Correção: ${f.correctionReference}` : ""}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <nav className="flex gap-4" aria-label="Páginas dos pareceres">
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {page * 20 < view.history.total && (
          <Link href={`?page=${page + 1}`}>Próxima</Link>
        )}
      </nav>
    </div>
  );
}
