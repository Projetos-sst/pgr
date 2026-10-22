"use client";
import { useState, useTransition } from "react";
import type {
  getAdminCommercialSubscriptions,
  getAdminCommercialSubscription,
} from "@/shared/server/platform/billing-admin-core";
import {
  getAdminCommercialSubscriptionsAction,
  getAdminCommercialSubscriptionAction,
  reconcileAdminCommercialSubscriptionAction,
} from "@/shared/server/actions/platform/billing-admin";
type List = Awaited<ReturnType<typeof getAdminCommercialSubscriptions>>;
type Detail = Awaited<ReturnType<typeof getAdminCommercialSubscription>>;
export function CommercialAdmin({ initial }: { initial: List }) {
  const [data, setData] = useState(initial),
    [detail, setDetail] = useState<Detail | null>(null),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState("");
  function load(page = 1) {
    start(async () => {
      try {
        const r = await getAdminCommercialSubscriptionsAction({
          ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
          page,
        });
        if (r.ok) {
          setData(r.data);
          setDetail(null);
          setMessage("");
        } else setMessage(r.error.message);
      } catch {
        setMessage("Não foi possível consultar as assinaturas.");
      }
    });
  }
  function open(id: string) {
    start(async () => {
      try {
        const r = await getAdminCommercialSubscriptionAction(id);
        if (r.ok) setDetail(r.data);
        else setMessage(r.error.message);
      } catch {
        setMessage("Não foi possível consultar a ficha.");
      }
    });
  }
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">Administração de assinaturas</h2>
      <p>Visão restrita ao escritório ativo e a operadores autorizados.</p>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        {["search", "companyId", "plan"].map((key) => (
          <label key={key}>
            {
              (
                {
                  search: "Empresa (nome)",
                  companyId: "ID da empresa",
                  plan: "Código do plano",
                } as Record<string, string>
              )[key]
            }
            <input
              className="block rounded border p-2"
              value={filters[key] ?? ""}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Módulo
          <select
            className="block rounded border p-2"
            value={filters.product ?? ""}
            onChange={(e) => setFilters({ ...filters, product: e.target.value })}
          >
            <option value="">Todos</option>
            {["pro", "pgr", "medicine"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            className="block rounded border p-2"
            value={filters.status ?? ""}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos</option>
            {[
              "pending_payment",
              "requires_action",
              "trialing",
              "active",
              "past_due",
              "unpaid",
              "canceled",
              "expired",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {["from", "to"].map((key) => (
          <label key={key}>
            {key === "from" ? "Criada a partir de" : "Criada até"}
            <input
              type="date"
              className="block rounded border p-2"
              onChange={(e) =>
                setFilters({
                  ...filters,
                  [key]: e.target.value
                    ? e.target.value + (key === "from" ? "T00:00:00Z" : "T23:59:59Z")
                    : "",
                })
              }
            />
          </label>
        ))}
        <button disabled={pending} className="rounded bg-indigo-700 p-2 text-white">
          Filtrar
        </button>
      </form>
      <p role="status">{pending ? "Consultando…" : message}</p>
      <ul className="divide-y">
        {data.rows.map((c) => (
          <li key={c.id} className="py-3">
            <strong>{c.companyName}</strong> · {c.plan.name} · {c.status}{" "}
            <button className="underline" disabled={pending} onClick={() => open(c.id)}>
              Abrir ficha
            </button>
          </li>
        ))}
      </ul>
      {!data.rows.length && <p>Nenhuma assinatura neste filtro.</p>}
      <div className="flex gap-4">
        <button disabled={pending || data.page <= 1} onClick={() => load(data.page - 1)}>
          Anterior
        </button>
        <span>Página {data.page}</span>
        <button disabled={pending || !data.hasMore} onClick={() => load(data.page + 1)}>
          Próxima
        </button>
      </div>
      {detail && (
        <article className="rounded-xl border bg-white p-5">
          <h3 className="text-lg font-bold">
            {detail.customer.name} — {detail.contract.snapshot.name}
          </h3>
          <p>ID: {detail.contract.id}</p>
          <p>Vínculo simulado: {detail.contract.providerSubscriptionId}</p>
          <p>
            Status: {detail.contract.status} · revisão{" "}
            {detail.synchronization.localRevision} · provedor{" "}
            {detail.synchronization.providerRevision ?? "sem evento"}
          </p>
          <p>
            {detail.synchronization.inSync === true
              ? "Sincronizada"
              : detail.synchronization.inSync === false
                ? "Divergência encontrada"
                : "Aguardando confirmação do provedor"}
          </p>
          <ul>
            {detail.contract.snapshot.items.map((i) => (
              <li key={i.product}>
                {i.label}:{" "}
                {(i.amountMinor / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </li>
            ))}
          </ul>
          <label>
            Motivo da reconciliação
            <input
              className="block w-full rounded border p-2"
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            className="my-3 rounded bg-indigo-700 p-2 text-white disabled:opacity-50"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                try {
                  const r = await reconcileAdminCommercialSubscriptionAction({
                    contractId: detail.contract.id,
                    reason,
                  });
                  if (!r.ok) {
                    setMessage(r.error.message);
                    return;
                  }
                  const d = await getAdminCommercialSubscriptionAction(
                    detail.contract.id,
                  );
                  if (d.ok) setDetail(d.data);
                  setMessage("Reconciliação registrada, sem nova cobrança.");
                } catch {
                  setMessage(
                    "Reconciliação indisponível. Consulte o estado antes de repetir.",
                  );
                }
              })
            }
          >
            Reconciliar estado
          </button>
          <h4 className="font-bold">
            Últimos {detail.historyLimit} eventos e alterações
          </h4>
          <ul>
            {detail.events.map((e) => (
              <li key={e.id}>
                {e.id}: {e.applied ? "aplicado" : "preservado sem reaplicar"}
              </li>
            ))}
          </ul>
          <ul>
            {detail.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString("pt-BR")} · {h.action} · {h.actor} ·{" "}
                {h.reason}
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
