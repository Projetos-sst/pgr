"use client";
import { useState, useTransition } from "react";
import { synchronizeMockPaymentProfileAction } from "@/shared/server/actions/platform/billing-portal";
export function MockPaymentProfile({
  sessionId,
  method,
}: {
  sessionId: string;
  method: { brand: string; last4: string } | null;
}) {
  const [current, setCurrent] = useState(method),
    [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  return (
    <section className="rounded-xl border bg-white p-5">
      <h3 className="font-bold">Portal de teste — método de pagamento</h3>
      <p>
        {current
          ? `${current.brand} •••• ${current.last4}`
          : "Nenhum método de teste vinculado."}
      </p>
      <p>
        Este controle usa somente um método fictício predefinido. Não informe dados de
        cartão real.
      </p>
      <button
        className="mt-3 rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const r = await synchronizeMockPaymentProfileAction({
                sessionId,
                method: "visa_test_4242",
              });
              if (!r.ok) {
                setMessage(r.error.message);
                return;
              }
              setCurrent({ brand: "Visa (teste)", last4: "4242" });
              setMessage(
                "Método de teste sincronizado. A leitura após recarregar preservará esta atualização.",
              );
            } catch {
              setMessage("Não foi possível atualizar. Tente novamente.");
            }
          })
        }
      >
        Simular atualização do método
      </button>
      <p role="status">{pending ? "Sincronizando…" : message}</p>
    </section>
  );
}
