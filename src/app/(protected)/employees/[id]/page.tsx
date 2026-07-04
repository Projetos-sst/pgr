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
      <span className="text-xs tracking-wide text-zinc-500 uppercase">{label}</span>
      <span className="text-sm">{value && value !== "" ? value : "—"}</span>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-zinc-500 dark:border-white/15">
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

  const [companyResult, gesResult, jobRoleResult, deliveriesResult, recordResult] =
    await Promise.all([
      getCompanyAction(employee.companyId),
      employee.gesId ? getGesAction(employee.gesId) : Promise.resolve(null),
      employee.jobRoleId ? getJobRoleAction(employee.jobRoleId) : Promise.resolve(null),
      listDeliveriesAction({ employeeId: employee.id, pageSize: 10 }),
      getEmployeeEpiRecordAction(employee.id),
    ]);

  const deliveryRows = deliveriesResult.ok ? deliveriesResult.data.rows : [];
  const deliveries = (
    await Promise.all(deliveryRows.map((row) => getDeliveryAction(row.id)))
  )
    .filter((result) => result.ok)
    .map((result) => (result as { ok: true; data: DeliveryDetail }).data);

  const companyName = companyResult.ok ? companyResult.data.razaoSocial : null;
  const gesName = gesResult?.ok ? gesResult.data.ges.name : null;
  const jobRoleTitle = jobRoleResult?.ok ? jobRoleResult.data.title : null;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={employee.fullName}
        description={`Status: ${STATUS_LABEL[employee.status] ?? employee.status}`}
        action={
          <div className="flex gap-2">
            <Link
              href={`/employees/${employee.id}/edit`}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
            >
              Editar
            </Link>
            <DeleteEmployee id={employee.id} redirectTo="/employees" />
          </div>
        }
      />

      <section className="grid gap-4 rounded-lg border border-black/10 p-4 sm:grid-cols-3 dark:border-white/10">
        <Field label="CPF" value={employee.cpf} />
        <Field label="Nascimento" value={employee.birthDate} />
        <Field label="Admissão" value={employee.admissionDate} />
        <Field label="Matrícula" value={employee.registration} />
        <Field label="RG" value={employee.rg} />
        <Field label="Tipo sanguíneo" value={employee.bloodType} />
      </section>

      <section className="grid gap-4 rounded-lg border border-black/10 p-4 sm:grid-cols-3 dark:border-white/10">
        <Field label="Empresa" value={companyName} />
        <Field label="GES" value={gesName} />
        <Field label="Função" value={jobRoleTitle} />
      </section>

      <section className="grid gap-4 rounded-lg border border-black/10 p-4 sm:grid-cols-3 dark:border-white/10">
        <Field label="Telefone" value={employee.phone} />
        <Field label="E-mail" value={employee.email} />
        <Field
          label="Endereço"
          value={[employee.street, employee.number, employee.city, employee.state]
            .filter(Boolean)
            .join(", ")}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Entregas de EPI</h2>
          <DeliverEpi employeeId={employee.id} />
        </div>

        {deliveries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-zinc-500 dark:border-white/15">
            Nenhuma entrega registrada para este funcionário.
          </p>
        ) : (
          deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="flex flex-col gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10"
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
                  <thead className="text-left text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="px-2 py-1 font-medium">EPI</th>
                      <th className="px-2 py-1 font-medium">CA</th>
                      <th className="px-2 py-1 font-medium">Tam.</th>
                      <th className="px-2 py-1 font-medium">Qtd.</th>
                      <th className="px-2 py-1 font-medium">Devolução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delivery.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-black/5 dark:border-white/5"
                      >
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

      <section className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Ficha de EPI</h2>
        <EpiRecordTable
          employeeId={employee.id}
          employeeName={employee.fullName}
          initial={recordResult.ok ? recordResult.data : { rows: [], total: 0 }}
        />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Placeholder title="Histórico" />
        <Placeholder title="Ordens de serviço" />
      </div>
    </div>
  );
}
