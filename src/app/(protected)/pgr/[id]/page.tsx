import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getPgrAction } from "@/shared/server/actions/pgr/pgr";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getWorkUnitAction } from "@/shared/server/actions/pgr/work-units";
import { pgrRegistrationTypeLabel } from "@/shared/domains/pgr/pgr";

import { PageHeader } from "../../_ui/list";
import { DeletePgr } from "../_components/delete-pgr";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs tracking-wide text-zinc-500 uppercase">{label}</span>
      <span className="text-sm">{value && value !== "" ? value : "—"}</span>
    </div>
  );
}

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export default async function PgrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const pgrResult = await getPgrAction(id);
  if (!pgrResult.ok) notFound();
  const doc = pgrResult.data;

  const [companyResult, workUnitResult] = await Promise.all([
    getCompanyAction(doc.companyId),
    doc.workUnitId ? getWorkUnitAction(doc.workUnitId) : Promise.resolve(null),
  ]);
  const companyName = companyResult.ok ? companyResult.data.razaoSocial : doc.companyId;
  const workUnitName =
    workUnitResult && workUnitResult.ok ? workUnitResult.data.name : null;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Documento PGR"
        description={`Empresa: ${companyName}`}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="Em breve (#76)"
              className="cursor-not-allowed rounded-md border border-black/15 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-white/15 dark:text-zinc-600"
            >
              Metodologia de Avaliação
            </button>
            <Link
              href={`/pgr/${doc.id}/edit`}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
            >
              Editar
            </Link>
            <DeletePgr id={doc.id} redirectTo="/pgr" />
          </div>
        }
      />

      <section className="grid gap-4 rounded-lg border border-black/10 p-4 sm:grid-cols-3 dark:border-white/10">
        <Field label="Empresa" value={companyName} />
        <Field label="Obra/Contrato" value={workUnitName} />
        <Field label="Responsável pela elaboração" value={doc.responsible} />
        <Field
          label="Tipo de registro"
          value={pgrRegistrationTypeLabel(doc.registrationType)}
        />
        <Field label="Nº do registro" value={doc.registrationNumber} />
        <Field label="Data de emissão" value={brDate(doc.issuedAt)} />
        <Field label="Data de validade" value={brDate(doc.validUntil)} />
      </section>
    </div>
  );
}
