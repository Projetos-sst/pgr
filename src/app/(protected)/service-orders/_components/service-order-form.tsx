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

import {
  CancelLink,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />

      <FormSection title="Identificação">
        <TextField
          label="Título"
          name="title"
          required
          isFullWidth
          placeholder="Ex.: Entrega de EPIs — NR-06"
          defaultValue={initial?.title}
        />
        <SelectField
          label="Funcionário"
          name="assignedEmployeeId"
          isFullWidth
          value={employeeId}
          onChange={setEmployeeId}
          options={employees}
          emptyLabel="— sem funcionário —"
        />
        <TextField
          label="Data de abertura"
          name="openedAt"
          type="date"
          required
          defaultValue={initial?.openedAt}
        />
        <TextField
          label="Prazo"
          name="dueDate"
          type="date"
          defaultValue={initial?.dueDate}
        />
        {id ? (
          <SelectField
            label="Status"
            name="status"
            isFullWidth
            defaultValue={initial?.status ?? "open"}
            options={STATUS_OPTIONS}
          />
        ) : null}
      </FormSection>

      <FormSection
        title={`Checklist da OS (${items.length}/${MAX_ITEMS_PER_ORDER})`}
        columns={1}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={loadSuggested}
            disabled={loadingSuggested || !employeeId}
            className="glass-input text-text-muted hover:text-text rounded-field px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50"
          >
            {loadingSuggested ? "Sugerindo…" : "Sugerir do GES"}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-text-subtle text-[13px]">Nenhum item no checklist.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li
                key={`${item.sourceType}-${item.sourceId ?? "manual"}-${index}`}
                className="glass-input rounded-field flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]"
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
                  aria-label="Remover item"
                  title="Remover"
                  className="text-text-subtle flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors hover:bg-red-50 hover:text-[#d33a3f]"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
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
            className="glass-input text-text placeholder:text-text-subtle rounded-field h-[46px] flex-1 px-3.5 text-[13px] outline-none"
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
            className="glass-input text-text-muted hover:text-text rounded-field px-5 text-[13px] font-semibold transition-colors"
          >
            Adicionar
          </button>
        </div>
      </FormSection>

      <FormActions>
        <CancelLink href="/service-orders" />
        <SubmitButton pending={pending} label={id ? "Salvar OS" : "Criar OS"} />
      </FormActions>
    </form>
  );
}
