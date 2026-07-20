# Contracts — Server Actions (Fase 06)

Padrão real: cada Action é `"use server"`, envolvida por `officeAction("<op>", async (ctx) => …, { audit })` → retorna `ActionResult<T>` (`{ok:true,data}` | `{ok:false,error:{code,message,fields?}}`). Gate `requireOfficeStaff()` (só `owner`/`collaborator`; `client`→`FORBIDDEN`/403) já embutido em `officeAction`. Erros mapeados por `toActionError` (não HTTP cru). Actions **não** tocam Drizzle — chamam repositórios. Input validado por schema Zod do domínio. Escritas com `{ audit: true }`; leituras sem audit.

---

## `server/actions/safety/service-orders.ts`

```txt
listServiceOrdersAction(input): ActionResult<Paginated<ServiceOrderListItem>>
getServiceOrderAction(id): ActionResult<ServiceOrderDetail>
createServiceOrderAction(input): ActionResult<ServiceOrder>            // audit
updateServiceOrderAction(id, input): ActionResult<ServiceOrder>       // audit; itens imutáveis se assinada
deleteServiceOrderAction(id): ActionResult<void>                      // audit; só não-assinada + open/in_progress
getSuggestedItemsAction(employeeId): ActionResult<SuggestedItem[]>    // pré-popular checklist (GES→risks/EPIs)
```

## `server/actions/safety/service-order-signature.ts` (via `server/safety/service-order-signature-core.ts`)

```txt
createServiceOrderSignatureAction(serviceOrderId, opts?): ActionResult<CreateSOSignatureResult>
  // { signature: SOSignatureView, requestId, publicUrl, qrCodeDataUrl }  — publicUrl SÓ aqui
  // monta payload público mínimo NO SERVIDOR; delega cota/token/persistência a createSignatureRequestCore
getServiceOrderSignatureAction(serviceOrderId): ActionResult<SOSignatureView>  // estado derivado (sem token/URL)
```

Reuso: `createSignatureRequestCore`, registries (`SIGNATURE_TARGET_TYPES`/`signatureTargetRegistry`/`signatureFormRegistry`) + `service-order` payload strict. **Não** cria Action pública (a assinatura pública roda pela rota `/signature-requests/[token]` já existente).

## `server/actions/safety/accidents.ts`

```txt
listAccidentsAction(input): ActionResult<Paginated<AccidentListItem>>
getAccidentAction(id): ActionResult<Accident>
createAccidentAction(input): ActionResult<Accident>                  // audit; sem dado de saúde no log
updateAccidentAction(id, input): ActionResult<Accident>             // audit
deleteAccidentAction(id): ActionResult<void>                        // audit
setAccidentStatusAction(id, transition): ActionResult<Accident>     // audit; incident-lifecycle; conclusão exige justificativa e sem plano ativo
```

## `server/actions/safety/action-plans.ts`

```txt
listActionPlansAction(input): ActionResult<Paginated<ActionPlanListItem>>   // central multiorigem + filtros
getActionPlanAction(id): ActionResult<ActionPlan>
createActionPlanAction(input): ActionResult<ActionPlan>            // audit; valida origem (risk|incident) → FK_NOT_FOUND/422
updateActionPlanAction(id, input): ActionResult<ActionPlan>        // audit
setActionPlanStatusAction(id, transition): ActionResult<ActionPlan> // audit; completed_at/cancelled_at; terminal não volta
deleteActionPlanAction(id): ActionResult<void>                     // audit; física só se planned+sem dependentes; senão cancelar
```

## `server/actions/safety/risk-audits.ts`

```txt
listRiskAuditsAction(input): ActionResult<Paginated<RiskAuditListItem>>     // dados do kanban
getRiskAuditAction(id): ActionResult<RiskAudit>
createRiskAuditAction(input): ActionResult<RiskAudit>            // audit; uma ativa/origem → DUPLICATE/409
setRiskAuditStatusAction(id, transition, justification?): ActionResult<RiskAudit>  // audit; transição explícita + justificativa
```

## `server/safety/action-plan-suggestion-core.ts` (consumido por Action + REST)

```txt
suggestActionPlanAction(originType, originId): ActionResult<ActionPlan5W2HSuggestion>
  // 1) valida origem no tenant (risk|incident)
  // 2) gate de cota (isAiSuggestionAvailable; free 20/mês, pro ∞) → QUOTA_EXCEEDED/402
  // 3) monta input NÃO-PII (allowlist research.md §7)
  // 4) chama Anthropic (tool use, saída 5W2H validada por Zod); falha → AI_UNAVAILABLE/502 (degradação graciosa)
  // 5) recordAiUsage(orgId, "action_plan_suggestion")  (ai_usage_events.kind = TEXT, zero migration)
  // Nunca bloqueia o CRUD: a sugestão é opcional e só preenche campos.
```

## Mapa Action → FR

| Grupo                    | FRs            |
| ------------------------ | -------------- |
| service-orders           | FR-007..FR-015 |
| service-orders-signature | FR-016..FR-020 |
| accidents + status       | FR-021..FR-030 |
| action-plans             | FR-031..FR-036 |
| risk-audits              | FR-037..FR-040 |
| action-plan-suggestion   | FR-041..FR-043 |
