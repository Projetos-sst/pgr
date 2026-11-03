import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { IDENTITY_STATUS_LABELS } from "@/shared/domains/medicine/professional-identity";
import { getMyProfessionalIdentityAction } from "@/shared/server/actions/medicine/professional-identity";

import { PageHeader } from "../_ui/list";
import { IdentityControls } from "./identity-controls";

export const dynamic = "force-dynamic";

/**
 * Minha identidade profissional (NOB-158/159/160): situação da verificação independente, do vínculo
 * legado e do acesso clínico de cada cadastro que a conta da sessão assume. O acesso clínico só
 * existe com identidade verificada pela plataforma e, no vínculo legado, com a reconfirmação.
 */
export default async function ProfessionalIdentityPage() {
  await requireTenantContext();
  const result = await getMyProfessionalIdentityAction();
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Minha identidade profissional"
        description="Verificação independente pela plataforma, exigida para qualquer acesso clínico (prontuário, ASO, PCMSO, afastamentos)."
      />
      <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        A identidade é conferida por um operador da plataforma, de forma presencial ou por
        vídeo ao vivo, com seus documentos e o registro no conselho. O escritório não
        verifica nem aprova a própria verificação. Sem verificação válida, o acesso
        clínico fica bloqueado.
      </p>
      {!result.ok ? (
        <p role="alert">{result.error.message}</p>
      ) : result.data.length === 0 ? (
        <p className="text-text-subtle text-sm">
          Sua conta não está vinculada a nenhum cadastro profissional neste escritório.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.data.map((item) => (
            <li
              key={`${item.medicoId}-${item.linkId ?? item.pendingSelfInvitationId}`}
              className="glass-card flex flex-col gap-2 rounded-xl p-5 text-sm"
            >
              <p className="text-text font-semibold">
                {item.medicoName} · {item.registration}
              </p>
              <p role="status">
                {IDENTITY_STATUS_LABELS[item.status]}
                {item.expiresAt && item.status === "verified"
                  ? ` · válida até ${item.expiresAt.slice(0, 10)}`
                  : ""}
              </p>
              {item.legacy ? (
                <p>
                  Vínculo anterior ao convite com aceite:{" "}
                  {item.needsReconfirmation
                    ? "reconfirmação pendente"
                    : "reconfirmado por esta conta"}
                  .
                </p>
              ) : null}
              {item.pendingSelfInvitationId ? (
                <p>
                  Autovínculo aceito: conclua depois da verificação, sem precisar de
                  segundo responsável.
                </p>
              ) : null}
              <p className={item.clinicalAccess ? "text-green-800" : "text-amber-900"}>
                {item.clinicalAccess
                  ? "Acesso clínico disponível."
                  : "Acesso clínico ainda não disponível."}
              </p>
              {item.challengeCode ? (
                <p>
                  Código de controle da conta para informar ao operador:{" "}
                  <strong className="font-mono">{item.challengeCode}</strong> (muda a cada
                  10 minutos).
                </p>
              ) : null}
              <IdentityControls item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
