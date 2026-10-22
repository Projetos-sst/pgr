"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { getCommercialCharges } from "@/shared/server/platform/billing-charges-core";
import { getCommercialChargesAction } from "@/shared/server/actions/platform/billing-charges";
import { openCommercialPortalAction } from "@/shared/server/actions/platform/billing-portal";
type Invoices = Awaited<ReturnType<typeof getCommercialCharges>>;
const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);
const button = "rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50";
export function CommercialInvoices({
  initial,
  customers,
  portalCompanyId,
}: {
  initial: Invoices;
  customers: { id: string; companyId: string; name: string }[];
  portalCompanyId?: string;
}) {
  const [data, setData] = useState(initial),
    [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const [customerId, setCustomer] = useState(
    customers.find((c) => !portalCompanyId || c.companyId === portalCompanyId)?.id ?? "",
  );
  const [portal, setPortal] = useState<{ portalUrl: string; expiresAt: string } | null>(
      null,
    ),
    key = useRef<string | null>(null);
  function page(value: number) {
    start(async () => {
      try {
        const result = await getCommercialChargesAction({
          page: value,
          companyId: portalCompanyId,
        });
        if (result.ok) setData(result.data);
        else setMessage(result.error.message);
      } catch {
        setMessage("Não foi possível consultar as cobranças.");
      }
    });
  }
  function openPortal() {
    start(async () => {
      try {
        key.current ??= crypto.randomUUID();
        const result = await openCommercialPortalAction({ customerId, key: key.current });
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        setPortal(result.data);
        key.current = null;
        setMessage("");
      } catch {
        setMessage("Não foi possível abrir o portal. Tente novamente.");
      }
    });
  }
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">Histórico de cobranças</h2>
      <p>
        Registros de simulação. Não são notas fiscais. Nenhum cartão é coletado ou
        armazenado neste modo.
      </p>
      <p role="status">{pending ? "Consultando…" : message}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="p-2">Data e empresa</th>
              <th className="p-2">Itens contratados</th>
              <th className="p-2">Total</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="p-2">
                  {new Date(i.createdAt).toLocaleString("pt-BR")}
                  <br />
                  {i.companyName}
                </td>
                <td className="p-2">
                  <ul>
                    {i.items.map((item) => (
                      <li key={item.product}>
                        {item.label}: {money(item.amountMinor)}
                      </li>
                    ))}
                  </ul>
                  {!i.items.length && <span>Discriminação histórica indisponível</span>}
                </td>
                <td className="p-2 whitespace-nowrap">{money(i.amountMinor)}</td>
                <td className="p-2">
                  {(
                    {
                      paid: "Paga (simulada)",
                      open: "Em aberto",
                      void: "Cancelada",
                    } as Record<string, string>
                  )[i.status] ?? i.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.rows.length && <p>Nenhuma cobrança neste filtro.</p>}
      <div className="flex items-center gap-4">
        <button
          className={button}
          disabled={pending || data.page <= 1}
          onClick={() => page(data.page - 1)}
        >
          Anterior
        </button>
        <span>Página {data.page}</span>
        <button
          className={button}
          disabled={pending || !data.hasMore}
          onClick={() => page(data.page + 1)}
        >
          Próxima
        </button>
      </div>
      <section className="flex flex-col gap-3 rounded-xl border bg-white p-5">
        <h3 className="font-bold">Método de pagamento e portal</h3>
        <p>
          Nenhum cartão cadastrado no simulador. A sessão abaixo é temporária e exige seu
          acesso de administrador.
        </p>
        <label className="flex flex-col gap-1">
          Cliente comercial
          <select
            className="rounded-lg border p-2"
            disabled={pending}
            value={customerId}
            onChange={(e) => {
              setCustomer(e.target.value);
              setPortal(null);
              key.current = null;
            }}
          >
            <option value="">Selecione</option>
            {customers
              .filter((c) => !portalCompanyId || c.companyId === portalCompanyId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <button className={button} disabled={pending || !customerId} onClick={openPortal}>
          Gerar sessão de portal simulado
        </button>
        {portal && (
          <p>
            <Link className="underline" href={portal.portalUrl}>
              Abrir portal temporário
            </Link>{" "}
            · válido até {new Date(portal.expiresAt).toLocaleString("pt-BR")}
          </p>
        )}
      </section>
    </section>
  );
}
