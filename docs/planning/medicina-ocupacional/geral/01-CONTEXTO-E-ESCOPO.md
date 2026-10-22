# 01 — Contexto e escopo da Medicina Ocupacional

> Documento permanente da frente. Criado em 2026-10-21 a partir da auditoria da Fase 0 (base `origin/develop` = `d6b787c`).
> Não repete a auditoria: aponta para ela. Navegação: [README da frente](../README.md) ·
> [02 Roadmap e status](02-ROADMAP-E-STATUS.md) · [03 Arquitetura e contratos](03-ARQUITETURA-E-CONTRATOS.md) ·
> [04 Decisões e bloqueios](04-DECISOES-E-BLOQUEIOS.md) · [05 Segurança e dados](05-SEGURANCA-E-DADOS.md) ·
> [06 Git, migrations e CD](06-GIT-MIGRATIONS-CD.md) · [07 Critérios de entrega](07-CRITERIOS-DE-ENTREGA.md) ·
> [08 Handoff](08-HANDOFF.md) · [09 Linear e responsáveis](09-LINEAR-E-RESPONSAVEIS.md)

## 1. O PGR-e

O PGR-e é uma plataforma SST (segurança e saúde no trabalho) **multi-tenant**: cada tenant é um **escritório**
(`orgs`) que atende várias **empresas-clientes** (`companies`). O isolamento entre escritórios é o invariante central
do sistema (`withOrg` + RLS; ver [03](03-ARQUITETURA-E-CONTRATOS.md) e o `CLAUDE.md` da raiz).

O produto tem duas áreas, contratadas **por empresa-cliente** (módulos `pgr` e `medicine`, NOB-97/NOB-100,
independentes do plano free/pro):

| Área                            | O que cobre hoje (develop)                                                                                                                                    | Dono no time                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Segurança do Trabalho (PGR)** | cadastros da cadeia do PGR, inventário de riscos por GES, avaliação, medidas, EPI, OS, acidentes, inspeções, psicossocial NR-01, geração DOCX/PDF do PGR, GED | Rikelvin (módulos, cadastros, integração); Douglas (documentos, infra) |
| **Medicina do Trabalho**        | catálogo de médicos (`medicos`) e **registro** de exames/ASO (`health_exams`); nada de emissão, PCMSO ou assinatura técnica                                   | Carlos                                                                 |

O objetivo da frente de Medicina é levar a área de **registro** a **emissão rastreável** (ASO e PCMSO), sem criar
um segundo sistema ao lado do PGR e sem expor dado clínico além do necessário.

## 2. Equipe e partes interessadas

| Pessoa          | Papel nesta frente                                                                                                       | Decide sobre                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Douglas**     | Tech Lead; dono do pipeline documental (DOCX/PDF, GED, worker, `jobs`) e da infra (CI/CD Vercel, migrations automáticas) | ordem de merge e numeração de migrations, camada de emissão, arquitetura de isolamento clínico, IA × saúde, design system |
| **Carlos**      | implementa a Medicina (11 issues no Linear)                                                                              | escopo e execução dos lotes 1 a 6; propostas de modelagem                                                                 |
| **Rikelvin**    | módulos por empresa (`company_modules`), cadastros comuns, integração Segurança → Medicina (**NOB-98**, PR #112)         | contrato de riscos, revisão de riscos, revisão da trilha de auditoria                                                     |
| **Expedito**    | produto                                                                                                                  | perfis, portais, habilitação de módulos, escopo comercial, quem concede autorização                                       |
| **Dr. Alcides** | validação técnica (clínica)                                                                                              | o que é validar risco, campos do ASO, Lista C, prazo de guarda, regras clínicas do protótipo                              |

Decisões pendentes por pessoa: [DECISIONS.md](../DECISIONS.md) e o registro vivo em
[04-DECISOES-E-BLOQUEIOS.md](04-DECISOES-E-BLOQUEIOS.md). Responsáveis por issue: [09](09-LINEAR-E-RESPONSAVEIS.md).

## 3. Limites da Medicina

| Dentro da frente de Medicina                                                                    | Fora (pertence a outra frente ou depende de decisão)                                                                        |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Painel da Medicina e ficha de saúde ocupacional do funcionário (Lote 1)                         | Cadastro de empresa, funcionário, função, GES (cadastros comuns, NOB-99, Rikelvin)                                          |
| Procedimentos por exame, auditoria clínica, arquivamento de exames (Lote 2)                     | Inventário de riscos e o contrato `medical_risk_*` (NOB-98, Rikelvin)                                                       |
| Identidade profissional e designação por empresa, PGR externo (UX), dataset da Lista C (Lote 3) | Pipeline documental genérico (Douglas): a Medicina **consome**, não reconstrói                                              |
| Emissão de ASO com snapshot, ciência do trabalhador (Lote 4)                                    | Psicossocial NR-01: hoje em "Gestão de Segurança"; dono a decidir (E-04, MED-28)                                            |
| PCMSO (Lote 5)                                                                                  | Comercial (teste grátis, preços, serviços avulsos: MED-34)                                                                  |
| Profissionais, clínicas, portais (Lote 6, sob decisão de produto)                               | Afastamentos/NTEP, PPP, FAP/RAT, fadiga, crônicos, prontuário, teleconsulta, IA de Medicina (backlog; GAP-MATRIX MED-29…37) |
| Homologação ponta a ponta (Lote 7)                                                              | Correções transversais de segurança fora da Medicina (bypass dev R1, texto de acidente no LLM R5)                           |

Lotes e dependências: [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) e [02-ROADMAP-E-STATUS.md](02-ROADMAP-E-STATUS.md).

## 4. O protótipo V17

**O que é.** Pacote Projeto-SST-Ocupacional V17 (fora do repositório), de 14/10/2026: um HTML monolítico
(2.977 linhas, 23 coleções, 64 telas P-01…P-64), uma especificação (13/10), 5 planilhas de revisão e 10 scripts
Playwright em Python. Inventário completo em [AUDIT-PROTOTYPE.md](../AUDIT-PROTOTYPE.md) §3–§5.

**Como usar.** O protótipo é **especificação de comportamento**, não código:

1. Fonte de jornadas e telas (P-xx em AUDIT-PROTOTYPE §5.13; jornadas J-01…J-08 em §5.14).
2. Fonte de regras a validar: toda regra clínica do protótipo é **HIPÓTESE** até o Dr. Alcides validar (A-06).
3. Roteiro de QA: as asserções dos scripts `flow.py`, `portal.py`, `amianto.py`, `rev3.py` viram casos de aceite
   (AUDIT-LINEAR-QA §5.7). Os scripts **não** são reaproveitáveis como código.
4. Quando a especificação (13/10) e o HTML/planilhas (14/10) divergem, **nenhum lado prevalece por padrão**
   (AUDIT-PROTOTYPE §11.1; posição única pendente com o Expedito, E-05).
5. Nunca linkar o pacote por caminho absoluto; citar como acima.

### 4.1 O que NÃO pode ser copiado do protótipo

| Comportamento do protótipo                                                          | Por que não                                                        | Fazer em vez disso                                                                         | Fonte                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| Perfis "Ver como" provedor/empresa/clínica, filtro só na tela                       | Não é controle de segurança: todas as coleções chegam ao navegador | Autorização no servidor + RLS                                                              | AUDIT-SECURITY E53–E55; PROTO R-01  |
| Dados em `localStorage` / banco compartilhado do artifact                           | Dado médico no cliente, sem isolamento                             | Server Components + Postgres com RLS; nada clínico em armazenamento do navegador           | AUDIT-PROTOTYPE §4.2                |
| "Aprovar como \<médico\>" clicado pelo editor                                       | Aprovação em nome de terceiro                                      | Validação só pelo próprio profissional identificado                                        | AUDIT-PROTOTYPE R-04; DB §4.7       |
| Carimbo textual / linha manuscrita como "assinatura"                                | Não é assinatura técnica                                           | ASO sai "emitido, sem assinatura técnica" até existir provedor ICP-Brasil                  | DB §4.6; IMPLEMENTATION-PLAN Lote 4 |
| Empresa emitindo e editando ASO próprio                                             | Emissor indefinido (A-05)                                          | Emissão restrita conforme decisão                                                          | PROTO R-05                          |
| Portal da empresa recebendo sinais vitais, audiometria, CID                         | Excede "empresa não vê resultados"                                 | Empresa/RH vê só conclusão (se houver portal)                                              | PROTO R-02, V-16                    |
| Clínica recebendo dados financeiros e folha da empresa                              | Excede a necessidade                                               | Mínimo necessário por encaminhamento                                                       | PROTO R-03                          |
| IA lendo laudos com nome/CPF, no cliente                                            | Dado de saúde em prompt                                            | Nenhum dado médico em IA (D-08)                                                            | PROTO R-06; SEC R5                  |
| Funções, riscos e exames embutidos no cadastro da empresa                           | Duplica `job_roles`/`ges`/`risks`                                  | Cadastros comuns + contrato `medical_risk_*`                                               | AUDIT-UX §4.5; DEPENDENCIES §3      |
| Lista C embutida (18 grupos, A15–K46, sem M e S/T) como dado oficial                | Base parcial                                                       | Dataset com procedência, a partir da fonte oficial; o protótipo só como teste de regressão | AUDIT-PROTOTYPE §5.12               |
| Periodicidade 12/24, dispensa 90/135, retorno ≥ 30 d etc. como regra pronta         | Regras clínicas não validadas                                      | Mostrar só validade **informada**; regras após A-06                                        | FIRST-MVP §2 passo 8                |
| PCMSO e PPP recalculados ao vivo                                                    | Documento emitido não pode mudar                                   | Snapshot imutável na emissão                                                               | DB §10.3                            |
| Exclusão em cascata pelo provedor                                                   | Perde histórico dentro do prazo de guarda                          | Arquivamento após decisão de prazo (A-07)                                                  | PROTO R-10; SEC R4                  |
| Navegação em 14 abas, re-render por `innerHTML`, sem `aria-live`, inputs sem rótulo | Acessibilidade e manutenção                                        | Rotas Next com `<Link>`, primitives `_ui`, `role="status"`/`"alert"`                       | AUDIT-UX §10.3                      |
| Bricolage Grotesque / Atkinson Hyperlegible, violeta `--psi`                        | Identidade de outro produto                                        | Manrope + JetBrains Mono + indigo (ver §8)                                                 | AUDIT-UX §10.1                      |
| Coleção `assinaturas` lida como assinatura de documento                             | É contrato/cobrança                                                | Não confundir com `signature_*`                                                            | DB §4.7                             |

## 5. O que existe e o que não existe (develop `d6b787c`)

| Existe (com evidência)                                                   | Não existe                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `company_modules` + RLS RESTRICTIVE + histórico append-only (NOB-97/100) | Papel clínico (médico, enfermagem, psicólogo)                                                 |
| Cadastros comuns com filtro `module=` (NOB-99)                           | Vínculo `medicos` ↔ usuário autenticado; UF do CRM; RQE                                       |
| `medicos` (CRUD) e `health_exams` (CRUD de registro, RLS `medicine`)     | Emissão de ASO; PCMSO; assinatura técnica                                                     |
| Validade derivada (`classifyDocumentValidity`)                           | Trilha de auditoria persistida de dado de saúde                                               |
| Pipeline DOCX/PDF + GED + worker (PGR, Douglas)                          | Catálogo de procedimentos; histórico de função                                                |
| Registry de assinatura simples (`signature_*`)                           | Lista C, NR-4, tabelas eSocial como dados                                                     |
| —                                                                        | Fluxo de validação de riscos (a PR #112 traz só fontes imutáveis `pending`, **não mergeada**) |

Matriz completa (37 funcionalidades): [GAP-MATRIX.md](../GAP-MATRIX.md).

## 6. Relação com a Segurança

1. **Cadastros comuns.** Empresa, funcionário, função e GES são um cadastro só do escritório; a Medicina usa os mesmos
   IDs (`listCompanyOptions(orgId, "medicine")`, `listEmployees({ module })`). Nunca CRUD paralelo.
2. **Riscos.** O único contrato Segurança → Medicina é `medical_risk_sources/entries` (PR #112). A Medicina **não lê
   `risks` diretamente** e **não** cria segundo cadastro de PGR externo. Ajustes ao contrato são propostos ao Rikelvin.
   Ver [03](03-ARQUITETURA-E-CONTRATOS.md) e [DEPENDENCIES.md](../DEPENDENCIES.md) §3.
3. **Documentos.** ASO/PCMSO reaproveitam template-engine, Gotenberg, GED, `jobs` e worker; o desenho da camada de
   emissão é decisão do Douglas (D-06).
4. **Empresa só com Medicina** não precisa contratar PGR: a fonte externa da #112 cobre, e os cadastros comuns
   continuam disponíveis.

## 7. Princípios de implementação

1. **Estender, nunca duplicar** o que o Rikelvin e o Douglas entregaram.
2. **Lote pequeno e demonstrável**: um lote = uma branch = uma PR ([06](06-GIT-MIGRATIONS-CD.md)).
3. **Zero migration até a ordem da #112 estar decidida** (D-01). Toda migration é aditiva e é aplicada em homologação
   no merge em develop.
4. **Toda superfície HTTP sai com as 4 peças** do `CLAUDE.md` (Action + REST + `api-design.md` + Postman).
5. **Toda tabela nova de Medicina**: FK composta `(company_id, org_id)`, RLS de isolamento + RESTRICTIVE `medicine`,
   `assertCompanyModuleTx` na escrita, `runIsolationSuite` no teste.
6. **Nada de dado fictício na UI** (regra da fatia 019) e **nada de dado clínico real em teste**.
7. **Proposta ≠ decisão ≠ implementação.** Cada afirmação carrega o rótulo certo (IMPLEMENTADO, PROPOSTO, BLOQUEADO,
   NÃO_VERIFICADO; ver [05](05-SEGURANCA-E-DADOS.md)).
8. **Critério de pronto** em [07](07-CRITERIOS-DE-ENTREGA.md): sem PASS sem execução; MERGED ≠ HOMOLOGADO ≠ PUBLICADO.

## 8. Regras permanentes de segurança clínica

Valem para todos os lotes. Detalhe e rótulos em [05-SEGURANCA-E-DADOS.md](05-SEGURANCA-E-DADOS.md) §2.

1. Não copiar a segurança simulada do protótipo (perfis de tela, "Ver como").
2. Não usar `localStorage` (ou qualquer armazenamento do navegador) para dado médico.
3. Não aprovar em nome de terceiros.
4. O owner **não** é médico presumido (nem o colaborador).
5. Não expor prontuário ao escritório.
6. Nada entre organizações.
7. Não armazenar resultado clínico novo antes de existir perfil clínico + trilha de auditoria.
8. Nenhum dado médico em IA.
9. Nenhuma assinatura técnica falsa: QR, link ou rabisco **não** é assinatura técnica.
10. Nenhum dado clínico real em teste (só dados fictícios).
11. Não apagar exames sem avaliar retenção.
12. Erro de leitura ≠ lista vazia.
13. Não duplicar cadastro de empresa ou funcionário.

## 9. Estratégia visual (só documentada; nada aplicado)

| Item               | Regra                                                                                                                   | Fonte                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Tipografia         | Manrope (texto) + JetBrains Mono (números/códigos), via `next/font` como já está                                        | AUDIT-UX §4.1, §10.1                              |
| Cor primária       | indigo `#5B63F5` (token `--color-primary`); nenhuma primária nova na Medicina                                           | AUDIT-UX §4.1                                     |
| Teal `#0d6b63`     | **Só como acento de módulo**, e **só se o Douglas aprovar** o token (D-09). Sem aprovação, o Lote 1 sai sem teal        | FIRST-MVP §3; AUDIT-UX §10.1                      |
| Tokens             | Nada de tokens globais automáticos: qualquer token novo entra no `@theme inline` de `globals.css` por decisão explícita | brief da organização                              |
| Componentes        | Primitives de `src/app/(protected)/_ui/`; promover `StatCard` do dashboard para `_ui`; `ErrorState` existente para erro | FIRST-MVP §3; AUDIT-UX §10.2                      |
| Dívidas conhecidas | `StatusBadge`/`ListCard` duplicados; pílulas abaixo de AA; `text-subtle` abaixo de 4,5:1                                | AUDIT-UX §4.2, §4.7 (correção é do Douglas, D-09) |
| Navegação          | Grupo "Medicina do Trabalho" com no máximo 5–6 itens no MVP; nunca as 14 abas do protótipo                              | AUDIT-UX §10.2                                    |
