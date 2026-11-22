"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import {
  AiFillButton,
  AiFilledBadge,
  AiSaveConfirm,
  useAiGenerateWarning,
} from "@/app/(protected)/_ui/ai-review";
import { SelectField, TextAreaField, TextField } from "@/app/(protected)/_ui/form";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import { ACTION_PLAN_PRIORITY_LABELS } from "@/shared/domains/safety/action-plan";
import type { ActionPlanOriginType } from "@/shared/domains/safety/action-plan-origin";
import { createActionPlanAction } from "@/shared/server/actions/safety/action-plans";
import { suggestActionPlanAction } from "@/shared/server/actions/safety/risk-audits";

const PRIORITY_OPTIONS = Object.entries(ACTION_PLAN_PRIORITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

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

type FieldKey = keyof Fields;

const FIELD_KEYS: FieldKey[] = [
  "what",
  "why",
  "who",
  "where",
  "when",
  "how",
  "howMuch",
  "priority",
];

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
  const [{ fields, aiFilled }, setState] = useState<{
    fields: Fields;
    aiFilled: ReadonlySet<FieldKey>;
  }>({ fields: EMPTY, aiFilled: new Set() });
  const [confirming, setConfirming] = useState(false);
  const [suggesting, startSuggest] = useTransition();
  const [creating, startCreate] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: FieldKey, v: string) =>
    setState((prev) => ({
      fields: { ...prev.fields, [k]: v },
      aiFilled: new Set([...prev.aiFilled].filter((f) => f !== k)),
    }));

  function suggest() {
    setError(null);
    setInfo(null);
    startSuggest(async () => {
      const result = await suggestActionPlanAction(originType, originId);
      if (result.ok) {
        const s = result.data.suggestion;
        const filled: Fields = {
          what: s.what,
          why: s.why,
          who: s.who,
          where: s.where,
          when: s.when ?? "",
          how: s.how,
          howMuch: s.howMuch != null ? String(s.howMuch) : "",
          priority: s.priority != null ? String(s.priority) : "",
        };
        setState({
          fields: filled,
          aiFilled: new Set(FIELD_KEYS.filter((k) => filled[k] !== "")),
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

  const warning = useAiGenerateWarning(suggest);

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
      setConfirming(false);
      if (result.ok) router.push(`/action-plans/${result.data.id}`);
      else setError(result.error.message);
    });
  }

  function requestCreate() {
    if (aiFilled.size > 0) {
      setConfirming(true);
      return;
    }
    create();
  }

  const badge = (k: FieldKey) =>
    aiFilled.has(k) ? <AiFilledBadge className="mt-1.5" /> : null;

  return (
    <div className="glass-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-text text-sm font-semibold">Criar plano de ação 5W2H</h2>
        <AiFillButton
          onClick={warning.request}
          pending={suggesting}
          disabled={creating}
        />
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
        <div className="sm:col-span-2">
          <TextAreaField
            label="O quê"
            name="what"
            rows={2}
            value={fields.what}
            onChange={(v) => set("what", v)}
          />
          {badge("what")}
        </div>
        <div className="sm:col-span-2">
          <TextAreaField
            label="Por quê"
            name="why"
            rows={2}
            value={fields.why}
            onChange={(v) => set("why", v)}
          />
          {badge("why")}
        </div>
        <div>
          <TextField
            label="Quem"
            name="who"
            value={fields.who}
            onChange={(v) => set("who", v)}
          />
          {badge("who")}
        </div>
        <div>
          <TextField
            label="Onde"
            name="where"
            value={fields.where}
            onChange={(v) => set("where", v)}
          />
          {badge("where")}
        </div>
        <div className="sm:col-span-2">
          <TextAreaField
            label="Como"
            name="how"
            rows={2}
            value={fields.how}
            onChange={(v) => set("how", v)}
          />
          {badge("how")}
        </div>
        <div>
          <TextField
            label="Quando (prazo)"
            name="when"
            type="date"
            value={fields.when}
            onChange={(v) => set("when", v)}
          />
          {badge("when")}
        </div>
        <div>
          <TextField
            label="Quanto custa (R$)"
            name="howMuch"
            type="number"
            value={fields.howMuch}
            onChange={(v) => set("howMuch", v)}
          />
          {badge("howMuch")}
        </div>
        <div>
          <SelectField
            label="Prioridade"
            name="priority"
            value={fields.priority}
            onChange={(v) => set("priority", v)}
            options={PRIORITY_OPTIONS}
            emptyLabel="— sem prioridade —"
          />
          {badge("priority")}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={creating || suggesting}
          onClick={requestCreate}
          className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {creating ? "Criando…" : "Criar plano"}
        </button>
      </div>

      {warning.modal}
      <AiSaveConfirm
        open={confirming}
        pending={creating}
        onConfirm={create}
        onCancel={() => setConfirming(false)}
      />
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
