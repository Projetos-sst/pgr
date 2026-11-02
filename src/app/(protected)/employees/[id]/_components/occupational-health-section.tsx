import Link from "next/link";
import type { ReactNode } from "react";

import { toExamTimeline } from "@/shared/domains/medicine/timeline";
import {
  EXAM_APTITUDE_LABELS,
  EXAM_DUE_WINDOW_DAYS,
  EXAM_TYPE_LABELS,
  type HealthExamListItem,
} from "@/shared/domains/pgr/health-exams";
import type { Paginated } from "@/shared/pagination";
import type { ActionResult } from "@/shared/server/result";
import { medicineErrorLabel } from "@/shared/domains/medicine/error-messages";

import { StatusBadge } from "../../../_ui/data-list";
import { ListErrorState } from "../../../_ui/list-error-state";

export type MedicineModuleState = "enabled" | "disabled" | "error";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function SectionShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <section
      aria-labelledby="occupational-health-title"
      className="glass-card animate-fade-in flex flex-col gap-4 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="occupational-health-title" className="text-text text-lg font-semibold">
          Saúde ocupacional
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Exames do funcionário na ficha (linha do tempo, mais recente primeiro). Só
 * existe quando a empresa tem Medicina habilitada — desabilitada, nada é
 * renderizado (nem contagem). Erro ≠ vazio: falha na verificação do módulo ou na
 * leitura dos exames vira `ListErrorState`. Nunca exibe `notes`/`certificatePath`
 * (o `HealthExamListItem` já não os traz). Status = validade INFORMADA.
 */
export function OccupationalHealthSection({
  employeeId,
  moduleState,
  exams,
  today,
}: {
  employeeId: string;
  moduleState: MedicineModuleState;
  exams: ActionResult<Paginated<HealthExamListItem>>;
  today: string;
}) {
  if (moduleState === "disabled") return null;

  const retryHref = `/employees/${employeeId}`;

  if (moduleState === "error") {
    return (
      <SectionShell>
        <ListErrorState
          isFlat
          title="Não foi possível verificar se a Medicina está habilitada para a empresa"
          description="Os exames deste funcionário não foram carregados. Tente novamente."
          retryHref={retryHref}
        />
      </SectionShell>
    );
  }

  const newExamHref = `/health-exams/new?employeeId=${encodeURIComponent(employeeId)}`;
  const registerLink = (
    <Link
      href={newExamHref}
      className="btn-primary inline-flex h-11 items-center rounded-xl px-[18px] text-[13px] font-bold transition-colors"
    >
      Registrar exame
    </Link>
  );

  if (!exams.ok) {
    return (
      <SectionShell action={registerLink}>
        <ListErrorState
          isFlat
          code={medicineErrorLabel(exams.error.code)}
          title="Não foi possível carregar os exames"
          description="Isso não significa que o funcionário não tenha exames registrados. Tente novamente."
          retryHref={retryHref}
        />
      </SectionShell>
    );
  }

  const { rows, total } = exams.data;

  if (rows.length === 0) {
    return (
      <SectionShell>
        <div className="glass-card flex flex-col items-center gap-3 px-4 py-6 text-center">
          <p className="text-text-subtle text-sm">
            Nenhum exame registrado para este funcionário.
          </p>
          {registerLink}
        </div>
      </SectionShell>
    );
  }

  const timeline = toExamTimeline(rows, { today, dueWindowDays: EXAM_DUE_WINDOW_DAYS });

  return (
    <SectionShell action={registerLink}>
      <ol
        className="flex flex-col gap-2"
        aria-label="Exames, do mais recente ao mais antigo"
      >
        {timeline.map((exam) => {
          const typeLabel = EXAM_TYPE_LABELS[exam.examType];
          const performed = formatDate(exam.performedAt);
          return (
            <li
              key={exam.id}
              className="glass-panel rounded-card flex flex-wrap items-center gap-x-5 gap-y-2 p-3 text-sm"
            >
              <div className="flex min-w-[150px] flex-1 flex-col">
                <span className="text-text font-semibold">{typeLabel}</span>
                <span className="text-text-muted font-mono text-[12px] tabular-nums">
                  {performed}
                </span>
              </div>
              <dl className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-[12px]">
                <div className="flex flex-col">
                  <dt className="text-text-subtle text-[10px] tracking-wide uppercase">
                    Médico
                  </dt>
                  <dd className={exam.doctorName ? "text-text" : "text-text-subtle"}>
                    {exam.doctorName ?? "—"}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-text-subtle text-[10px] tracking-wide uppercase">
                    Aptidão
                  </dt>
                  <dd className="text-text">{EXAM_APTITUDE_LABELS[exam.aptitude]}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-text-subtle text-[10px] tracking-wide uppercase">
                    Validade informada
                  </dt>
                  <dd
                    className={
                      exam.validUntil
                        ? "text-text font-mono tabular-nums"
                        : "text-text-subtle"
                    }
                  >
                    {exam.validUntil ? formatDate(exam.validUntil) : exam.validityLabel}
                  </dd>
                </div>
              </dl>
              <div className="flex items-center gap-3">
                <StatusBadge tone={exam.badge.tone}>{exam.badge.label}</StatusBadge>
                <Link
                  href={`/health-exams/${exam.id}/edit`}
                  className="text-primary focus-visible:ring-primary-ring rounded text-[13px] font-bold hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  Abrir
                  <span className="sr-only">
                    {" "}
                    exame {typeLabel} de {performed}
                  </span>
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
      {total > rows.length ? (
        <Link
          href={`/health-exams?employeeId=${encodeURIComponent(employeeId)}`}
          className="text-primary focus-visible:ring-primary-ring w-fit rounded text-sm font-bold hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
        >
          Ver todos os {total} exames
        </Link>
      ) : null}
    </SectionShell>
  );
}
