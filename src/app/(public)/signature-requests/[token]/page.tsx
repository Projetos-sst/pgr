import { resolvePublicSignature } from "@/shared/server/actions/public-signatures";
import { isSignatureTargetType } from "@/shared/domains/signatures/contract";
import { SignatureFormRenderer } from "@/shared/ui/signature/SignatureFormRenderer";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: {
    title: "Link inválido",
    body: "Este link de assinatura não é válido. Solicite um novo ao responsável.",
  },
  expired: {
    title: "Link expirado",
    body: "O prazo para assinar por este link terminou. Solicite um novo ao responsável.",
  },
  used: {
    title: "Link já utilizado",
    body: "Esta assinatura já foi registrada. Não é necessário assinar novamente.",
  },
};

function StatusCard({ state }: { state: keyof typeof MESSAGES }) {
  const { title, body } = MESSAGES[state];
  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-text text-xl font-semibold">{title}</h1>
      <p className="text-text-muted text-sm">{body}</p>
    </div>
  );
}

export default async function PublicSignaturePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await resolvePublicSignature(token);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md bg-white/90 p-6">
        {view.state !== "signable" ? (
          <StatusCard state={view.state} />
        ) : view.targetType && isSignatureTargetType(view.targetType) ? (
          <SignatureFormRenderer
            targetType={view.targetType}
            token={token}
            payload={view.payload}
          />
        ) : (
          <StatusCard state="invalid" />
        )}
      </div>
    </div>
  );
}
