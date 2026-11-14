import {
  DIVERGENCE_LABELS,
  RECONCILIATION_RESULT_LABELS,
  RECONCILIATION_SOURCE_LABELS,
  type AdminSubscriptionDetail,
} from "@/shared/domains/commercial/admin-subscriptions";

import { Table } from "../../../_ui/list";
import { StatusBadge } from "../../../_ui/status-badge";
import {
  PERIOD_LABELS,
  SERVICE_LABELS,
  STATUS_LABELS,
  describeItem,
  divergenceTone,
  formatInstant,
  formatPeriod,
  statusTone,
} from "./format";

const sectionClass = "glass-card flex flex-col gap-3 rounded-xl p-5 text-sm";
const headingClass = "text-text text-sm font-semibold";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-subtle text-xs">{label}</dt>
      <dd className="text-text font-mono text-xs break-all">{value}</dd>
    </div>
  );
}

export function ContractSection({ detail }: { detail: AdminSubscriptionDetail }) {
  return (
    <section className={sectionClass} aria-label="Contratação">
      <h2 className={headingClass}>Contratação e preço contratado</h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact label="Escritório" value={detail.orgId} />
        <Fact label="Contratação" value={detail.contractId} />
        <Fact
          label="Oferta"
          value={`${detail.offerName} (${detail.offerCode} v${detail.offerVersion})`}
        />
        <Fact
          label="Cobrança"
          value={PERIOD_LABELS[detail.billingPeriod] ?? detail.billingPeriod}
        />
        <Fact label="Vigência" value={formatPeriod(detail.termStart, detail.termEnd)} />
        <Fact label="Catálogo" value={detail.fictitious ? "Fictício" : "Comercial"} />
      </dl>
      <ul className="flex flex-col gap-1">
        {detail.items.map((item) => (
          <li key={item.position}>{describeItem(item)}</li>
        ))}
      </ul>
    </section>
  );
}

export function MirrorSection({ detail }: { detail: AdminSubscriptionDetail }) {
  const { subscription } = detail;
  return (
    <section className={sectionClass} aria-label="Assinatura no provedor">
      <h2 className={headingClass}>Assinatura espelhada do provedor</h2>
      {subscription ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-text-subtle text-xs">Status</dt>
            <dd>
              <StatusBadge
                tone={statusTone(subscription.status)}
                label={STATUS_LABELS[subscription.status]}
              />
            </dd>
          </div>
          <Fact
            label="Assinatura (provedor)"
            value={subscription.providerSubscriptionId}
          />
          <Fact
            label="Cliente (provedor)"
            value={subscription.providerCustomerId ?? "—"}
          />
          <Fact
            label="Período atual"
            value={formatPeriod(
              subscription.currentPeriodStart,
              subscription.currentPeriodEnd,
            )}
          />
          <Fact
            label="Cancela ao fim do período"
            value={subscription.cancelAtPeriodEnd ? "Sim" : "Não"}
          />
          <Fact
            label="Último evento aplicado"
            value={formatInstant(subscription.lastEventAt)}
          />
        </dl>
      ) : (
        <p>Esta contratação ainda não tem assinatura espelhada.</p>
      )}
      <StatusBadge
        tone={divergenceTone(detail.divergence)}
        label={DIVERGENCE_LABELS[detail.divergence]}
      />
    </section>
  );
}

export function EntitlementsSection({ detail }: { detail: AdminSubscriptionDetail }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Direitos de uso">
      <h2 className={headingClass}>Direitos de uso gravados</h2>
      {detail.entitlements.length === 0 ? (
        <p className="text-text-subtle text-sm">Nenhum direito de uso gravado.</p>
      ) : (
        <Table headers={["Serviço", "Empresa", "Situação", "Motivo", "Aplicado"]}>
          {detail.entitlements.map((row) => (
            <tr key={`${row.companyId ?? "org"}:${row.service}`}>
              <td className="px-4 py-2">{SERVICE_LABELS[row.service] ?? row.service}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {row.companyId ?? "Escritório"}
              </td>
              <td className="px-4 py-2">
                {row.status === "active" ? "Ativo" : "Inativo"}
              </td>
              <td className="px-4 py-2 font-mono text-xs">{row.reason}</td>
              <td className="px-4 py-2">{row.applied ? "Sim" : "Não"}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

export function EventsSection({ detail }: { detail: AdminSubscriptionDetail }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Eventos do provedor">
      <h2 className={headingClass}>Últimos eventos do provedor</h2>
      {detail.events.length === 0 ? (
        <p className="text-text-subtle text-sm">Nenhum evento recebido.</p>
      ) : (
        <Table headers={["Tipo", "Resultado", "Detalhe", "Data"]}>
          {detail.events.map((event) => (
            <tr key={`${event.type}:${event.occurredAt}`}>
              <td className="px-4 py-2 font-mono text-xs">{event.type}</td>
              <td className="px-4 py-2">{event.outcome}</td>
              <td className="px-4 py-2 font-mono text-xs">{event.detail}</td>
              <td className="px-4 py-2">{formatInstant(event.occurredAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

export function HistorySection({ detail }: { detail: AdminSubscriptionDetail }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Histórico de reconciliações">
      <h2 className={headingClass}>Histórico de reconciliações</h2>
      {detail.reconciliations.length === 0 ? (
        <p className="text-text-subtle text-sm">Nenhuma reconciliação registrada.</p>
      ) : (
        <Table headers={["Data", "Operador", "Motivo", "Fonte", "Resultado"]}>
          {detail.reconciliations.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-2">{formatInstant(row.createdAt)}</td>
              <td className="px-4 py-2 font-mono text-xs">{row.operatorId}</td>
              <td className="px-4 py-2">{row.reason}</td>
              <td className="px-4 py-2">{RECONCILIATION_SOURCE_LABELS[row.source]}</td>
              <td className="px-4 py-2">
                {RECONCILIATION_RESULT_LABELS[row.result]}
                <p className="text-text-subtle font-mono text-xs">{row.detail}</p>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
