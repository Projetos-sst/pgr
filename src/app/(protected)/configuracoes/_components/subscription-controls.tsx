"use client";
import { useState, useTransition, useEffect } from "react";
import type { BillingChangePreview } from "@/shared/domains/billing/contracts";
import {
  previewCommercialChangeAction,
  confirmCommercialChangeAction,
  cancelCommercialSubscriptionAction,
  resumeCommercialSubscriptionAction,
} from "@/shared/server/actions/platform/billing-management";
const button =
  "rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-50";
const field = "rounded-lg border border-slate-300 bg-white p-2 text-slate-900";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100,
  );
type Contract = {
  id: string;
  availableActions: string[];
  snapshot: { name: string; interval: string };
};
export function SubscriptionActions({
  contract,
  onChanged,
}: {
  contract: Contract;
  onChanged: () => Promise<void>;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  if (contract.snapshot.interval === "one_time")
    return (
      <p>
        Pedido avulso: a autorização comercial é limitada aos serviços comprados neste
        pedido.
      </p>
    );
  function change(cancel: boolean) {
    if (
      cancel &&
      !window.confirm("Confirmar cancelamento conforme a política contratada?")
    )
      return;
    start(async () => {
      try {
        const result = await (
          cancel ? cancelCommercialSubscriptionAction : resumeCommercialSubscriptionAction
        )({
          contractId: contract.id,
          reason: cancel
            ? "Cancelamento confirmado pelo administrador"
            : "Retomada confirmada pelo administrador",
        });
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        setMessage(
          cancel
            ? "Cancelamento registrado conforme a política contratada."
            : "Retomada registrada. Pagamentos pendentes continuam aguardando confirmação.",
        );
        await onChanged();
      } catch {
        setMessage("Não foi possível concluir. Consulte o estado antes de repetir.");
      }
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {contract.availableActions.includes("cancel") && (
          <button className={button} disabled={pending} onClick={() => change(true)}>
            Cancelar assinatura
          </button>
        )}
        {contract.availableActions.includes("resume") && (
          <button className={button} disabled={pending} onClick={() => change(false)}>
            Retomar assinatura
          </button>
        )}
      </div>
      <p role="status">{pending ? "Processando…" : message}</p>
    </div>
  );
}
export function SubscriptionChangeForm({
  contracts,
  offers,
  onChanged,
}: {
  contracts: Contract[];
  offers: { id: string; version: number; data: { name: string; interval: string } }[];
  onChanged: () => Promise<void>;
}) {
  const [contractId, setContract] = useState(""),
    [priceId, setPrice] = useState(""),
    [quote, setQuote] = useState<BillingChangePreview | null>(null),
    [expired, setExpired] = useState(false),
    [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(quote.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [quote]);
  function preview() {
    start(async () => {
      try {
        const result = await previewCommercialChangeAction({ contractId, priceId });
        if (!result.ok) {
          setMessage(result.error.message);
          setQuote(null);
          return;
        }
        setQuote(result.data);
        setExpired(false);
        setMessage("");
      } catch {
        setMessage("Não foi possível calcular a prévia.");
        setQuote(null);
      }
    });
  }
  function confirm() {
    if (!quote || expired) return;
    start(async () => {
      try {
        const result = await confirmCommercialChangeAction({
          quoteId: quote.id,
          reason: "Prévia e política de mudança confirmadas pelo administrador",
        });
        if (!result.ok) {
          setMessage(result.error.message);
          setQuote(null);
          return;
        }
        setQuote(null);
        setMessage(
          "Mudança confirmada. O novo acesso aguarda a vigência e a confirmação do pagamento.",
        );
        await onChanged();
      } catch {
        setMessage("Não foi possível confirmar. Consulte a assinatura antes de repetir.");
      }
    });
  }
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-white p-5">
      <h2 className="font-bold">Mudança de plano</h2>
      <p>
        A prévia preserva o preço por tempo limitado. Nenhuma licença é alterada apenas ao
        confirmar esta tela.
      </p>
      <label className="flex flex-col gap-1">
        Assinatura
        <select
          className={field}
          value={contractId}
          disabled={pending}
          onChange={(e) => {
            setContract(e.target.value);
            setQuote(null);
          }}
        >
          <option value="">Selecione</option>
          {contracts
            .filter(
              (c) =>
                c.snapshot.interval !== "one_time" &&
                c.availableActions.includes("change"),
            )
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.snapshot.name} — {c.id}
              </option>
            ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Nova oferta
        <select
          className={field}
          value={priceId}
          disabled={pending}
          onChange={(e) => {
            setPrice(e.target.value);
            setQuote(null);
          }}
        >
          <option value="">Selecione</option>
          {offers
            .filter((o) => o.data.interval !== "one_time")
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.data.name} v{o.version}
              </option>
            ))}
        </select>
      </label>
      <button
        className={button}
        disabled={pending || !contractId || !priceId}
        onClick={preview}
      >
        Calcular prévia
      </button>
      {quote && (
        <article className="flex flex-col gap-3 border-t pt-3">
          <h3 className="font-bold">Confira a mudança simulada</h3>
          <ul>
            {quote.items.map((i) => (
              <li key={i.product}>
                {i.label}: {money(i.amountMinor)}
              </li>
            ))}
          </ul>
          <strong>Valor integral do novo período: {money(quote.amountMinor)}</strong>
          <p>
            Vigência: {new Date(quote.effectiveAt).toLocaleString("pt-BR")}. Confirme até{" "}
            {new Date(quote.expiresAt).toLocaleString("pt-BR")}.
          </p>
          <p>Sem rateio nesta simulação. A mudança não reescreve cobranças anteriores.</p>
          <button className={button} disabled={pending || expired} onClick={confirm}>
            Confirmar mudança simulada
          </button>
          {expired && (
            <p role="alert">A prévia expirou. Calcule novamente antes de confirmar.</p>
          )}
        </article>
      )}
      <p role="status">{pending ? "Processando…" : message}</p>
    </section>
  );
}
