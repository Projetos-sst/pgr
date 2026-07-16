"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createCampaignAction,
  listWorkUnitOptionsAction,
  updateCampaignAction,
} from "@/shared/server/actions/psychosocial/campaigns";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../../_ui/form";

type Option = { value: string; label: string };

export type CampaignFormInitial = {
  name: string;
  companyId: string;
  workUnitId: string;
  startsAt: string | null;
  endsAt: string | null;
  themeColor: string | null;
  coverPath: string | null;
  workerDescription: string | null;
};

export function CampaignForm({
  id,
  companies,
  initialWorkUnits,
  initial,
}: {
  id?: string;
  companies: Option[];
  initialWorkUnits: Option[];
  initial?: CampaignFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const [workUnits, setWorkUnits] = useState<Option[]>(initialWorkUnits);
  const [workUnitId, setWorkUnitId] = useState(initial?.workUnitId ?? "");

  // Cascata Empresa → Obra: ao trocar a empresa, recarrega as obras.
  function onCompanyChange(next: string) {
    setCompanyId(next);
    setWorkUnitId("");
    if (!next) {
      setWorkUnits([]);
      return;
    }
    listWorkUnitOptionsAction(next).then((r) => {
      if (r.ok) setWorkUnits(r.data);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      name: (fd.get("name") as string) ?? "",
      companyId,
      workUnitId,
      startsAt: ((fd.get("startsAt") as string) || null) as string | null,
      endsAt: ((fd.get("endsAt") as string) || null) as string | null,
      themeColor: (fd.get("themeColor") as string) ?? "",
      coverPath: (fd.get("coverPath") as string) ?? "",
      workerDescription: (fd.get("workerDescription") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateCampaignAction(id, input)
        : await createCampaignAction(input);
      if (result.ok) {
        setFormError(null);
        router.push(
          id
            ? `/psychosocial/campaigns/${id}`
            : `/psychosocial/campaigns/${result.data.id}`,
        );
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <TextField
        label="Nome da campanha"
        name="name"
        required
        defaultValue={initial?.name}
      />
      <SelectField
        label="Empresa"
        name="companyId"
        required
        options={companies}
        value={companyId}
        onChange={onCompanyChange}
        emptyLabel="— selecione a empresa —"
      />
      <SelectField
        label="Obra / Local"
        name="workUnitId"
        required
        options={workUnits}
        value={workUnitId}
        onChange={setWorkUnitId}
        emptyLabel={companyId ? "— selecione a obra —" : "— escolha a empresa primeiro —"}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Data início"
          name="startsAt"
          type="date"
          defaultValue={initial?.startsAt}
        />
        <TextField
          label="Data fim"
          name="endsAt"
          type="date"
          defaultValue={initial?.endsAt}
        />
      </div>
      <TextField
        label="Cor do tema (ex. #2563eb)"
        name="themeColor"
        defaultValue={initial?.themeColor}
      />
      <TextField
        label="Capa (caminho)"
        name="coverPath"
        defaultValue={initial?.coverPath}
      />
      <TextField
        label="Descrição exibida ao trabalhador"
        name="workerDescription"
        defaultValue={initial?.workerDescription}
      />

      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Criar campanha"} />
      </FormActions>
    </form>
  );
}
