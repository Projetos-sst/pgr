import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { editableTextGroups } from "@/shared/domains/pgr/pgr-docx/text-overrides";
import { resolvePageParams } from "@/shared/pagination";
import { listPgrDocxTextVersionsAction } from "@/shared/server/actions/pgr/pgr-docx-texts";
import Link from "next/link";
import { PageHeader } from "../../../_ui/list";
import { PgrDocxTextsForm } from "./texts-form";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function PgrDocxTextsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const result = await listPgrDocxTextVersionsAction(id, { page, pageSize: PAGE_SIZE });
  if (!result.ok)
    return (
      <p role="alert" className="p-6">
        {result.error.message}
      </p>
    );
  const { rows, total, currentOverrides, currentTextsSha256 } = result.data;
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Textos padrão do PGR"
        backHref={`/pgr/${id}`}
        description="O documento sai com o texto padrão da plataforma. Altere aqui o que este PGR precisa dizer de outro modo."
      />
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-semibold">Versão em uso</h2>
        <p className="text-sm">
          {rows.length === 0 && total === 0
            ? "Texto padrão da plataforma, sem alteração neste PGR."
            : `${total} versão(ões) registrada(s). A mais recente vale para a próxima geração.`}
        </p>
        <p className="font-mono text-xs break-all">Textos: {currentTextsSha256}</p>
      </section>
      <PgrDocxTextsForm pgrId={id} groups={editableTextGroups(currentOverrides)} />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Histórico de versões</h2>
        {rows.length === 0 ? <p>Nenhuma alteração registrada.</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="glass-card rounded-xl p-4">
            <p className="font-semibold">
              Versão {row.version} ·{" "}
              {new Date(row.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </p>
            <p className="text-sm">{row.reason}</p>
            <p className="text-text-muted text-xs">Registrada por {row.createdBy}</p>
            <p className="font-mono text-xs break-all">Textos: {row.textsSha256}</p>
          </article>
        ))}
        <nav className="flex gap-4" aria-label="Páginas do histórico de textos">
          {page > 1 ? <Link href={`?page=${page - 1}`}>Anterior</Link> : null}
          {page * PAGE_SIZE < total ? (
            <Link href={`?page=${page + 1}`}>Próxima</Link>
          ) : null}
        </nav>
      </section>
    </div>
  );
}
