import type { ReactNode } from "react";

import { PortalHeader } from "../_portal/portal-header";
import { PortalFooterSlot } from "../_portal/portal-footer-slot";
import "../_portal/portal.css";

/**
 * Shell do portal comercial, na identidade aprovada pelo Claude Design.
 *
 * Dois pontos estruturais:
 *
 * 1. **Grupo de rotas aninhado.** `(marketing)` fica dentro de `(public)` de
 *    propósito: login, cadastro, assinatura por token e questionário
 *    psicossocial **não** herdam header e rodapé comerciais.
 * 2. **`.pg` é a fronteira do tema.** Toda a folha do portal está escopada sob
 *    esta classe. É o que garante que o fundo `#F2F1EE`, a tinta `#16171D` e os
 *    raios do design público não alcancem as telas autenticadas, que seguem com
 *    os tokens do `globals.css`.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="pg"
      style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}
    >
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <PortalHeader />
      <main id="conteudo" style={{ flex: "1 1 auto" }}>
        {children}
      </main>
      <PortalFooterSlot />
    </div>
  );
}
