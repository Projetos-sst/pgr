import "server-only";

import { toString as qrToString } from "qrcode";

/**
 * QR Code da URL de assinatura como SVG inline (R4): gerado no servidor pela
 * lib `qrcode` (JS puro, sem binário nativo) e exibido direto na UI — sem
 * upload, sem arquivo, sem coluna nova.
 */
export async function qrSvgFor(url: string): Promise<string> {
  return qrToString(url, { type: "svg", margin: 1, width: 220 });
}
