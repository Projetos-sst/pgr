import Link from "next/link";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listBasicOffersAction } from "@/shared/server/actions/pgr/basic-offers";
import { resolvePageParams } from "@/shared/pagination";
import { PageHeader } from "../_ui/list";
import { BasicOfferForm, OfferPublicationForm } from "./form";
export const dynamic = "force-dynamic";
const periodLabels = { one_time: "Pagamento único", monthly: "Mensal", annual: "Anual" };
export default async function BasicOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireOfficeStaffPage();
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const result = await listBasicOffersAction({ page });
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
        title="Oferta de PGR básico"
        backHref="/companies"
        description="Defina público, escopo e condições comerciais com histórico. Apenas o administrador pode salvar e publicar versões."
      />
      <p>
        Publicação é administrativa: não cobra clientes nem altera contratos, Pro ou
        habilitações de PGR/Medicina. O documento usa o mesmo gerador e conferências do
        PGR.
      </p>
      <BasicOfferForm key={view.rows[0]?.id ?? "new"} initial={view.rows[0]?.data} />
      <section>
        <h2 className="font-semibold">Versões ({view.total})</h2>
        {view.rows.map((v) => (
          <article key={v.id} className="glass-card my-4 rounded-xl p-5">
            <h3 className="font-semibold">
              Versão {v.version} — {v.data.name} ·{" "}
              {v.id === view.activeVersionId ? "Publicada" : "Não publicada"}
            </h3>
            <p>
              {v.data.priceCents === null
                ? "Preço ainda não definido"
                : new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(v.data.priceCents / 100)}{" "}
              ·{" "}
              {v.data.billingPeriod
                ? periodLabels[v.data.billingPeriod]
                : "Periodicidade não definida"}
            </p>
            <dl className="my-3 space-y-2">
              {(
                [
                  ["Público", v.data.eligibility],
                  ["Escopo técnico", v.data.technicalScope],
                  ["Serviços incluídos", v.data.servicesIncluded],
                  ["Limitações", v.data.limitations],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="font-medium">{label}</dt>
                  <dd className="whitespace-pre-wrap">{value || "Ainda não definido"}</dd>
                </div>
              ))}
            </dl>
            <p>
              Funcionários: {v.data.maxEmployees ?? "Sem limite numérico definido"} ·
              Obras: {v.data.maxWorkUnits ?? "Sem limite numérico definido"} · Revisões:{" "}
              {v.data.maxRevisions ?? "Não definido"}
            </p>
            <p className="text-sm">
              Registrada em{" "}
              {new Date(v.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              por {v.createdBy}. Motivo: {v.data.reason}
            </p>
            <OfferPublicationForm
              id={v.id}
              activeVersionId={view.activeVersionId}
              isActive={v.id === view.activeVersionId}
            />
          </article>
        ))}
      </section>
      <section>
        <h2 className="font-semibold">Histórico de publicação</h2>
        {view.history.rows.map((e) => (
          <article key={e.id} className="my-3 rounded-lg border p-3">
            <p>
              {new Date(e.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              · {e.actor} ·{" "}
              {e.event === "created"
                ? "Nova versão"
                : e.event === "published"
                  ? "Publicação"
                  : "Retirada"}
            </p>
            <p>{String(e.details.reason ?? "")}</p>
            {typeof e.details.commercialApprovalReference === "string" && (
              <p>Aprovação comercial: {String(e.details.commercialApprovalReference)}</p>
            )}
            {typeof e.details.technicalApprovalReference === "string" && (
              <p>Aprovação técnica: {String(e.details.technicalApprovalReference)}</p>
            )}
          </article>
        ))}
      </section>
      <nav className="flex gap-4" aria-label="Páginas da oferta">
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {page * 20 < Math.max(view.total, view.history.total) && (
          <Link href={`?page=${page + 1}`}>Próxima</Link>
        )}
      </nav>
    </div>
  );
}
