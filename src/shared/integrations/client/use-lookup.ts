"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ActionResult } from "@/shared/server/result";

export type LookupStatus = "idle" | "loading" | "success" | "error" | "invalid";

export type LookupApi<T> = {
  status: LookupStatus;
  data?: T;
  lookup: (value: string) => void;
};

type Options<T> = {
  isValid: (value: string) => boolean;
  buildUrl: (value: string) => string;
  onFound: (data: T) => void;
};

/**
 * Base dos hooks de consulta externa (CEP/CNPJ). Dispara `fetch` só se o formato
 * for válido, aborta a requisição anterior em digitação rápida e nunca lança:
 * falha vira `status: "error"` silencioso, mantendo o campo editável.
 */
export function useLookup<T>({ isValid, buildUrl, onFound }: Options<T>): LookupApi<T> {
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [data, setData] = useState<T>();
  const controllerRef = useRef<AbortController | null>(null);
  // Ref mantém o callback mais recente sem re-criar `lookup`; atualizada após o
  // commit (nunca durante o render — regra react-hooks/refs). O fetch resolve
  // depois, então sempre enxerga a última versão do `onFound`.
  const onFoundRef = useRef(onFound);
  useEffect(() => {
    onFoundRef.current = onFound;
  });

  const lookup = useCallback(
    (value: string) => {
      if (!isValid(value)) {
        // Formato inválido não dispara fetch, mas o usuário merece o feedback:
        // campo vazio segue neutro (idle); preenchido errado vira "invalid".
        controllerRef.current?.abort();
        setStatus(value.trim() === "" ? "idle" : "invalid");
        return;
      }
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus("loading");

      fetch(buildUrl(value), { signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json()) as ActionResult<T>;
          if (controller.signal.aborted) return;
          if (response.ok && body.ok) {
            setData(body.data);
            setStatus("success");
            onFoundRef.current(body.data);
            return;
          }
          setStatus("error");
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    },
    [isValid, buildUrl],
  );

  return { status, data, lookup };
}
