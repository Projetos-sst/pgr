"use client";

import type { ReactNode } from "react";

import { useCepLookup } from "@/shared/integrations/client/use-cep-lookup";

import { TextField } from "./form";

export type AddressValue = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export function emptyAddress(): AddressValue {
  return {
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  };
}

/** Aplica o endereço do ViaCEP preservando o que o usuário já digitou (número). */
function mergeCepResult(
  current: AddressValue,
  found: Omit<AddressValue, "number">,
): AddressValue {
  return {
    ...current,
    zipCode: found.zipCode || current.zipCode,
    street: found.street || current.street,
    complement: found.complement || current.complement,
    district: found.district || current.district,
    city: found.city || current.city,
    state: found.state || current.state,
  };
}

/**
 * Bloco de endereço compartilhado (empresa, unidade, funcionário) com autofill de
 * CEP embutido: no blur do campo CEP, consulta o ViaCEP e preenche rua/bairro/
 * cidade/UF. Falha é silenciosa — os campos seguem editáveis manualmente.
 */
export function AddressFields({
  value,
  onChange,
  errors = {},
  headerSlot,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  errors?: Record<string, string>;
  headerSlot?: ReactNode;
}) {
  const cep = useCepLookup((found) => onChange(mergeCepResult(value, found)));

  function setField(key: keyof AddressValue) {
    return (fieldValue: string) => onChange({ ...value, [key]: fieldValue });
  }

  return (
    <fieldset className="glass-panel rounded-card grid gap-4 p-4">
      <legend className="text-text-muted px-1 text-sm font-semibold">Endereço</legend>
      {headerSlot}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <TextField
            label="CEP"
            name="zipCode"
            value={value.zipCode}
            onChange={setField("zipCode")}
            onBlur={() => cep.lookup(value.zipCode)}
            error={errors.zipCode}
          />
          <CepStatus status={cep.status} />
        </div>
        <TextField
          label="Logradouro"
          name="street"
          value={value.street}
          onChange={setField("street")}
          error={errors.street}
        />
        <TextField
          label="Número"
          name="number"
          value={value.number}
          onChange={setField("number")}
          error={errors.number}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Complemento"
          name="complement"
          value={value.complement}
          onChange={setField("complement")}
          error={errors.complement}
        />
        <TextField
          label="Bairro"
          name="district"
          value={value.district}
          onChange={setField("district")}
          error={errors.district}
        />
        <TextField
          label="Cidade"
          name="city"
          value={value.city}
          onChange={setField("city")}
          error={errors.city}
        />
      </div>
      <TextField
        label="UF"
        name="state"
        value={value.state}
        onChange={setField("state")}
        error={errors.state}
      />
    </fieldset>
  );
}

function CepStatus({ status }: { status: "idle" | "loading" | "success" | "error" }) {
  if (status === "loading") {
    return <span className="text-text-subtle text-xs">Buscando…</span>;
  }
  if (status === "error") {
    return (
      <span className="text-xs text-amber-600">
        CEP não encontrado. Preencha manualmente.
      </span>
    );
  }
  return null;
}
