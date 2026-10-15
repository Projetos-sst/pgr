"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import { ACTION_PLAN_PRIORITY_LABELS } from "@/shared/domains/safety/action-plan";
import type { ActionPlanOriginType } from "@/shared/domains/safety/action-plan-origin";
import { createActionPlanAction } from "@/shared/server/actions/safety/action-plans";
import { suggestActionPlanAction } from "@/shared/server/actions/safety/risk-audits";

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

type Fields = {
  what: string;
  why: string;
  who: string;
  where: string;
  when: string;
  how: string;
  howMuch: string;
  priority: string;
};

const EMPTY: Fields = {
  what: "",
  why: "",
  who: "",
  where: "",
  when: "",
  how: "",
  howMuch: "",
  priority: "",
};

/**
 * Cria um plano de ação **para a origem da auditoria**, reutilizando o fluxo normal
 * (`createActionPlanAction`). A sugestão por IA apenas **preenche** os campos — a persistência
 * exige o clique em "Criar plano". Se a IA estiver indisponível, o preenchimento manual
 * continua disponível (a auditoria nunca é bloqueada).
 *
 * Enquanto o agente roda (~8–10s), os campos dão lugar ao esqueleto do formulário: são
 * exatamente esses campos que serão sobrescritos pela sugestão, então deixá-los editáveis
 * durante a espera só convidaria o usuário a digitar algo que seria perdido.
 */

/** Roteiro fixo exibido enquanto o agente 5W2H roda (ver `agent-stages.ts`). */
const ACTION_PLAN_AGENT_STAGES = [
  "Pensando…",
  "Analisando a origem…",
  "Definindo as ações corretivas…",
  "Montando o 5W2H…",
  "Estimando prazo e custo…",
] as const;
export function AuditPlanCreator({
  originType,
  originId,
}: {
  originType: ActionPlanOriginType;
  originId: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [suggesting, startSuggest] = useTransition();
  const [creating, startCreate] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Fields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  function suggest() {
    setError(null);
    setInfo(null);
    startSuggest(async () => {
      const result = await suggestActionPlanAction(originType, originId);
      if (result.ok) {
        const s = result.data.suggestion;
        setFields({
          what: s.what,
          why: s.why,
          who: s.who,
          where: s.where,
          when: s.when ?? "",
          how: s.how,
          howMuch: s.howMuch != null ? String(s.howMuch) : "",
          priority: s.priority != null ? String(s.priority) : "",
        });
        setInfo("Sugestão preenchida. Revise e edite antes de criar o plano.");
      } else {
        setError(
          result.error.code === "AI_UNAVAILABLE"
            ? "A IA pgr-e está indisponível no momento. Preencha o plano manualmente e clique em Criar plano."
            : result.error.message,
        );
      }
    });
  }

  function create() {
    setError(null);
    startCreate(async () => {
      const result = await createActionPlanAction({
        originType,
        originId,
        what: fields.what,
        why: fields.why,
        who: fields.who,
        where: fields.where,
        when: fields.when || undefined,
        how: fields.how,
        howMuch: fields.howMuch ? Number(fields.howMuch) : undefined,
        priority: fields.priority ? Number(fields.priority) : undefined,
      });
      if (result.ok) router.push(`/action-plans/${result.data.id}`);
      else setError(result.error.message);
    });
  }

  return (
    <div className="glass-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-text text-sm font-semibold">Criar plano de ação 5W2H</h2>
        <button
          type="button"
          disabled={suggesting}
          onClick={suggest}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {suggesting ? "Sugerindo…" : "Sugerir 5W2H com a IA pgr-e"}
        </button>
      </div>
      {info ? <p className="text-xs text-emerald-700">{info}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {suggesting ? (
        <>
          <AgentProgress stages={ACTION_PLAN_AGENT_STAGES} />
          <FieldsSkeleton />
        </>
      ) : null}

      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${suggesting ? "hidden" : ""}`}
      >
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-text-muted text-sm font-semibold">O quê</span>
          <textarea
            rows={2}
            value={fields.what}
            onChange={(e) => set("what", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-text-muted text-sm font-semibold">Por quê</span>
          <textarea
            rows={2}
            value={fields.why}
            onChange={(e) => set("why", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Quem</span>
          <input
            value={fields.who}
            onChange={(e) => set("who", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Onde</span>
          <input
            value={fields.where}
            onChange={(e) => set("where", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-text-muted text-sm font-semibold">Como</span>
          <textarea
            rows={2}
            value={fields.how}
            onChange={(e) => set("how", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Quando (prazo)</span>
          <input
            type="date"
            value={fields.when}
            onChange={(e) => set("when", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Quanto custa (R$)</span>
          <input
            type="number"
            step="0.01"
            value={fields.howMuch}
            onChange={(e) => set("howMuch", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Prioridade</span>
          <select
            value={fields.priority}
            onChange={(e) => set("priority", e.target.value)}
            className={inputClass}
          >
            <option value="">— sem prioridade —</option>
            {Object.entries(ACTION_PLAN_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={creating || suggesting}
          onClick={create}
          className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {creating ? "Criando…" : "Criar plano"}
        </button>
      </div>
    </div>
  );
}

/**
 * Espelha o grid dos 8 campos 5W2H para que a troca de esqueleto → formulário preenchido
 * não desloque o restante da página.
 */
function FieldsSkeleton() {
  const field = (key: string, wide: boolean, lines: number) => (
    <div key={key} className={`flex flex-col gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Skeleton className="h-4 w-20" />
      {Array.from({ length: lines }, (_, line) => (
        <Skeleton key={line} className="h-8 w-full rounded-lg" />
      ))}
    </div>
  );

  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {field("what", true, 2)}
      {field("why", true, 2)}
      {field("who", false, 1)}
      {field("where", false, 1)}
      {field("how", true, 2)}
      {field("when", false, 1)}
      {field("howMuch", false, 1)}
      {field("priority", false, 1)}
    </div>
  );
}
