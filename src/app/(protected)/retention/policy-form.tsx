"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  RETENTION_CATEGORIES,
  RETENTION_CATEGORY_CATALOG,
  RETENTION_STARTING_POINTS,
  RETENTION_STARTING_POINT_LABELS,
  type RetentionTerms,
} from "@/shared/domains/retention/policy";
import { recordRetentionPolicyVersionAction } from "@/shared/server/actions/retention/retention";

import {
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../_ui/form";

const STATUS_OPTIONS = [
  { value: "proposed", label: "Proposta (ainda sem aprovação)" },
  { value: "approved", label: "Aprovada pelo responsável" },
];
const STARTING_POINT_OPTIONS = RETENTION_STARTING_POINTS.map((value) => ({
  value,
  label: RETENTION_STARTING_POINT_LABELS[value],
}));

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

function termsOf(form: FormData) {
  return {
    categories: RETENTION_CATEGORIES.map((category) => ({
      category,
      retentionMonths: text(form, `months.${category}`),
      startingPoint: text(form, `start.${category}`),
    })),
    noticeDaysBefore: text(form, "noticeDays")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value !== ""),
    postClosureAccess: text(form, "postClosureAccess"),
    discardAuthorization: text(form, "discardAuthorization"),
  };
}

function versionOf(form: FormData, status: string) {
  const terms = termsOf(form);
  if (status !== "approved") return { status, terms };
  return {
    status,
    terms,
    approval: {
      approverName: text(form, "approverName"),
      approverRole: text(form, "approverRole"),
      approvedOn: text(form, "approvedOn"),
      reference: text(form, "reference"),
    },
  };
}

export function RetentionPolicyForm({ terms }: { terms: RetentionTerms }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("proposed");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    start(async () => {
      const result = await recordRetentionPolicyVersionAction(versionOf(form, status));
      setError(result.ok ? null : result.error.message);
      setSaved(result.ok ? `Versão ${result.data.version} registrada.` : null);
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
      <FormSection
        title="Prazo e marco inicial por categoria"
        description="Os prazos vêm desta política. Nenhum prazo dispara exclusão: o sistema só calcula datas."
      >
        {terms.categories.map((row) => {
          const label = RETENTION_CATEGORY_CATALOG[row.category].label;
          return [
            <TextField
              key={`months.${row.category}`}
              name={`months.${row.category}`}
              label={`${label}: prazo de guarda (meses)`}
              type="number"
              defaultValue={String(row.retentionMonths)}
              required
            />,
            <SelectField
              key={`start.${row.category}`}
              name={`start.${row.category}`}
              label={`${label}: marco inicial`}
              defaultValue={row.startingPoint}
              options={STARTING_POINT_OPTIONS}
              required
            />,
          ];
        })}
      </FormSection>
      <FormSection title="Avisos, acesso e descarte" columns={1}>
        <TextField
          name="noticeDays"
          label="Avisos antes do fim do prazo (dias, separados por vírgula)"
          defaultValue={terms.noticeDaysBefore.join(", ")}
          required
        />
        <TextAreaField
          name="postClosureAccess"
          label="Acesso após o encerramento"
          defaultValue={terms.postClosureAccess}
          required
        />
        <TextAreaField
          name="discardAuthorization"
          label="Quem autoriza o descarte"
          defaultValue={terms.discardAuthorization}
          required
        />
      </FormSection>
      <FormSection
        title="Aprovação"
        description="Sem versão aprovada, a política vale como proposta e todo descarte fica bloqueado."
      >
        <SelectField
          name="status"
          label="Situação desta versão"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          required
          isFullWidth
        />
        {status === "approved" ? (
          <>
            <TextField name="approverName" label="Quem aprovou" required />
            <TextField name="approverRole" label="Cargo de quem aprovou" required />
            <TextField name="approvedOn" label="Data da aprovação" type="date" required />
            <TextField
              name="reference"
              label="Onde a aprovação está registrada"
              required
            />
          </>
        ) : null}
      </FormSection>
      <SubmitButton pending={pending} label="Registrar versão da política" />
    </form>
  );
}
