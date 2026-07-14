"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { ROLE_LABEL, type AssignableRole } from "@/shared/domains/platform/team";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
} from "@/shared/server/actions/platform/team";

import { FormError, SelectField, SubmitButton, TextField } from "../../_ui/form";

const ROLE_OPTIONS = (Object.entries(ROLE_LABEL) as [AssignableRole, string][]).map(
  ([value, label]) => ({ value, label }),
);

export function InviteMemberForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const input = {
      email: (fd.get("email") as string) ?? "",
      role: (fd.get("role") as AssignableRole) ?? "collaborator",
    };
    startTransition(async () => {
      const result = await inviteMember(input);
      if (result.ok) {
        setErrors({});
        setFormError(null);
        setInvited(result.data.email);
        form.reset();
        router.refresh();
      } else {
        setErrors(result.error.fields ?? {});
        setFormError(result.error.message);
        setInvited(null);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 sm:flex-row sm:items-end dark:border-white/10"
    >
      <div className="flex-1">
        <TextField
          label="Convidar por e-mail"
          name="email"
          type="email"
          required
          error={errors.email}
        />
      </div>
      <div className="w-full sm:w-48">
        <SelectField
          label="Papel"
          name="role"
          defaultValue="collaborator"
          options={ROLE_OPTIONS}
          error={errors.role}
        />
      </div>
      <SubmitButton pending={pending} label="Convidar" />
      {formError ? (
        <div className="w-full">
          <FormError message={formError} />
        </div>
      ) : null}
      {invited ? (
        <p className="w-full text-sm text-green-700 dark:text-green-400">
          Convite enviado para {invited}.
        </p>
      ) : null}
    </form>
  );
}

export function MemberActions({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRoleChange(newRole: string) {
    if (newRole === role) return;
    startTransition(async () => {
      const result = await changeMemberRole(userId, { role: newRole as AssignableRole });
      if (result.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeMember(userId);
      if (result.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) => onRoleChange(e.target.value)}
        className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-zinc-900"
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {isSelf ? null : (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
        >
          Remover
        </button>
      )}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
