# Contrato — Tokens de fundação (`@theme inline`)

O contrato visual da fatia. Todos os tokens vivem no bloco `@theme inline` de `src/app/globals.css`.
**Nenhuma página ou componente pode usar hex cru** — só `var(--…)` / utilitários Tailwind derivados.

## Tokens (nome → valor)

```css
@theme inline {
  /* cor primária (indigo) */
  --color-primary: #5b63f5;
  --color-primary-strong: #4f46e5;
  --color-primary-ring: rgba(91, 99, 245, 0.12);

  /* neutros */
  --color-bg: #eae9e8;
  --color-surface: #ffffff;
  --color-text: #1b1f2e;
  --color-text-muted: #52576e;
  --color-text-subtle: #8c91a8;

  /* acentos de status (badges) */
  --color-accent-green: #0e9f6e;
  --color-accent-amber: #f5a524;

  /* raio e sombra */
  --radius-card: 12px;
  --radius-pill: 30px;
  --shadow-card:
    0 14px 34px rgba(50, 55, 100, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.85);
  --shadow-primary: 0 8px 20px rgba(91, 99, 245, 0.35);

  /* tipografia (via next/font/google) */
  --font-sans: var(--font-manrope);
  --font-mono: var(--font-jetbrains-mono);
}
```

> Nomes finais podem ser ajustados no implement desde que (a) fiquem centralizados no `@theme`, (b) as
> primitives os consumam por variável, e (c) o valor observável bata com o mockup.

## Regras de conformidade

- **C-TOK-1**: 0 ocorrências de hex de cor em arquivos `.tsx`/`.ts` de UI fora de `globals.css`
  (grep de conformidade no implement).
- **C-TOK-2**: `body` herda `--font-sans`; o `font-family: Arial` hardcoded é removido.
- **C-TOK-3**: cor primária, raio e sombra dos cards/CTAs batem visualmente com `dashboard.dc.html` e
  `login.dc.html` nos 3 breakpoints.
- **C-TOK-4**: tema claro único preservado — nenhum texto claro sobre fundo claro (o `dark:` inerte não
  pode degradar contraste).
