"use client";
import { useState, type FormEvent } from "react";
import type {
  BillingOfferInput,
  BillingProduct,
} from "@/shared/domains/billing/contracts";
const field = "rounded-lg border border-slate-300 bg-white p-2 text-slate-900";
const products: [BillingProduct, string][] = [
  ["pro", "Pro"],
  ["pgr", "PGR"],
  ["medicine", "Medicina"],
];
export function CommercialOfferForm({
  pending,
  onSave,
}: {
  pending: boolean;
  onSave: (offer: BillingOfferInput) => void;
}) {
  const [period, setPeriod] = useState<BillingOfferInput["interval"]>("month");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const selected = products.filter(([code]) => form.get(`include-${code}`) === "on");
    if (!selected.length) {
      setError("Selecione pelo menos um serviço.");
      return;
    }
    const items = [];
    for (const [product, label] of selected) {
      const value = text(`price-${product}`);
      if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
        setError(`Informe o valor de ${label} com até duas casas decimais.`);
        return;
      }
      const [whole, fraction = ""] = value.replace(",", ".").split(".");
      items.push({
        product,
        label: `${label} — simulação`,
        amountMinor: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
      });
    }
    onSave({
      code: text("code"),
      name: text("name"),
      description: text("description"),
      interval: period,
      currency: "BRL",
      items,
      benefits: text("benefits")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      limits: { companies: null, employees: null },
      policy: {
        trialDays: 15,
        trialRequiresCard: false,
        trialAllowsExport: false,
        changeTiming: text("changeTiming") as "period_end" | "immediate",
        cancellationTiming: text("cancellationTiming") as "period_end" | "immediate",
        pastDueAccess: text("pastDueAccess") as "preserve_until_period_end" | "suspend",
        quoteMinutes: 10,
      },
      reason: text("reason"),
    });
  }
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-xl border bg-white p-5"
    >
      <h2 className="font-bold">Oferta para simulação</h2>
      <p>
        Os valores abaixo são exemplos fictícios. Reutilizar o código cria uma nova versão
        e preserva as condições já contratadas.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          Código da oferta
          <input
            className={field}
            name="code"
            defaultValue="exemplo-ficticio"
            pattern="[a-z0-9_-]+"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          Nome
          <input
            className={field}
            name="name"
            defaultValue="Oferta fictícia para simulação"
            minLength={2}
            maxLength={150}
            required
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        Descrição
        <textarea
          className={field}
          name="description"
          defaultValue="Demonstração sem cobrança real."
          maxLength={3000}
        />
      </label>
      <label className="flex flex-col gap-1">
        Periodicidade
        <select
          className={field}
          value={period}
          onChange={(e) => setPeriod(e.target.value as typeof period)}
        >
          <option value="month">Mensal</option>
          <option value="year">Anual</option>
          <option value="one_time">Serviço avulso</option>
        </select>
      </label>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">Itens e valores fictícios</legend>
        {products.map(([code, label], i) => (
          <div key={code} className="flex flex-wrap items-center justify-between gap-3">
            <label>
              <input
                type="checkbox"
                name={`include-${code}`}
                defaultChecked={code !== "pro"}
                disabled={period === "one_time" && code === "pro"}
              />{" "}
              Incluir {label}
            </label>
            <label>
              Valor de {label} (R$)
              <input
                className={`${field} ml-2 w-32`}
                type="text"
                inputMode="decimal"
                name={`price-${code}`}
                defaultValue={["100,00", "50,00", "25,00"][i]}
                aria-label={`Valor fictício de ${label}`}
                disabled={period === "one_time" && code === "pro"}
              />
            </label>
          </div>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        Benefícios (um por linha)
        <textarea
          className={field}
          name="benefits"
          defaultValue="Demonstração do fluxo de contratação"
        />
      </label>
      <label className="flex flex-col gap-1">
        Quando uma mudança de plano entra em vigor
        <select className={field} name="changeTiming" defaultValue="period_end">
          <option value="period_end">No fim do período atual</option>
          <option value="immediate">
            Na confirmação do novo período, pelo valor integral
          </option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Quando cancelar o acesso comercial
        <select className={field} name="cancellationTiming" defaultValue="period_end">
          <option value="period_end">No fim do período já contratado</option>
          <option value="immediate">Imediatamente</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Se houver atraso no pagamento
        <select
          className={field}
          name="pastDueAccess"
          defaultValue="preserve_until_period_end"
        >
          <option value="preserve_until_period_end">
            Preservar acesso até o fim do período
          </option>
          <option value="suspend">Suspender licença comercial</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Motivo do cadastro/alteração
        <input
          className={field}
          name="reason"
          defaultValue="Cadastro explícito de oferta fictícia"
          minLength={3}
          maxLength={1000}
          required
        />
      </label>
      <p>
        Teste de 15 dias sem cartão, sem impressão e sem cobrança automática. Limites
        comerciais não estão definidos neste exemplo.
      </p>
      <p role="alert">{error}</p>
      <button
        className="rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        Salvar versão de teste
      </button>
    </form>
  );
}
