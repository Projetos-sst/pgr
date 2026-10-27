"use client";
import Link from "next/link";
import { useState, useTransition, useRef, useEffect } from "react";
import type { getCommercialOverview } from "@/shared/server/platform/commercial-core";
import type { ActionResult } from "@/shared/server/result";
import { getCommercialOverviewAction } from "@/shared/server/actions/platform/commercial";
import { startCommercialCheckoutAction } from "@/shared/server/actions/platform/billing-checkout";
import { createBillingOfferAction } from "@/shared/server/actions/platform/billing-catalog";
import { startCommercialTrialAction } from "@/shared/server/actions/platform/billing-trials";
import { registerCommercialInterestAction } from "@/shared/server/actions/platform/billing-interests";
import {
  simulateCommercialPaymentAction,
  reconcileCommercialSubscriptionAction,
} from "@/shared/server/actions/platform/billing-subscriptions";
import { CommercialOfferForm } from "./commercial-offer-form";
import { SubscriptionActions, SubscriptionChangeForm } from "./subscription-controls";
import { CommercialInvoices } from "./commercial-invoices";
import { CommercialInterestInbox } from "./commercial-interest-inbox";
type Data = Awaited<ReturnType<typeof getCommercialOverview>>;
const money = (n: number) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (v: Date | string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const button = "rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50";
const labels: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  requires_action: "Ação necessária",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  unpaid: "Pagamento recusado",
  canceled: "Cancelada",
  expired: "Expirada",
  trialing: "Em teste",
};
export function CommercialPanel({
  initial,
  section,
  portalCompanyId,
  checkoutContractId,
}: {
  initial: Data;
  section: "plans" | "subscription" | "invoices" | "simulation";
  portalCompanyId?: string;
  checkoutContractId?: string;
}) {
  const [data, setData] = useState(initial),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [companyId, setCompany] = useState(initial.companyOptions[0]?.id ?? ""),
    [showOffer, setShowOffer] = useState(false),
    [checkoutUrl, setCheckoutUrl] = useState<string | null>(null),
    keys = useRef<Record<string, string>>({});
  const waiting = data.contracts.some((c) =>
    ["pending_payment", "requires_action"].includes(c.status),
  );
  async function refresh() {
    const r = await getCommercialOverviewAction();
    if (r.ok) setData(r.data);
    else setMessage(r.error.message);
  }
  useEffect(() => {
    if (!waiting || pending) return;
    let active = true;
    const timer = setInterval(() => {
      getCommercialOverviewAction()
        .then((r) => {
          if (active) {
            if (r.ok) setData(r.data);
            else setMessage(r.error.message);
          }
        })
        .catch(() => {
          if (active)
            setMessage("Falha ao consultar pagamento. Tente atualizar o estado.");
        });
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [waiting, pending]);
  function run(
    operation: () => Promise<ActionResult<unknown>>,
    success = "Operação registrada na simulação.",
  ) {
    start(async () => {
      setMessage("");
      try {
        const r = await operation();
        if (!r.ok) {
          setMessage(r.error.message);
          return;
        }
        setMessage(success);
        await refresh();
      } catch {
        setMessage("Não foi possível concluir. Consulte o estado antes de repetir.");
      }
    });
  }
  function checkout(priceId: string) {
    const target = companyId + ":" + priceId,
      storage = "billing-checkout:" + target;
    let key = keys.current[target];
    if (!key) {
      try {
        key = sessionStorage.getItem(storage) ?? "";
      } catch {}
      key ||= crypto.randomUUID();
      keys.current[target] = key;
      try {
        sessionStorage.setItem(storage, key);
      } catch {}
    }
    run(async () => {
      const r = await startCommercialCheckoutAction({ companyId, priceId, key });
      if (!r.ok && r.error.code === "DUPLICATE" && r.error.message.includes("expirou")) {
        delete keys.current[target];
        try {
          sessionStorage.removeItem(storage);
        } catch {}
      }
      if (r.ok) {
        setCheckoutUrl(r.data.checkoutUrl);
        delete keys.current[target];
        try {
          sessionStorage.removeItem(storage);
        } catch {}
      }
      return r;
    }, "Checkout criado. O acesso aguarda confirmação do pagamento.");
  }
  const trial = data.trials.find((t) => t.companyId === companyId);
  const visible = checkoutContractId
    ? data.contracts.filter((c) => c.id === checkoutContractId)
    : data.contracts;
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 text-slate-900 sm:p-8">
      <h1 className="text-2xl font-bold">
        {section === "plans"
          ? "Planos e serviços"
          : section === "invoices"
            ? "Cobranças"
            : section === "simulation"
              ? "Checkout e provedor simulado"
              : "Minha assinatura"}
      </h1>
      <p className="rounded-xl border border-amber-400 bg-amber-50 p-4 font-medium">
        Simulação de pagamentos. Nenhum valor será cobrado. Preços cadastrados aqui são
        dados de teste, sem oferta comercial aprovada.
      </p>
      <nav className="flex flex-wrap gap-4" aria-label="Financeiro">
        {[
          ["/configuracoes/planos", "Planos"],
          ["/configuracoes/assinatura", "Assinatura"],
          ["/configuracoes/assinatura/cobrancas", "Cobranças"],
          ["/configuracoes/assinatura/simulacao", "Simulador"],
          ["/plans", "Plano atual do sistema"],
        ].map(([href, label]) => (
          <Link key={href} className="underline" href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <p role="status" aria-live="polite">
        {pending ? "Processando…" : message}
      </p>
      {checkoutUrl && (
        <Link className={button} href={checkoutUrl}>
          Continuar no checkout simulado
        </Link>
      )}
      {section === "plans" && (
        <>
          <label>
            Empresa-cliente
            <select
              className="ml-2 rounded-lg border p-2"
              value={companyId}
              disabled={pending}
              onChange={(e) => {
                setCompany(e.target.value);
                setCheckoutUrl(null);
              }}
            >
              <option value="">Selecione</option>
              {data.companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!data.companyOptions.length && (
            <p>Cadastre uma empresa antes de iniciar teste ou contratação.</p>
          )}
          <section
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Comparação de ofertas"
          >
            {data.offers.map((o) => (
              <article
                key={o.id}
                className="flex flex-col gap-3 rounded-xl border bg-white p-5"
              >
                <h2 className="text-xl font-bold">{o.data.name}</h2>
                <p>{o.data.description}</p>
                <p>
                  Versão {o.version} ·{" "}
                  {o.data.interval === "one_time"
                    ? "Avulso"
                    : o.data.interval === "year"
                      ? "Anual"
                      : "Mensal"}
                </p>
                <ul>
                  {o.data.items.map((i) => (
                    <li key={i.product}>
                      {i.label}: {money(i.amountMinor)}
                    </li>
                  ))}
                </ul>
                <strong>
                  Total: {money(o.data.items.reduce((a, i) => a + i.amountMinor, 0))}
                </strong>
                <ul>
                  {o.data.benefits.map((b) => (
                    <li key={b}>✓ {b}</li>
                  ))}
                </ul>
                <p>
                  PGR e Medicina seguem os serviços desta oferta e as permissões da
                  empresa.
                </p>
                <button
                  className={button}
                  disabled={
                    pending ||
                    !companyId ||
                    data.contracts.some(
                      (c) =>
                        data.customers.find((x) => x.id === c.customerId)?.companyId ===
                          companyId &&
                        c.offerId === o.id &&
                        ["pending_payment", "requires_action"].includes(c.status),
                    )
                  }
                  onClick={() => checkout(o.id)}
                >
                  {o.data.interval === "one_time"
                    ? "Comprar serviço avulso (teste)"
                    : "Contratar no simulador"}
                </button>
              </article>
            ))}
          </section>
          {!data.offers.length && (
            <p>
              Nenhuma oferta de teste cadastrada. O administrador pode cadastrar uma
              abaixo.
            </p>
          )}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-bold">Teste por 15 dias</h2>
            <p>
              Sem cartão e sem cobrança automática. Durante o teste, PDF e DOCX são
              demonstrações com marca e downloads sem limite nesta etapa. Emissão,
              assinatura e impressão pelo sistema ficam bloqueadas.
            </p>
            {trial ? (
              <p>
                {new Date(trial.endsAt) > new Date()
                  ? "Teste em andamento"
                  : "Teste encerrado"}{" "}
                · início {date(trial.startedAt)} · fim {date(trial.endsAt)}
              </p>
            ) : (
              <button
                className={button}
                disabled={pending || !companyId}
                onClick={() => run(() => startCommercialTrialAction({ companyId }))}
              >
                Iniciar teste de 15 dias
              </button>
            )}
            {trial && (
              <fieldset disabled={pending} className="mt-4 flex flex-wrap gap-3">
                <legend>Registrar interesse comercial</legend>
                {(["pro", "pgr", "medicine", "both"] as const).map((interest) => (
                  <button
                    className={button}
                    key={interest}
                    onClick={() =>
                      run(
                        () =>
                          registerCommercialInterestAction({
                            trialId: trial.id,
                            interest,
                          }),
                        "Interesse registrado na caixa interna.",
                      )
                    }
                  >
                    {
                      {
                        pro: "Pro",
                        pgr: "PGR",
                        medicine: "Medicina",
                        both: "PGR e Medicina",
                      }[interest]
                    }
                  </button>
                ))}
              </fieldset>
            )}
          </section>
          <button
            className="self-start underline"
            onClick={() => setShowOffer(!showOffer)}
          >
            {showOffer ? "Fechar cadastro" : "Cadastrar ou versionar oferta de teste"}
          </button>
          {showOffer && (
            <CommercialOfferForm
              pending={pending}
              onSave={(offer) => run(() => createBillingOfferAction(offer))}
            />
          )}
          <CommercialInterestInbox
            key={data.interestInbox.rows.map((i) => i.id).join(":")}
            initial={data.interestInbox}
          />
        </>
      )}
      {(section === "subscription" || section === "simulation") && (
        <>
          <p>
            O retorno do checkout não ativa acesso. O estado abaixo vem do servidor e é
            atualizado enquanto o pagamento está pendente.
          </p>
          <button
            className={button}
            disabled={pending}
            onClick={() =>
              run(async () => {
                await refresh();
                return { ok: true, data: null };
              }, "Estado consultado.")
            }
          >
            Atualizar estado
          </button>
          {!visible.length && (
            <p>
              Nenhuma contratação encontrada.{" "}
              <Link className="underline" href="/configuracoes/planos">
                Consultar planos
              </Link>
            </p>
          )}
          {visible.map((c) => (
            <article
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border bg-white p-5"
            >
              <h2 className="text-lg font-bold">
                {c.snapshot.name} —{" "}
                {data.customers.find((x) => x.id === c.customerId)?.name}
              </h2>
              <p>
                {labels[c.status] ?? c.status} ·{" "}
                {c.access ? "acesso comercial vigente" : "sem acesso comercial vigente"}
              </p>
              <p>
                Período: {date(c.periodStart)} até {date(c.periodEnd)}
                {c.cancelAtPeriodEnd ? " · cancelamento agendado" : ""}
              </p>
              <ul>
                {c.snapshot.items.map((i) => (
                  <li key={i.product}>
                    {i.label}: {money(i.amountMinor)}
                  </li>
                ))}
              </ul>
              <SubscriptionActions contract={c} onChanged={refresh} />
              <button
                className={button}
                disabled={pending}
                onClick={() =>
                  run(() =>
                    reconcileCommercialSubscriptionAction({
                      contractId: c.id,
                      reason: "Conferência explícita pelo administrador",
                    }),
                  )
                }
              >
                Reconciliar estado
              </button>
              {section === "simulation" && (
                <fieldset
                  disabled={pending}
                  className="flex flex-wrap gap-2 border-t pt-3"
                >
                  <legend>Cenários fictícios do provedor</legend>
                  {(
                    [
                      "success",
                      "requires_action",
                      "refused",
                      "renewal",
                      "late",
                      "recovery",
                      "cancel",
                      "duplicate",
                      "out_of_order",
                    ] as const
                  ).map((scenario) => (
                    <button
                      className={button}
                      key={scenario}
                      onClick={() =>
                        run(() =>
                          simulateCommercialPaymentAction({ contractId: c.id, scenario }),
                        )
                      }
                    >
                      {
                        {
                          success: "Aprovar",
                          requires_action: "Exigir ação",
                          refused: "Recusar",
                          renewal: "Renovar",
                          late: "Atrasar",
                          recovery: "Recuperar pagamento",
                          cancel: "Cancelar",
                          duplicate: "Repetir evento",
                          out_of_order: "Evento antigo",
                        }[scenario]
                      }
                    </button>
                  ))}
                </fieldset>
              )}
            </article>
          ))}
          {section === "subscription" && (
            <SubscriptionChangeForm
              contracts={data.contracts}
              offers={data.offers}
              onChanged={refresh}
            />
          )}
        </>
      )}
      {section === "invoices" && (
        <CommercialInvoices
          initial={data.invoiceList}
          customers={data.customers}
          portalCompanyId={portalCompanyId}
        />
      )}
    </main>
  );
}
