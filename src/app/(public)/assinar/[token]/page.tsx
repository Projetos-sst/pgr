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
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
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
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
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
