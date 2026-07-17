import { notFound, redirect } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { isTerminalIncidentStatus } from "@/shared/domains/safety/incident-lifecycle";
import {
  getAccidentAction,
  listCompanyOptionsAction,
  listEmployeeOptionsAction,
} from "@/shared/server/actions/safety/accidents";

import { PageHeader } from "../../../_ui/list";
import { IncidentForm } from "../../_components/incident-form";

export const dynamic = "force-dynamic";

export default async function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [result, companiesResult, employeesResult] = await Promise.all([
    getAccidentAction(id),
    listCompanyOptionsAction(),
    listEmployeeOptionsAction(),
  ]);
  if (!result.ok) notFound();
  const a = result.data;

  // Estado terminal é imutável (state machine): o repositório rejeita a edição; a UI antecipa.
  if (isTerminalIncidentStatus(a.status)) redirect(`/incidents/${id}`);

  const companies = companiesResult.ok ? companiesResult.data : [];
  const employees = employeesResult.ok ? employeesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar incidente/acidente"
        description="Estados terminais não podem ser editados."
      />
      <IncidentForm
        id={id}
        companies={companies}
        employees={employees}
        initial={{
          companyId: a.companyId,
          employeeId: a.employeeId,
          occurredAt: new Date(a.occurredAt).toISOString().slice(0, 16),
          type: a.type,
          category: a.category,
          severity: a.severity,
          location: a.location,
          description: a.description,
          awayFromWork: a.awayFromWork,
          workedHours: a.workedHours,
          hospital: a.hospital,
          injuryNatureCode: a.injuryNatureCode,
          injuryNatureDescription: a.injuryNatureDescription,
          bodyPartCode: a.bodyPartCode,
          bodyPartDescription: a.bodyPartDescription,
          causativeAgentCode: a.causativeAgentCode,
          causativeAgentDescription: a.causativeAgentDescription,
          causes: a.causes,
          environmentalImpact: a.environmentalImpact,
          materialLoss: a.materialLoss,
          thirdParties: a.thirdParties,
          fatalityPotential: a.fatalityPotential,
          responsibleArea: a.responsibleArea,
          activityProcedure: a.activityProcedure,
          witnesses: a.witnesses,
          investigationNotes: a.investigationNotes,
          catNumber: a.catNumber,
          catIssuedAt: a.catIssuedAt,
        }}
      />
    </div>
  );
}
