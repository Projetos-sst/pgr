import { getDeliveryByTokenAction } from "@/shared/server/actions/pgr/epi-deliveries";

import { SignaturePad } from "./_components/signature-pad";

export const dynamic = "force-dynamic";

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

function BusinessMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <h1 className="text-text text-xl font-semibold">{title}</h1>
        <p className="text-text-muted mt-3 text-sm">{detail}</p>
      </div>
    </main>
  );
}

/**
 * Rota PÚBLICA de assinatura (US3): sem Clerk, sem tenant de sessão — a
 * credencial é o token HMAC (R1/R2). Todo desfecho de negócio é página amigável
 * (inválido ≡ inexistente → mesma mensagem, anti-enumeração; nunca 500).
 */
export default async function SignDeliveryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getDeliveryByTokenAction(token);

  if (!result.ok) {
    if (result.error.code === "TOKEN_EXPIRED") {
      return (
        <BusinessMessage
          title="Link expirado"
          detail="Este link de assinatura passou da validade de 72 horas. Peça ao responsável para gerar um novo QR Code ou link."
        />
      );
    }
    return (
      <BusinessMessage
        title="Link inválido"
        detail="Este link de assinatura não é válido. Confira o endereço ou peça ao responsável para gerar um novo."
      />
    );
  }

  const { delivery, alreadySigned } = result.data;

  if (alreadySigned) {
    return (
      <BusinessMessage
        title="Recebimento já confirmado"
        detail={`Esta entrega já foi assinada (${delivery.signatureLabel.toLowerCase()}). Nenhuma ação é necessária.`}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-card flex w-full max-w-lg flex-col gap-5 p-8">
        <div>
          <h1 className="text-text text-xl font-semibold">
            Confirmação de recebimento de EPI
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            {delivery.employeeName} · entrega de {formatIsoDate(delivery.deliveryDate)}
          </p>
        </div>

        <div className="glass-card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="text-text-muted border-b border-white/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">EPI</th>
                <th className="px-3 py-2 font-medium">CA</th>
                <th className="px-3 py-2 font-medium">Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {delivery.items.map((item) => (
                <tr key={item.id} className="border-t border-white/50">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.ca ?? "—"}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-text-muted text-sm">
          Ao confirmar, você declara ter recebido os itens acima em perfeitas condições de
          uso e se compromete a utilizá-los conforme orientação.
        </p>

        <SignaturePad token={token} />
      </div>
    </main>
  );
}
