"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ProfessionalIdentityItem } from "@/shared/domains/medicine/professional-identity";
import { actOnMedicoLinkInvitationAction } from "@/shared/server/actions/medicine/professional-links";
import {
  reconfirmLegacyLinkAction,
  requestIdentityVerificationAction,
} from "@/shared/server/actions/medicine/professional-identity";

import { FormError } from "../_ui/form";

type Result = { ok: true } | { ok: false; error: { message: string } };

/** Ações da própria conta: pedir verificação, reconfirmar vínculo legado, concluir autovínculo. */
export function IdentityControls({ item }: { item: ProfessionalIdentityItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        router.refresh();
      } else setError(result.error.message);
    });
  const canRequest = ["not_requested", "rejected", "expired", "revoked"].includes(
    item.status,
  );
  const button = "text-primary self-start font-semibold underline disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2">
      <FormError message={error} />
      <div className="flex flex-wrap gap-4">
        {canRequest ? (
          <button
            type="button"
            disabled={pending}
            className={button}
            onClick={() =>
              run(() => requestIdentityVerificationAction({ medicoId: item.medicoId }))
            }
          >
            Pedir verificação de identidade
          </button>
        ) : null}
        {item.needsReconfirmation && item.linkId ? (
          <button
            type="button"
            disabled={pending}
            className={button}
            onClick={() => run(() => reconfirmLegacyLinkAction(item.linkId!))}
          >
            Reconfirmar: sou este profissional e mantenho o vínculo
          </button>
        ) : null}
        {item.pendingSelfInvitationId && item.status === "verified" ? (
          <button
            type="button"
            disabled={pending}
            className={button}
            onClick={() =>
              run(() =>
                actOnMedicoLinkInvitationAction(
                  item.medicoId,
                  item.pendingSelfInvitationId!,
                  "complete",
                ),
              )
            }
          >
            Concluir autovínculo
          </button>
        ) : null}
      </div>
    </div>
  );
}
