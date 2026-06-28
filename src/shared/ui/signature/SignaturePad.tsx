"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import SignaturePadLib from "signature_pad";

export type SignaturePadHandle = {
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

/**
 * Wrapper vanilla de `signature_pad` (sem peer-dependency de React → imune ao
 * React 19). Expõe `toDataURL`/`clear`/`isEmpty` por ref para o formulário ler a
 * assinatura no submit. Ajusta o canvas ao devicePixelRatio.
 */
export const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      padRef.current?.clear();
    };

    padRef.current = new SignaturePadLib(canvas, { backgroundColor: "rgb(255,255,255)" });
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      padRef.current?.off();
      padRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    toDataURL: () =>
      padRef.current && !padRef.current.isEmpty()
        ? padRef.current.toDataURL("image/png")
        : null,
    clear: () => padRef.current?.clear(),
    isEmpty: () => padRef.current?.isEmpty() ?? true,
  }));

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-md border border-black/15 bg-white dark:border-white/15"
        aria-label="Área de assinatura"
      />
      <button
        type="button"
        onClick={() => padRef.current?.clear()}
        className="self-start rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
      >
        Limpar
      </button>
    </div>
  );
});
