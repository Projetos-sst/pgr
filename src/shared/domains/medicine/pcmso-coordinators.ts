import { z } from "zod";

import type { Medico } from "@/shared/db/schema/medicos";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

/**
 * Designação do médico responsável (coordenador) pelo PCMSO por empresa e
 * período (MED-02; NR-7 7.4.1 "c"). Regras puras: o repositório as aplica
 * dentro da transação.
 *
 * - Só médico ativo, com UF do CRM, pode ser designado.
 * - Sem RQE em Medicina do Trabalho, a designação exige a justificativa da
 *   exceção do NR-7 7.5.2 (inexistência de médico do trabalho na localidade):
 *   a regra do Word (CRM, UF e RQE) vale como padrão, sem bloquear a exceção
 *   prevista na norma.
 * - Trocar de coordenador encerra a designação aberta na véspera do início
 *   da nova; os períodos nunca se sobrepõem e o histórico não é apagado.
 */

const isoDate = z.iso.date("Data inválida (use AAAA-MM-DD)");
const reason = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(10, "Descreva o motivo com pelo menos 10 caracteres")
    .max(1000, "Motivo com no máximo 1000 caracteres");

export const coordinatorDesignationSchema = z.object({
  medicoId: requiredUuid("Selecione o médico"),
  startsOn: isoDate,
  rqeExceptionReason: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    reason("Justificativa inválida").optional(),
  ),
});
export type CoordinatorDesignationInput = z.input<typeof coordinatorDesignationSchema>;
export type CoordinatorDesignationValues = z.output<typeof coordinatorDesignationSchema>;

export const coordinatorClosingSchema = z.object({
  endsOn: isoDate,
  endReason: reason("Informe o motivo do encerramento"),
});
export type CoordinatorClosingInput = z.input<typeof coordinatorClosingSchema>;
export type CoordinatorClosingValues = z.output<typeof coordinatorClosingSchema>;

export type EligibilityResult =
  | { ok: true; rqeExceptionReason: string | null }
  | { ok: false; message: string };

/** Confere se o profissional pode responder pelo PCMSO. */
export function assessCoordinatorEligibility(
  medico: Pick<Medico, "status" | "profession" | "registrationUf" | "rqe">,
  rqeExceptionReason: string | undefined,
): EligibilityResult {
  if (medico.status !== "active")
    return { ok: false, message: "Profissional inativo não pode ser designado." };
  if (medico.profession !== "physician")
    return {
      ok: false,
      message:
        "Somente médico pode ser o responsável pelo PCMSO (NR-7, item 7.4.1, alínea c).",
    };
  if (!medico.registrationUf)
    return {
      ok: false,
      message: "Informe a UF do CRM no cadastro do médico antes de designá-lo.",
    };
  if (medico.rqe) return { ok: true, rqeExceptionReason: null };
  if (!rqeExceptionReason)
    return {
      ok: false,
      message:
        "O médico não tem RQE em Medicina do Trabalho. A designação só é possível com a justificativa da exceção do item 7.5.2 da NR-7 (inexistência de médico do trabalho na localidade).",
    };
  return { ok: true, rqeExceptionReason };
}

/** Véspera de uma data ISO (AAAA-MM-DD), em UTC para não depender do fuso. */
export function previousIsoDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type Period = { startsOn: string; endsOn: string | null };

export type SwitchPlan =
  | { ok: true; closeOpenOn: string | null }
  | { ok: false; message: string };

/**
 * Planeja a troca: a nova designação começa depois da aberta (que é
 * encerrada na véspera) e depois do fim de todas as encerradas.
 */
export function planCoordinatorSwitch(history: Period[], startsOn: string): SwitchPlan {
  const open = history.find((p) => p.endsOn === null) ?? null;
  if (open && startsOn <= open.startsOn)
    return {
      ok: false,
      message: `A nova designação precisa começar depois de ${open.startsOn}, início da designação atual.`,
    };
  const lastEnd = history
    .map((p) => p.endsOn)
    .filter((e): e is string => e !== null)
    .sort()
    .at(-1);
  if (lastEnd && startsOn <= lastEnd)
    return {
      ok: false,
      message: `A nova designação precisa começar depois de ${lastEnd}, fim da designação anterior.`,
    };
  return { ok: true, closeOpenOn: open ? previousIsoDay(startsOn) : null };
}

/** Coordenador vigente numa data (designação cujo período contém a data). */
export function coordinatorOn<T extends Period>(history: T[], isoDay: string): T | null {
  return (
    history.find(
      (p) => p.startsOn <= isoDay && (p.endsOn === null || isoDay <= p.endsOn),
    ) ?? null
  );
}

export type CoordinatorInForce<T> =
  | { kind: "in_force"; assignment: T }
  | { kind: "none" }
  | { kind: "overlap"; assignments: T[] };

/**
 * Coordenador em vigor numa data de referência (NOB-109/NOB-144), para a conferência e a prévia
 * do PCMSO. "Designação aberta" (`ends_on` nulo) não é o mesmo que "em vigor": a designação pode
 * começar no futuro (sucessor agendado) ou ter encerramento agendado e seguir vigente até lá.
 * Mais de uma designação vigente no mesmo dia (só alcançável fora do app, que impede períodos
 * sobrepostos) é devolvida como `overlap`, sem escolha arbitrária: quem usa bloqueia.
 */
export function coordinatorInForceOn<T extends Period>(
  history: readonly T[],
  isoDay: string,
): CoordinatorInForce<T> {
  const matches = history.filter(
    (p) => p.startsOn <= isoDay && (p.endsOn === null || isoDay <= p.endsOn),
  );
  if (matches.length === 0) return { kind: "none" };
  if (matches.length > 1) return { kind: "overlap", assignments: matches };
  return { kind: "in_force", assignment: matches[0] };
}

export const SWITCH_END_REASON =
  "Substituído por nova designação de coordenador do PCMSO.";
