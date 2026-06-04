# ePGR — Plataforma (Dashboard, Conta, Billing, Admin, Assinaturas públicas)

---

## 1. Dashboard (`/dashboard`) — `api/Dashboard/`

Painel com KPIs e gráficos (Chart.js + datalabels), filtrável por empresa (Ativos/Inativos).
- **KPIs**: PGRs · Empresas · Equipe · OS Funcional · Monitoramento Psicossocial.
- **Gráficos**: Riscos por Categoria · Planos de Ação · Status de OS · OS por Tipo · Status de Incidentes · Categorias de Incidentes.
- **"Personalizar Visão"** — dashboard configurável (escolher widgets exibidos).
- Atalho "Acessar Campanhas" (psicossocial).
- Home (`/boasvindas`) mostra indicadores: "Precisão da IA 92%", "Saúde da Modelagem 100%", ações rápidas
  (Acessar PGRs, Dashboard, Funcionários) e cards de novidades.

## 2. Boas-vindas / Primeiros Passos (`/boasvindas`, `/primeiros-passos`)

- `/boasvindas`: saudação, último acesso, ações rápidas, cards de inovações, "Cadastrar primeira empresa".
- `/primeiros-passos?rota=<rotaAtual>`: guia de onboarding contextual (passo a passo).
- Geração de **manual de onboarding** via `api/Relatorios/gerar-manual-onboarding`.
- Link para tutoriais no YouTube (`@ePGR-tec`).

## 3. Perfil e Gestão de Usuários (`/user/perfil`) — `api/usuarios/`

- **Informações Pessoais**: `Nome`, `Sobrenome`, `CPF`, `Telefone`, `Email`, avatar (upload).
- **Informações Profissionais**: `Empresa`, `Cargo`.
- **Alterar Senha**: `Senha Atual`, `Nova Senha` (mín. 4 caracteres), `Confirmar Nova Senha`.
- **Gestão de Usuários** (multiusuário por conta): lista de usuários, busca, **"Novo Usuário"**
  → a conta/tenant suporta vários usuários (equipe), com (provável) papéis/permissões.

## 4. Notificações (`/notificacoes`) — `api/notificacoes`

- Central de notificações/alertas (ex.: prazos de planos de ação, EPIs abaixo da mínima, documentos a vencer).

## 5. Agenda (`/agenda`) — `api/agendamentos/`

- Agendamentos (ex.: inspeções, treinamentos, exames, vencimentos).

## 6. Relatórios (`/relatorios`) — `api/Relatorios/`

- Geração de relatórios/arquivos. Endpoints detectados: `gerar-eventos-esocial`, `gerar-manual-onboarding`.
- (Demais relatórios consolidados — PGR, EPI, OS, incidentes — gerados nos respectivos módulos.)

## 7. Configurações (`/configuracoes`)

- Tela de configurações da conta/empresa (acesso restrito nesta conta de teste — redirecionou).

## 8. Planos de Assinatura / Billing (`/planosdeassinatura`) — `api/planosdeassinatura`

- **PACOTE SMART** — teste grátis por **07 dias**.
- Recursos do pacote: Suporte via chat · Dashboard · Emissão do PGR · Gerenciamento do Plano de Ação ·
  Emissão de Ordem de Serviço · Emissão de Ficha de EPI para Empregados · Gestão de EPI (estoque e entrega).
- Pilares de marketing: Segurança (conformidade NRs), Produtividade (automação), Suporte.

## 9. Administração Global (`/admin-global/...`) — restrito a superadmin

(Redireciona para usuários comuns; documentado a partir das rotas.)
- `/admin-global/masters` — gestão de usuários master.
- `/admin-global/convites` — convites de acesso.
- `/admin-global/uso-openai` — monitoramento de consumo da IA (OpenAI) por cliente/uso.
- `/admin-global/gestao-guias` — gestão de guias/conteúdo de onboarding.

## 10. Autenticação (`/user/...`)

- `login` (e-mail + senha), `register` (criar conta), `password-reset` + `reset-password/:token/:email`.
- Endpoints: `api/usuarios/resetpassword`, `api/usuarios/newpassword`.
- Dica de UX na tela de login: mensagens rotativas de segurança.

## 11. Páginas públicas de assinatura/coleta (sem login)

Fluxos externos acessados por link/token (QR Code), para coleta de assinatura/dados sem conta:
| Rota | Uso |
|---|---|
| `/autenticacaoentregaepi/:param` | Assinatura/validação da **entrega de EPI** (recibo, QR) |
| `/assinaturaos/:param` | Assinatura digital da **Ordem de Serviço** |
| `/assinaturainspeseguranca/:param` | Assinatura da **inspeção de segurança** |
| `/assinaturapgr/:param` | Assinatura digital do **PGR** |
| `/foto3x4/:param` | Captura/upload da **foto 3x4** do funcionário |
| `/responderpsico/:campanhaId/:token` | **Questionário psicossocial** respondido pelo trabalhador |

> Requisito de paridade: infraestrutura de **links públicos assináveis com token** + captura de assinatura
> (canvas/imagem) e armazenamento (Backblaze), reutilizada por EPI, OS, inspeção, PGR e foto/questionário.

---

## Resumo de paridade (checklist macro para o sst-manager)

- [ ] Multi-tenant por Empresa com seletor global de contexto.
- [ ] Cadeia Empresa → Unidade de Obra → GES → Funções/Riscos → Funcionário.
- [ ] Inventário de riscos NR-01 (agente/perigo/risco, exposição, eSocial S-2240, matriz 5×5, hierarquia de controles).
- [ ] Metodologia de avaliação configurável (probabilidade × severidade, AIHA/AS-NZS/Fundacentro).
- [ ] Sugestão de riscos por IA (função × ambiente) + dicas de preenchimento por IA.
- [ ] PGR: editor por abas (GES, revisões, capa/sumário, documentos), declaração de ciência, geração de PDF, assinatura digital, versionamento e validade.
- [ ] EPI: catálogo (CA/CAEPI), estoque com mínima/saldo/movimentos, entrega com assinatura digital (QR), ficha de EPI.
- [ ] Inspeções: planos/checklists reutilizáveis; veiculares, segurança (com ocorrências) e equipamentos; assinatura.
- [ ] Incidentes/acidentes: investigação completa (CAT, causas, impacto ambiental) + gestão do ciclo de vida.
- [ ] Planos de ação 5W2H com prazos, status e alertas; origem em risco/inspeção/incidente.
- [ ] Ordens de Serviço funcionais com assinatura digital e controle de assinatura.
- [ ] Riscos psicossociais: campanhas/questionários públicos, análise e derivação de riscos.
- [ ] eSocial: geração e envio em lote de S-2190/2200/2210/2220/2221/2240/2300 com consulta de retorno.
- [ ] GED: pastas, versionamento, vencimento, upload (Backblaze).
- [ ] Treinamentos (norma/carga horária) e obrigatoriedade por função; Permissões de Trabalho.
- [ ] Dashboard configurável (Chart.js); notificações; agenda; relatórios; multiusuário por conta; billing/trial.
- [ ] Integrações: ViaCEP, consulta CNPJ, CAEPI/MTE, LLM (no sst-manager: Anthropic/Claude), storage de arquivos.
