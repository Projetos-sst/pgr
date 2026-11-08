import { formatInstantDate } from "@/shared/dates";
import {
  sourceIsLive,
  type RiskAbsenceDeclarationView,
} from "@/shared/domains/medicine/risk-absence";
import type { SourceFreshness } from "@/shared/domains/medicine/risk-sources";

import { RiskAbsenceForm } from "./risk-absence-form";

type SourceRow = {
  id: string;
  title: string;
  version: string;
  superseded: boolean;
  freshness: SourceFreshness;
};

/**
 * Declarações de inexistência de riscos (NOB-156, DT-12): lista com a fonte e a vigência, e o
 * formulário só para quem tem autorização ativa de validação de riscos. Usada na tela de riscos
 * da Medicina e na de autorização e revisão (onde o profissional da empresa trabalha).
 */
export function RiskAbsenceSection({
  companyId,
  data,
  sources,
}: {
  companyId: string;
  data: {
    declarations: RiskAbsenceDeclarationView[];
    canDeclare: boolean;
    groups: { id: string; name: string; jobRoles: { id: string; title: string }[] }[];
  };
  sources: SourceRow[];
}) {
  return (
    <section className="glass-card flex flex-col gap-3 rounded-[20px] p-6 text-sm">
      <h2 className="font-semibold">Declarações de inexistência de riscos</h2>
      <p className="text-text-muted">
        Só o profissional com autorização ativa de validação de riscos declara, por GES e
        função, que não há exposição a riscos que exijam controle médico. Ausência de
        cadastro nunca vale como inexistência, e a declaração só vale para a versão da
        fonte em que foi feita (DT-12).
      </p>
      {data.declarations.length ? (
        <ul className="space-y-2">
          {data.declarations.map((d) => {
            const source = sources.find((s) => s.id === d.sourceId);
            const live = source ? sourceIsLive(source) : false;
            return (
              <li key={d.id} className="rounded-xl border border-white/70 p-3">
                <p className="font-medium">
                  {d.exposureGroup}
                  {d.jobRole ? ` · Função: ${d.jobRole}` : " · Grupo todo"}
                  {d.jobRoleId && d.currentJobRole && d.currentJobRole !== d.jobRole
                    ? ` (hoje: ${d.currentJobRole})`
                    : ""}
                </p>
                {d.jobRole && !d.jobRoleId ? (
                  <p className="text-text-muted text-xs">
                    Declaração sem vínculo com uma função cadastrada (antiga, ou a função
                    foi excluída): não vale no ASO. Regularização: declarar de novo
                    escolhendo a função do GES.
                  </p>
                ) : null}
                <p className="text-text-muted">
                  {source ? `${source.title} — ${source.version}` : "Fonte"} ·{" "}
                  {live
                    ? "versão vigente"
                    : "fonte substituída ou desatualizada: não vale mais"}{" "}
                  · {d.declaredByName ?? d.declaredBy} em{" "}
                  {formatInstantDate(d.declaredAt)}
                </p>
                <p>{d.justification}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-text-muted">Nenhuma declaração registrada.</p>
      )}
      {data.canDeclare ? (
        <RiskAbsenceForm
          companyId={companyId}
          sources={sources
            .filter(sourceIsLive)
            .map((s) => ({ id: s.id, label: `${s.title} — ${s.version}` }))}
          groups={data.groups.map((g) => ({
            id: g.id,
            label: g.name,
            jobRoles: g.jobRoles,
          }))}
        />
      ) : null}
    </section>
  );
}
