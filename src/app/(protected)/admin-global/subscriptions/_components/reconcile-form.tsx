"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  RECONCILIATION_REASON_MIN_LENGTH,
  RECONCILIATION_RESULT_LABELS,
  reconciliationReasonSchema,
} from "@/shared/domains/commercial/admin-subscriptions";
import { reconcileSubscriptionAction } from "@/shared/server/actions/commercial/admin-subscriptions";

import { Button } from "../../../_ui/button";
import { ConfirmModal } from "../../../_ui/confirm-modal";
import { FormError, TextAreaField } from "../../../_ui/form";

type Feedback = { kind: "success" | "error"; message: string } | null;

export function ReconcileForm({
  orgId,
  contractId,
}: {
  orgId: string;
  contractId: string;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const ask = () => {
    const parsed = reconciliationReasonSchema.safeParse(reason);
    setFieldError(
      parsed.success
        ? undefined
        : `O motivo precisa ter ao menos ${RECONCILIATION_REASON_MIN_LENGTH} caracteres.`,
    );
    setConfirming(parsed.success);
  };

  const release = () => {
    busy.current = false;
  };

  const confirm = () => {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      const result = await reconcileSubscriptionAction({
        orgId,
        contractId,
        reason,
      }).finally(release);
      setConfirming(false);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error.message });
        setFieldError(result.error.fields?.reason);
        return;
      }
      setFeedback({
        kind: "success",
        message: `${RECONCILIATION_RESULT_LABELS[result.data.result]} (${result.data.detail}).`,
      });
      setReason("");
      router.refresh();
    });
  };

  return (
    <section
      className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm"
      aria-label="Reconciliação"
    >
      <h2 className="text-text text-sm font-semibold">Reconciliar assinatura</h2>
      <p className="text-text-subtle">
        Confere a assinatura na fonte (provedor em modo de teste) ou, sem a fonte,
        reavalia os direitos de uso a partir do espelho local. Não cria cobrança, checkout
        nem fatura e nunca revoga licença legada.
      </p>
      <TextAreaField
        label="Motivo da reconciliação"
        name="reason"
        required
        value={reason}
        onChange={setReason}
        error={fieldError}
      />
      <div aria-live="polite" role="status">
        {feedback?.kind === "success" ? <p>{feedback.message}</p> : null}
        {feedback?.kind === "error" ? <FormError message={feedback.message} /> : null}
      </div>
      <div className="flex justify-end">
        <Button label="Reconciliar" pending={pending} onClick={ask} />
      </div>
      <ConfirmModal
        open={confirming}
        title="Confirmar reconciliação"
        description="Os direitos de uso desta contratação serão reavaliados e a execução ficará registrada com o seu usuário e o motivo informado."
        confirmLabel="Reconciliar agora"
        variant="warning"
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
