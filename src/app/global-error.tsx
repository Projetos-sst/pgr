"use client";

import { Manrope, JetBrains_Mono } from "next/font/google";

import { ErrorState } from "./_components/error-state";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

/**
 * Boundary de último recurso: só dispara quando o próprio layout raiz falha,
 * por isso precisa renderizar seu próprio <html>/<body>.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ErrorState
          code="500"
          eyebrow="Sistema"
          title="Não foi possível carregar"
          description="Algo não respondeu como esperávamos. Tente novamente em alguns instantes."
          actions={[
            { label: "Tentar novamente", onClick: reset },
            { label: "Voltar ao painel", href: "/dashboard", variant: "quiet" },
          ]}
        />
      </body>
    </html>
  );
}
