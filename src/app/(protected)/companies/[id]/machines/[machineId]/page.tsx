import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getMachineAction,
  machineOptionsAction,
} from "@/shared/server/actions/pgr/machine-installations";
import { PageHeader } from "../../../../_ui/list";
import { MachineForm, ArchiveMachine } from "../form";
import Link from "next/link";
import { resolvePageParams } from "@/shared/pagination";
export const dynamic = "force-dynamic";
export default async function MachinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; machineId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireOfficeStaffPage();
  const { id, machineId } = await params;
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const [result, options] = await Promise.all([
    getMachineAction(id, machineId, { page }),
    machineOptionsAction(id),
  ]);
  if (!result.ok || !options.ok)
    return (
      <p role="alert" className="p-6">
        {!result.ok
          ? result.error.message
          : !options.ok
            ? options.error.message
            : "Indisponível"}
      </p>
    );
  const { installation, history } = result.data;
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={installation.catalogName}
        backHref={`/companies/${id}/machines`}
        description={`Versão ${installation.version} · ${installation.active ? "Vínculo ativo" : "Vínculo retirado"}`}
      />
      {installation.active ? (
        <>
          <MachineForm
            key={installation.version}
            companyId={id}
            options={options.data}
            initial={installation}
          />
          <ArchiveMachine companyId={id} machine={installation} />
        </>
      ) : (
        <p>Este vínculo foi retirado. Os dados anteriores permanecem no histórico.</p>
      )}
      <section>
        <h2 className="font-semibold">Histórico de alterações</h2>
        {history.rows.map((e) => (
          <article key={e.id} className="my-3 rounded-xl border p-4">
            <p>
              {new Date(e.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              · {e.actor} ·{" "}
              {e.event === "created"
                ? "Cadastro"
                : e.event === "updated"
                  ? "Alteração"
                  : "Retirada"}
            </p>
            <p>{e.reason}</p>
            <details>
              <summary>Dados registrados nesta versão</summary>
              <p className="whitespace-pre-wrap">
                {String(
                  (e.snapshot.next as Record<string, unknown> | undefined)?.description ??
                    "",
                )}
              </p>
              <p>
                {String(
                  (e.snapshot.next as Record<string, unknown> | undefined)
                    ?.safetyMeasures ?? "Medidas de segurança não informadas.",
                )}
              </p>
            </details>
          </article>
        ))}
        <nav aria-label="Páginas do histórico" className="flex gap-4">
          {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
          {page * 20 < history.total && <Link href={`?page=${page + 1}`}>Próxima</Link>}
        </nav>
      </section>
    </div>
  );
}
