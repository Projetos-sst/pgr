import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  accidentCategoryLabel,
  accidentSeverityLabel,
  accidentTypeLabel,
} from "@/shared/domains/safety/accident";
import {
  incidentStatusLabel,
  isTerminalIncidentStatus,
  type IncidentStatus,
} from "@/shared/domains/safety/incident-lifecycle";
import {
  getAccidentAction,
  listCompanyOptionsAction,
  listEmployeeOptionsAction,
} from "@/shared/server/actions/safety/accidents";

import { PageHeader } from "../../_ui/list";
import { DeleteIncident } from "../_components/delete-incident";
import { IncidentDetailTabs } from "../_components/incident-detail-tabs";
import { IncidentStatusActions } from "../_components/incident-status-actions";

export const dynamic = "force-dynamic";

type Field = { label: string; value: string };

const yesNo = (v: boolean | null): string => (v == null ? "—" : v ? "Sim" : "Não");
const text = (v: string | null): string => (v && v.trim() ? v : "—");

function push(fields: Field[], label: string, value: string) {
  if (value !== "—") fields.push({ label, value });
}

export default async function IncidentDetailPage({
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

  const companyName = companiesResult.ok
    ? (companiesResult.data.find((c) => c.value === a.companyId)?.label ?? "—")
    : "—";
  const employeeName =
    a.employeeId && employeesResult.ok
      ? (employeesResult.data.find((e) => e.value === a.employeeId)?.label ?? "—")
      : "—";

  const occurred = new Date(a.occurredAt).toLocaleString("pt-BR");
  const terminal = isTerminalIncidentStatus(a.status);

  const dados: Field[] = [];
  push(dados, "Empresa", companyName);
  push(dados, "Funcionário", employeeName);
  push(dados, "Ocorrência", occurred);
  push(dados, "Tipo", accidentTypeLabel(a.type));
  push(dados, "Categoria", accidentCategoryLabel(a.category));
  push(dados, "Severidade", accidentSeverityLabel(a.severity));
  push(dados, "Local", text(a.location));
  push(dados, "Atividade/procedimento", text(a.activityProcedure));
  push(dados, "Descrição", text(a.description));
  push(dados, "Afastamento", yesNo(a.awayFromWork));
  push(dados, "Horas trabalhadas", text(a.workedHours));
  push(dados, "Hospital/atendimento", text(a.hospital));
  push(dados, "Área responsável", text(a.responsibleArea));
  push(dados, "Potencial de fatalidade", yesNo(a.fatalityPotential));
  push(dados, "Nº CAT (interno)", text(a.catNumber));
  push(dados, "Emissão CAT (interno)", text(a.catIssuedAt));

  const causas: Field[] = [];
  push(causas, "Causas", text(a.causes));
  push(causas, "Natureza da lesão (código)", text(a.injuryNatureCode));
  push(causas, "Natureza da lesão (descrição)", text(a.injuryNatureDescription));
  push(causas, "Parte do corpo (código)", text(a.bodyPartCode));
  push(causas, "Parte do corpo (descrição)", text(a.bodyPartDescription));
  push(causas, "Agente causador (código)", text(a.causativeAgentCode));
  push(causas, "Agente causador (descrição)", text(a.causativeAgentDescription));
  push(causas, "Testemunhas", text(a.witnesses));
  push(causas, "Notas de investigação", text(a.investigationNotes));
  push(causas, "Impacto ambiental", text(a.environmentalImpact));
  push(causas, "Perdas materiais", text(a.materialLoss));
  push(causas, "Terceiros", text(a.thirdParties));
  if (a.completionJustification) {
    push(causas, "Justificativa de encerramento", text(a.completionJustification));
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`${accidentTypeLabel(a.type)} — ${occurred}`}
        description={`Status: ${incidentStatusLabel(a.status)} · ${companyName}`}
        action={
          <div className="flex gap-2">
            {terminal ? null : (
              <Link
                href={`/incidents/${id}/edit`}
                className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
              >
                Editar
              </Link>
            )}
            <DeleteIncident id={id} redirectTo="/incidents" />
          </div>
        }
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-text text-sm font-semibold">Alterar status</h2>
        <IncidentStatusActions id={id} current={a.status as IncidentStatus} />
      </section>

      <IncidentDetailTabs dados={dados} causas={causas} />
    </div>
  );
}
