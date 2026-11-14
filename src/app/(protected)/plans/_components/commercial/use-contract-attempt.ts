"use client";

import { useRef, useState, useTransition } from "react";

import {
  freshAttempt,
  runAttempt,
  type Attempt,
  type ContractRequest,
} from "./run-attempt";

export function useContractAttempt(resumeContractId: string | null = null) {
  const attempt = useRef<Attempt | null>(null);
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    attempt.current = null;
    setError(null);
  };

  const submit = (request: ContractRequest | null) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      const current = attempt.current ?? freshAttempt(resumeContractId);
      attempt.current = current;
      const failure = await runAttempt(current, request);
      if (failure === null) return;
      busy.current = false;
      setError(failure);
    });
  };

  return { pending, error, reset, submit };
}
