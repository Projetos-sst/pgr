import { notFound } from "next/navigation";
import { pgrBillingExportAllowed } from "@/shared/db/repositories/billing-export";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getPgrAction } from "@/shared/server/actions/pgr/pgr";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getWorkUnitAction } from "@/shared/server/actions/pgr/work-units";
import { listGesAction } from "@/shared/server/actions/pgr/ges";
import { listPgrGesAction } from "@/shared/server/actions/pgr/pgr-ges";
import { listPgrRevisionsAction } from "@/shared/server/actions/pgr/pgr-revisions";
import { getPgrConsolidatedAction } from "@/shared/server/actions/pgr/pgr-consolidated";
import { getPgrSignatureViewAction } from "@/shared/server/actions/pgr/pgr-signature";
import { listDocumentsAction } from "@/shared/server/actions/documents/documents";
import { getPgrNr18ChecklistAction } from "@/shared/server/actions/pgr/pgr-nr18";
import { isNr18ApplicableUnitType } from "@/shared/domains/documents/nr18";
import { derivePgrEpiRelation } from "@/shared/domains/pgr/epi-relation";
import { todayInSaoPaulo } from "@/shared/dates";

import { PgrEditorTabs } from "./_components/pgr-editor-tabs";

export const dynamic = "force-dynamic";

export default async function PgrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireOfficeStaffPage();
  const { id } = await params;

  const pgrResult = await getPgrAction(id);
  if (!pgrResult.ok) notFound();
  const doc = pgrResult.data;
  const billingExportBlocked = !(await pgrBillingExportAllowed(ctx.tenantId, doc.id));

  // Uma rodada de leituras independentes para montar o editor em abas.
  const [
    companyResult,
    workUnitResult,
    gesLinks,
    revisions,
    consolidated,
    gesOptions,
    signature,
    linkedDocuments,
    technicianDocuments,
    nr18Checklist,
  ] = await Promise.all([
    getCompanyAction(doc.companyId),
    doc.workUnitId ? getWorkUnitAction(doc.workUnitId) : Promise.resolve(null),
    listPgrGesAction(id),
    listPgrRevisionsAction(id),
    getPgrConsolidatedAction(id),
    listGesAction({ companyId: doc.companyId, pageSize: 100 }),
    getPgrSignatureViewAction({ pgrId: id }),
    listDocumentsAction({
      relatedEntityType: "pgr",
      relatedEntityId: id,
      pageSize: 5,
    }),
    // Anexos da ART do Responsável Técnico (issue #36) — mesmo id do PGR, entidade sem
    // tabela própria (grupo de colunas em `pgr`).
    listDocumentsAction({
      relatedEntityType: "responsible_technician",
      relatedEntityId: id,
      pageSize: 5,
    }),
    // Checklist NR-18 (#48) — leitura derivada do GED; o painel só aparece quando a
    // unidade do PGR é Obra/Canteiro (filtro logo abaixo).
    getPgrNr18ChecklistAction(id),
  ]);

  const companyName = companyResult.ok ? companyResult.data.razaoSocial : doc.companyId;
  const workUnitName =
    workUnitResult && workUnitResult.ok ? workUnitResult.data.name : null;
  const availableGes = gesOptions.ok
    ? gesOptions.data.rows.map((g) => ({ id: g.id, name: g.name }))
    : [];

  // NR-18 só faz sentido em canteiro de obra; nas demais unidades o painel some
  // inteiro em vez de exibir um checklist irrelevante.
  const workUnitType =
    workUnitResult && workUnitResult.ok ? workUnitResult.data.type : null;
  const nr18 =
    isNr18ApplicableUnitType(workUnitType) && nr18Checklist.ok
      ? nr18Checklist.data
      : null;

  // Relação de EPIs (#48): derivada da MESMA visão consolidada já carregada acima —
  // nenhuma query extra, nenhuma digitação paralela.
  const epiRelation = consolidated.ok
    ? derivePgrEpiRelation(consolidated.data, { today: todayInSaoPaulo() })
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
      <PgrEditorTabs
        billingExportBlocked={billingExportBlocked}
        pgrId={doc.id}
        pgr={doc}
        isPublished={!!doc.publishedAt}
        companyName={companyName}
        workUnitName={workUnitName}
        availableGes={availableGes}
        gesLinks={gesLinks.ok ? gesLinks.data : []}
        revisions={revisions.ok ? revisions.data : []}
        consolidated={consolidated.ok ? consolidated.data : null}
        signature={signature.ok ? signature.data : undefined}
        linkedDocuments={linkedDocuments.ok ? linkedDocuments.data.rows : []}
        linkedDocumentsTotal={linkedDocuments.ok ? linkedDocuments.data.total : 0}
        technicianDocuments={technicianDocuments.ok ? technicianDocuments.data.rows : []}
        technicianDocumentsTotal={
          technicianDocuments.ok ? technicianDocuments.data.total : 0
        }
        nr18Checklist={nr18}
        epiRelation={epiRelation}
      />
    </div>
  );
}
