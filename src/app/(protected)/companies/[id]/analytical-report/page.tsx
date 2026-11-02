import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { AnalyticalReportContent } from "@/shared/domains/medicine/analytical-report";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  getAnalyticalReportAction,
  getAnalyticalReportContextAction,
  listAnalyticalReportsAction,
} from "@/shared/server/actions/medicine/analytical-reports";

import { PageHeader } from "../../../_ui/list";
import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";

const STATUS = {
  available: "Disponível",
  insufficient: "Informação insuficiente",
  not_required: "Não exigida (7.6.6)",
  registered_only: "Só CAT registradas no sistema",
  compared: "Comparado",
  no_previous: "Sem relatório anterior",
} as const;

function Item({
  title,
  status,
  children,
}: {
  title: string;
  status: keyof typeof STATUS;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-text font-semibold">
        {title} — {STATUS[status]}
      </h3>
      {children}
    </section>
  );
}

function Preview({
  content,
  version,
  hash,
}: {
  content: AnalyticalReportContent;
  version: number;
  hash: string;
}) {
  const { a, b, c, d, e, f } = content.items;
  return (
    <article className="glass-card flex flex-col gap-4 rounded-xl p-5 text-sm">
      <p role="note" className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900">
        {content.notice}
      </p>
      <header className="flex flex-col gap-1">
        <h2 className="text-text text-base font-semibold">
          Relatório analítico · versão {version} · {content.period.start} a{" "}
          {content.period.end}
        </h2>
        <p className="text-text-subtle text-xs">
          {content.period.basis} {content.author.name} ({content.author.registration}).
          SHA-256 {hash}
        </p>
        <p className="text-text-subtle text-xs">
          {content.simplification.basis}{" "}
          {content.simplification.applied ? "Relatório simplificado (7.6.6)." : ""}{" "}
          {content.exemption.note}
        </p>
      </header>
      <Item title="a) Exames clínicos realizados" status={a.status}>
        <p className="text-text-subtle">
          Total: {a.total}
          {a.byType.length
            ? ` (${a.byType.map((t) => `${t.label}: ${t.count}`).join("; ")})`
            : ""}
          . Fora da contagem por origem não comprovada: {a.unverifiedOrigin}. Repetidos
          ignorados: {a.duplicatesIgnored}.
        </p>
        <p className="text-text-subtle text-xs">{a.criteria}</p>
      </Item>
      <Item title="b) Exames complementares realizados" status={b.status}>
        <ul className="text-text-subtle list-disc pl-5">
          {b.byProcedure.map((p) => (
            <li key={`${p.procedureCode}-${p.description}`}>
              {p.procedureCode} {p.description}: {p.count}
            </li>
          ))}
          <li>Total: {b.total}</li>
        </ul>
      </Item>
      <Item title="c) Resultados anormais" status={c.status}>
        <p className="text-text-subtle">{c.note}</p>
      </Item>
      <Item title="d) Doenças relacionadas ao trabalho" status={d.status}>
        <p className="text-text-subtle">{d.note}</p>
      </Item>
      <Item title="e) CAT" status={e.status}>
        {e.status === "registered_only" ? (
          <p className="text-text-subtle">
            Total: {e.total}
            {e.byType.length
              ? ` (${e.byType.map((t) => `${t.label}: ${t.count}`).join("; ")})`
              : ""}
            . Sem data de emissão: {e.withoutIssueDate}. {e.criteria}
          </p>
        ) : (
          <p className="text-text-subtle">{e.note}</p>
        )}
      </Item>
      <Item title="f) Comparação com o relatório anterior" status={f.status}>
        {f.status === "compared" ? (
          <>
            <ul className="text-text-subtle list-disc pl-5">
              {f.comparisons.map((row) => (
                <li key={row.indicator}>
                  {row.indicator}: {row.previous} → {row.current} (
                  {row.difference >= 0 ? "+" : ""}
                  {row.difference})
                </li>
              ))}
            </ul>
            <p className="text-text-subtle whitespace-pre-line">
              Discussão ({f.discussionAuthor}): {f.discussion}
            </p>
          </>
        ) : (
          <p className="text-text-subtle">{f.note}</p>
        )}
      </Item>
      <section className="text-text-subtle flex flex-col gap-1 text-xs">
        <p>{content.transferredRecords.note}</p>
        {content.insufficiency.doctorNote ? (
          <p className="whitespace-pre-line">
            Insuficiência informada pelo médico (7.6.4):{" "}
            {content.insufficiency.doctorNote}
          </p>
        ) : null}
        <p>{content.presentation.note}</p>
      </section>
    </article>
  );
}

/**
 * Relatório analítico anual do PCMSO (NOB-154). Elaborado pelo médico coordenador a partir dos
 * dados reais; a equipe vê os números consolidados e as prévias, nunca dados individuais.
 */
export default async function AnalyticalReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const [reports, context] = await Promise.all([
    listAnalyticalReportsAction(id),
    getAnalyticalReportContextAction(id),
  ]);
  if (!reports.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{reports.error.message}</p>
      </div>
    );
  const latest = reports.data[0]
    ? await getAnalyticalReportAction(reports.data[0].id)
    : null;
  const ctx = context.ok ? context.data : null;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Relatório analítico — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/pcmso-readiness`}
        description="Relatório analítico anual do PCMSO (NR-7 7.6.2 a 7.6.6), a partir dos exames e CAT registrados. O médico coordenador elabora; o sistema não inventa números nem conclusões."
      />
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <p role="status">
          {ctx?.previous
            ? `Último relatório: versão ${ctx.previous.version}, ${ctx.previous.periodStart} a ${ctx.previous.periodEnd}. O próximo começa em ${ctx.suggestedPeriod?.periodStart}.`
            : "Nenhum relatório analítico anterior registrado: informe o período do primeiro relatório (até 12 meses)."}
        </p>
        <p className="text-text-subtle text-xs">
          Só a conta vinculada ao médico coordenador com designação aberta elabora o
          relatório. Resultados de exames e diagnósticos não são registrados no sistema;
          essas alíneas saem como informação insuficiente.
        </p>
        <ReportForm
          companyId={id}
          suggested={ctx?.suggestedPeriod ?? null}
          hasPrevious={Boolean(ctx?.previous)}
          canSimplify={ctx?.eligibility?.eligible ?? true}
        />
      </section>
      {latest?.ok ? (
        <Preview
          content={latest.data.content as AnalyticalReportContent}
          version={latest.data.version}
          hash={latest.data.contentSha256}
        />
      ) : null}
      {reports.data.length ? (
        <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
          <h2 className="text-text text-base font-semibold">Versões arquivadas</h2>
          <ul className="text-text-subtle list-disc pl-5 text-sm">
            {reports.data.map((r) => (
              <li key={r.id}>
                Versão {r.version} · prévia · {r.periodStart} a {r.periodEnd} · gerada em{" "}
                {new Date(r.generatedAt).toISOString().slice(0, 10)} · SHA-256{" "}
                {r.contentSha256.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
