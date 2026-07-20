# Contracts — Repositories (Fase 06)

Regras gerais (padrão real das fatias 007–022):

- Todo repositório importa `"server-only"`, envolve queries em `withOrg(orgId, tx => …)` e é o **único** a tocar Drizzle.
- Escritas passam por `auditedTenantWrite(orgId, "<op>", () => …)`; log sem PII.
- Listagens retornam `Paginated<T> = { rows, total }` via `resolvePageParams` (pageSize 20/máx 100).
- Inexistente/cross-tenant → `throw new NotFoundError()` (→ 404). Origem inválida/cross-tenant → `throw new FkNotFoundError()` (→ 422). Duplicidade → erro de `DUPLICATE` (23505 → 409).
- Nenhum repositório recebe `orgId` do cliente — vem sempre do `ctx`/sessão.

---

## `repositories/service-orders.ts`

```txt
listServiceOrders(orgId, filters?, page?): Promise<Paginated<ServiceOrderListItem>>
getServiceOrderById(orgId, id): Promise<ServiceOrderDetail | null>          // inclui itens
createServiceOrder(orgId, values: ServiceOrderValues): Promise<ServiceOrder>
  // 1) valida assigned_employee_id no tenant (senão FkNotFound/422)
  // 2) withOrg + tx: SELECT id FROM orgs WHERE id=orgId FOR UPDATE  (lock do tenant)
  // 3) number = coalesce(max(number),0)+1  (escopo org)
  // 4) INSERT service_orders
  // 5) INSERT service_order_items (manuais + snapshots)  — MESMA transação
  // UNIQUE(org_id, number) = backstop → DUPLICATE/409
updateServiceOrder(orgId, id, values): Promise<ServiceOrder | null>
  // bloqueia edição de itens se OS assinada (imutável)
deleteServiceOrder(orgId, id): Promise<boolean>
  // só se NÃO assinada e status ∈ {open,in_progress}; senão erro de estado
listServiceOrderItems(orgId, serviceOrderId): Promise<ServiceOrderItem[]>
buildSuggestedItems(orgId, employeeId): Promise<SuggestedItem[]>
  // employee.ges_id → risks → epi_risk → epi_catalog  (snapshots textuais)
```

## `repositories/service-order-signature.ts`

```txt
getServiceOrderSignatureSource(orgId, serviceOrderId): Promise<SOSignatureSource | null>
  // dados p/ montar o payload público NO SERVIDOR (number, companyName, employeeName, issuedAt, items)
getServiceOrderSignatureState(orgId, serviceOrderId): Promise<SOSignatureView>
  // estado derivado de signature_requests/captures (none|pending|signed|expired|cancelled)
// escrita da solicitação reusa createSignatureRequestCore (sem repo novo de assinatura)
```

## `repositories/accidents.ts`

```txt
listAccidents(orgId, filters?, page?): Promise<Paginated<AccidentListItem>>
getAccidentById(orgId, id): Promise<Accident | null>
createAccident(orgId, values: AccidentValues): Promise<Accident>       // valida company_id/employee_id no tenant
updateAccident(orgId, id, values): Promise<Accident | null>
deleteAccident(orgId, id): Promise<boolean>
setAccidentStatus(orgId, id, transition): Promise<Accident | null>     // aplica incident-lifecycle (regras puras)
advanceIncidentOnFirstPlan(tx, orgId, incidentId): Promise<void>       // chamado DENTRO da tx de action_plans
countActivePlansForIncident(orgId, incidentId): Promise<number>        // usado no bloqueio de conclusão
```

## `repositories/action-plans.ts`

```txt
listActionPlans(orgId, filters?, page?): Promise<Paginated<ActionPlanListItem>>  // central multiorigem
getActionPlanById(orgId, id): Promise<ActionPlan | null>
createActionPlan(orgId, values: ActionPlanValues): Promise<ActionPlan>
  // valida origin (tipo suportado + existe + mesmo tenant) → FkNotFound/422
  // se origin_type=incident: advanceIncidentOnFirstPlan(tx, …) na MESMA transação
updateActionPlan(orgId, id, values): Promise<ActionPlan | null>
setActionPlanStatus(orgId, id, transition): Promise<ActionPlan | null> // completed_at/cancelled_at; terminal não volta
deleteActionPlan(orgId, id): Promise<boolean>                          // física só se planned e sem dependentes
resolveOriginRef(tx, orgId, origin_type, origin_id): Promise<boolean>  // validação de origem (risk|incident)
```

## `repositories/risk-audits.ts`

```txt
listRiskAudits(orgId, filters?, page?): Promise<Paginated<RiskAuditListItem>>   // p/ kanban
getRiskAuditById(orgId, id): Promise<RiskAudit | null>
createRiskAudit(orgId, values: RiskAuditValues): Promise<RiskAudit>
  // valida origin (risk|incident, existe, tenant); UNIQUE parcial (uma ativa/origem) → DUPLICATE/409
setRiskAuditStatus(orgId, id, transition, justification?): Promise<RiskAudit | null>
  // awaiting_analysis→planning_actions→completed; justificativa obrigatória conforme regra
```
