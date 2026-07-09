# Contract — Rota pública e registry de consumo

## Rota pública `src/app/(public)/assinar/[token]/page.tsx`

- **Sem autenticação** (fora do `(protected)` layout; não há `middleware.ts` no repo — proteção é por layout/gate, então `(public)` fica naturalmente aberto).
- **Fluxo de render**:
  1. Recebe `token` do path. Calcula `sha256(token)` no servidor.
  2. `withSignatureToken(token, …)` → `getRequestByTokenCapability`.
  3. Decide o estado:
     - `null` → página "link inválido" (sem expor dados; FR-010).
     - `status='signed'` ou `used_at != null` → página "já utilizado" (FR-012).
     - `expires_at < now()` e `pending` → página "expirado" (FR-011).
     - `pending` válido → renderiza o **FormRenderer** do `target_type` (do registry) com o `payload`, e o `SignaturePad`.
  4. Envio chama `submitPublicSignature(token, { signerName, imageDataUrl })`.
- **Estados públicos** são páginas amigáveis, **não** erros HTTP crus (FR-025).
- **Conexão perdida durante captura (edge)**: enquanto `used_at IS NULL`, o reenvio é seguro; um envio incompleto não marca `signed` nem grava captura parcial (transação atômica).

## Painel interno `src/app/(protected)/signatures/page.tsx` (demo)

- Gera pedido (`createSignatureRequest` com `targetType:'demo'`), exibe **copiar link** + **QR Code** (`QrCode.tsx`), e o **status** com polling ~3 s (`getSignatureStatus`) → vira "Assinado" em `<5s` (SC-001). Botão de **assinatura manual** (`signManually`).

## Registry de `target_type` — `src/shared/domains/signatures/contract.ts`

Ponto de extensão DRY (FR-015/016, SC-004). Cada tipo registra seu schema de payload e seu renderizador de formulário:

```ts
export type SignatureTargetType = "demo"; // união cresce ao registrar novos tipos

type TargetRegistryEntry = {
  payloadSchema: ZodType<unknown>; // valida o payload na criação e na exibição pública
  FormRenderer: (props: { payload: unknown }) => ReactNode; // client component do formulário público
};

export const signatureTargetRegistry: Record<SignatureTargetType, TargetRegistryEntry> = {
  demo: { payloadSchema: demoPayloadSchema, FormRenderer: DemoSignatureForm },
};
```

### Caminho de plug-in para um novo consumidor (documentado — SC-004)

Adicionar, p. ex., entrega de EPI **sem mudar o schema**:

1. Estender a união `SignatureTargetType` com `'epi_delivery'`.
2. Adicionar entrada no `signatureTargetRegistry` (`payloadSchema` + `FormRenderer`).
3. O módulo de EPI chama `createSignatureRequest({ targetType:'epi_delivery', targetId, payload })`.

Nenhuma migração nova é necessária: `target_type`/`target_id`/`payload` (jsonb) absorvem o novo tipo.
