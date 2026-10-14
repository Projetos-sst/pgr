"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  MAX_ITEM_DESCRIPTION,
  MAX_ITEMS_PER_ORDER,
  SERVICE_ORDER_STATUS_LABELS,
  type ServiceOrderItemSource,
  type ServiceOrderStatus,
} from "@/shared/domains/safety/service-order";
import { EXAM_TYPE_LABELS, type ExamType } from "@/shared/domains/pgr/health-exams";
import {
  createServiceOrderAction,
  getSuggestedItemsAction,
  updateServiceOrderAction,
} from "@/shared/server/actions/safety/service-orders";
import { suggestServiceOrderInstructions } from "@/shared/server/actions/safety/ai-service-order-instructions";

import { AgentProgress } from "../../_ui/agent-progress";

import { FormActions, FormError, SubmitButton, TextField } from "../../_ui/form";

type Option = { value: string; label: string };

type ChecklistItem = {
  description: string;
  sourceType: ServiceOrderItemSource;
  sourceId: string | null;
};

export type ServiceOrderFormInitial = {
  title: string;
  osType: ExamType | null;
  assignedEmployeeId: string | null;
  workUnitId: string | null;
  openedAt: string;
  dueDate: string | null;
  status: ServiceOrderStatus;
  items: ChecklistItem[];
};

const STATUS_OPTIONS = Object.entries(SERVICE_ORDER_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const OS_TYPE_OPTIONS = Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Roteiro fixo exibido enquanto o agente de instruções roda (ver `agent-stages.ts`). */
const SERVICE_ORDER_AGENT_STAGES = [
  "Pensando…",
  "Lendo a função e o GES…",
  "Revisando riscos e EPIs da atividade…",
  "Redigindo as instruções…",
  "Revisando o texto…",
] as const;

const SOURCE_LABELS: Record<ServiceOrderItemSource, string> = {
  manual: "Manual",
  risk: "Risco",
  epi: "EPI",
};

export function ServiceOrderForm({
  id,
  employees,
  workUnits,
  initial,
}: {
  id?: string;
  employees: Option[];
  workUnits: Option[];
  initial?: ServiceOrderFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState(initial?.assignedEmployeeId ?? "");
  const [items, setItems] = useState<ChecklistItem[]>(initial?.items ?? []);
  const [newItem, setNewItem] = useState("");
  const [loadingSuggested, startSuggested] = useTransition();
  const [loadingAi, startAi] = useTransition();

  function addManualItem() {
    const description = newItem.trim();
    if (!description) return;
    if (items.length >= MAX_ITEMS_PER_ORDER) {
      setFormError(`No máximo ${MAX_ITEMS_PER_ORDER} itens por OS.`);
      return;
    }
    setItems((prev) => [...prev, { description, sourceType: "manual", sourceId: null }]);
    setNewItem("");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function loadSuggested() {
    if (!employeeId) {
      setFormError("Selecione um funcionário para sugerir itens do GES.");
      return;
    }
    startSuggested(async () => {
      const result = await getSuggestedItemsAction(employeeId);
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      setFormError(null);
      // Evita duplicar sugestões já presentes (por sourceType+sourceId).
      const existing = new Set(items.map((i) => `${i.sourceType}:${i.sourceId ?? ""}`));
      const fresh = result.data.filter(
        (s) => !existing.has(`${s.sourceType}:${s.sourceId ?? ""}`),
      );
      setItems((prev) => [...prev, ...fresh].slice(0, MAX_ITEMS_PER_ORDER));
    });
  }

  /**
   * Redige as instruções de segurança da OS com a IA pgr-e (NR-01 1.4.1). Só existe na
   * **edição**: o agente lê a OS persistida (função, GES, riscos e EPIs da atividade), o
   * que ainda não existe numa OS em criação. As instruções entram como itens do
   * checklist e são gravadas pelo "Salvar" normal — a IA nunca escreve sozinha.
   */
  function suggestWithAi() {
    if (!id) return;
    startAi(async () => {
      const result = await suggestServiceOrderInstructions(id);
      if (!result.ok) {
        setFormError(
          result.error.code === "AI_UNAVAILABLE"
            ? "A IA pgr-e está indisponível no momento. Continue pelo checklist manual."
            : result.error.message,
        );
        return;
      }
      setFormError(null);
      const existing = new Set(items.map((i) => i.description.trim().toLowerCase()));
      const fresh = result.data.suggestions
        .filter((s) => !existing.has(s.description.trim().toLowerCase()))
        .map((s) => ({
          description: s.description,
          sourceType: "manual" as const,
          sourceId: null,
        }));
      setItems((prev) => [...prev, ...fresh].slice(0, MAX_ITEMS_PER_ORDER));
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const title = (fd.get("title") as string) ?? "";
    const openedAt = (fd.get("openedAt") as string) ?? "";
    const dueDate = (fd.get("dueDate") as string)?.trim() || undefined;
    const osType = ((fd.get("osType") as string)?.trim() || undefined) as
      | ExamType
      | undefined;
    const workUnitId = (fd.get("workUnitId") as string)?.trim() || null;
    const assignedEmployeeId = employeeId ? employeeId : null;
    const payloadItems = items.map((i) => ({
      description: i.description,
      sourceType: i.sourceType,
      sourceId: i.sourceId ?? undefined,
    }));

    startTransition(async () => {
      const result = id
        ? await updateServiceOrderAction(id, {
            title,
            osType,
            assignedEmployeeId,
            workUnitId,
            openedAt,
            dueDate,
            status: (fd.get("status") as ServiceOrderStatus) ?? "open",
            items: payloadItems,
          })
        : await createServiceOrderAction({
            title,
            osType,
            assignedEmployeeId,
            workUnitId,
            openedAt,
            dueDate,
            items: payloadItems,
          });
      if (result.ok) {
        setFormError(null);
        router.push(id ? `/service-orders/${id}` : "/service-orders");
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />

      <TextField label="Título" name="title" required defaultValue={initial?.title} />

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-sm font-semibold">
          Funcionário (opcional)
        </span>
        <select
          name="assignedEmployeeId"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          <option value="">— sem funcionário —</option>
          {employees.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Tipo de OS</span>
          <select
            name="osType"
            defaultValue={initial?.osType ?? ""}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          >
            <option value="">— selecione —</option>
            {OS_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Unidade / Obra</span>
          <select
            name="workUnitId"
            defaultValue={initial?.workUnitId ?? ""}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          >
            <option value="">— sem unidade —</option>
            {workUnits.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Data de abertura"
          name="openedAt"
          type="date"
          required
          defaultValue={initial?.openedAt}
        />
        <TextField
          label="Prazo (opcional)"
          name="dueDate"
          type="date"
          defaultValue={initial?.dueDate}
        />
      </div>

      {id ? (
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Status *</span>
          <select
            name="status"
            defaultValue={initial?.status ?? "open"}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Checklist de itens (snapshots textuais) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-sm font-semibold">
            Checklist ({items.length}/{MAX_ITEMS_PER_ORDER})
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadSuggested}
              disabled={loadingSuggested || !employeeId}
              className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loadingSuggested ? "Sugerindo…" : "Sugerir do GES"}
            </button>
            {id ? (
              <button
                type="button"
                onClick={suggestWithAi}
                disabled={loadingAi}
                className="btn-primary rounded-pill px-3 py-1 text-sm font-semibold disabled:opacity-50"
              >
                {loadingAi ? "Redigindo…" : "Redigir com a IA pgr-e"}
              </button>
            ) : null}
          </div>
        </div>

        {loadingAi ? <AgentProgress stages={SERVICE_ORDER_AGENT_STAGES} /> : null}

        {items.length === 0 ? (
          <p className="text-text-subtle text-sm">Nenhum item no checklist.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li
                key={`${item.sourceType}-${item.sourceId ?? "manual"}-${index}`}
                className="glass-panel rounded-card flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="flex-1">
                  <span className="text-text-subtle font-mono text-[10px] tracking-wide uppercase">
                    {SOURCE_LABELS[item.sourceType]}
                  </span>{" "}
                  {item.description}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-600 hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            maxLength={MAX_ITEM_DESCRIPTION}
            placeholder="Novo item manual…"
            className="glass-input text-text placeholder:text-text-subtle rounded-card flex-1 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManualItem();
              }
            }}
          />
          <button
            type="button"
            onClick={addManualItem}
            className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>

      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Criar OS"} />
      </FormActions>
    </form>
  );
}
