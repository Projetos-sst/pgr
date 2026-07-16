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
      <span className="w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        {signatureLabel}
        {signedAt ? ` em ${new Date(signedAt).toLocaleString("pt-BR")}` : ""}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {signatureLabel}
        </span>
        <button
          type="button"
          onClick={signManual}
          disabled={pending}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "Aguarde…" : "Registrar assinatura manual"}
        </button>
        <button
          type="button"
          onClick={() => generate("qr")}
          disabled={pending}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          Gerar QR
        </button>
        <button
          type="button"
          onClick={() => generate("link")}
          disabled={pending}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          Gerar link
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>

      {generated ? (
        <div className="glass-panel rounded-card flex flex-col gap-2 p-3">
          {generated.qrSvg ? (
            <div
              className="w-fit rounded bg-white p-2"
              // SVG gerado no servidor pela lib `qrcode` a partir da URL — não é input do usuário.
              dangerouslySetInnerHTML={{ __html: generated.qrSvg }}
            />
          ) : null}
          <p className="text-text-muted text-xs break-all">{generated.url}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generated.url)}
              className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-xs font-semibold transition-colors"
            >
              Copiar link
            </button>
            <span className="text-text-subtle text-xs">
              Aguardando confirmação do funcionário… (válido por 72h)
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
