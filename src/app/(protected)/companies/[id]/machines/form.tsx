"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createMachineAction,
  updateMachineAction,
  archiveMachineAction,
} from "@/shared/server/actions/pgr/machine-installations";
import {
  TextField,
  TextAreaField,
  SelectField,
  SubmitButton,
  FormError,
} from "../../../_ui/form";
import type { MachineInstallationFormValues as Machine } from "@/shared/domains/pgr/machine-installation";
type Options = {
  units: { id: string; name: string }[];
  groups: { id: string; name: string; workUnitId: string }[];
  catalog: { id: string; name: string }[];
  truncated: boolean;
};
export function MachineForm({
  companyId,
  options,
  initial,
}: {
  companyId: string;
  options: Options;
  initial?: Machine;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState(initial?.workUnitId ?? "");
  const [group, setGroup] = useState(initial?.gesId ?? "");
  const [catalog, setCatalog] = useState(initial?.catalogId ?? "");
  const [mode, setMode] = useState(initial?.mode ?? "individual");
  const choices = (rows: { id: string; name: string }[]) =>
    rows.map((r) => ({ value: r.id, label: r.name }));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const t = (name: string) => String(fd.get(name) ?? "");
    setError(null);
    const data = {
      workUnitId: unit,
      gesId: group || null,
      catalogId: catalog,
      mode,
      quantity: mode === "individual" ? 1 : Number(t("quantity")),
      identifier: t("identifier"),
      description: t("description"),
      operatingConditions: t("operatingConditions"),
      safetyMeasures: t("safetyMeasures"),
      maintenanceNotes: t("maintenanceNotes"),
      responsible: t("responsible"),
      reason: t("reason"),
    };
    start(async () => {
      const result = initial
        ? await updateMachineAction(companyId, initial.id, {
            expectedVersion: initial.version,
            data,
          })
        : await createMachineAction(companyId, data);
      if (!result.ok)
        setError(
          result.error.fields
            ? Object.values(result.error.fields).join(" · ")
            : result.error.message,
        );
      else {
        router.push(`/companies/${companyId}/machines`);
        router.refresh();
      }
    });
  }
  return (
    <form
      onSubmit={submit}
      className="glass-card grid gap-4 rounded-xl p-5 sm:grid-cols-2"
    >
      <FormError message={error} />
      {options.truncated && (
        <p className="sm:col-span-2">
          Há mais de 100 opções em algum cadastro. A lista foi limitada; confira os
          cadastros com a equipe antes de selecionar.
        </p>
      )}
      <SelectField
        name="catalogId"
        label="Máquina do catálogo"
        value={catalog}
        onChange={setCatalog}
        options={choices(options.catalog)}
        required
      />
      <SelectField
        name="workUnitId"
        label="Obra ou unidade"
        value={unit}
        onChange={(v) => {
          setUnit(v);
          setGroup("");
        }}
        options={choices(options.units)}
        required
      />
      <SelectField
        name="gesId"
        label="Ambiente/GES"
        value={group}
        onChange={setGroup}
        options={choices(options.groups.filter((g) => g.workUnitId === unit))}
        emptyLabel="Uso geral nesta obra/unidade"
      />
      <SelectField
        name="mode"
        label="Forma de registro"
        value={mode}
        onChange={setMode}
        options={[
          { value: "individual", label: "Máquina individual" },
          { value: "group", label: "Grupo de máquinas equivalentes" },
        ]}
      />
      {mode === "group" && (
        <TextField
          name="quantity"
          type="number"
          label="Quantidade"
          defaultValue={String(initial?.quantity ?? 1)}
          required
        />
      )}
      <TextField
        name="identifier"
        label="Identificação ou patrimônio (obrigatório para máquina individual)"
        defaultValue={initial?.identifier}
      />
      <TextAreaField
        name="description"
        label="Descrição e finalidade no ambiente"
        defaultValue={initial?.description}
        required
      />
      <TextAreaField
        name="operatingConditions"
        label="Condições de operação e exposição informadas"
        defaultValue={initial?.operatingConditions}
      />
      <TextAreaField
        name="safetyMeasures"
        label="Medidas de segurança existentes e observações"
        defaultValue={initial?.safetyMeasures}
      />
      <TextAreaField
        name="maintenanceNotes"
        label="Manutenção e acompanhamento informados"
        defaultValue={initial?.maintenanceNotes}
      />
      <TextField
        name="responsible"
        label="Responsável informado, quando definido"
        defaultValue={initial?.responsible}
      />
      <TextField name="reason" label="Motivo do cadastro ou alteração" required />
      <p className="text-sm sm:col-span-2">
        Registre fatos observados. O cadastro não certifica conformidade nem preenche
        medidas de segurança automaticamente.
      </p>
      <SubmitButton
        pending={pending}
        label={initial ? "Salvar alterações" : "Vincular máquina"}
      />
    </form>
  );
}
export function ArchiveMachine({
  companyId,
  machine,
}: {
  companyId: string;
  machine: Machine;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
    start(async () => {
      const result = await archiveMachineAction(companyId, machine.id, {
        expectedVersion: machine.version,
        reason,
      });
      if (!result.ok) setError(result.error.message);
      else {
        router.push(`/companies/${companyId}/machines`);
        router.refresh();
      }
    });
  }
  return (
    <form onSubmit={submit} className="glass-card flex flex-col gap-3 rounded-xl p-5">
      <p>Retirar este vínculo preserva o histórico e não exclui a máquina do catálogo.</p>
      <FormError message={error} />
      <TextField name="reason" label="Motivo da retirada" required />
      <SubmitButton pending={pending} label="Retirar máquina deste contexto" />
    </form>
  );
}
