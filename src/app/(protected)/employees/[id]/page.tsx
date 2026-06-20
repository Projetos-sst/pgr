import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEmployeeAction } from "@/shared/server/actions/pgr/employees";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getGesAction } from "@/shared/server/actions/pgr/ges";
import { getJobRoleAction } from "@/shared/server/actions/pgr/job-roles";

import { PageHeader } from "../../_ui/list";
import { DeleteEmployee } from "../_components/delete-employee";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  on_leave: "Afastado",
  dismissed: "Desligado",
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
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

  const [companyResult, gesResult, jobRoleResult] = await Promise.all([
    getCompanyAction(employee.companyId),
    employee.gesId ? getGesAction(employee.gesId) : Promise.resolve(null),
    employee.jobRoleId ? getJobRoleAction(employee.jobRoleId) : Promise.resolve(null),
  ]);

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

      <div className="grid gap-4 sm:grid-cols-3">
        <Placeholder title="EPIs" />
        <Placeholder title="Histórico" />
        <Placeholder title="Ordens de serviço" />
      </div>
    </div>
  );
}
