# Briefing US1 — Plugar CAEPI no catálogo de EPI (autofill de CA)

> Issues **#18** (catálogo), **#75**/**#115** (validação de CA). Fluxo: panorama **F1** + a validação
> de CA descrita em [`115-caepi-validacao-ca.md`](./115-caepi-validacao-ca.md). Decisão-mãe: **D6** do
> [brainstorming](./fase02-epi-completion-brainstorming.md).

## Problema

O `CaField`/`useCaepiValidation`/`lookupCa`/REST CAEPI já existem e passam testes, mas **não estão
plugados** no formulário de catálogo (`grep -rn "CaField" src/app` = vazio). Os campos `ca`,
`caValidUntil`, `manufacturer`, `norm` são `TextField` manuais. A US1 da spec 011 (autofill no cadastro
de EPI) não é satisfeita hoje.

## Alvo

No `src/app/(protected)/epi-catalog/_components/epi-catalog-form.tsx`, substituir o `TextField` de
**CA** pelo `CaField` (lookup no blur contra `GET /api/integrations/caepi/[ca]`) e, no callback
`onFound`, autopreencher os campos controlados `manufacturer`, `norm` e `caValidUntil` do próprio form
(cópia por valor). Campos permanecem **sempre editáveis**.

## Regras verificáveis (reuso da spec 011, aplicadas ao form)

- CA **válido e vigente** → badge verde + autofill de fabricante/norma/validade.
- CA **vencido** (`valid_until < hoje` ou situação vencida) → aviso "CA vencido" **distinto** de
  inexistente; **ainda** autopreenche (usuário decide).
- CA **não encontrado** → aviso inline "CA não encontrado"; cadastro segue manual.
- **Base CAEPI vazia/nunca sincronizada** → aviso "base CAEPI ainda não sincronizada"; **nunca** erro
  fatal.
- Formato inválido (vazio/não-dígito) → não dispara consulta no cliente.
- Digitação rápida → aborta a requisição anterior (AbortController — herdado do `useLookup`).
- **Qualquer** desfecho (válido/vencido/não-encontrado/erro/timeout) **nunca bloqueia** o salvar.

## Não fazer (YAGNI / fronteiras)

- **Não** alterar `epis.ts` nem `epiCatalogInputSchema` (o modelo já tem os campos).
- **Não** persistir resultado da CAEPI numa tabela do tenant — o `caepi_certificates` global é a fonte;
  o catálogo guarda só os valores autopreenchidos que o usuário confirmar ao salvar.
- **Não** mexer no job de ingestão nem na tabela CAEPI (fora do escopo desta leva).

## Testes

- Unit: `CaField` chama `onFound` em `valid` e `expired`, **não** em `not_found`; salvar com CA
  vazio/errado funciona (não bloqueia).
- Integração: já coberta pela fatia 011 (lookup 3 estados + base vazia + guarda de sessão) — **reusar**,
  não reimplementar.

## Housekeeping

Ao fechar: marcar #18 concluída (CRUD já mergeado + wiring), **#115** concluída e **#75** como
**duplicada de #115**.
