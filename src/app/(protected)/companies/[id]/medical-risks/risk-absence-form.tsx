"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { RISK_ABSENCE_JUSTIFICATION_MIN } from "@/shared/domains/medicine/risk-absence";
import { declareRiskAbsenceAction } from "@/shared/server/actions/medicine/risk-absence";

import { FormError, SelectField, SubmitButton, TextAreaField } from "../../../_ui/form";

type Option = { id: string; label: string };
type GroupOption = Option & { jobRoles: { id: string; title: string }[] };

/**
 * Declaração de inexistência de riscos (NOB-156, DT-12) pelo profissional autorizado: GES,
 * função (vazia = grupo todo), versão vigente da fonte e justificativa. A função é escolhida
 * entre as cadastradas e vinculadas ao GES, nunca digitada (NOB-112): texto livre com erro de
 * digitação era gravado e nunca valia no ASO. O servidor confere de novo a função, e recusa fonte
 * substituída e grupo/função com risco pendente ou validado.
 */
export function RiskAbsenceForm({
  companyId,
  sources,
  groups,
}: {
  companyId: string;
  sources: Option[];
  groups: GroupOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [gesId, setGesId] = useState("");
  const [jobRole, setJobRole] = useState("");
  const jobRoles = groups.find((g) => g.id === gesId)?.jobRoles ?? [];
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await declareRiskAbsenceAction(companyId, {
        sourceId: fd.get("sourceId") ?? "",
        gesId: fd.get("gesId") ?? "",
        jobRole,
        justification: fd.get("justification") ?? "",
      });
      if (result.ok) {
        setError(null);
        setFields({});
        setGesId("");
        setJobRole("");
        form.reset();
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.fields ? null : result.error.message);
      }
    });
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <SelectField
        label="Versão vigente da fonte"
        name="sourceId"
        required
        options={sources.map((s) => ({ value: s.id, label: s.label }))}
        emptyLabel="— selecione a fonte —"
        error={fields.sourceId}
      />
      <SelectField
        label="GES"
        name="gesId"
        required
        options={groups.map((g) => ({ value: g.id, label: g.label }))}
        emptyLabel="— selecione o GES —"
        error={fields.gesId}
        value={gesId}
        onChange={(value) => {
          setGesId(value);
          // Função de outro GES não vale: troca de GES limpa a escolha.
          setJobRole("");
        }}
      />
      <SelectField
        label="Função"
        name="jobRole"
        options={jobRoles.map((r) => ({ value: r.title, label: r.title }))}
        emptyLabel="Grupo todo (todas as funções do GES)"
        error={fields.jobRole}
        value={jobRole}
        onChange={setJobRole}
        disabled={!gesId}
      />
      {gesId && jobRoles.length === 0 ? (
        <p className="text-text-subtle text-xs">
          Este GES não tem funções vinculadas no cadastro: a declaração só pode ser para o
          grupo todo.
        </p>
      ) : null}
      <TextAreaField
        label="Justificativa técnica"
        name="justification"
        rows={3}
        required
        error={fields.justification}
      />
      <p className="text-text-subtle text-xs">
        A declaração fica em seu nome, com data, e não pode ser alterada. Vale só para
        esta versão da fonte; uma fonte nova exige nova declaração. Mínimo de{" "}
        {RISK_ABSENCE_JUSTIFICATION_MIN} caracteres na justificativa.
      </p>
      <SubmitButton pending={pending} label="Declarar inexistência de riscos" />
    </form>
  );
}
