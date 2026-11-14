import {
  registerCommercialContractAction,
  startCommercialCheckoutAction,
} from "@/shared/server/actions/commercial/commercial";

import { messageFor } from "./format";
import { redirectTo } from "./redirect";

export type Attempt = { key: string; contractId: string | null };

export type ContractRequest = {
  customerId: string;
  offerVersionId: string;
  companyIds: string[];
  termStart: string;
  termEnd: null;
};

type Step = { contractId: string } | { message: string };

const MISSING_CONTRACT =
  "Não foi possível identificar a contratação. Recarregue a página.";

export function freshAttempt(contractId: string | null): Attempt {
  return { key: crypto.randomUUID(), contractId };
}

async function ensureContract(
  attempt: Attempt,
  request: ContractRequest | null,
): Promise<Step> {
  if (attempt.contractId !== null) return { contractId: attempt.contractId };
  if (request === null) return { message: MISSING_CONTRACT };
  const created = await registerCommercialContractAction(request);
  if (!created.ok) return { message: messageFor("contract", created.error) };
  attempt.contractId = created.data.id;
  return { contractId: created.data.id };
}

export async function runAttempt(
  attempt: Attempt,
  request: ContractRequest | null,
): Promise<string | null> {
  const contract = await ensureContract(attempt, request);
  if ("message" in contract) return contract.message;
  const session = await startCommercialCheckoutAction(contract.contractId, {
    idempotencyKey: attempt.key,
  });
  if (!session.ok) return messageFor("checkout", session.error);
  redirectTo(session.data.url);
  return null;
}
