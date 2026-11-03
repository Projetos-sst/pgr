import { requireMasterPage } from "@/shared/auth/require-master";
import { getVerificationQueueAction } from "@/shared/server/actions/medicine/professional-identity";

import { PageHeader } from "../../_ui/list";
import { ApproveForm, DecisionForm } from "./verification-forms";

export const dynamic = "force-dynamic";

const day = (iso: string) => iso.slice(0, 10);

/**
 * Fila de verificação de identidade profissional (NOB-158). Exige master E designação de operador
 * no banco (provisionada fora da aplicação). Só metadados de cadastro e conta: nenhum prontuário,
 * diagnóstico, CID ou exame clínico.
 */
export default async function IdentityVerificationsPage() {
  await requireMasterPage();
  const result = await getVerificationQueueAction();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Verificação de identidade profissional"
        backHref="/admin-global"
        description="Conferência independente (presencial ou vídeo ao vivo, sem gravação) de documento de identidade, registro profissional, situação do CRM/UF e controle da conta."
      />
      {!result.ok ? (
        <p role="alert">{result.error.message}</p>
      ) : !result.data.available ? (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {result.data.reason}
        </p>
      ) : (
        <>
          <p className="text-text-subtle text-sm">
            Validade configurada: {result.data.validityMonths} meses. Você não pode
            verificar a própria conta nem contas de escritórios dos quais é membro: o
            banco recusa. Não guarde fotos nem documentos: registre só a fonte consultada
            e uma referência de auditoria.
          </p>
          <section className="flex flex-col gap-4">
            <h2 className="text-text text-sm font-semibold">
              Pedidos em análise ({result.data.pending.length})
            </h2>
            {result.data.pending.map((r) => (
              <article
                key={r.requestId}
                className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm"
              >
                <p className="text-text font-semibold">
                  {r.medicoName} · CRM {r.crm}/{r.registrationUf ?? "UF não informada"}
                </p>
                <p className="text-text-subtle">
                  Escritório {r.orgName ?? r.orgId} · conta {r.userId} · pedido em{" "}
                  {day(r.requestedAt)}
                </p>
                <ApproveForm requestId={r.requestId} crm={r.crm} uf={r.registrationUf} />
                <DecisionForm id={r.requestId} kind="reject" />
              </article>
            ))}
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="text-text text-sm font-semibold">
              Verificações vigentes ({result.data.active.length})
            </h2>
            {result.data.active.map((v) => (
              <article
                key={v.verificationId}
                className="glass-card flex flex-col gap-2 rounded-xl p-5 text-sm"
              >
                <p className="text-text font-semibold">
                  {v.medicoName} · CRM {v.crm}/{v.registrationUf}
                </p>
                <p className="text-text-subtle">
                  {v.orgName} · conta {v.userId} · verificada em {day(v.verifiedAt)} por{" "}
                  {v.verifiedBy} · válida até {day(v.expiresAt)}
                </p>
                <DecisionForm id={v.verificationId} kind="revoke" />
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
