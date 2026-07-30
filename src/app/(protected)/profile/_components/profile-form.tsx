"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { updateProfile } from "@/shared/server/actions/platform/profile";

import { FormActions, FormError, SubmitButton, TextField } from "../../_ui/form";

export function ProfileForm({
  initial,
}: {
  initial: { phone: string | null; cpf: string | null; jobTitle: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      phone: (fd.get("phone") as string) ?? "",
      cpf: (fd.get("cpf") as string) ?? "",
      jobTitle: (fd.get("jobTitle") as string) ?? "",
    };
    startTransition(async () => {
      const result = await updateProfile(input);
      if (result.ok) {
        setErrors({});
        setFormError(null);
        setSaved(true);
        router.refresh();
      } else {
        setErrors(result.error.fields ?? {});
        setFormError(result.error.message);
        setSaved(false);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <FormError message={formError} />
      {saved ? (
        <p className="rounded-card border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Perfil atualizado.
        </p>
      ) : null}
      <TextField
        label="Telefone"
        name="phone"
        defaultValue={initial.phone}
        error={errors.phone}
      />
      <TextField label="CPF" name="cpf" defaultValue={initial.cpf} error={errors.cpf} />
      <TextField
        label="Cargo"
        name="jobTitle"
        defaultValue={initial.jobTitle}
        error={errors.jobTitle}
      />
      <FormActions>
        <SubmitButton pending={pending} label="Salvar perfil" />
      </FormActions>
    </form>
  );
}
