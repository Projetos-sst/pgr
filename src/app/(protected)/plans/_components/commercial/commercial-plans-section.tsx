"use client";

import Link from "next/link";
import { useState } from "react";

import type { PlansOverview } from "@/shared/server/commercial/plans-overview-core";

import { FormError } from "../../../_ui/form";
import { CheckoutReturnNotice } from "./checkout-return-notice";
import { ContractFlow } from "./contract-flow";
import type { CheckoutReturn } from "./format";
import { OfferCard, type ActiveTrial, type OfferView } from "./offer-card";
import { ResumePayment } from "./resume-payment";

const NO_PAYER_MESSAGE =
  "Nenhum cliente pagador cadastrado. Cadastre a consultoria ou a empresa pagadora antes de contratar.";
const EMPTY_MESSAGE = "Nenhuma oferta publicada no momento.";

function isCurrentOffer(overview: PlansOverview, offer: OfferView): boolean {
  return overview.contracts.some(
    (contract) => contract.offerCode === offer.code && contract.payment === "released",
  );
}

function trialsFor(overview: PlansOverview, offer: OfferView): ActiveTrial[] {
  if (!offer.items.some((item) => item.service === "pgr")) return [];
  return overview.trials
    .filter((trial) => trial.status === "active")
    .flatMap((trial) => {
      const company = overview.companies.find(
        (candidate) => candidate.id === trial.companyId,
      );
      return company ? [{ companyName: company.name, endsOn: trial.endsAt }] : [];
    });
}

function Offers({
  overview,
  selectedId,
  onChoose,
}: {
  overview: PlansOverview;
  selectedId: string;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {overview.offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          isCurrent={isCurrentOffer(overview, offer)}
          trials={trialsFor(overview, offer)}
          canChoose={overview.canContract}
          isSelected={selectedId === offer.id}
          onChoose={() => onChoose(offer.id)}
        />
      ))}
    </div>
  );
}

function Contracting({
  overview,
  offer,
}: {
  overview: PlansOverview;
  offer: OfferView | undefined;
}) {
  if (!overview.canContract) return null;
  if (overview.customers.length === 0) return <FormError message={NO_PAYER_MESSAGE} />;
  if (!offer) return null;
  return (
    <ContractFlow
      key={offer.id}
      offer={offer}
      customers={overview.customers}
      companies={overview.companies}
      termStart={overview.termStart}
    />
  );
}

function OwnerLinks({ canContract }: { canContract: boolean }) {
  if (!canContract) return null;
  return (
    <nav
      aria-label="Assinatura e faturas"
      className="flex flex-wrap gap-4 text-sm font-bold"
    >
      <Link href="/plans/subscription">Minha assinatura</Link>
      <Link href="/plans/invoices">Faturas</Link>
    </nav>
  );
}

export function CommercialPlansSection({
  overview,
  checkoutReturn,
}: {
  overview: PlansOverview;
  checkoutReturn: CheckoutReturn | null;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = overview.offers.find((offer) => offer.id === selectedId);
  return (
    <section aria-labelledby="commercial-plans-title" className="flex flex-col gap-5">
      <h2 id="commercial-plans-title" className="text-text text-2xl font-black">
        Contratação por empresa
      </h2>
      <OwnerLinks canContract={overview.canContract} />
      <CheckoutReturnNotice kind={checkoutReturn} contracts={overview.contracts} />
      {overview.readOnlyMessage ? (
        <p role="status" className="glass-card rounded-[16px] p-4 text-sm font-semibold">
          {overview.readOnlyMessage}
        </p>
      ) : null}
      {overview.offers.length === 0 ? (
        <p role="status" className="text-text-muted text-sm">
          {EMPTY_MESSAGE}
        </p>
      ) : (
        <Offers overview={overview} selectedId={selectedId} onChoose={setSelectedId} />
      )}
      <Contracting overview={overview} offer={selected} />
      <ResumePayment contracts={overview.contracts} />
    </section>
  );
}
