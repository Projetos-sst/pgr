# Issue #36 · Deploy do serviço Gotenberg

**Objetivo:** 1 container Gotenberg fora da Vercel, protegido, com
`GOTENBERG_URL`/`GOTENBERG_TOKEN` configurados e conversão HTML→PDF validada e2e.

**Depende de:** #32 (✅). **Destrava:** #37.

**Natureza:** infra pura + validação — sem código de aplicação. Não precisa de Spec Kit
completo; runbook curto basta.

## Decisões a cravar

1. **Auth — o ponto que a issue erra:** Gotenberg **não tem auth por token nativa**.
   O Gotenberg 8 suporta _basic auth_ via `--api-enable-basic-auth` +
   `GOTENBERG_API_BASIC_AUTH_USERNAME/PASSWORD`. Opções:
   - (a) basic auth nativa — **recomendada**, mais simples;
   - (b) proxy reverso na frente;
   - (c) rede privada do provedor (ex.: Railway private networking).
     Mapear `GOTENBERG_TOKEN` para o par user/senha ou renomear a env. **Consultar a doc
     oficial antes de configurar** (regra de infra do RULES.md).
2. **Provedor:** critérios — deploy de imagem pronta sem Dockerfile, sleep no free tier
   (Render free dorme → primeira geração lenta, pesa contra), custo fixo baixo.
   Railway tende a ser o menor atrito.
3. **Dimensionamento:** Chromium é faminto — 512MB provavelmente insuficiente para PGRs
   longos (#40); começar com 1–2GB e medir. Timeout do Gotenberg > timeout do cliente
   (#37), coerentes entre si.
4. **Validação e2e:** `curl` multipart em `forms/chromium/convert/html` com HTML de
   teste → PDF válido; documentar o comando no runbook.

## Riscos

- Segredos nunca no repo (envs por ambiente).
- App precisa degradar bem quando o serviço cair (tratado no #37/#38).
- Preview/dev apontando para o mesmo container: ok (stateless).

## Insumos para checklist de conclusão

- Container no ar e acessível pela aplicação; endpoint não público.
- Basic auth ativa; envs configuradas em dev/preview/prod.
- Conversão HTML→PDF validada com comando documentado.
