# Plano — Personalização da UI do Clerk (Opção 1: `appearance`)

Documento de referência para personalizar a identidade visual dos componentes prontos do Clerk (`<SignIn />`, `<SignUp />`, `<OrganizationSwitcher />`, `<UserProfile />`, `<OrganizationList />`, `<UserButton />`) **sem** abrir mão da UX/lógica fornecida pelo Clerk.

> Decisão: começar por esta opção (menor risco, sem regredir o slice `feature/clerk-auth-foundation`). Custom flows com hooks (`useSignIn`, `useSignUp`, `useOrganizationList`, `useUser`) ficam para uma segunda fase, apenas em telas que precisem fugir do template (ex.: onboarding multi-step, tela de convite custom).

---

## 1. Escopo

Componentes Clerk atualmente em uso no projeto (slice `001-clerk-auth`):

- `<SignIn />` — página `/sign-in`
- `<SignUp />` — página `/sign-up` (invite-only)
- `<OrganizationList />` — área protegida (seleção/criação de org)
- `<OrganizationSwitcher />` — header da área autenticada
- `<UserButton />` / `<UserProfile />` — menu do usuário

A personalização deve cobrir **todos** acima de forma consistente via configuração global no `<ClerkProvider>`, com overrides pontuais por componente quando necessário.

---

## 2. Eixos de personalização

O prop `appearance` aceita 4 grandes blocos:

### 2.1 `variables` — design tokens globais

Tokens semânticos aplicados a todos os componentes. Mapeiam 1:1 com as CSS custom properties do projeto (`app/globals.css`).

```ts
variables: {
  colorPrimary: 'var(--foreground)',     // ou hex/hsl direto
  colorBackground: 'var(--background)',
  colorText: 'var(--foreground)',
  colorTextSecondary: '...',
  colorDanger: '...',
  colorSuccess: '...',
  colorWarning: '...',
  colorInputBackground: '...',
  colorInputText: '...',
  fontFamily: 'var(--font-sans)',
  fontFamilyButtons: 'var(--font-sans)',
  fontSize: '0.95rem',
  borderRadius: '0.75rem',
  spacingUnit: '1rem',
}
```

> Hoje o `globals.css` define apenas `--background` e `--foreground`. **Ação pendente**: expandir os tokens (primary, muted, border, danger, etc.) antes de aplicar.

### 2.2 `elements` — classes por slot

Override fino de cada slot interno via classes Tailwind. Exemplos dos slots mais usados:

| Slot                                           | Para que serve                           |
| ---------------------------------------------- | ---------------------------------------- |
| `rootBox`                                      | wrapper externo do componente            |
| `card`                                         | card principal (sign-in/sign-up/profile) |
| `headerTitle`, `headerSubtitle`                | títulos do header                        |
| `socialButtonsBlockButton`                     | botões OAuth                             |
| `dividerLine`, `dividerText`                   | divisor "OR"                             |
| `formFieldLabel`, `formFieldInput`             | label e input dos forms                  |
| `formButtonPrimary`                            | CTA principal (Continue, Sign in)        |
| `footerActionLink`                             | link "Sign up"/"Sign in" no rodapé       |
| `identityPreview`                              | preview de email/identidade              |
| `organizationSwitcherTrigger`                  | botão do switcher no header              |
| `organizationPreview`                          | linha de cada org na lista               |
| `userButtonAvatarBox`, `userButtonPopoverCard` | avatar e popover do UserButton           |
| `profileSectionTitle`, `profileSectionContent` | seções do UserProfile                    |

```ts
elements: {
  card: 'bg-background border border-foreground/10 shadow-sm rounded-xl',
  headerTitle: 'text-foreground text-2xl font-semibold',
  formButtonPrimary:
    'bg-foreground text-background hover:bg-foreground/90 ' +
    'rounded-lg font-medium normal-case',
  formFieldInput:
    'bg-background border-foreground/15 focus:border-foreground rounded-lg',
  footerActionLink: 'text-foreground underline-offset-4 hover:underline',
  socialButtonsBlockButton:
    'border-foreground/15 hover:bg-foreground/5 rounded-lg',
}
```

### 2.3 `layout` — estrutura e branding

- `logoImageUrl`, `logoPlacement` (`inside` | `outside` | `none`)
- `socialButtonsPlacement` (`top` | `bottom`), `socialButtonsVariant` (`iconButton` | `blockButton`)
- `showOptionalFields`, `helpPageUrl`, `privacyPageUrl`, `termsPageUrl`
- `unsafe_disableDevelopmentModeWarnings` (apenas dev)

### 2.4 `baseTheme` (opcional)

`@clerk/themes` traz `dark`, `neobrutalism`, `shadesOfPurple`, etc. Pode-se herdar e sobrescrever:

```ts
import { dark } from '@clerk/themes'
appearance={{ baseTheme: dark, variables: {...} }}
```

> Útil se quisermos dark mode automático. Avaliar usar com `prefers-color-scheme` ou toggle manual.

---

## 3. Arquitetura proposta

### 3.1 Arquivo central de tema

Criar `lib/clerk/appearance.ts` exportando uma constante única reutilizada por todos os pontos:

```ts
// lib/clerk/appearance.ts
import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  variables: {
    /* tokens globais */
  },
  elements: {
    /* classes Tailwind por slot */
  },
  layout: {
    /* logo, social buttons, links */
  },
};
```

### 3.2 Aplicação global

`app/layout.tsx`:

```tsx
<ClerkProvider appearance={clerkAppearance} localization={ptBR}>
  ...
</ClerkProvider>
```

### 3.3 Overrides pontuais

Quando um componente precisar divergir (ex.: `<OrganizationSwitcher />` no header com visual de chip), passar `appearance` apenas naquele componente — ele faz **merge** com o global.

```tsx
<OrganizationSwitcher
  appearance={{
    elements: {
      organizationSwitcherTrigger: "h-9 px-3 rounded-full ...",
    },
  }}
/>
```

---

## 4. Localização (bônus)

Como o projeto é PT-BR, aproveitar para configurar simultaneamente:

```ts
import { ptBR } from '@clerk/localizations'
<ClerkProvider localization={ptBR} appearance={clerkAppearance}>
```

---

## 5. Passo a passo de implementação (futuro)

1. **Expandir tokens em `app/globals.css`**
   Adicionar variáveis semânticas: `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--danger`, `--success`. Definir dark mode via `prefers-color-scheme` (já parcialmente existe).

2. **Criar `lib/clerk/appearance.ts`**
   Mapear tokens → `variables`. Definir `elements` para os slots prioritários (card, form inputs, primary button, footer links, switcher trigger, user button).

3. **Aplicar no `<ClerkProvider>`** (`app/layout.tsx`)
   Passar `appearance` + `localization={ptBR}`.

4. **Smoke test visual**
   - `/sign-in`, `/sign-up`
   - Área protegida → `<OrganizationList />` (sem org) e `<OrganizationSwitcher />` (com org)
   - `<UserButton />` aberto → conferir popover e link para `<UserProfile />`
   - Verificar dark mode (se ativado).

5. **Refinar slot a slot**
   Inspecionar via DevTools: cada elemento Clerk tem `data-localization-key` e classes `cl-*`. Ajustar `elements` até casar com a identidade visual.

6. **Documentar tokens finais**
   Atualizar este doc com as decisões finais de cor/tipografia e screenshots antes/depois.

---

## 6. Pontos de atenção

- **Não usar `globalAppearance` deprecado** — somente o prop `appearance` no `<ClerkProvider>` e/ou por componente.
- **Classes em `elements` substituem, não complementam** — para preservar comportamentos padrão (estados focus/hover), incluir as variantes Tailwind correspondentes manualmente.
- **Versionar mudanças junto com testes visuais** — qualquer ajuste em `appearance` deve passar pelos 55 testes existentes (unit + integration) sem regressão, já que a lógica não muda.
- **CSP / fontes externas** — se trocar `fontFamily` para fonte custom, garantir que `next.config.ts` e CSP do middleware permitam o domínio.
- **`baseTheme: dark`** desativa boa parte das `variables` de cor — escolher um caminho (tokens manuais OU baseTheme), evitar misturar.

---

## 7. Migração futura para Opção 2 (custom flows)

Quando uma tela específica precisar de UX fora do template Clerk:

- Substituir o componente pronto por uma página própria usando hooks:
  - `useSignIn()` / `useSignUp()` / `useClerk()` para auth
  - `useOrganizationList()` / `useOrganization()` / `setActive({ organization })` para orgs
  - `useUser()` para perfil
- Manter os componentes prontos (com `appearance`) nas telas que não exigem divergência.
- Os dois modelos **coexistem** no mesmo app sem problema.

---

## 8. Referências

- Clerk Appearance prop: `https://clerk.com/docs/customization/overview`
- Clerk Elements (slots): `https://clerk.com/docs/customization/elements`
- Clerk Localizations: `https://clerk.com/docs/customization/localization`
- Slice atual: `specs/001-clerk-auth/plan.md`, `specs/001-clerk-auth/contracts/ui-surface.md`
