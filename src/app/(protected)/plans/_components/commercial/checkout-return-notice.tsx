import type { PlansOverview } from "@/shared/server/commercial/plans-overview-core";

import { StatusBadge, type StatusTone } from "../../../_ui/status-badge";
import {
  CANCELLED_NOTICE,
  PAYMENT_LABEL,
  PROCESSING_NOTICE,
  type CheckoutReturn,
} from "./format";

const PAYMENT_TONE: Record<PlansOverview["contracts"][number]["payment"], StatusTone> = {
  released: "green",
  processing: "amber",
  pending: "neutral",
};

function ContractStatuses({ contracts }: { contracts: PlansOverview["contracts"] }) {
  if (contracts.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {contracts.map((contract) => (
        <li key={contract.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold">{contract.offerName}</span>
          <StatusBadge
            tone={PAYMENT_TONE[contract.payment]}
            label={PAYMENT_LABEL[contract.payment]}
          />
        </li>
      ))}
    </ul>
  );
}

export function CheckoutReturnNotice({
  kind,
  contracts,
}: {
  kind: CheckoutReturn | null;
  contracts: PlansOverview["contracts"];
}) {
  return (
    <div role="status" aria-live="polite">
      {kind === "success" ? (
        <div className="glass-card rounded-[16px] p-4 text-sm font-semibold">
          <p>{PROCESSING_NOTICE}</p>
          <ContractStatuses contracts={contracts} />
        </div>
      ) : null}
      {kind === "cancelled" ? (
        <p className="glass-card rounded-[16px] p-4 text-sm font-semibold">
          {CANCELLED_NOTICE}
        </p>
      ) : null}
    </div>
  );
}
