"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createCategoryAction,
  updateCategoryAction,
} from "@/shared/server/actions/pgr/categories";
import type { Category, CategoryInput } from "@/shared/domains/pgr/categories";

import {
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const TYPE_OPTIONS = [
  { value: "epi", label: "EPI" },
  { value: "machine", label: "Máquina" },
  { value: "supply", label: "Insumo" },
];

const STATUS_OPTIONS = [
  { value: "true", label: "Ativa" },
  { value: "false", label: "Inativa" },
];

export function CategoryForm({
  category,
  initialType,
}: {
  category?: Category;
  initialType?: CategoryInput["type"];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: CategoryInput = {
      type: value("type") as CategoryInput["type"],
      name: value("name"),
      note: value("note"),
      isActive: value("isActive"),
    };

    startTransition(async () => {
      const result = category
        ? await updateCategoryAction(category.id, input)
        : await createCategoryAction(input);
      if (result.ok) {
        router.push("/categories");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />

      <FormSection title="Categoria">
        <SelectField
          label="Tipo"
          name="type"
          required
          defaultValue={category?.type ?? initialType}
          options={TYPE_OPTIONS}
          error={errors.type}
        />
        <TextField
          label="Nome"
          name="name"
          required
          defaultValue={category?.name}
          error={errors.name}
        />
        <SelectField
          label="Situação"
          name="isActive"
          defaultValue={category ? String(category.isActive) : "true"}
          options={STATUS_OPTIONS}
          error={errors.isActive}
        />
        <TextField
          label="Observação"
          name="note"
          isFullWidth
          placeholder="Descrição opcional da categoria"
          defaultValue={category?.note}
          error={errors.note}
        />
      </FormSection>

      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href="/categories" />
        <SubmitButton
          pending={pending}
          label={category ? "Salvar alterações" : "Criar categoria"}
        />
      </FormActions>
    </form>
  );
}
