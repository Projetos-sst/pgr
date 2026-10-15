"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createEpiStockAction,
  updateEpiStockAction,
} from "@/shared/server/actions/pgr/epi-stock";
import type { EpiCatalogOption, EpiStockDetail } from "@/shared/domains/pgr/epi-stock";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

export function EpiStockForm({
  stock,
  catalogOptions,
}: {
  stock?: EpiStockDetail;
  catalogOptions?: EpiCatalogOption[];
}) {
  const router = useRouter();
  const isEdit = !!stock;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const minimumQuantity = String(fd.get("minimumQuantity") ?? "");

    startTransition(async () => {
      const result = isEdit
        ? await updateEpiStockAction(stock!.id, { minimumQuantity })
        : await createEpiStockAction({
            catalogId: String(fd.get("catalogId") ?? ""),
            minimumQuantity,
            initialQuantity: String(fd.get("initialQuantity") ?? ""),
          });
      if (result.ok) {
        router.push("/epi-stock");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <FormError message={formError} />

      {isEdit ? (
        <div className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Item do catálogo</span>
          <p className="glass-panel text-text rounded-card px-3 py-2 text-sm">
            {stock!.name}
            {stock!.ca ? ` · CA ${stock!.ca}` : ""}
          </p>
        </div>
      ) : (
        <SelectField
          label="Item do catálogo"
          name="catalogId"
          required
          options={(catalogOptions ?? []).map((o) => ({
            value: o.catalogId,
            label: o.ca ? `${o.name} (CA ${o.ca})` : o.name,
          }))}
          emptyLabel="— selecione um item —"
          error={errors.catalogId}
        />
      )}

      <TextField
        label="Quantidade mínima"
        name="minimumQuantity"
        type="number"
        required
        defaultValue={isEdit ? String(stock!.minimumQuantity) : "0"}
        error={errors.minimumQuantity}
      />

      {isEdit ? null : (
        <TextField
          label="Quantidade inicial"
          name="initialQuantity"
          type="number"
          defaultValue="0"
          placeholder="0"
          error={errors.initialQuantity}
        />
      )}

      {isEdit ? (
        <p className="text-text-subtle text-sm">
          Saldo atual: <strong>{stock!.currentBalance}</strong>. O saldo é alterado apenas
          por movimentações de estoque — não é editável aqui.
        </p>
      ) : null}

      <FieldError message={errors._} />

      <FormActions>
        <SubmitButton
          pending={pending}
          label={isEdit ? "Salvar alterações" : "Adicionar ao estoque"}
        />
      </FormActions>
    </form>
  );
}
