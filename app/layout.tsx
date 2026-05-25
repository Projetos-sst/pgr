import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  ClerkProvider,
  OrganizationSwitcher,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SST Manager",
  description: "Plataforma multiempresa de Segurança do Trabalho",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          localization={ptBR}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/"
        >
          <header className="flex items-center justify-between gap-4 border-b border-black/8 px-6 py-4">
            <Link
              href="/"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              SST Manager
            </Link>
            <nav className="flex items-center gap-3">
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838]"
                >
                  Entrar
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  Painel
                </Link>
                <OrganizationSwitcher
                  hidePersonal
                  afterSelectOrganizationUrl="/dashboard"
                  afterCreateOrganizationUrl="/dashboard"
                />
                <UserButton />
              </Show>
            </nav>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
