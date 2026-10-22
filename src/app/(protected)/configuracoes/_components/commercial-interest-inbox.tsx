"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { getCommercialInterests } from "@/shared/server/platform/billing-interests-core";
import {
  getCommercialInterestsAction,
  acknowledgeCommercialInterestAction,
} from "@/shared/server/actions/platform/billing-interests";
type Inbox = Awaited<ReturnType<typeof getCommercialInterests>>;
export function CommercialInterestInbox({ initial }: { initial: Inbox }) {
  const [data, setData] = useState(initial),
    [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const [status, setStatus] = useState<"pending" | "acknowledged" | "">("");
  function load(page: number, nextStatus = status) {
    start(async () => {
      try {
        const result = await getCommercialInterestsAction({
          page,
          status: nextStatus || undefined,
        });
        if (result.ok) setData(result.data);
        else setMessage(result.error.message);
      } catch {
        setMessage("Não foi possível consultar os alertas.");
      }
    });
  }
  function acknowledge(id: string) {
    start(async () => {
      try {
        const result = await acknowledgeCommercialInterestAction({
          id,
          reason: "Interesse comercial marcado como visto pelo administrador",
        });
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        const fresh = await getCommercialInterestsAction({
          page: data.page,
          status: status || undefined,
        });
        if (fresh.ok) setData(fresh.data);
      } catch {
        setMessage("Não foi possível registrar a consulta do alerta.");
      }
    });
  }
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Caixa de interesse comercial</h2>
      <p>
        Alertas internos gerados por solicitação explícita. Nenhuma mensagem externa é
        enviada.
      </p>
      <label>
        Exibir
        <select
          className="ml-2 rounded-lg border p-2"
          value={status}
          onChange={(e) => {
            const next = e.target.value as typeof status;
            setStatus(next);
            load(1, next);
          }}
        >
          <option value="">Todos</option>
          <option value="pending">Não vistos</option>
          <option value="acknowledged">Vistos</option>
        </select>
      </label>
      <p role="status">{pending ? "Atualizando…" : message}</p>
      {!data.rows.length && <p>Nenhum interesse neste filtro.</p>}
      {data.rows.map((row) => (
        <article key={row.id} className="flex flex-col gap-2 border-t pt-3">
          <h3 className="font-semibold">
            {row.companyName} ·{" "}
            {
              (
                {
                  pgr: "PGR",
                  medicine: "Medicina",
                  both: "PGR e Medicina",
                  pro: "Pro",
                } as Record<string, string>
              )[row.interest]
            }
          </h3>
          <p>{row.message || "Solicitação sem observação adicional."}</p>
          <p>
            Registrado em {new Date(row.createdAt).toLocaleString("pt-BR")} ·{" "}
            {row.acknowledgedAt ? "Visto" : "Não visto"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/companies/${row.companyId}`} className="underline">
              Consultar empresa
            </Link>
            {!row.acknowledgedAt && (
              <button
                type="button"
                disabled={pending}
                className="rounded-lg bg-indigo-700 px-3 py-2 text-white disabled:opacity-50"
                onClick={() => acknowledge(row.id)}
              >
                Marcar como visto
              </button>
            )}
          </div>
        </article>
      ))}
      <div className="flex gap-3">
        <button disabled={pending || data.page <= 1} onClick={() => load(data.page - 1)}>
          Anterior
        </button>
        <span>Página {data.page}</span>
        <button disabled={pending || !data.hasMore} onClick={() => load(data.page + 1)}>
          Próxima
        </button>
      </div>
    </section>
  );
}
