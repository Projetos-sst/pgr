import { DownloadDocumentButton } from "../../../documents/_components/download-document-button";
import Link from "next/link";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listReviewSamplesAction } from "@/shared/server/actions/pgr/document-reviews";
import { resolvePageParams } from "@/shared/pagination";
import { PageHeader } from "../../../_ui/list";
import { NewSampleForm } from "./forms";
export const dynamic = "force-dynamic";
export default async function ReviewSamplesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const result = await listReviewSamplesAction(id, { page });
  if (!result.ok)
    return (
      <p role="alert" className="p-6">
        {result.error.message}
      </p>
    );
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Amostras e revisão técnica do PGR"
        backHref={`/pgr/${id}`}
        description="Preserve a versão analisada, registre pareceres recebidos e acompanhe correções e revalidações."
      />
      <NewSampleForm pgrId={id} />
      {result.data.rows.length === 0 && <p>Nenhuma amostra registrada.</p>}
      {result.data.rows.map((s) => (
        <article key={s.id} className="glass-card rounded-xl p-5">
          <Link className="font-semibold underline" href={`/pgr/${id}/reviews/${s.id}`}>
            Amostra de{" "}
            {new Date(s.createdAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </Link>
          <p>{s.reason}</p>
          <p>
            {s.latestDecision
              ? s.latestDecision.status === "accepted"
                ? "Parecer favorável registrado"
                : "Correções solicitadas"
              : "Aguardando parecer"}{" "}
            ·{" "}
            {s.sourceChanged
              ? "Dados atuais diferem da amostra"
              : "Dados correspondem à amostra"}
          </p>
          <DownloadDocumentButton documentId={s.documentId} />
        </article>
      ))}
      <nav className="flex gap-4" aria-label="Páginas das amostras">
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {page * 20 < result.data.total && <Link href={`?page=${page + 1}`}>Próxima</Link>}
      </nav>
    </div>
  );
}
