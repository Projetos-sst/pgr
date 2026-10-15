"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  ACTION_PLAN_PRIORITY_LABELS,
  ACTION_PLAN_TYPE_LABELS,
  type ActionPlanCreateInput,
  type ActionPlanUpdateInput,
} from "@/shared/domains/safety/action-plan";
import { ORIGIN_TYPE_LABELS } from "@/shared/domains/safety/action-plan-origin";
import {
  createActionPlanAction,
  updateActionPlanAction,
} from "@/shared/server/actions/safety/action-plans";

import { FormActions, FormError, SubmitButton } from "../../_ui/form";

type Option = { value: string; label: string };

export type ActionPlanFormInitial = {
  type: string | null;
  what: string;
  why: string;
  who: string;
  where: string;
  when: string | null;
  how: string;
  howMuch: string | null;
  priority: number | null;
};

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

function Field({
  label,
  hint,
  children,
  full,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-text-muted text-sm font-semibold">{label}</span>
      {hint ? <span className="text-text-subtle text-xs">{hint}</span> : null}
      {children}
    </label>
  );
}

export function ActionPlanForm({
  id,
  fixedOrigin,
  riskOptions,
  incidentOptions,
  initial,
}: {
  id?: string;
  /** Em edição, a origem é imutável — mostrada apenas como leitura. */
  fixedOrigin?: { typeLabel: string; label: string } | null;
  riskOptions: Option[];
  incidentOptions: Option[];
  initial: ActionPlanFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [originType, setOriginType] = useState<"risk" | "incident">("risk");
  const [originId, setOriginId] = useState("");

  const originOptions = originType === "risk" ? riskOptions : incidentOptions;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const str = (name: string) => {
      const v = (fd.get(name) as string | null)?.trim();
      return v ? v : undefined;
    };
    const howMuchRaw = str("howMuch");
    const priorityRaw = str("priority");

    const content = {
      type: str("type") as "corrective" | "preventive" | undefined,
      what: (fd.get("what") as string) ?? "",
      why: (fd.get("why") as string) ?? "",
      who: (fd.get("who") as string) ?? "",
      where: (fd.get("where") as string) ?? "",
      when: str("when"),
      how: (fd.get("how") as string) ?? "",
      howMuch: howMuchRaw != null ? Number(howMuchRaw) : undefined,
      priority: priorityRaw != null ? Number(priorityRaw) : undefined,
    };

    startTransition(async () => {
      let result;
      if (id) {
        result = await updateActionPlanAction(id, content as ActionPlanUpdateInput);
      } else {
        if (!originId) {
          setFormError("Selecione a origem do plano.");
          return;
        }
        result = await createActionPlanAction({
          originType,
          originId,
          ...content,
        } as ActionPlanCreateInput);
      }
      if (result.ok) {
        setFormError(null);
        router.push(id ? `/action-plans/${id}` : `/action-plans/${result.data.id}`);
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5">
      <FormError message={formError} />

      <section className="glass-card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {id ? (
          <div className="sm:col-span-2">
            <span className="text-text-muted text-sm font-semibold">Origem</span>
            <p className="text-text text-sm">
              {fixedOrigin
                ? `${fixedOrigin.typeLabel}: ${fixedOrigin.label}`
                : "Origem removida"}
            </p>
          </div>
        ) : (
          <>
            <Field label="Tipo de origem">
              <select
                value={originType}
                onChange={(e) => {
                  setOriginType(e.target.value as "risk" | "incident");
                  setOriginId("");
                }}
                className={inputClass}
              >
                <option value="risk">{ORIGIN_TYPE_LABELS.risk}</option>
                <option value="incident">{ORIGIN_TYPE_LABELS.incident}</option>
              </select>
            </Field>
            <Field label="Origem">
              <select
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className={inputClass}
              >
                <option value="">— selecione —</option>
                {originOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </section>

      <section className="glass-card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <Field label="O quê" full>
          <textarea
            name="what"
            rows={2}
            required
            defaultValue={initial.what}
            className={inputClass}
          />
        </Field>
        <Field label="Por quê" full>
          <textarea
            name="why"
            rows={2}
            required
            defaultValue={initial.why}
            className={inputClass}
          />
        </Field>
        <Field label="Quem">
          <input name="who" required defaultValue={initial.who} className={inputClass} />
        </Field>
        <Field label="Onde">
          <input
            name="where"
            required
            defaultValue={initial.where}
            className={inputClass}
          />
        </Field>
        <Field label="Como" full>
          <textarea
            name="how"
            rows={2}
            required
            defaultValue={initial.how}
            className={inputClass}
          />
        </Field>
        <Field label="Quando (prazo)">
          <input
            name="when"
            type="date"
            defaultValue={initial.when ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Quanto custa (R$)">
          <input
            name="howMuch"
            type="number"
            step="0.01"
            defaultValue={initial.howMuch ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Tipo">
          <select name="type" defaultValue={initial.type ?? ""} className={inputClass}>
            <option value="">— selecione —</option>
            {Object.entries(ACTION_PLAN_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridade">
          <select
            name="priority"
            defaultValue={initial.priority != null ? String(initial.priority) : ""}
            className={inputClass}
          >
            <option value="">— sem prioridade —</option>
            {Object.entries(ACTION_PLAN_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Criar plano"} />
      </FormActions>
    </form>
  );
}
