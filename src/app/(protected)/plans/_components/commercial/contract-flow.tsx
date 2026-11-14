"use client";

import { useState } from "react";

import { contractCompaniesProblem } from "@/shared/domains/commercial/contract";
import type { PlansOverview } from "@/shared/server/commercial/plans-overview-core";

import { Button } from "../../../_ui/button";
import { CheckboxGroupField } from "../../../_ui/checkbox-group";
import { FormError, SelectField } from "../../../_ui/form";
import { PERIOD_LABEL, SERVICE_LABEL, UNIT_LABEL, formatBrl } from "./format";
import type { OfferView } from "./offer-card";
import { useContractAttempt } from "./use-contract-attempt";

type Customer = PlansOverview["customers"][number];
type Company = PlansOverview["companies"][number];

function eligibleCustomers(offer: OfferView, customers: readonly Customer[]) {
  if (offer.scope === "organization")
    return customers.filter((customer) => customer.kind === "office");
  return customers;
}

function chosenCompanyIds(
  offer: OfferView,
  customer: Customer | undefined,
  picked: readonly string[],
): string[] {
  if (offer.scope === "organization") return [];
  if (customer?.kind === "company")
    return customer.companyId === null ? [] : [customer.companyId];
  return [...picked];
}

function problemOf(
  offer: OfferView,
  customer: Customer | undefined,
  companyIds: readonly string[],
): string | null {
  if (!customer) return "Escolha o cliente pagador.";
  return contractCompaniesProblem({
    customerKind: customer.kind,
    customerCompanyId: customer.companyId,
    offerScope: offer.scope,
    companyIds,
  });
}

function Summary({
  offer,
  payer,
  companyNames,
}: {
  offer: OfferView;
  payer: string;
  companyNames: readonly string[];
}) {
  return (
    <section aria-label="Resumo da contratação" className="flex flex-col gap-2 text-xs">
      <h4 className="text-primary font-mono text-[11px] tracking-[0.14em] uppercase">
        Resumo da contratação
      </h4>
      <p>
        {offer.name} — cobrança {PERIOD_LABEL[offer.billingPeriod]}
      </p>
      <p>Pagador: {payer}</p>
      {companyNames.length > 0 ? <p>Empresas: {companyNames.join(", ")}</p> : null}
      <ul aria-label="Itens da contratação" className="flex flex-col gap-1">
        {offer.items.map((item) => (
          <li key={item.label}>
            {SERVICE_LABEL[item.service]} · {item.label} —{" "}
            {formatBrl(item.unitAmountCents)} {UNIT_LABEL[item.unit]}
          </li>
        ))}
      </ul>
      <p className="text-text-muted">
        O total cobrado é calculado pelo servidor ao abrir o pagamento.
      </p>
    </section>
  );
}

export function ContractFlow({
  offer,
  customers,
  companies,
  termStart,
}: {
  offer: OfferView;
  customers: readonly Customer[];
  companies: readonly Company[];
  termStart: string;
}) {
  const options = eligibleCustomers(offer, customers);
  const [customerId, setCustomerId] = useState(options.length === 1 ? options[0].id : "");
  const [picked, setPicked] = useState<string[]>([]);
  const attempt = useContractAttempt();
  const customer = options.find((candidate) => candidate.id === customerId);
  const companyIds = chosenCompanyIds(offer, customer, picked);
  const problem = problemOf(offer, customer, companyIds);
  const asksCompanies = offer.scope === "company" && customer?.kind !== "company";

  const changeCustomer = (value: string) => {
    attempt.reset();
    setCustomerId(value);
  };
  const changeCompanies = (values: string[]) => {
    attempt.reset();
    setPicked(values);
  };
  const confirm = () =>
    attempt.submit({
      customerId,
      offerVersionId: offer.id,
      companyIds,
      termStart,
      termEnd: null,
    });

  if (options.length === 0)
    return (
      <FormError message="Esta oferta é por escritório e exige a consultoria como cliente pagador. Cadastre a consultoria antes de contratar." />
    );

  return (
    <div className="glass-card flex flex-col gap-4 p-6">
      <h3 className="text-text text-base font-extrabold">Contratar {offer.name}</h3>
      <SelectField
        label="Cliente pagador"
        name="customerId"
        value={customerId}
        onChange={changeCustomer}
        options={options.map((option) => ({ value: option.id, label: option.legalName }))}
        disabled={attempt.pending}
      />
      {asksCompanies ? (
        <CheckboxGroupField
          legend="Empresas que vão usar o serviço"
          name="companyIds"
          values={picked}
          onChange={changeCompanies}
          disabled={attempt.pending}
          options={companies.map((company) => ({
            value: company.id,
            label: company.name,
          }))}
        />
      ) : null}
      <Summary
        offer={offer}
        payer={customer?.legalName ?? "—"}
        companyNames={companies
          .filter((company) => companyIds.includes(company.id))
          .map((company) => company.name)}
      />
      <FormError message={attempt.error} />
      <Button
        label={attempt.error ? "Tentar novamente" : "Confirmar e ir ao pagamento"}
        pendingLabel="Abrindo pagamento…"
        pending={attempt.pending}
        disabled={problem !== null}
        onClick={confirm}
      />
    </div>
  );
}
