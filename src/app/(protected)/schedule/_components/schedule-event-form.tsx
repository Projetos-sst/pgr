"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  SCHEDULE_EVENT_TYPE_LABELS,
  type ScheduleEventType,
} from "@/shared/domains/platform/scheduling";
import {
  createScheduleEventAction,
  updateScheduleEventAction,
} from "@/shared/server/actions/platform/scheduling";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const TYPE_OPTIONS = Object.entries(SCHEDULE_EVENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export type ScheduleEventFormInitial = {
  eventType: string;
  title: string;
  eventDate: string;
  description: string | null;
  referenceUrl: string | null;
};

export function ScheduleEventForm({
  id,
  initial,
}: {
  id?: string;
  initial?: ScheduleEventFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      eventType: (fd.get("eventType") as ScheduleEventType) ?? "inspection",
      title: (fd.get("title") as string) ?? "",
      eventDate: (fd.get("eventDate") as string) ?? "",
      description: (fd.get("description") as string) ?? "",
      referenceUrl: (fd.get("referenceUrl") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateScheduleEventAction(id, input)
        : await createScheduleEventAction(input);
      if (result.ok) {
        setErrors({});
        setFormError(null);
        router.push("/schedule");
        router.refresh();
      } else {
        setErrors(result.error.fields ?? {});
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <FormError message={formError} />
      <SelectField
        label="Tipo"
        name="eventType"
        required
        defaultValue={initial?.eventType ?? "inspection"}
        options={TYPE_OPTIONS}
        error={errors.eventType}
      />
      <TextField
        label="Título"
        name="title"
        required
        defaultValue={initial?.title}
        error={errors.title}
      />
      <TextField
        label="Data"
        name="eventDate"
        type="date"
        required
        defaultValue={initial?.eventDate}
        error={errors.eventDate}
      />
      <TextField
        label="Descrição"
        name="description"
        defaultValue={initial?.description}
        error={errors.description}
      />
      <TextField
        label="Link de referência"
        name="referenceUrl"
        defaultValue={initial?.referenceUrl}
        error={errors.referenceUrl}
      />
      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Criar evento"} />
      </FormActions>
    </form>
  );
}
