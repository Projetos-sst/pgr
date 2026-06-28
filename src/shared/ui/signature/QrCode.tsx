/* eslint-disable @next/next/no-img-element */

/**
 * Exibe um QR Code já gerado no servidor (data-URL). Componente puro de
 * apresentação — a geração (`qrcode`) acontece na Server Action.
 */
export function QrCode({
  dataUrl,
  size = 192,
  alt = "QR Code para assinatura",
}: {
  dataUrl: string;
  size?: number;
  alt?: string;
}) {
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      className="rounded-md border border-black/10 dark:border-white/10"
    />
  );
}
