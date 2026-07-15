import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getPgrAction } from "@/shared/server/actions/pgr/pgr";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getWorkUnitAction } from "@/shared/server/actions/pgr/work-units";
import { listGesAction } from "@/shared/server/actions/pgr/ges";
import { listPgrGesAction } from "@/shared/server/actions/pgr/pgr-ges";
import { listPgrRevisionsAction } from "@/shared/server/actions/pgr/pgr-revisions";
import { getPgrConsolidatedAction } from "@/shared/server/actions/pgr/pgr-consolidated";
import { getPgrSignatureViewAction } from "@/shared/server/actions/pgr/pgr-signature";

import { PageHeader } from "../../_ui/list";
import { DeletePgr } from "../_components/delete-pgr";
import { PgrEditorTabs } from "./_components/pgr-editor-tabs";

export const dynamic = "force-dynamic";

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

  // Uma rodada de leituras independentes para montar o editor em abas.
  const [
    companyResult,
    workUnitResult,
    gesLinks,
    revisions,
    consolidated,
    gesOptions,
    signature,
  ] = await Promise.all([
    getCompanyAction(doc.companyId),
    doc.workUnitId ? getWorkUnitAction(doc.workUnitId) : Promise.resolve(null),
    listPgrGesAction(id),
    listPgrRevisionsAction(id),
    getPgrConsolidatedAction(id),
    listGesAction({ companyId: doc.companyId, pageSize: 100 }),
    getPgrSignatureViewAction({ pgrId: id }),
  ]);

  const companyName = companyResult.ok ? companyResult.data.razaoSocial : doc.companyId;
  const workUnitName =
    workUnitResult && workUnitResult.ok ? workUnitResult.data.name : null;
  const availableGes = gesOptions.ok
    ? gesOptions.data.rows.map((g) => ({ id: g.id, name: g.name }))
    : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Documento PGR"
        description={`Empresa: ${companyName}`}
        action={<DeletePgr id={doc.id} redirectTo="/pgr" />}
      />

      <PgrEditorTabs
        pgrId={doc.id}
        pgr={doc}
        companyName={companyName}
        workUnitName={workUnitName}
        availableGes={availableGes}
        gesLinks={gesLinks.ok ? gesLinks.data : []}
        revisions={revisions.ok ? revisions.data : []}
        consolidated={consolidated.ok ? consolidated.data : null}
        signature={signature.ok ? signature.data : undefined}
      />
    </div>
  );
}
