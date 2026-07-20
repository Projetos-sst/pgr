# Issue #34 · CRUD de Documentos (GED)

**Objetivo:** a fatia mais gorda da fase — listagem com KPIs + navegação por pastas +
upload + versionamento + mover + excluir, sobre o modelo do #33.

**Depende de:** #33 (e do helper de Storage do #37, ou cria o helper aqui — alinhar).
**Destrava:** #35.

Issue já está no Modelo B ✅ — pontos que ela **não** cobre e precisam entrar no spec:

## Decisões a cravar

1. **Checklist das 4 superfícies (regra do CLAUDE.md):** Server Action + espelho REST
   `/api/v1/documents/**` (e pastas) + `docs/api/api-design.md` + Postman. Upload REST =
   `multipart/form-data` no Route Handler; upload via action = `FormData`; mesmas
   zod/repos nas duas entradas.
2. **Limite de body do upload:** Server Actions no Next têm `bodySizeLimit` default de
   **1MB** — insuficiente para GED.
   - MVP/KISS: subir `serverActions.bodySizeLimit` (~10–25MB) + validação zod de tamanho.
   - Evolução registrada: signed upload URL direto ao Storage + action só registra
     metadado (mais escalável; adiciona passo de confirmação e risco de arquivo órfão).
3. **Atomicidade Storage×DB:** gravar binário primeiro, inserir linha depois; insert
   falhou → delete best-effort do objeto + log. Janela de órfãos aceitável no MVP
   (documentar).
4. **KPIs** (Documentos · Pastas · Vencem 30d · Vencidos): query agregada `withOrg`
   reusando o classificador de validade derivado (irmão do `classifyTrainingStatus`);
   unit test com datas fixas em `America/Sao_Paulo` (`todayInSaoPaulo` já existe em
   `src/shared/dates.ts`).
5. **Excluir pasta ficou fora do escopo** — confirmar se é intencional (a UI não pode
   travar com pasta vazia inutilizável). Breadcrumb = laço subindo `parent_id`, sem CTE
   recursiva no MVP.
6. **Excluir documento:** apagar também o objeto no Storage (best-effort, com log) —
   senão o bucket vira cemitério.
7. **Versionamento:** depende da decisão do #33. Se "1 linha por versão": listagem mostra
   só a corrente; detalhe lista anteriores; download de versão antiga sai de graça no #35.
8. **UI:** nascer já no design system da fatia 019 (primitives `_ui`).

## Edge cases extras

- Validação de tipo por extensão + MIME declarado (magic bytes = limitação registrada).
- `?folderId=` de outro tenant → tratar como raiz/404, nunca vazar.
- Falha de upload no meio; org sem documentos/pastas; documento sem validade.

## Insumos para o /speckit-specify

- **Branch:** `feature/document-crud` (da issue — o template da issue já está bom;
  somar os pontos acima como restrições/edge cases).
- **Success criteria adicionais:** as 4 superfícies entregues; upload acima do limite
  rejeitado com erro claro; exclusão remove o binário do Storage.
