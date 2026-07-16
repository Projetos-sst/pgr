"use client";

import { ErrorState } from "./_components/error-state";

/**
 * Boundary de erro de rota ("não foi possível carregar"). Nunca expõe
 * `error.message`/stack ao usuário — apenas direção e retry (`reset`).
 */
export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
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
  );
}
