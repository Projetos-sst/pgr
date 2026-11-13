"use client";

import { revokeAccessScopeAction } from "@/shared/server/actions/platform/access-scopes";

import { ConfirmDeleteButton } from "../../../../_ui/confirm-delete-button";

export function RevokeScope({ userId, scopeId }: { userId: string; scopeId: string }) {
  return (
    <ConfirmDeleteButton
      id={scopeId}
      entityName="escopo de acesso"
      description="O membro perde este acesso na próxima navegação. Se este for o último escopo, ele volta a acessar todas as empresas, obras e áreas."
      deleteAction={(id) => revokeAccessScopeAction(userId, id)}
    />
  );
}
