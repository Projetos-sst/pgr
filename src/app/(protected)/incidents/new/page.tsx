import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  listCompanyOptionsAction,
  listEmployeeOptionsAction,
} from "@/shared/server/actions/safety/accidents";

import { PageHeader } from "../../_ui/list";
import { IncidentForm } from "../_components/incident-form";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage() {
  await requireOfficeStaffPage();
  const [companiesResult, employeesResult] = await Promise.all([
    listCompanyOptionsAction(),
    listEmployeeOptionsAction(),
  ]);
  const companies = companiesResult.ok ? companiesResult.data : [];
  const employees = employeesResult.ok ? employeesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/incidents"
        title="Novo incidente/acidente"
        description="Registro interno. Dado de saúde é restrito à equipe do escritório."
      />
      <IncidentForm
        companies={companies}
        employees={employees}
        initial={{
          companyId: null,
          employeeId: null,
          occurredAt: new Date().toISOString().slice(0, 16),
          type: "typical",
          category: "without_leave",
          severity: "minor",
          location: null,
          description: null,
          awayFromWork: null,
          workedHours: null,
          hospital: null,
          injuryNatureCode: null,
          injuryNatureDescription: null,
          bodyPartCode: null,
          bodyPartDescription: null,
          causativeAgentCode: null,
          causativeAgentDescription: null,
          causes: null,
          environmentalImpact: null,
          materialLoss: null,
          thirdParties: null,
          fatalityPotential: null,
          responsibleArea: null,
          activityProcedure: null,
          witnesses: null,
          investigationNotes: null,
          catNumber: null,
          catIssuedAt: null,
        }}
      />
    </div>
  );
}
