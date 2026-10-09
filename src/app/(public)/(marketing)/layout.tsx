import type { ReactNode } from "react";

import { PublicHeader } from "../_components/public-header";
import { PublicFooter } from "../_components/public-footer";

/**
 * Shell do portal comercial. É um grupo de rotas *aninhado* dentro de
 * `(public)` de propósito: as outras rotas públicas — login, cadastro,
 * assinatura por token e questionário psicossocial — não devem herdar header e
 * rodapé de marketing. Só o que está em `(marketing)` recebe este shell.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {/*
        O padding vai no próprio variante `focus:`. O utilitário `not-sr-only`
        do Tailwind zera `padding` e `margin` ao reativar o elemento — com
        `px-5 py-2.5` fora do variante, o link reaparecia como um alvo de 20px
        de altura, abaixo do mínimo confortável de toque.
      */}
      <a
        href="#conteudo"
        className="btn-primary rounded-pill sr-only text-sm font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-5 focus:py-3"
      >
        Ir para o conteúdo
      </a>
      <PublicHeader />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
