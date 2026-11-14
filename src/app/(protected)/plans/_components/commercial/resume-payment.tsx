"use client";

import type { PlansOverview } from "@/shared/server/commercial/plans-overview-core";

import { Button } from "../../../_ui/button";
import { FormError } from "../../../_ui/form";
import { StatusBadge } from "../../../_ui/status-badge";
import { PAYMENT_LABEL, formatCivilDate } from "./format";
import { useContractAttempt } from "./use-contract-attempt";

type Contract = PlansOverview["contracts"][number];

function ResumeRow({ contract }: { contract: Contract }) {
  const attempt = useContractAttempt(contract.id);
  return (
    <li className="glass-card flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold">{contract.offerName}</span>
        <span className="text-text-muted">
          desde {formatCivilDate(contract.termStart)}
        </span>
        <StatusBadge tone="amber" label={PAYMENT_LABEL[contract.payment]} />
      </div>
      <FormError message={attempt.error} />
      <Button
        label="Retomar pagamento"
        pendingLabel="Abrindo pagamento…"
        pending={attempt.pending}
        onClick={() => attempt.submit(null)}
      />
    </li>
  );
}

export function ResumePayment({ contracts }: { contracts: readonly Contract[] }) {
  const unpaid = contracts.filter((contract) => contract.payment === "pending");
  if (unpaid.length === 0) return null;
  return (
    <section
      aria-label="Contratações aguardando pagamento"
      className="flex flex-col gap-3"
    >
      <h3 className="text-text text-base font-extrabold">
        Contratações aguardando pagamento
      </h3>
      <ul className="grid gap-3 md:grid-cols-2">
        {unpaid.map((contract) => (
          <ResumeRow key={contract.id} contract={contract} />
        ))}
      </ul>
    </section>
  );
}
