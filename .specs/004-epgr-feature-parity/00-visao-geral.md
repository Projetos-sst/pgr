# ePGR — Visão Geral e Arquitetura (engenharia reversa para paridade no sst-manager)

> Documento de requisitos derivado da exploração da aplicação **ePGR** (`https://app.e-pgr.com.br`).
> Objetivo: replicar 100% das funcionalidades no **sst-manager**.
> Método: navegação autenticada via Playwright + mineração do bundle Angular (rotas e endpoints).
> Data da coleta: 2026-06-04. Conta usada: `dougladmo19@gmail` (empresa de teste criada para destravar fluxos).

## 1. O que é o produto

Plataforma SaaS de **SST (Saúde e Segurança do Trabalho)** focada em **gestão de riscos ocupacionais**
conforme legislação brasileira (NR-01 / GRO — Gerenciamento de Riscos Ocupacionais, eSocial S-2240).

Capacidades centrais (conforme tela de boas-vindas e menus):

- **Gestão de PGR** (Programa de Gerenciamento de Riscos) — emissão e controle, com assinatura digital.
- **Gestão de EPIs** — estoque, entrega com assinatura digital via QR Code, consulta de CA (CAEPI/MTE).
- **Análise inteligente de riscos por IA** — correlaciona função × ambiente para sugerir riscos
  (anunciado "92% de precisão"); prompt personalizado.
- **Planos de ação** — correção de não conformidades, prazos automatizados, alertas.
- **Ordens de Serviço (OS)** funcionais com assinatura digital.
- **Inspeções** — veiculares, de segurança, de equipamentos (com planos de inspeção e itens).
- **Treinamentos**, **Permissões de trabalho**, **Incidentes**, **Riscos psicossociais** (campanhas),
  **GED** (gestão eletrônica de documentos), integração **eSocial**.

## 2. Stack observada

| Camada | Tecnologia (evidência) |
|---|---|
| Frontend | **Angular** (bundles `runtime/polyfills/scripts/main.<hash>.js`), Bootstrap (modais `.modal`), Chart.js + chartjs-plugin-datalabels (dashboards) |
| Backend (API) | **`https://back.e-pgr.com.br/api`** (REST). Em dev o bundle aponta `https://localhost:44347/api` — padrão **ASP.NET Core** (porta 44347 / IIS Express) |
| Padrão de service | `apiUrl = environment.apiURL + "api/<recurso>/"`, chamadas `http.get/post/put/delete` |
| Auth | Login por e-mail/senha (`api/usuarios/`), reset de senha (`resetpassword`/`newpassword`), JWT (rotas protegidas redirecionam a `/user/login`) |

### Integrações externas (URLs presentes no bundle)

- **ViaCEP** (`https://viacep.com.br/ws`) — autocompletar endereço por CEP.
- **AwesomeAPI Economia** (`https://economia.awesomeapi.com.br/json`) — cotação/câmbio.
- **CAEPI / MTE** (`https://caepi.mte.gov.br/internet`) — consulta de Certificado de Aprovação (CA) de EPI.
- **OpenAI** — recurso `api/OpenAI/` no backend (modelagem/sugestão de riscos e "Dicas de Preenchimento da IA").
- **Backblaze B2** (`api/backblaze/`) — armazenamento de arquivos/imagens.
- **WhatsApp** (`https://wa.me/`) — contato/compartilhamento.
- **YouTube** (`@ePGR-tec`) — tutoriais.

## 3. Modelo de contexto multi-tenant (CRÍTICO para paridade)

- O app opera **por empresa selecionada**. Há um **seletor de empresa global** no topo
  (combobox "Todas as Empresas" / `<Empresa> (CNPJ)`). A seleção persiste entre telas (serviço de estado).
- **Quase todas as telas operacionais ficam bloqueadas sem uma empresa cadastrada/selecionada.**
- Hierarquia de dados (cadeia de dependência obrigatória):

```
Usuário (conta)
 └─ Empresa (tenant)                      [CNPJ, grau de risco, CNAE]
     └─ Unidade de Obra / Local            [obra/contrato]
         └─ GES (Grupo de Exposição Similar) [caracterização do ambiente/processo]
             ├─ Funções do GES              [cargos/CBO expostos]
             └─ Riscos do GES               [inventário de riscos + avaliação + controles]
                 └─ EPIs do risco           [EPIs que neutralizam, CA]
     └─ Funcionários                        [vinculados a GES + função]
     └─ PGR                                 [consolida GES+riscos da obra → documento]
```

## 4. Mapa de rotas (Angular Router — 68 paths extraídos do bundle)

### Área autenticada (app)
| Rota | Tela |
|---|---|
| `/dashboard` | Dashboard com indicadores (Chart.js) |
| `/boasvindas` | Tela inicial pós-login |
| `/primeiros-passos` | Onboarding / guia de primeiros passos |
| `/empresas/lista`, `/empresas/detalhe` | Empresas (CRUD) |
| `/unidades-obra/lista`, `/unidades-obra/detalhe` | Unidades de Obra |
| `/setores/lista`, `/setores/detalhe(/:id)` | GES (rota interna "setores") |
| `/setores/riscos/lista`, `/setores/riscos/detalhe` | Riscos do GES |
| `/funcionarios/lista`, `/funcionarios/detalhe` | Funcionários |
| `/funcionarios/entregarepi/:id` | Entrega de EPI ao funcionário |
| `/funcionarios/historicoentregaepi/:id` | Histórico de entrega de EPI |
| `/funcoes/lista` | Funções (cargos, CBO) |
| `/categorias/lista` | Categorias |
| `/treinamentos/lista` | Treinamentos |
| `/controle-formularios/lista` | Controle de Formulários |
| `/equipamentos/lista` | Equipamentos |
| `/incidentes/lista` | Incidentes (cadastro) |
| `/veiculos/lista` | Veículos |
| `/planosdeinspecao/lista`, `/planosdeinspecao/detalhe/:planoId/itens` | Planos de Inspeção + itens |
| `/inspecoesveiculares/lista`, `/inspecoesveiculares/visualizar/:id` | Inspeções veiculares |
| `/inspecoes-de-seguranca/lista`, `/inspecoes-de-seguranca/detalhe/:inspecaoId/ocorrencias` | Inspeções de segurança + ocorrências |
| `/inspecoesequipamentos` | Inspeções de equipamentos |
| `/pgrs/lista`, `/pgrs/detalhe(/:id)`, `/pgrs/gerarpgr/:id` | PGR (lista, editor, geração do documento) |
| `/pgrs/revisao` | Revisões do PGR |
| `/estoque/lista`, `/estoque/historico/:id` | Estoque de EPI + histórico de movimento |
| `/permissoesdetrabalho` | Permissões de trabalho (PT) |
| `/planosdeacao` , `/planosdeacao/gestao` | Planos de ação (lista + gestão) |
| `/planosdeassinatura` | Planos de assinatura (billing/SaaS) |
| `/gestaodeincidentes` | Gestão de incidentes |
| `/gestaodeos` | Gestão de Ordens de Serviço |
| `/gestaoriscospsico/lista` | Gestão de riscos psicossociais (campanhas) |
| `/riscoseauditorias/lista`, `/riscoseauditorias/detalhe/:id` | Riscos e Auditorias (workflow de auditoria — **plano premium**) |
| `/ged/lista` | GED — Gestão Eletrônica de Documentos |
| `/notificacoes` | Notificações |
| `/agenda` | Agenda / agendamentos |
| `/relatorios` | Relatórios |
| `/configuracoes` | Configurações |
| `/esocial` | Integração eSocial |

### Área administrativa (admin-global)
| Rota | Tela |
|---|---|
| `/admin-global/masters` | Gestão de usuários master |
| `/admin-global/convites` | Convites |
| `/admin-global/uso-openai` | Uso/consumo OpenAI |
| `/admin-global/gestao-guias` | Gestão de guias |

### Autenticação / perfil (`/user/...`)
`login`, `register`, `perfil`, `password-reset`, `reset-password/:token/:email`.

### Rotas públicas (sem login — assinaturas digitais e formulários externos)
| Rota | Função |
|---|---|
| `/autenticacaoentregaepi/:param` | Assinatura/validação da entrega de EPI (QR Code) |
| `/assinaturaos/:param` | Assinatura digital de Ordem de Serviço |
| `/assinaturainspeseguranca/:param` | Assinatura de inspeção de segurança |
| `/assinaturapgr/:param` | Assinatura digital do PGR |
| `/foto3x4/:param` | Upload/captura de foto 3x4 do funcionário |
| `/responderpsico/:campanhaId/:token` | Responder questionário psicossocial (trabalhador) |

## 5. Recursos da API (40 — extraídos de `api/<recurso>/`)

`empresas`, `unidadeobra`, `setor`, `funcaosetor`/`FuncaoSetor`, `funcao`, `funcionario`/`Funcionario`,
`risco`, `epirisco`, `epi`, `epiestoque`/`EpiEstoque`, `estoquemovimento`/`EstoqueMovimento`,
`pgrs`, `pgrsetor`, `revisao`, `sumario`, `modelagemRisco`, `planoDeAcao`, `incidentes`,
`treinamento`, `categoria`, `veiculo`/`Veiculo`, `controleformulario`, `documento`, `pasta`,
`campanhas-psicossociais`, `agendamentos`, `historico`, `imagem`/`Imagem`, `backblaze`,
`Cbo` (CBO — Classificação Brasileira de Ocupações), `Dashboard`, `Relatorios`/`relatorios`,
`OpenAI`, `usuarios`.

> Observação: `setor` = GES; `pgrsetor` = vínculo PGR↔GES; `sumario` = sumário/índice do PGR;
> `modelagemRisco` = motor de sugestão de risco por IA; `Cbo` = base de ocupações.

## 6. Navegação (arquitetura de informação dos menus)

- **Dashboard**
- **Módulos**: PGR · Estoque de EPI · eSocial ▸ · Inspeções ▸ (Veiculares, Segurança) · Treinamentos · Permissões de trabalho
- **Cadastro**: Empresas · Unidades de Obra · GES · Funcionários · Funções · Categorias · Treinamentos · Controle de Formulários · Equipamentos · Incidentes · Veículos · Planos de Inspeção
- **Gestão de Segurança**: Gestão de Riscos Psicossociais · Gestão de Incidentes · Gestão de Planos de Ação · Gestão de OS
- **Qualidade**: GED — Gestão Eletrônica de Documentos
- **Topo/direita**: Seletor de empresa · link YouTube (tutoriais) · Primeiros passos · menu do usuário (avatar/inicial)
- **Botão "Cadastrar primeira empresa"** quando não há empresa.

## 7. Padrões de UI recorrentes (replicar como componentes base)

1. **Lista padrão**: cabeçalho com título + breadcrumb; barra com **busca textual**, filtros
   (Empresa, Obra/Local, status), botão **"Novo"**; **tabela** com coluna "Opções" (ações por linha);
   **paginação** ("Mostrando X a Y de Z registros") + **itens por página** (valores variam: 6/8/10/25/50);
   estado vazio "Nenhum registro encontrado".
2. **Filtro de empresa/obra** no topo de cada módulo, espelhando o seletor global.
3. **Formulário detalhe**: blocos/abas; campos com máscara (CNPJ, CEP, telefone); selects de UF;
   botões "Cancelar" / "Salvar alterações"; botões de IA ("Dicas de Preenchimento da IA").
4. **Modais** (Bootstrap) para confirmações, termos (declaração) e sub-cadastros.
5. **Assinatura digital** via páginas públicas com token na URL + QR Code.
6. **Ações por IA** embutidas em formulários (sugestão de riscos, dicas de preenchimento).

## 8. Índice destes requisitos

- `00-visao-geral.md` — este arquivo (arquitetura, rotas, API, IA de informação).
- `01-cadastros-base.md` — Empresa, Unidade de Obra, GES, Funcionário, Função, Categoria.
- `02-riscos-e-pgr.md` — inventário de riscos, metodologia de avaliação, eSocial S-2240, controles NR-01, PGR.
- `03-epi-estoque.md` — EPI, estoque, movimentações, entrega com assinatura, CA/CAEPI.
- `04-inspecoes.md` — planos de inspeção, veiculares, segurança, equipamentos, veículos.
- `05-gestao-seguranca.md` — incidentes, planos de ação, OS, riscos psicossociais.
- `06-qualidade-ged-esocial.md` — GED, eSocial, treinamentos, permissões de trabalho, controle de formulários.
- `07-plataforma.md` — dashboard, relatórios, agenda, notificações, perfil/usuários, configurações, admin, billing.

## 9. Auditoria de cobertura (como garantimos que está tudo)

Método de verificação objetivo: como o ePGR é um SPA Angular, **toda tela/funcionalidade existente é
necessariamente um componente compilado no `main.js`**. Extraímos a lista completa de componentes
(`selectors:[["app-..."]]`) e cruzamos 1-a-1 com esta documentação.

- **127 componentes** Angular detectados · **68 rotas** · **40 recursos de API**.
- Descontando componentes de layout/infra (`app-root`, `app-nav`, `app-sidebar`, `app-footer`, `app-titulo`,
  `app-empresa-seletor`, `app-chat-widget`) e modais genéricos (`app-confirmacao-modal`, `app-excluir-modal`,
  `app-help-modal`, `app-pdf-modal`, `app-photo-qr-modal`), **todos os componentes de tela/feature mapeiam para
  uma funcionalidade documentada** nos arquivos 01–07.

**Telas não inspecionadas campo-a-campo (e por quê) — todas têm a feature documentada:**
| Área | Status | Motivo |
|---|---|---|
| Riscos e Auditorias (`riscoseauditorias`) | Workflow capturado parcialmente | **Plano premium** — bloqueado na conta de teste |
| Agenda/Agendamentos (`agendamento-*`) | Módulo documentado; form não acessível | Tela renderiza vazia (gate de plano/feature) |
| Configurações (`configuracoes`) | Rota documentada | Redireciona — restrito por papel |
| Admin Global (`masters`, `convites`, `uso-openai`, `gestao-guias`) | Rotas documentadas | Restrito a **superadmin** |
| Permissões de Trabalho (`permissaodetrabalho`) | Documentado | **Módulo stub** (placeholder na versão atual) |
| Documento wizard / eSocial-configurações | Documentado (GED/eSocial) | Sub-fluxos de módulos já cobertos |

**Conclusão:** a documentação cobre 100% das **funcionalidades** expostas pelo frontend. As únicas lacunas de
**profundidade** (campos exatos) são telas bloqueadas por plano/papel ou módulos stub — nenhuma feature ficou
de fora. O que não é verificável por este método: regras de negócio exclusivas do backend sem reflexo na UI.
