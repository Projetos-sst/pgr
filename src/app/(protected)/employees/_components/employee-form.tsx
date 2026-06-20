"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import {
  createEmployeeAction,
  updateEmployeeAction,
  listGesFunctionsAction,
} from "@/shared/server/actions/pgr/employees";
import { listGesAction } from "@/shared/server/actions/pgr/ges";
import type { EmployeeInput, Employee } from "@/shared/domains/pgr/employees";
import type { JobRoleOption } from "@/shared/domains/pgr/ges";
import type { CompanyOption } from "@/shared/domains/pgr/companies";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const SEX_OPTIONS = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "not_informed", label: "Não informado" },
];
const MARITAL_OPTIONS = [
  { value: "single", label: "Solteiro(a)" },
  { value: "married", label: "Casado(a)" },
  { value: "divorced", label: "Divorciado(a)" },
  { value: "widowed", label: "Viúvo(a)" },
  { value: "stable_union", label: "União estável" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "on_leave", label: "Afastado" },
  { value: "dismissed", label: "Desligado" },
];

type Option = { id: string; name: string };

export function EmployeeForm({
  companies,
  employee,
}: {
  companies: CompanyOption[];
  employee?: Employee;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [companyId, setCompanyId] = useState(employee?.companyId ?? "");
  const [gesId, setGesId] = useState(employee?.gesId ?? "");
  const [jobRoleId, setJobRoleId] = useState(employee?.jobRoleId ?? "");
  const [gesOptions, setGesOptions] = useState<Option[]>([]);
  const [functionOptions, setFunctionOptions] = useState<JobRoleOption[]>([]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      const result = await listGesAction({ companyId, pageSize: 100 });
      if (!active) return;
      setGesOptions(
        result.ok ? result.data.rows.map((g) => ({ id: g.id, name: g.name })) : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!gesId) return;
    let active = true;
    (async () => {
      const result = await listGesFunctionsAction(gesId);
      if (!active) return;
      setFunctionOptions(result.ok ? result.data : []);
    })();
    return () => {
      active = false;
    };
  }, [gesId]);

  function selectCompany(value: string) {
    setCompanyId(value);
    setGesId("");
    setJobRoleId("");
    setGesOptions([]);
    setFunctionOptions([]);
  }

  function selectGes(value: string) {
    setGesId(value);
    setJobRoleId("");
    setFunctionOptions([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: EmployeeInput = {
      companyId,
      gesId,
      jobRoleId,
      fullName: value("fullName"),
      cpf: value("cpf"),
      birthDate: value("birthDate"),
      sex: value("sex"),
      maritalStatus: value("maritalStatus"),
      status: value("status"),
      phone: value("phone"),
      email: value("email"),
      rg: value("rg"),
      badgeNumber: value("badgeNumber"),
      badgeValidUntil: value("badgeValidUntil"),
      registration: value("registration"),
      bloodType: value("bloodType"),
      admissionDate: value("admissionDate"),
      dismissalDate: value("dismissalDate"),
      zipCode: value("zipCode"),
      street: value("street"),
      number: value("number"),
      complement: value("complement"),
      district: value("district"),
      city: value("city"),
      state: value("state"),
      photoPath: value("photoPath"),
    };

    startTransition(async () => {
      const result = employee
        ? await updateEmployeeAction(employee.id, input)
        : await createEmployeeAction(input);
      if (result.ok) {
        router.push("/employees");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-6">
      <FormError message={formError} />

      <fieldset className="grid gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Geral</legend>
        <TextField label="Nome completo" name="fullName" required defaultValue={employee?.fullName} error={errors.fullName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="CPF" name="cpf" required defaultValue={employee?.cpf} error={errors.cpf} />
          <SelectField label="Status" name="status" defaultValue={employee?.status ?? "active"} options={STATUS_OPTIONS} error={errors.status} />
        </div>
        <SelectField
          label="Empresa"
          name="companyId"
          required
          value={companyId}
          onChange={selectCompany}
          options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
          error={errors.companyId}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="GES"
            name="gesId"
            value={gesId}
            onChange={selectGes}
            options={gesOptions.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel="— sem GES —"
            error={errors.gesId}
          />
          <SelectField
            label="Função (do GES)"
            name="jobRoleId"
            value={jobRoleId}
            onChange={setJobRoleId}
            options={functionOptions.map((f) => ({ value: f.jobRoleId, label: f.title }))}
            emptyLabel={gesId && functionOptions.length === 0 ? "GES sem funções" : "— sem função —"}
            error={errors.jobRoleId}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Data de nascimento" name="birthDate" type="date" defaultValue={employee?.birthDate} />
          <SelectField label="Sexo" name="sex" defaultValue={employee?.sex} options={SEX_OPTIONS} emptyLabel="— não informado —" />
          <SelectField label="Estado civil" name="maritalStatus" defaultValue={employee?.maritalStatus} options={MARITAL_OPTIONS} emptyLabel="— não informado —" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Admissão" name="admissionDate" type="date" defaultValue={employee?.admissionDate} />
          <TextField label="Desligamento" name="dismissalDate" type="date" defaultValue={employee?.dismissalDate} />
          <TextField label="Matrícula" name="registration" defaultValue={employee?.registration} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Endereço e contato</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Telefone" name="phone" defaultValue={employee?.phone} />
          <TextField label="E-mail" name="email" defaultValue={employee?.email} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="RG" name="rg" defaultValue={employee?.rg} />
          <TextField label="Crachá" name="badgeNumber" defaultValue={employee?.badgeNumber} />
          <TextField label="Validade do crachá" name="badgeValidUntil" type="date" defaultValue={employee?.badgeValidUntil} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Tipo sanguíneo" name="bloodType" defaultValue={employee?.bloodType} />
          <TextField label="CEP" name="zipCode" defaultValue={employee?.zipCode} />
          <TextField label="Logradouro" name="street" defaultValue={employee?.street} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Número" name="number" defaultValue={employee?.number} />
          <TextField label="Complemento" name="complement" defaultValue={employee?.complement} />
          <TextField label="Bairro" name="district" defaultValue={employee?.district} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Cidade" name="city" defaultValue={employee?.city} />
          <TextField label="UF" name="state" defaultValue={employee?.state} />
        </div>
        <TextField label="Foto (caminho)" name="photoPath" defaultValue={employee?.photoPath} />
      </fieldset>

      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton pending={pending} label={employee ? "Salvar alterações" : "Criar funcionário"} />
      </FormActions>
    </form>
  );
}
