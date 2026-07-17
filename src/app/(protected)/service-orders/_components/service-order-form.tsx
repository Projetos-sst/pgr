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
import {
  createServiceOrderAction,
  getSuggestedItemsAction,
  updateServiceOrderAction,
} from "@/shared/server/actions/safety/service-orders";

import { FormActions, FormError, SubmitButton, TextField } from "../../_ui/form";

type Option = { value: string; label: string };

type ChecklistItem = {
  description: string;
  sourceType: ServiceOrderItemSource;
  sourceId: string | null;
};

export type ServiceOrderFormInitial = {
  title: string;
  assignedEmployeeId: string | null;
  openedAt: string;
  dueDate: string | null;
  status: ServiceOrderStatus;
  items: ChecklistItem[];
};

const STATUS_OPTIONS = Object.entries(SERVICE_ORDER_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const SOURCE_LABELS: Record<ServiceOrderItemSource, string> = {
  manual: "Manual",
  risk: "Risco",
  epi: "EPI",
};

export function ServiceOrderForm({
  id,
  employees,
  initial,
}: {
  id?: string;
  employees: Option[];
  initial?: ServiceOrderFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState(initial?.assignedEmployeeId ?? "");
  const [items, setItems] = useState<ChecklistItem[]>(initial?.items ?? []);
  const [newItem, setNewItem] = useState("");
  const [loadingSuggested, startSuggested] = useTransition();

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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const title = (fd.get("title") as string) ?? "";
    const openedAt = (fd.get("openedAt") as string) ?? "";
    const dueDate = (fd.get("dueDate") as string)?.trim() || undefined;
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
            assignedEmployeeId,
            openedAt,
            dueDate,
            status: (fd.get("status") as ServiceOrderStatus) ?? "open",
            items: payloadItems,
          })
        : await createServiceOrderAction({
            title,
            assignedEmployeeId,
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
          <button
            type="button"
            onClick={loadSuggested}
            disabled={loadingSuggested || !employeeId}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loadingSuggested ? "Sugerindo…" : "Sugerir do GES"}
          </button>
        </div>

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
