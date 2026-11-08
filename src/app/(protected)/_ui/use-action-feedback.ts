"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  EMPTY_FORM_FEEDBACK,
  formFeedback,
  unexpectedFormFeedback,
  type DescribePath,
  type FormFeedback,
} from "@/shared/domains/medicine/form-feedback";

type Fields = Record<string, string>;

/** Forma mínima do `ActionResult<T>` que os formulários consomem. */
export type ActionOutcome =
  | { ok: true }
  | { ok: false; error: { code?: string; message?: string; fields?: Fields } };

export type RunOptions<Success> = {
  /** Chaves de erro que a tela mostra junto ao campo ou à seção; as demais vão ao resumo. */
  slots?: readonly string[];
  /** Ajusta as chaves do servidor ao que a tela mostra (ex.: índice da linha na tela). */
  mapFields?: (fields: Fields | undefined) => Fields | undefined;
  /** Só depois do sucesso confirmado pelo servidor (ex.: limpar o formulário). */
  onOk?: (result: Success) => void;
  /** Atualiza a página depois do sucesso (padrão: sim). */
  refresh?: boolean;
};

/**
 * Envio de formulário da Medicina com retorno por campo (NOB-112), sobre `formFeedback`:
 * erro de campo vai ao campo (`feedback.fields`), chave sem lugar na tela vira linha legível
 * no resumo (`feedback.details`), erro sem campos (permissão, registro não encontrado, regra do
 * servidor) fica como mensagem do formulário e nunca vira erro de validação. Promessa
 * rejeitada (rede, falha não mapeada) vira mensagem segura, sem detalhe técnico, e libera o
 * botão. Os valores digitados só somem se o chamador limpar em `onOk`. Um segundo envio
 * enquanto o primeiro está pendente é ignorado.
 */
export function useActionFeedback(
  options: { describe?: DescribePath; unexpectedMessage?: string } = {},
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [feedback, setFeedback] = useState<FormFeedback>(EMPTY_FORM_FEEDBACK);
  const [succeeded, setSucceeded] = useState(false);

  function run<R extends ActionOutcome>(
    fn: () => Promise<R>,
    runOptions: RunOptions<Extract<R, { ok: true }>> = {},
  ) {
    if (busy.current) return;
    busy.current = true;
    setSucceeded(false);
    startTransition(async () => {
      try {
        let result: R;
        try {
          result = await fn();
        } catch {
          // Falha sem resposta tratável (o servidor já registrou): nada técnico na tela.
          const unexpected = unexpectedFormFeedback();
          setFeedback(
            options.unexpectedMessage
              ? { ...unexpected, formError: options.unexpectedMessage }
              : unexpected,
          );
          return;
        }
        const outcome: ActionOutcome = result;
        if (outcome.ok) {
          setFeedback(EMPTY_FORM_FEEDBACK);
          setSucceeded(true);
          runOptions.onOk?.(result as Extract<R, { ok: true }>);
          if (runOptions.refresh !== false) router.refresh();
          return;
        }
        const fields = runOptions.mapFields
          ? runOptions.mapFields(outcome.error.fields)
          : outcome.error.fields;
        setFeedback(
          formFeedback(
            { ...outcome.error, fields },
            { slots: runOptions.slots ?? [], describe: options.describe },
          ),
        );
      } finally {
        busy.current = false;
      }
    });
  }

  /** Recusa local (antes do envio), mostrada como mensagem do formulário. */
  const fail = (message: string) => {
    setSucceeded(false);
    setFeedback({ formError: message, details: [], fields: {} });
  };

  return { pending, feedback, succeeded, run, fail, setFeedback };
}
