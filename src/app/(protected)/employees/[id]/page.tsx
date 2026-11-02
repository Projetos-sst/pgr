import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEmployeeAction } from "@/shared/server/actions/pgr/employees";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getGesAction } from "@/shared/server/actions/pgr/ges";
import { getJobRoleAction } from "@/shared/server/actions/pgr/job-roles";
import {
  getDeliveryAction,
  listDeliveriesAction,
} from "@/shared/server/actions/pgr/epi-deliveries";
import type { DeliveryDetail } from "@/shared/domains/pgr/epi-deliveries";

import { PageHeader } from "../../_ui/list";
import { DeleteEmployee } from "../_components/delete-employee";
import { DeliverEpi } from "./_components/deliver-epi";
import { DeliverySignature } from "./_components/delivery-signature";
import { DeleteDelivery } from "./_components/delete-delivery";
import { ReturnItem } from "./_components/return-item";
import { EpiRecordTable } from "./_components/epi-record-table";
import { getEmployeeEpiRecordAction } from "@/shared/server/actions/pgr/epi-record";
import { listTrainingRecordsAction } from "@/shared/server/actions/pgr/training-records";
import { listTrainingCatalogOptionsAction } from "@/shared/server/actions/pgr/training-catalog";
import { getEmployeeComplianceAction } from "@/shared/server/actions/pgr/job-role-required-trainings";
import { RegisterTraining } from "./_components/register-training";
import { DeleteTrainingRecord } from "./_components/delete-training-record";
import { TrainingStatusBadge } from "../../_ui/training-status-badge";
import { todayInSaoPaulo } from "@/shared/dates";
import { moduleIsEnabled } from "@/shared/domains/platform/company-modules";
import { getCompanyModuleOverviewAction } from "@/shared/server/actions/platform/company-modules";
import { listHealthExamsAction } from "@/shared/server/actions/pgr/health-exams";
import {
  OccupationalHealthSection,
  type MedicineModuleState,
} from "./_components/occupational-health-section";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  on_leave: "Afastado",
  dismissed: "Desligado",
};

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-subtle text-xs tracking-wide uppercase">{label}</span>
      <span className="text-sm">{value && value !== "" ? value : "—"}</span>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="glass-card text-text-subtle px-4 py-6 text-center text-sm">
      {title} — disponível em fase futura.
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const employeeResult = await getEmployeeAction(id);
  if (!employeeResult.ok) notFound();
  const employee = employeeResult.data;

  const [
    companyResult,
    gesResult,
    jobRoleResult,
    deliveriesResult,
    recordResult,
    trainingRecordsResult,
    trainingOptionsResult,
    complianceResult,
    moduleResult,
    healthExamsResult,
  ] = await Promise.all([
    getCompanyAction(employee.companyId),
    employee.gesId ? getGesAction(employee.gesId) : Promise.resolve(null),
    employee.jobRoleId ? getJobRoleAction(employee.jobRoleId) : Promise.resolve(null),
    listDeliveriesAction({ employeeId: employee.id, pageSize: 10 }),
    getEmployeeEpiRecordAction(employee.id),
    listTrainingRecordsAction({ employeeId: employee.id, pageSize: 20 }),
    listTrainingCatalogOptionsAction(),
    getEmployeeComplianceAction({ employeeId: employee.id }),
    getCompanyModuleOverviewAction(employee.companyId, { pageSize: 1 }),
    listHealthExamsAction({ employeeId: employee.id, pageSize: 20 }),
  ]);

  // Estado do módulo para a seção de Saúde ocupacional: erro ≠ desabilitada.
  const medicineState: MedicineModuleState = !moduleResult.ok
    ? "error"
    : moduleIsEnabled(moduleResult.data.modules, "medicine")
      ? "enabled"
      : "disabled";

  const trainingRows = trainingRecordsResult.ok ? trainingRecordsResult.data.rows : [];
  const trainingOptions = trainingOptionsResult.ok ? trainingOptionsResult.data : [];
  const complianceRows = complianceResult.ok ? complianceResult.data : [];

  const deliveryRows = deliveriesResult.ok ? deliveriesResult.data.rows : [];
  const deliveries = (
    await Promise.all(deliveryRows.map((row) => getDeliveryAction(row.id)))
  )
    .filter((result) => result.ok)
    .map((result) => (result as { ok: true; data: DeliveryDetail }).data);

  const companyName = companyResult.ok ? companyResult.data.razaoSocial : null;
  // Sugestão do demissional (NR-7 7.5.11) só com desligamento informado.
  const riskGrade = companyResult.ok ? companyResult.data.riskGrade : null;
  const dismissal = employee.dismissalDate
    ? {
        contractEndOn: employee.dismissalDate,
        riskGrade:
          riskGrade !== null && riskGrade >= 1 && riskGrade <= 4
            ? (riskGrade as 1 | 2 | 3 | 4)
            : null,
      }
    : null;
  const gesName = gesResult?.ok ? gesResult.data.ges.name : null;
  const jobRoleTitle = jobRoleResult?.ok ? jobRoleResult.data.title : null;

  return (
    <div className="animate-fade-slide-up flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={employee.fullName}
        description={`Status: ${STATUS_LABEL[employee.status] ?? employee.status}`}
        action={
          <div className="flex gap-2">
            <Link
              href={`/employees/${employee.id}/edit`}
              className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
            >
              Editar
            </Link>
            <DeleteEmployee id={employee.id} redirectTo="/employees" hasLabel />
          </div>
        }
      />

      <section className="glass-card animate-fade-in grid gap-4 p-4 sm:grid-cols-3">
        <Field label="CPF" value={employee.cpf} />
        <Field label="Nascimento" value={employee.birthDate} />
        <Field label="Admissão" value={employee.admissionDate} />
        <Field label="Matrícula" value={employee.registration} />
        <Field label="RG" value={employee.rg} />
        <Field label="Tipo sanguíneo" value={employee.bloodType} />
      </section>

      <section className="glass-card animate-fade-in grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Empresa" value={companyName} />
        <Field label="GES" value={gesName} />
        <Field label="Função" value={jobRoleTitle} />
      </section>

      <section className="glass-card animate-fade-in grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Telefone" value={employee.phone} />
        <Field label="E-mail" value={employee.email} />
        <Field
          label="Endereço"
          value={[employee.street, employee.number, employee.city, employee.state]
            .filter(Boolean)
            .join(", ")}
        />
      </section>

      <section className="glass-card animate-fade-in flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-text text-lg font-semibold">Entregas de EPI</h2>
          <DeliverEpi employeeId={employee.id} />
        </div>

        {deliveries.length === 0 ? (
          <p className="glass-card text-text-subtle px-4 py-6 text-center text-sm">
            Nenhuma entrega registrada para este funcionário.
          </p>
        ) : (
          deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="glass-panel rounded-card flex flex-col gap-3 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  Entrega de {formatIsoDate(delivery.deliveryDate)}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <DeliverySignature
                    deliveryId={delivery.id}
                    signatureStatus={delivery.signatureStatus}
                    signatureLabel={delivery.signatureLabel}
                    signedAt={delivery.signedAt ? delivery.signedAt.toISOString() : null}
                  />
                  {delivery.signatureStatus === "pending" ? (
                    <DeleteDelivery id={delivery.id} />
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="text-text-muted border-b border-white/50 text-left text-xs uppercase">
                    <tr>
                      <th className="px-2 py-1 font-semibold">EPI</th>
                      <th className="px-2 py-1 font-semibold">CA</th>
                      <th className="px-2 py-1 font-semibold">Tam.</th>
                      <th className="px-2 py-1 font-semibold">Qtd.</th>
                      <th className="px-2 py-1 font-semibold">Devolução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delivery.items.map((item) => (
                      <tr key={item.id} className="border-t border-white/50">
                        <td className="px-2 py-1">{item.name}</td>
                        <td className="px-2 py-1">{item.ca ?? "—"}</td>
                        <td className="px-2 py-1">{item.size ?? "—"}</td>
                        <td className="px-2 py-1">{item.quantity}</td>
                        <td className="px-2 py-1">
                          <ReturnItem
                            deliveryId={delivery.id}
                            itemId={item.id}
                            returnedAt={
                              item.returnedAt ? item.returnedAt.toISOString() : null
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="glass-card animate-fade-in flex flex-col gap-4 p-4">
        <h2 className="text-text text-lg font-semibold">Ficha de EPI</h2>
        <EpiRecordTable
          employeeId={employee.id}
          employeeName={employee.fullName}
          initial={recordResult.ok ? recordResult.data : { rows: [], total: 0 }}
        />
      </section>

      <section className="glass-card animate-fade-in flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-text text-lg font-semibold">Treinamentos</h2>
        </div>
        <RegisterTraining employeeId={employee.id} options={trainingOptions} />

        {trainingRows.length === 0 ? (
          <p className="glass-card text-text-subtle px-4 py-6 text-center text-sm">
            Nenhum treinamento registrado para este funcionário.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="text-text-muted border-b border-white/50 text-left text-xs uppercase">
                <tr>
                  <th className="px-2 py-1 font-semibold">Treinamento</th>
                  <th className="px-2 py-1 font-semibold">Realização</th>
                  <th className="px-2 py-1 font-semibold">Validade</th>
                  <th className="px-2 py-1 font-semibold">Certificado</th>
                  <th className="px-2 py-1 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {trainingRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/50">
                    <td className="px-2 py-1">{row.trainingName}</td>
                    <td className="px-2 py-1">{formatIsoDate(row.completedAt)}</td>
                    <td className="px-2 py-1">
                      {row.validUntil ? formatIsoDate(row.validUntil) : "Não expira"}
                    </td>
                    <td className="px-2 py-1">{row.certificatePath ?? "—"}</td>
                    <td className="px-2 py-1 text-right">
                      <DeleteTrainingRecord id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-card animate-fade-in flex flex-col gap-4 p-4">
        <h2 className="text-text text-lg font-semibold">Treinamentos obrigatórios</h2>
        {complianceRows.length === 0 ? (
          <p className="glass-card text-text-subtle px-4 py-6 text-center text-sm">
            {jobRoleTitle
              ? "A função deste funcionário não tem treinamentos obrigatórios."
              : "Funcionário sem função — nenhum treinamento obrigatório se aplica."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="text-text-muted border-b border-white/50 text-left text-xs uppercase">
                <tr>
                  <th className="px-2 py-1 font-semibold">Treinamento</th>
                  <th className="px-2 py-1 font-semibold">Última realização</th>
                  <th className="px-2 py-1 font-semibold">Validade</th>
                  <th className="px-2 py-1 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {complianceRows.map((row) => (
                  <tr key={row.trainingId} className="border-t border-white/50">
                    <td className="px-2 py-1">{row.trainingName}</td>
                    <td className="px-2 py-1">
                      {row.completedAt ? formatIsoDate(row.completedAt) : "—"}
                    </td>
                    <td className="px-2 py-1">
                      {row.completedAt
                        ? row.validUntil
                          ? formatIsoDate(row.validUntil)
                          : "Não expira"
                        : "—"}
                    </td>
                    <td className="px-2 py-1">
                      <TrainingStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <OccupationalHealthSection
        employeeId={employee.id}
        moduleState={medicineState}
        exams={healthExamsResult}
        today={todayInSaoPaulo()}
        dismissal={dismissal}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Placeholder title="Histórico" />
        <Placeholder title="Ordens de serviço" />
      </div>
    </div>
  );
}
