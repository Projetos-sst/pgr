"use client";

import type { ProfessionalIdentityItem } from "@/shared/domains/medicine/professional-identity";
import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import { actOnMedicoLinkInvitationAction } from "@/shared/server/actions/medicine/professional-links";
import {
  reconfirmLegacyLinkAction,
  requestIdentityVerificationAction,
} from "@/shared/server/actions/medicine/professional-identity";

import { FormError } from "../_ui/form";
import { useActionFeedback } from "../_ui/use-action-feedback";

// Os botões não têm campos: qualquer erro de campo vira linha legível no resumo.
const describeIdentityPath = pathDescriber({
  fields: { medicoId: "Cadastro do profissional", linkId: "Vínculo" },
});

/** Ações da própria conta: pedir verificação, reconfirmar vínculo legado, concluir autovínculo. */
export function IdentityControls({ item }: { item: ProfessionalIdentityItem }) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeIdentityPath,
  });
  const canRequest = ["not_requested", "rejected", "expired", "revoked"].includes(
    item.status,
  );
  const button = "text-primary self-start font-semibold underline disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2">
      <FormError message={feedback.formError} details={feedback.details} />
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
