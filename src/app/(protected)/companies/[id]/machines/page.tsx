import Link from "next/link";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  listMachinesAction,
  machineOptionsAction,
} from "@/shared/server/actions/pgr/machine-installations";
import { resolvePageParams } from "@/shared/pagination";
import { PageHeader } from "../../../_ui/list";
import { MachineForm } from "./form";
export const dynamic = "force-dynamic";
export default async function MachinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; history?: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const { page } = resolvePageParams({ page: Number(sp.page) });
  const includeInactive = sp.history === "true";
  const [result, options] = await Promise.all([
    listMachinesAction(id, { page, includeInactive }),
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
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Máquinas e equipamentos por ambiente"
        backHref={`/companies/${id}/services`}
        description="Vincule itens do catálogo à obra e, quando aplicável, ao GES. Informações de segurança permanecem específicas deste contexto."
      />
      <Link href="/epi-catalog?type=machine" className="underline">
        Consultar ou cadastrar máquina no catálogo
      </Link>
      <MachineForm companyId={id} options={options.data} />
      <Link href={`?history=${!includeInactive}`} className="underline">
        {includeInactive
          ? "Exibir somente vínculos ativos"
          : "Incluir vínculos retirados"}
      </Link>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Vínculos ({result.data.total})</h2>
        {result.data.rows.length === 0 && <p>Nenhuma máquina vinculada.</p>}
        {result.data.rows.map((m) => (
          <article key={m.id} className="glass-card rounded-xl p-4">
            <Link
              href={`/companies/${id}/machines/${m.id}`}
              className="font-semibold underline"
            >
              {m.catalogName} {m.identifier ? `— ${m.identifier}` : ""}
            </Link>
            <p>
              {m.quantity} unidade(s) · {m.active ? "Ativo" : "Retirado"} ·{" "}
              {m.description}
            </p>
            <p>
              Obra:{" "}
              {options.data.units.find((u) => u.id === m.workUnitId)?.name ??
                "Cadastro vinculado"}{" "}
              · GES:{" "}
              {m.gesId
                ? (options.data.groups.find((g) => g.id === m.gesId)?.name ??
                  "Cadastro vinculado")
                : "Uso geral na obra"}
            </p>
          </article>
        ))}
      </section>
      <nav className="flex gap-4" aria-label="Páginas de máquinas">
        {page > 1 && (
          <Link href={`?page=${page - 1}&history=${includeInactive}`}>Anterior</Link>
        )}
        {page * 20 < result.data.total && (
          <Link href={`?page=${page + 1}&history=${includeInactive}`}>Próxima</Link>
        )}
      </nav>
    </div>
  );
}
