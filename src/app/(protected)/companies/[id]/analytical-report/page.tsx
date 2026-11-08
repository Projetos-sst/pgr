import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate } from "@/shared/dates";
import type { AnalyticalReportContent } from "@/shared/domains/medicine/analytical-report";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  getAnalyticalReportAction,
  getAnalyticalReportContextAction,
  listAnalyticalReportsAction,
  listReportPresentationAction,
} from "@/shared/server/actions/medicine/analytical-reports";

import {
  CIPA_SITUATION_LABELS,
  REPORT_MODALITY_LABELS,
  REPORT_PARTICIPANT_ROLE_LABELS,
  REPORT_PRESENTATION_STATE_LABELS,
  effectiveReportEventIds,
  type ReportParticipantRole,
} from "@/shared/domains/medicine/analytical-report-presentation";
import { PageHeader } from "../../../_ui/list";
import {
  DiscussionForm,
  FinalizeReportForm,
  PresentationForm,
  VoidReportEventForm,
} from "./presentation-controls";
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
 * Relatório analítico anual do PCMSO (NOB-154, NOB-168). Elaborado pelo médico coordenador a partir
 * dos dados reais; a equipe vê os números consolidados e as prévias, nunca dados individuais. A
 * versão finalizada pelo médico é apresentada e discutida com SST/CIPA (NR-7 7.6.5).
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
  const [reports, context, presentation] = await Promise.all([
    listAnalyticalReportsAction(id),
    getAnalyticalReportContextAction(id),
    listReportPresentationAction(id),
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
  const pres = presentation.ok ? presentation.data : null;
  const voidedIds = new Set(
    (pres?.events ?? []).filter((e) => e.voidsId).map((e) => e.voidsId),
  );
  const effectiveIds = effectiveReportEventIds(pres?.events ?? []);
  const roles = (list: { role: string; name?: string }[] | null) =>
    (list ?? [])
      .map((p) =>
        p.name
          ? `${REPORT_PARTICIPANT_ROLE_LABELS[p.role as ReportParticipantRole] ?? p.role} (${p.name})`
          : (REPORT_PARTICIPANT_ROLE_LABELS[p.role as ReportParticipantRole] ?? p.role),
      )
      .join("; ");
  const KIND_LABELS = {
    finalized: "Versão finalizada pelo médico responsável",
    presented: "Apresentação realizada",
    discussed: "Discussão realizada",
    voided: "Correção de registro",
  } as const;

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
          Só a conta vinculada ao médico coordenador com designação em vigor hoje elabora
          o relatório. Resultados de exames e diagnósticos não são registrados no sistema;
          essas alíneas saem como informação insuficiente.
        </p>
        <ReportForm
          companyId={id}
          suggested={ctx?.suggestedPeriod ?? null}
          hasPrevious={Boolean(ctx?.previous)}
          canSimplify={ctx?.eligibility?.eligible ?? true}
        />
      </section>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">
          Apresentação e discussão (NR-7 7.6.5)
        </h2>
        <p className="text-text-subtle">
          O relatório deve ser apresentado e discutido com os responsáveis por segurança e
          saúde no trabalho da organização, incluindo a CIPA, quando existente. Registre
          só o que já aconteceu: agendar, gerar ou baixar o arquivo não conta como
          apresentação. Só uma versão finalizada pelo médico responsável é apresentada.
          Medidas discutidas ficam como propostas, não como executadas.
        </p>
        {pres?.current ? (
          <>
            <p className="text-text font-semibold">
              Versão {pres.current.version} · {pres.current.periodStart} a{" "}
              {pres.current.periodEnd} · SHA-256 {pres.current.contentSha256.slice(0, 12)}
              … · {REPORT_PRESENTATION_STATE_LABELS[pres.summary.state]}
            </p>
            {pres.summary.cipaSituation ? (
              <p className={pres.summary.cipaRequirementMet ? "" : "text-amber-900"}>
                CIPA: {CIPA_SITUATION_LABELS[pres.summary.cipaSituation]}
                {pres.summary.cipaRequirementMet
                  ? ""
                  : " — não é possível declarar a participação da CIPA atendida."}
              </p>
            ) : null}
            {pres.summary.previousVersionPresented ? (
              <p className="text-amber-900">
                A versão anterior foi apresentada; esta versão precisa de apresentação
                própria.
              </p>
            ) : null}
            {pres.summary.state === "not_finalized" ? (
              <FinalizeReportForm companyId={id} reportId={pres.current.id} />
            ) : null}
            {pres.summary.state === "pending_presentation" ||
            pres.summary.state === "discussion_pending" ||
            pres.summary.state === "presented_and_discussed" ? (
              <details>
                <summary className="cursor-pointer font-semibold">
                  Registrar apresentação realizada
                </summary>
                <PresentationForm companyId={id} reportId={pres.current.id} />
              </details>
            ) : null}
            {pres.summary.state === "discussion_pending" ||
            pres.summary.state === "presented_and_discussed" ? (
              <details>
                <summary className="cursor-pointer font-semibold">
                  Registrar discussão realizada
                </summary>
                <DiscussionForm companyId={id} reportId={pres.current.id} />
              </details>
            ) : null}
          </>
        ) : (
          <p className="text-amber-900">Gere o relatório analítico antes.</p>
        )}
        {pres?.events.length ? (
          <ul className="flex flex-col gap-2">
            {pres.events.map((e) => (
              <li key={e.id} className="text-text-subtle flex flex-col gap-1">
                <span className="text-text font-semibold">
                  {KIND_LABELS[e.kind]}
                  {e.occurredOn ? ` · ${e.occurredOn}` : ""}
                  {e.reportId !== pres.current?.id ? " · versão anterior" : ""}
                  {voidedIds.has(e.id) ? " · corrigido" : ""}
                  {e.kind !== "voided" && !voidedIds.has(e.id) && !effectiveIds.has(e.id)
                    ? " · sem efeito (o ato de que dependia foi corrigido)"
                    : ""}
                </span>
                {e.modality ? <span>{REPORT_MODALITY_LABELS[e.modality]}</span> : null}
                {e.participants ? (
                  <span>Participantes: {roles(e.participants)}</span>
                ) : null}
                {e.cipaSituation ? (
                  <span>
                    CIPA: {CIPA_SITUATION_LABELS[e.cipaSituation]}
                    {e.cipaReference ? ` (${e.cipaReference})` : ""}
                  </span>
                ) : null}
                {e.summary ? <span>Síntese: {e.summary}</span> : null}
                {e.measures?.length ? (
                  <ul className="list-disc pl-5">
                    {e.measures.map((m, i) => (
                      <li key={i}>
                        {m.description}
                        {m.responsible ? ` · responsável: ${m.responsible}` : ""}
                        {m.dueDate ? ` · prazo: ${m.dueDate}` : ""} · proposta
                      </li>
                    ))}
                  </ul>
                ) : null}
                {e.evidenceReference ? (
                  <span>Evidência: {e.evidenceReference}</span>
                ) : null}
                {e.note ? <span>Observação: {e.note}</span> : null}
                {e.voidReason ? <span>Motivo: {e.voidReason}</span> : null}
                <span className="text-xs">
                  Registrado por {e.recordedBy} em {formatInstantDate(e.recordedAt)}
                </span>
                {e.kind !== "voided" && effectiveIds.has(e.id) ? (
                  <VoidReportEventForm companyId={id} eventId={e.id} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
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
                {formatInstantDate(r.generatedAt)} · SHA-256{" "}
                {r.contentSha256.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
