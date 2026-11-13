import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatCivilDate, formatInstantDateTime } from "@/shared/dates";
import {
  RETENTION_CATEGORIES,
  RETENTION_CATEGORY_CATALOG,
  RETENTION_STARTING_POINTS,
  RETENTION_STARTING_POINT_LABELS,
  retentionPolicyStateLabel,
} from "@/shared/domains/retention/policy";
import { discardGateLabel } from "@/shared/domains/retention/schedule";
import { resolvePageParams } from "@/shared/pagination";
import {
  getRetentionPolicyAction,
  simulateRetentionAction,
} from "@/shared/server/actions/retention/retention";

import { FormSection, SubmitButton, TextField } from "../_ui/form";
import { PageHeader } from "../_ui/list";
import { StatusBadge } from "../_ui/status-badge";
import { RetentionPolicyForm } from "./policy-form";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Search = Partial<
  Record<(typeof RETENTION_STARTING_POINTS)[number] | "page", string>
>;

function Alert({ message }: { message: string }) {
  return (
    <p role="alert" className="p-6">
      {message}
    </p>
  );
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireOfficeStaffPage();
  const { page: rawPage, ...markers } = await searchParams;
  const { page } = resolvePageParams({ page: Number(rawPage) });
  const policy = await getRetentionPolicyAction({ page, pageSize: PAGE_SIZE });
  if (!policy.ok) return <Alert message={policy.error.message} />;
  const simulation = await simulateRetentionAction(markers);
  if (!simulation.ok) return <Alert message={simulation.error.message} />;
  const { state, current, rows, total, proposal, canRecord } = policy.data;
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Guarda, exportação e descarte"
        description="Política de guarda dos registros do PGR e de SST. Nenhuma exclusão é feita pelo sistema: aqui ficam o registro da política, a simulação de prazos e o histórico de versões."
      />
      <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
        <h2 className="font-semibold">Situação da política</h2>
        <StatusBadge
          tone={state.status === "approved" ? "green" : "amber"}
          label={retentionPolicyStateLabel(state)}
        />
        <p className="text-sm">
          {state.status === "approved"
            ? `Aprovada por ${current?.approverName} (${current?.approverRole}) em ${formatCivilDate(current?.approvedOn, "br")}. Registro: ${current?.approvalReference}`
            : "Prazos e avisos abaixo são provisórios (proposta da SEG-12). Enquanto não houver versão aprovada, todo descarte fica bloqueado."}
        </p>
      </section>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5">
        <h2 className="font-semibold">Registros abrangidos</h2>
        {RETENTION_CATEGORIES.map((category) => (
          <div key={category}>
            <h3 className="text-sm font-semibold">
              {RETENTION_CATEGORY_CATALOG[category].label}
            </h3>
            <ul className="list-disc pl-5 text-sm">
              {RETENTION_CATEGORY_CATALOG[category].records.map((record) => (
                <li key={record}>{record}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-sm">
          A exportação com manifesto e hash é feita por PGR, na aba Documentos de cada
          PGR.
        </p>
      </section>
      <form method="get" className="flex flex-col gap-4">
        <FormSection
          title="Simulação de prazos"
          description="Informe as datas dos marcos para ver quando cada categoria ficaria elegível e quando sairiam os avisos. É só cálculo: nada é excluído."
        >
          {RETENTION_STARTING_POINTS.map((point) => (
            <TextField
              key={point}
              name={point}
              type="date"
              label={RETENTION_STARTING_POINT_LABELS[point]}
              defaultValue={markers[point]}
            />
          ))}
        </FormSection>
        <SubmitButton pending={false} label="Simular prazos" />
      </form>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">
          Resultado da simulação{simulation.data.provisional ? " (provisório)" : ""}
        </h2>
        {simulation.data.rows.map((row) => (
          <article key={row.category} className="glass-card rounded-xl p-4">
            <p className="font-semibold">
              {RETENTION_CATEGORY_CATALOG[row.category].label}
            </p>
            <p className="text-sm">
              {row.retentionMonths} meses a partir de:{" "}
              {RETENTION_STARTING_POINT_LABELS[row.startingPoint]}
            </p>
            <p className="text-sm">
              Fim do prazo de guarda: {formatCivilDate(row.eligibleOn, "br")}
            </p>
            <p className="text-sm">
              Avisos:{" "}
              {row.notices.length === 0
                ? "—"
                : row.notices
                    .map(
                      (notice) =>
                        `${notice.daysBefore} dias antes (${formatCivilDate(notice.on, "br")})`,
                    )
                    .join(", ")}
            </p>
            <p className="text-text-muted text-xs">{discardGateLabel(row.discard)}</p>
          </article>
        ))}
      </section>
      {canRecord ? (
        <RetentionPolicyForm terms={current?.terms ?? proposal} />
      ) : (
        <p className="text-sm">
          Somente o administrador do escritório registra ou aprova a política.
        </p>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Histórico de versões</h2>
        {rows.length === 0 ? <p>Nenhuma versão registrada.</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="glass-card rounded-xl p-4">
            <p className="font-semibold">
              Versão {row.version} · {row.status === "approved" ? "Aprovada" : "Proposta"}{" "}
              · {formatInstantDateTime(row.createdAt)}
            </p>
            <p className="text-text-muted text-xs">Registrada por {row.recordedBy}</p>
            <p className="font-mono text-xs break-all">Termos: {row.termsSha256}</p>
          </article>
        ))}
        <nav className="flex gap-4" aria-label="Páginas do histórico da política">
          {page > 1 ? <Link href={`?page=${page - 1}`}>Anterior</Link> : null}
          {page * PAGE_SIZE < total ? (
            <Link href={`?page=${page + 1}`}>Próxima</Link>
          ) : null}
        </nav>
      </section>
    </div>
  );
}
