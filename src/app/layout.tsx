import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { getSiteUrl } from "@/shared/site-url";

import { clerkLocalization } from "./_components/clerk-localization";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  // `%s` deixa cada pagina publica definir o proprio titulo sem repetir a marca;
  // `default` atende as telas autenticadas, que nao exportam metadata propria.
  title: { default: "PGR-e", template: "%s" },
  description:
    "Plataforma multiempresa de Seguranca e Medicina do Trabalho: riscos, medidas de controle, plano de acao, EPI, treinamentos, ASO e elaboracao do PGR.",
  applicationName: "PGR-e",
  // Sem NEXT_PUBLIC_APP_URL definido, `metadataBase` fica ausente e o Next
  // emite as URLs relativas — melhor do que fixar um dominio inventado.
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          localization={clerkLocalization}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/welcome"
          signUpFallbackRedirectUrl="/welcome"
          afterSignOutUrl="/"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
