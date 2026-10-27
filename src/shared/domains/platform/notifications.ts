import type { DashboardPending } from "./dashboard";

export type NotificationSeverity = "high" | "medium";

export type AppNotification = {
  /** Chave estável por categoria (para "lido" client-side). */
  key: string;
  type: string;
  title: string;
  description: string;
  href: string;
  severity: NotificationSeverity;
};

/**
 * Constrói a lista de notificações **derivada** das pendências do tenant (sem
 * persistência): um alerta-resumo por categoria com contagem > 0, linkando à
 * tela de origem. Puro/testável. A leitura ("lido") é resolvida no cliente
 * (localStorage) — não há tabela nem e-mail (decisão KISS, zero infra nova).
 */
export function buildNotifications(pending: DashboardPending): AppNotification[] {
  const list: AppNotification[] = [];
  const add = (
    count: number,
    key: string,
    title: string,
    description: string,
    href: string,
    severity: NotificationSeverity,
  ) => {
    if (count > 0) list.push({ key, type: key, title, description, href, severity });
  };

  add(
    pending.pgrsExpired,
    "pgrs_expired",
    `${pending.pgrsExpired} PGR(s) vencido(s)`,
    "Documentos de PGR com validade expirada.",
    "/pgr",
    "high",
  );
  add(
    pending.pgrsDueSoon ?? 0,
    "pgrs_due_soon",
    `${pending.pgrsDueSoon ?? 0} PGR(s) a vencer`,
    "Vigência informada termina em até 30 dias. Confira a necessidade de revisão com o responsável.",
    "/pgr",
    "medium",
  );
  add(
    pending.controlsOverdue,
    "controls_overdue",
    `${pending.controlsOverdue} plano(s) de ação em atraso`,
    "Medidas de controle com prazo vencido.",
    "/risks",
    "high",
  );
  add(
    pending.trainingsExpired,
    "trainings_expired",
    `${pending.trainingsExpired} treinamento(s) vencido(s)`,
    "Treinamentos com validade expirada.",
    "/training-expiry",
    "high",
  );
  add(
    pending.episLowStock,
    "epis_low_stock",
    `${pending.episLowStock} EPI(s) abaixo do mínimo`,
    "Itens de EPI com saldo abaixo do estoque mínimo.",
    "/epi-stock",
    "medium",
  );
  add(
    pending.trainingsDueSoon,
    "trainings_due_soon",
    `${pending.trainingsDueSoon} treinamento(s) a vencer`,
    "Treinamentos próximos do vencimento.",
    "/training-expiry",
    "medium",
  );
  add(
    pending.episPendingReturn,
    "epis_pending_return",
    `${pending.episPendingReturn} EPI(s) a devolver`,
    "Itens de EPI entregues e ainda não devolvidos.",
    "/epi-returns",
    "medium",
  );
  add(
    pending.episCaExpired,
    "epis_ca_expired",
    `${pending.episCaExpired} EPI(s) com CA vencido`,
    "Itens de EPI em uso com Certificado de Aprovação vencido.",
    "/epi-stock?caStatus=expired",
    "high",
  );
  add(
    pending.episCaDueSoon,
    "epis_ca_due_soon",
    `${pending.episCaDueSoon} EPI(s) com CA a vencer`,
    "Itens de EPI em uso com Certificado de Aprovação próximo do vencimento.",
    "/epi-stock",
    "medium",
  );

  return list;
}
