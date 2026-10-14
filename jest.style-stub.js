/**
 * Stub para `import "…​.css"` nos testes.
 *
 * O Next processa folhas de estilo no build; o Jest, não — sem este mapa, um
 * componente que importa CSS quebra a suíte com `SyntaxError: Unexpected token
 * '.'` ao tentar executar o arquivo como JavaScript. É o equivalente local do
 * `identity-obj-proxy`, sem dependência nova.
 *
 * Testes de estilo não são feitos aqui: a aparência é verificada no navegador
 * (ver `docs/planning/reuniao-2026-10-05/portal-publico/PORTAL-QA.md`).
 */
module.exports = {};
