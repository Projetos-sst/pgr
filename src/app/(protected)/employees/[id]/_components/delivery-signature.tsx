"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  generateSignTokenAction,
  getDeliveryAction,
  signDeliveryManualAction,
} from "@/shared/server/actions/pgr/epi-deliveries";
import type { SignTokenMethod } from "@/shared/integrations/epi-signature/token";
import type { EpiSignatureStatus } from "@/shared/domains/pgr/validation";

const POLL_INTERVAL_MS = 5_000;

type GeneratedLink = { method: SignTokenMethod; url: string; qrSvg: string | null };

/**
 * Status de assinatura da entrega + as 3 vias de assinatura (US2 manual, US3
 * QR/link). Depois de gerar o QR/link, o painel "Aguardando confirmação" faz
 * polling do `signature_status` até a assinatura pública refletir.
 */
export function DeliverySignature({
  deliveryId,
  signatureStatus,
  signatureLabel,
  signedAt,
}: {
  deliveryId: string;
  signatureStatus: EpiSignatureStatus;
  signatureLabel: string;
  signedAt: string | null;
}) {
  const router = useRouter();
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const waiting = signatureStatus === "pending" && generated !== null;

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const result = await getDeliveryAction(deliveryId);
      if (result.ok && result.data.signatureStatus !== "pending") {
        router.refresh();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [waiting, deliveryId, router]);

  function signManual() {
    startTransition(async () => {
      const result = await signDeliveryManualAction(deliveryId);
      if (result.ok) {
        setError(null);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  function generate(method: SignTokenMethod) {
    startTransition(async () => {
      const result = await generateSignTokenAction(deliveryId, method);
      if (result.ok) {
        setError(null);
        setGenerated({ method, url: result.data.url, qrSvg: result.data.qrSvg });
        return;
      }
      setError(result.error.message);
    });
  }

  if (signatureStatus !== "pending") {
    return (
      <span className="w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
        {signatureLabel}
        {signedAt ? ` em ${new Date(signedAt).toLocaleString("pt-BR")}` : ""}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
          {signatureLabel}
        </span>
        <button
          type="button"
          onClick={signManual}
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
        >
          {pending ? "Aguarde…" : "Registrar assinatura manual"}
        </button>
        <button
          type="button"
          onClick={() => generate("qr")}
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
        >
          Gerar QR
        </button>
        <button
          type="button"
          onClick={() => generate("link")}
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
        >
          Gerar link
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>

      {generated ? (
        <div className="flex flex-col gap-2 rounded-md border border-black/10 bg-black/2 p-3 dark:border-white/10 dark:bg-white/5">
          {generated.qrSvg ? (
            <div
              className="w-fit rounded bg-white p-2"
              // SVG gerado no servidor pela lib `qrcode` a partir da URL — não é input do usuário.
              dangerouslySetInnerHTML={{ __html: generated.qrSvg }}
            />
          ) : null}
          <p className="text-xs break-all text-zinc-600 dark:text-zinc-400">
            {generated.url}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generated.url)}
              className="rounded-md border border-black/15 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/15"
            >
              Copiar link
            </button>
            <span className="text-xs text-zinc-500">
              Aguardando confirmação do funcionário… (válido por 72h)
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
