import Link from "next/link";

import {
  NO_ERGONOMIC_EVALUATION_LABEL,
  PSYCHOSOCIAL_AGGREGATE_LABEL,
  ergonomicAdequacyText,
  ergonomicAdequacyTone,
  listErgonomicDimensions,
} from "@/shared/domains/pgr/ergonomics";
import { getCurrentErgonomicEvaluationAction } from "@/shared/server/actions/pgr/ergonomic-evaluations";

import { StatusBadge } from "../../../_ui/data-list";
import { ErgonomicIcon } from "../ergonomic-evaluations/_components/ergonomic-icon";

/**
 * Seção "Avaliação ergonômica (NR-17)" do detalhe do risco (issue #40). Mostra a
 * avaliação **vigente** e leva ao histórico. Sem avaliação, diz isso com todas as
 * letras — ausência nunca é apresentada como conformidade.
 */
export async function ErgonomicEvaluationSection({
  riskId,
  riskLabel,
}: {
  riskId: string;
  riskLabel: string;
}) {
  const basePath = `/risks/${riskId}/ergonomic-evaluations`;
  const result = await getCurrentErgonomicEvaluationAction(riskId);
  const current = result.ok ? result.data : null;
  const dimensions = current ? listErgonomicDimensions(current) : [];

  return (
    <section className="glass-card flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <ErgonomicIcon />
          </div>
          <div>
            <h2 className="text-text text-base font-bold sm:text-lg">
              Avaliação ergonômica (NR-17)
            </h2>
            <p className="text-text-subtle mt-1.5 max-w-2xl text-xs sm:text-sm">
              Avaliação preliminar (AEP) vinculada a este risco. A AET é laudo e vai
              anexada ao risco no acervo de documentos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={basePath}
            className="glass-panel text-text-muted hover:text-text rounded-card px-4 py-2 text-xs font-bold transition-colors"
          >
            Histórico
          </Link>
          <Link
            href={`${basePath}/new`}
            className="btn-primary rounded-card px-4 py-2 text-xs font-bold text-white"
          >
            Nova avaliação
          </Link>
        </div>
      </div>

      {current ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-text-subtle text-xs tracking-wide uppercase">
                Data da avaliação vigente
              </dt>
              <dd className="text-text text-sm font-semibold">{current.assessedAt}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-text-subtle text-xs tracking-wide uppercase">
                Responsável
              </dt>
              <dd className="text-text text-sm">{current.responsible ?? "—"}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-text-subtle text-xs tracking-wide uppercase">
                Método / instrumento
              </dt>
              <dd className="text-text text-sm">{current.method ?? "—"}</dd>
            </div>
          </dl>

          <ul className="grid gap-2.5 sm:grid-cols-2">
            {dimensions.map((entry) => (
              <li
                key={entry.dimension}
                className="glass-panel flex flex-col gap-1.5 rounded-2xl px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-muted text-[13px] font-semibold">
                    {entry.label}
                  </span>
                  <StatusBadge tone={ergonomicAdequacyTone(entry.adequacy)}>
                    {ergonomicAdequacyText(entry.adequacy)}
                  </StatusBadge>
                </div>
                {entry.notes ? (
                  <p className="text-text-subtle text-xs">{entry.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>

          {current.notes ? (
            <p className="text-text-subtle rounded-2xl border border-dashed border-black/10 px-4 py-3 text-xs">
              {current.notes}
            </p>
          ) : null}

          {current.psychosocialCampaignId ? (
            <p className="text-text-subtle text-xs">
              {PSYCHOSOCIAL_AGGREGATE_LABEL} vinculado — o PGR imprime período, número de
              respostas e fatores derivados. Nenhuma resposta individual é exibida.
            </p>
          ) : null}

          <Link
            href={`${basePath}/${current.id}/edit`}
            className="text-primary w-fit text-xs font-bold hover:underline"
          >
            Editar avaliação vigente →
          </Link>
        </>
      ) : (
        <p className="text-text-subtle rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-xs">
          {NO_ERGONOMIC_EVALUATION_LABEL} para <strong>{riskLabel}</strong>.
        </p>
      )}
    </section>
  );
}
