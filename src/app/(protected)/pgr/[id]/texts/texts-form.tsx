"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PgrDocxTextFieldGroup } from "@/shared/domains/pgr/pgr-docx/text-overrides";
import { savePgrDocxTextVersionAction } from "@/shared/server/actions/pgr/pgr-docx-texts";
import {
  FormError,
  FormSection,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";

type Sections = Record<string, Record<string, string>>;

function sectionsOf(form: FormData, groups: PgrDocxTextFieldGroup[]): Sections {
  const sections: Sections = {};
  for (const group of groups) {
    sections[group.section] = Object.fromEntries(
      group.fields.map((field) => [
        field.name.slice(group.section.length + 1),
        String(form.get(field.name) ?? ""),
      ]),
    );
  }
  return sections;
}

export function PgrDocxTextsForm({
  pgrId,
  groups,
}: {
  pgrId: string;
  groups: PgrDocxTextFieldGroup[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    start(async () => {
      const result = await savePgrDocxTextVersionAction(pgrId, {
        reason: String(form.get("reason") ?? ""),
        overrides: sectionsOf(form, groups),
      });
      setError(result.ok ? null : result.error.message);
      setSaved(result.ok ? `Versão ${result.data.version} salva.` : null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormError message={error} />
      {saved ? (
        <p role="status" className="text-accent-green text-sm font-semibold">
          {saved}
        </p>
      ) : null}
      {groups.map((group) => (
        <FormSection
          key={group.section}
          title={group.title}
          description={group.description}
          columns={group.section === "texts" ? 1 : 2}
        >
          {group.fields.map((field) => {
            const label = field.changed ? `${field.label} (alterado)` : field.label;
            return group.section === "texts" ? (
              <TextAreaField
                key={field.name}
                name={field.name}
                label={label}
                defaultValue={field.value}
                rows={8}
              />
            ) : (
              <TextField
                key={field.name}
                name={field.name}
                label={label}
                defaultValue={field.value}
              />
            );
          })}
        </FormSection>
      ))}
      <FormSection
        title="Registro da alteração"
        description="Cada salvamento cria uma versão nova. As versões anteriores ficam no histórico."
        columns={1}
      >
        <TextField name="reason" label="Motivo da alteração" required />
      </FormSection>
      <SubmitButton pending={pending} label="Salvar nova versão dos textos" />
    </form>
  );
}
