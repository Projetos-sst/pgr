"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { createPgrAction, updatePgrAction } from "@/shared/server/actions/pgr/pgr";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import type { Pgr, PgrInput } from "@/shared/domains/pgr/pgr";
import type { CompanyOption } from "@/shared/domains/pgr/companies";
import type { ActionError } from "@/shared/server/result";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";
import { DeclarationModal } from "./declaration-modal";

const REGISTRATION_OPTIONS = [
  { value: "crm", label: "CRM" },
  { value: "crea", label: "CREA" },
  { value: "mte", label: "MTE" },
  { value: "not_applicable", label: "Não aplicável" },
];

type WorkUnitOption = { id: string; name: string };

export function PgrForm({ companies, pgr }: { companies: CompanyOption[]; pgr?: Pgr }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [companyId, setCompanyId] = useState(pgr?.companyId ?? "");
  const [workUnitId, setWorkUnitId] = useState(pgr?.workUnitId ?? "");
  const [workUnitOptions, setWorkUnitOptions] = useState<WorkUnitOption[]>([]);

  const [showDeclaration, setShowDeclaration] = useState(false);
  const [pendingInput, setPendingInput] = useState<PgrInput | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      const result = await listWorkUnitsAction({ companyId, pageSize: 100 });
      if (!active) return;
      setWorkUnitOptions(
        result.ok ? result.data.rows.map((w) => ({ id: w.id, name: w.name })) : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  function selectCompany(value: string) {
    setCompanyId(value);
    setWorkUnitId("");
    setWorkUnitOptions([]);
  }

  function buildInput(formEl: HTMLFormElement): PgrInput {
    const fd = new FormData(formEl);
    const value = (key: string) => String(fd.get(key) ?? "");
    return {
      companyId,
      workUnitId,
      responsible: value("responsible"),
      registrationType: value("registrationType") as PgrInput["registrationType"],
      registrationNumber: value("registrationNumber"),
      issuedAt: value("issuedAt"),
      validUntil: value("validUntil"),
    };
  }

  function applyError(error: ActionError) {
    setErrors(error.fields ?? {});
    setFormError(error.fields ? null : error.message);
  }

  function runUpdate(input: PgrInput) {
    startTransition(async () => {
      const result = await updatePgrAction(pgr!.id, input);
      if (result.ok) {
        router.push("/pgr");
        router.refresh();
        return;
      }
      applyError(result.error);
    });
  }

  function runCreate(input: PgrInput) {
    startTransition(async () => {
      const result = await createPgrAction({ ...input, declarationAccepted: true });
      if (result.ok) {
        router.push("/pgr");
        router.refresh();
        return;
      }
      setShowDeclaration(false);
      applyError(result.error);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = buildInput(event.currentTarget);
    if (pgr) {
      runUpdate(input);
      return;
    }
    setPendingInput(input);
    setShowDeclaration(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />

      <SelectField
        label="Empresa"
        name="companyId"
        required
        value={companyId}
        onChange={selectCompany}
        options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
        error={errors.companyId}
      />
      <SelectField
        label="Obra/Contrato"
        name="workUnitId"
        value={workUnitId}
        onChange={setWorkUnitId}
        options={workUnitOptions.map((w) => ({ value: w.id, label: w.name }))}
        emptyLabel={
          companyId && workUnitOptions.length === 0 ? "Empresa sem obras" : "— sem obra —"
        }
        error={errors.workUnitId}
      />
      <TextField
        label="Responsável pela elaboração"
        name="responsible"
        defaultValue={pgr?.responsible}
        error={errors.responsible}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo de registro"
          name="registrationType"
          required
          defaultValue={pgr?.registrationType ?? "not_applicable"}
          options={REGISTRATION_OPTIONS}
          error={errors.registrationType}
        />
        <TextField
          label="Nº do registro"
          name="registrationNumber"
          defaultValue={pgr?.registrationNumber}
          error={errors.registrationNumber}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Data de emissão"
          name="issuedAt"
          type="date"
          required
          defaultValue={pgr?.issuedAt}
          error={errors.issuedAt}
        />
        <TextField
          label="Data de validade"
          name="validUntil"
          type="date"
          required
          defaultValue={pgr?.validUntil}
          error={errors.validUntil}
        />
      </div>

      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton pending={pending} label={pgr ? "Salvar alterações" : "Criar PGR"} />
      </FormActions>

      {!pgr ? (
        <DeclarationModal
          open={showDeclaration}
          pending={pending}
          onCancel={() => setShowDeclaration(false)}
          onConfirm={() => {
            if (pendingInput) runCreate(pendingInput);
          }}
        />
      ) : null}
    </form>
  );
}
