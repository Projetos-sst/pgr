"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { createPgrAction, updatePgrAction } from "@/shared/server/actions/pgr/pgr";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import type { Pgr, PgrInput } from "@/shared/domains/pgr/pgr";
import type { CompanyOption } from "@/shared/domains/pgr/companies";
import type { ActionError } from "@/shared/server/result";

import {
  FieldError,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";
import { DeclarationModal } from "./declaration-modal";

const REGISTRATION_OPTIONS = [
  { value: "crm", label: "CRM (Medicina do Trabalho)" },
  { value: "crea", label: "CREA (Engenharia de Segurança)" },
  { value: "mte", label: "MTE (Técnico de Segurança)" },
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
        router.push(`/pgr/${pgr!.id}`);
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
        router.push(`/pgr/${result.data.id}`);
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

  const cancelHref = pgr ? `/pgr/${pgr.id}` : "/pgr";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormError message={formError} />

      {/* Seção 1: Empresa & Obra */}
      <div className="glass-panel flex flex-col gap-4 rounded-[16px] p-5">
        <h3 className="text-text border-b border-black/5 pb-2 text-sm font-bold">
          1. Empresa e Unidade de Trabalho
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Empresa *"
            name="companyId"
            required
            value={companyId}
            onChange={selectCompany}
            options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
            error={errors.companyId}
          />
          <SelectField
            label="Obra / Unidade de Trabalho"
            name="workUnitId"
            value={workUnitId}
            onChange={setWorkUnitId}
            options={workUnitOptions.map((w) => ({ value: w.id, label: w.name }))}
            emptyLabel={
              companyId && workUnitOptions.length === 0
                ? "Empresa sem obras cadastradas"
                : "— Sem obra específica —"
            }
            error={errors.workUnitId}
          />
        </div>
      </div>

      {/* Seção 2: Responsável Técnico */}
      <div className="glass-panel flex flex-col gap-4 rounded-[16px] p-5">
        <h3 className="text-text border-b border-black/5 pb-2 text-sm font-bold">
          2. Responsável Técnico pela Elaboração
        </h3>
        <TextField
          label="Nome completo do responsável"
          name="responsible"
          defaultValue={pgr?.responsible}
          error={errors.responsible}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Tipo de registro profissional *"
            name="registrationType"
            required
            defaultValue={pgr?.registrationType ?? "not_applicable"}
            options={REGISTRATION_OPTIONS}
            error={errors.registrationType}
          />
          <TextField
            label="Número do registro"
            name="registrationNumber"
            defaultValue={pgr?.registrationNumber}
            error={errors.registrationNumber}
          />
        </div>
      </div>

      {/* Seção 3: Vigência do PGR */}
      <div className="glass-panel flex flex-col gap-4 rounded-[16px] p-5">
        <h3 className="text-text border-b border-black/5 pb-2 text-sm font-bold">
          3. Datas de Vigência do Documento
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Data de emissão *"
            name="issuedAt"
            type="date"
            required
            defaultValue={pgr?.issuedAt}
            error={errors.issuedAt}
          />
          <TextField
            label="Data de validade *"
            name="validUntil"
            type="date"
            required
            defaultValue={pgr?.validUntil}
            error={errors.validUntil}
          />
        </div>
      </div>

      <FieldError message={errors._} />

      {/* Ações do Formulário */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <Link
          href={cancelHref}
          className="glass-panel text-text-muted hover:text-text rounded-card px-5 py-2.5 text-xs font-bold transition-colors sm:text-sm"
        >
          Cancelar
        </Link>
        <SubmitButton pending={pending} label={pgr ? "Salvar alterações" : "Criar PGR"} />
      </div>

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
