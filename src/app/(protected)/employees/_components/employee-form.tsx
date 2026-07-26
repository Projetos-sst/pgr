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
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  FormSteps,
  SelectField,
  StepBackButton,
  StepNextButton,
  SubmitButton,
  TextField,
  type FormStep,
} from "../../_ui/form";
import { stepsWithError } from "../../_ui/form-steps";
import { AddressFields, type AddressValue } from "../../_ui/address-fields";

function addressFrom(source?: Employee | null): AddressValue {
  return {
    zipCode: source?.zipCode ?? "",
    street: source?.street ?? "",
    number: source?.number ?? "",
    complement: source?.complement ?? "",
    district: source?.district ?? "",
    city: source?.city ?? "",
    state: source?.state ?? "",
  };
}

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

const STEPS: FormStep[] = [
  { title: "Dados pessoais", hint: "Nome, CPF e contato" },
  { title: "Vínculo & função", hint: "Empresa, GES e função" },
  { title: "Documentos & crachá", hint: "RG, crachá e foto" },
  { title: "Endereço", hint: "CEP e logradouro" },
];

/** Campos de cada etapa — usado para abrir a etapa do primeiro erro do servidor. */
const STEP_FIELDS: readonly (readonly string[])[] = [
  ["fullName", "cpf", "birthDate", "phone", "email", "sex", "maritalStatus"],
  [
    "companyId",
    "gesId",
    "jobRoleId",
    "registration",
    "admissionDate",
    "dismissalDate",
    "status",
  ],
  ["rg", "badgeNumber", "badgeValidUntil", "bloodType", "photoPath"],
  ["zipCode", "street", "number", "complement", "district", "city", "state"],
];

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
  const [address, setAddress] = useState<AddressValue>(addressFrom(employee));
  const [step, setStep] = useState(0);

  const isLastStep = step === STEPS.length - 1;

  function goToStep(next: number) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
    // Enter em um campo submete o form nativo — nas etapas iniciais isso avança.
    if (!isLastStep) {
      goToStep(step + 1);
      return;
    }
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
      ...address,
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
      const fields = result.error.fields ?? {};
      setErrors(fields);
      setFormError(result.error.fields ? null : result.error.message);
      const [firstInvalid] = stepsWithError(STEP_FIELDS, fields);
      if (firstInvalid !== undefined) goToStep(firstInvalid);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormSteps
        steps={STEPS}
        current={step}
        onSelect={goToStep}
        invalidSteps={stepsWithError(STEP_FIELDS, errors)}
      />

      <FormError message={formError} />

      <FormSection title="Dados pessoais" hidden={step !== 0}>
        <TextField
          label="Nome completo"
          name="fullName"
          required
          isFullWidth
          placeholder="Ex.: João Ferreira da Silva"
          defaultValue={employee?.fullName}
          error={errors.fullName}
        />
        <TextField
          label="CPF"
          name="cpf"
          required
          isMono
          placeholder="000.000.000-00"
          defaultValue={employee?.cpf}
          error={errors.cpf}
        />
        <TextField
          label="Data de nascimento"
          name="birthDate"
          type="date"
          defaultValue={employee?.birthDate}
        />
        <TextField
          label="Telefone"
          name="phone"
          placeholder="(00) 00000-0000"
          defaultValue={employee?.phone}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          placeholder="nome@empresa.com"
          defaultValue={employee?.email}
        />
        <SelectField
          label="Sexo"
          name="sex"
          defaultValue={employee?.sex}
          options={SEX_OPTIONS}
          emptyLabel="— não informado —"
        />
        <SelectField
          label="Estado civil"
          name="maritalStatus"
          defaultValue={employee?.maritalStatus}
          options={MARITAL_OPTIONS}
          emptyLabel="— não informado —"
        />
      </FormSection>

      <FormSection title="Vínculo & função" hidden={step !== 1}>
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
          emptyLabel={
            gesId && functionOptions.length === 0 ? "GES sem funções" : "— sem função —"
          }
          error={errors.jobRoleId}
        />
        <TextField
          label="Matrícula"
          name="registration"
          isMono
          placeholder="Ex.: 004821"
          defaultValue={employee?.registration}
        />
        <TextField
          label="Data de admissão"
          name="admissionDate"
          type="date"
          defaultValue={employee?.admissionDate}
        />
        <TextField
          label="Data de desligamento"
          name="dismissalDate"
          type="date"
          defaultValue={employee?.dismissalDate}
        />
        <SelectField
          label="Situação"
          name="status"
          defaultValue={employee?.status ?? "active"}
          options={STATUS_OPTIONS}
          error={errors.status}
        />
      </FormSection>

      <FormSection title="Documentos & crachá" columns={3} hidden={step !== 2}>
        <TextField label="RG" name="rg" isMono defaultValue={employee?.rg} />
        <TextField
          label="Crachá"
          name="badgeNumber"
          isMono
          defaultValue={employee?.badgeNumber}
        />
        <TextField
          label="Validade do crachá"
          name="badgeValidUntil"
          type="date"
          defaultValue={employee?.badgeValidUntil}
        />
        <TextField
          label="Tipo sanguíneo"
          name="bloodType"
          placeholder="Ex.: O+"
          defaultValue={employee?.bloodType}
        />
        <TextField
          label="Foto (caminho)"
          name="photoPath"
          defaultValue={employee?.photoPath}
        />
      </FormSection>

      <AddressFields
        value={address}
        onChange={setAddress}
        errors={errors}
        hidden={step !== 3}
      />

      <FieldError message={errors._} />
      <FormActions>
        {step === 0 ? (
          <CancelLink href={employee ? `/employees/${employee.id}` : "/employees"} />
        ) : (
          <StepBackButton onClick={() => goToStep(step - 1)} />
        )}
        {isLastStep ? (
          <SubmitButton
            pending={pending}
            label={employee ? "Salvar alterações" : "Salvar funcionário"}
          />
        ) : (
          <StepNextButton onClick={() => goToStep(step + 1)} />
        )}
      </FormActions>
    </form>
  );
}
