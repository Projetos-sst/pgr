"use client";

import { SignOutButton } from "@clerk/nextjs";

/**
 * Saída de conta na tela "sem organização". É o único jeito de a pessoa trocar
 * de identidade a partir daqui: `/sign-in` com sessão ativa devolve para a área
 * autenticada (Clerk), que é justamente de onde ela foi barrada — sem este botão
 * o estado vira um beco sem saída.
 */
export function SignOutLink() {
  return (
    <SignOutButton redirectUrl="/">
      <button
        type="button"
        className="text-text-muted hover:text-text inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        Sair da conta
      </button>
    </SignOutButton>
  );
}
