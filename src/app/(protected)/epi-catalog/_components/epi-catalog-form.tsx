"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { listCategoriesAction } from "@/shared/server/actions/pgr/categories";
import {
  createEpiCatalogAction,
  updateEpiCatalogAction,
} from "@/shared/server/actions/pgr/epi-catalog";
import type { EpiCatalog, EpiCatalogInput } from "@/shared/domains/pgr/epi-catalog";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const TYPE_OPTIONS = [
  { value: "epi", label: "EPI" },
  { value: "machine", label: "Máquinas e Equipamentos" },
];

type CategoryOption = { value: string; label: string };

export function EpiCatalogForm({ item }: { item?: EpiCatalog }) {
  const router = useRouter();
  const [type, setType] = useState<string>(item?.type ?? "");
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ?? "");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Tipo → Categoria em cascata: carrega categorias do tipo selecionado (009).
  useEffect(() => {
    if (type !== "epi" && type !== "machine") return;
    let active = true;
    (async () => {
      const result = await listCategoriesAction({ type, pageSize: 100 });
      if (!active) return;
      setCategories(
        result.ok
          ? result.data.rows.map((row) => ({ value: row.id, label: row.name }))
          : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [type]);

  function handleTypeChange(value: string) {
    setType(value);
    // Trocar o tipo invalida a categoria selecionada (coerência Tipo×Categoria).
    if (value !== item?.type) setCategoryId("");
    else setCategoryId(item?.categoryId ?? "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: EpiCatalogInput = {
      type: type as EpiCatalogInput["type"],
      categoryId,
      name: value("name"),
      ca: value("ca"),
      caValidUntil: value("caValidUntil"),
      manufacturer: value("manufacturer"),
      norm: value("norm"),
      size: value("size"),
      unitOfMeasure: value("unitOfMeasure"),
      description: value("description"),
      photoPath: value("photoPath"),
    };

    startTransition(async () => {
      const result = item
        ? await updateEpiCatalogAction(item.id, input)
        : await createEpiCatalogAction(input);
      if (result.ok) {
        router.push("/epi-catalog");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <SelectField
        label="Tipo"
        name="type"
        required
        value={type}
        onChange={handleTypeChange}
        options={TYPE_OPTIONS}
        error={errors.type}
      />
      <SelectField
        label="Categoria"
        name="categoryId"
        required
        value={categoryId}
        onChange={setCategoryId}
        options={categories}
        error={errors.categoryId}
        disabled={categories.length === 0}
        emptyLabel={
          type === "" ? "— selecione o tipo primeiro —" : "— selecione a categoria —"
        }
      />
      <TextField
        label="Nome"
        name="name"
        required
        defaultValue={item?.name}
        error={errors.name}
      />
      <TextField label="CA" name="ca" defaultValue={item?.ca} error={errors.ca} />
      <TextField
        label="Validade do CA"
        name="caValidUntil"
        type="date"
        defaultValue={item?.caValidUntil ?? ""}
        error={errors.caValidUntil}
      />
      <TextField
        label="Fabricante"
        name="manufacturer"
        defaultValue={item?.manufacturer}
        error={errors.manufacturer}
      />
      <TextField
        label="Norma"
        name="norm"
        defaultValue={item?.norm}
        error={errors.norm}
      />
      <TextField
        label="Tamanho"
        name="size"
        defaultValue={item?.size}
        error={errors.size}
      />
      <TextField
        label="Unidade de medida"
        name="unitOfMeasure"
        defaultValue={item?.unitOfMeasure}
        error={errors.unitOfMeasure}
      />
      <TextField
        label="Descrição"
        name="description"
        defaultValue={item?.description}
        error={errors.description}
      />
      <TextField
        label="Caminho da foto"
        name="photoPath"
        defaultValue={item?.photoPath}
        error={errors.photoPath}
      />
      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton
          pending={pending}
          label={item ? "Salvar alterações" : "Criar item"}
        />
      </FormActions>
    </form>
  );
}
