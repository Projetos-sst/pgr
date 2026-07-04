"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type PointerEvent } from "react";

import { submitSignatureAction } from "@/shared/server/actions/pgr/epi-deliveries";

/**
 * Assinatura por `<canvas>` nativo (pointer events, sem lib — R4). O traço é
 * exigido como gesto de consentimento, mas a imagem NÃO é persistida nesta
 * fatia: a prova legal é `signature_status` + timestamp da transição.
 */
export function SignaturePad({ token }: { token: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function pointFrom(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    canvasRef.current?.setPointerCapture(event.pointerId);
    const { x, y } = pointFrom(event);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFrom(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  function confirmSignature() {
    if (!hasStroke) {
      setError("Assine no quadro acima antes de confirmar.");
      return;
    }
    startTransition(async () => {
      const result = await submitSignatureAction(token);
      if (result.ok) {
        setError(null);
        setDone(true);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  if (done) {
    return (
      <p className="rounded-md bg-emerald-100 px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
        Recebimento confirmado. Obrigado!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={440}
        height={160}
        className="w-full touch-none rounded-md border border-dashed border-black/25 bg-white dark:border-white/25"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        aria-label="Quadro de assinatura"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={pending}
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={confirmSignature}
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Confirmando…" : "Confirmar recebimento"}
        </button>
      </div>
    </div>
  );
}
