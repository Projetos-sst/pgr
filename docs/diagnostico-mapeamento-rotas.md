# Diagnóstico de Mapeamento de Rotas e Integridade da Navegação

> **Data:** 25 de Julho de 2026  
> **Repositório:** SST Manager (`sst-manager`)  
> **Objetivo:** Mapear todas as rotas da barra superior (existentes vs. pendentes de implementação futura) e auditá-las para garantir que nenhuma funcionalidade do sistema tenha ficado órfã ou inacessível.

---

## 1. Resumo da Auditoria de Integridade (Rotas Órfãs)

Foi realizada uma varredura completa em todas as 40 pastas de rotas protegidas sob `src/app/(protected)/`.

### 🛡️ Resultado: **Zero Rotas Órfãs / Dead Features**

Todas as telas e módulos implementados na aplicação possuem caminhos de acesso direto e claro no sistema:

1. **27 rotas principais** estão diretamente ligadas no menu de topo unificado (**`Módulos`**, **`Cadastro`**, **`Gestão de Segurança`** e **`Qualidade`**).
2. **Atalhos Rápidos no Header:**
   - 🗺️ **Mapa:** Leva para `/getting-started` (_Trilha de Sucesso / Tutorial da Plataforma_).
   - ☑️ **Checkmark:** Leva para `/pending-items` (_Minhas Tarefas e Pendências_).
   - 🏢 **Prédio:** Atalho para seleção de empresa (_TenantSwitcher_).
   - 🔔 **Sino:** Leva para `/notifications` (_Central de Notificações_).
3. **Menu do Usuário (Avatar no canto direito):**
   - 👥 **Equipe** (`/team`)
   - 👤 **Perfil** (`/profile`)
   - 💳 **Planos e Assinatura** (`/plans`)
   - 🚀 **Primeiros Passos** (`/getting-started`)
4. **Subpáginas e Visões Auxiliares:**
   - **Vencimentos** (`/training-expiry`) e **Conformidade** (`/training-compliance`) são acessíveis como abas/subvisões dentro do catálogo de **Treinamentos** (`/training-catalog`) e através de links da Dashboard e de Pendências.
   - **Assinaturas Digitais** (`/signatures`) é acessível via relatórios e comprovantes de EPI.
   - **Agenda** (`/schedule`) e **Relatórios** (`/reports`) são acessíveis via Dashboard.
5. **Acesso Global:**
   - O logo **SST Manager** leva para a tela de **Boas-Vindas** (`/welcome`).

---

## 2. De-Para do Header: Telas Implementadas vs. Pendentes (Futuro)

Abaixo está o mapeamento detalhado de todos os itens do header de referência (`app.e-pgr.com.br` / mockups `.dc.html`), indicando o status atual de cada um e o plano de ação para os módulos ainda não implementados.

### 2.1 Dropdown `Módulos ▾`

| Item no Header               | Rota no Código           |     Status      | Descrição / Observação                                             |
| :--------------------------- | :----------------------- | :-------------: | :----------------------------------------------------------------- |
| **PGR**                      | `/pgr`                   | ✅ Implementado | Gestão do Programa de Gerenciamento de Riscos (Fase 03).           |
| **Estoque de EPI**           | `/epi-stock`             | ✅ Implementado | Controle de movimentação e saldo de estoque de EPI (Fase 02).      |
| **Devoluções de EPI**        | `/epi-returns`           | ✅ Implementado | Registro e baixa de devoluções de equipamentos.                    |
| **eSocial (SST)**            | `/esocial`               | ✅ Implementado | Gestão de eventos eSocial S-2210, S-2220 e S-2240.                 |
| **Inspeções > Veiculares**   | `/vehicular-inspections` | ✅ Implementado | Inspeções veiculares e checklists de frota.                        |
| **Inspeções > Segurança**    | `/safety-inspections`    | ✅ Implementado | Inspeções de segurança em obras e frentes de trabalho.             |
| **Inspeções > Equipamentos** | `/equipment-inspections` | ✅ Implementado | Inspeções de máquinas, ferramentas e equipamentos.                 |
| **Permissões de trabalho**   | `/work-permits`          | ✅ Implementado | Emissão e controle de PET (Trabalho em Altura / Espaço Confinado). |

---

### 2.2 Dropdown `Cadastro ▾`

| Item no Header              | Rota no Código      |     Status      | Descrição / Observação                                                                              | Ação Futura                                                                     |
| :-------------------------- | :------------------ | :-------------: | :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Empresas**                | `/companies`        | ✅ Implementado | Cadastro de empresas-clientes e matriz/filiais (Fase 01).                                           | —                                                                               |
| **Unidades de Obra**        | `/work-units`       | ✅ Implementado | Cadastro de frentes de trabalho e obras (Fase 01).                                                  | —                                                                               |
| **Funções**                 | `/job-roles`        | ✅ Implementado | Cadastro de funções ocupacionais e CBO (Fase 01).                                                   | —                                                                               |
| **GES**                     | `/ges`              | ✅ Implementado | Grupos de Exposição Similar para PGR (Fase 01).                                                     | —                                                                               |
| **Funcionários**            | `/employees`        | ✅ Implementado | Cadastro de trabalhadores (Fase 01).                                                                | —                                                                               |
| **Categorias**              | `/categories`       | ✅ Implementado | Categorias de EPIs e equipamentos.                                                                  | —                                                                               |
| **Treinamentos**            | `/training-catalog` | ✅ Implementado | Catálogo de NRs, validade e carga horária (Fase 04). Contém subvisões de Vencimento e Conformidade. | —                                                                               |
| **Médicos**                 | `N/A`               | ❌ **Pendente** | **Cadastro de Médicos Examinadores / Coordenadores de PCMSO (CRM, UF, Especialidade e Clínica).**   | **Criar tabela `doctors` no schema Drizzle, Server Actions e rota `/medicos`.** |
| **Controle de Formulários** | `/form-controls`    | ✅ Implementado | Gestão de modelos e templates de formulários/checklists.                                            | —                                                                               |
| **Equipamentos**            | `/epi-catalog`      | ✅ Implementado | Catálogo geral de EPIs e CA de equipamentos.                                                        | —                                                                               |
| **Incidentes**              | `/incidents`        | ✅ Implementado | Registro e cadastro inicial de incidentes/acidentes.                                                | —                                                                               |
| **Veículos**                | `/vehicles`         | ✅ Implementado | Cadastro de frota de veículos.                                                                      | —                                                                               |
| **Planos de Inspeção**      | `/inspection-plans` | ✅ Implementado | Cadastro de rotinas e periodicidades de inspeção.                                                   | —                                                                               |

---

### 2.3 Dropdown `Gestão de Segurança ▾`

| Item no Header                     | Rota no Código            |     Status      | Descrição / Observação                                                                                                 | Ação Futura                                                                                  |
| :--------------------------------- | :------------------------ | :-------------: | :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Gestão de Riscos Psicossociais** | `/psychosocial/campaigns` | ✅ Implementado | Campanhas de saúde mental e riscos psicossociais NR-01.                                                                | —                                                                                            |
| **Gestão de Incidentes**           | `/incidents`              | ✅ Implementado | Investigação de acidentes, emissão de CAT e análise de causa raiz.                                                     | —                                                                                            |
| **Gestão de Planos de Ação**       | `/action-plans`           | ✅ Implementado | Matriz 5W2H com status, responsáveis e prazos de controle de risco.                                                    | —                                                                                            |
| **Gestão de OS**                   | `/service-orders`         | ✅ Implementado | Abertura e assinatura de Ordens de Serviço de SST (Fase 06).                                                           | —                                                                                            |
| **Metodologia de Risco**           | `/risk-methodology`       | ✅ Implementado | Configuração da matriz de probabilidade x severidade do PGR.                                                           | —                                                                                            |
| **Riscos**                         | `/risks`                  | ✅ Implementado | Inventário completo de riscos por GES/Empresa.                                                                         | —                                                                                            |
| **Auditorias de Risco**            | `/risk-audits`            | ✅ Implementado | Auditorias periódicas de conformidade do PGR.                                                                          | —                                                                                            |
| **Gestão de Saúde Ocupacional**    | `N/A`                     | ❌ **Pendente** | **Gestão de PCMSO, ASOs (Admissionais/Periódicos/Demissionais) e Exames Complementares.**                              | **Criar tabelas `pcmso`, `asos` e `medical_exams`, Server Actions e rota `/gestao-saude`.**  |
| **Gestão de Responsabilidades**    | `N/A`                     | ❌ **Pendente** | **Matriz de atribuição de responsabilidade regulatória por função (quem aprova PGR, quem assina OS, quem emite PET).** | **Criar tabela `responsibility_matrix`, Server Actions e rota `/gestao-responsabilidades`.** |

---

### 2.4 Dropdown `Qualidade ▾`

| Item no Header                            | Rota no Código |     Status      | Descrição / Observação                                                                       |
| :---------------------------------------- | :------------- | :-------------: | :------------------------------------------------------------------------------------------- |
| **GED — Gestão Eletrônica de Documentos** | `/documents`   | ✅ Implementado | Repositório de documentos com upload, validade, URL assinada e pipeline Gotenberg (Fase 05). |

---

## 3. Matriz de Desenvolvimento Futuro (Backlog de Implementações)

As 3 únicas funcionalidades do header de referência que ainda não possuem tabelas e rotas no backend são:

1. 🩺 **Módulo de Cadastro de Médicos (`/medicos`):**
   - **Tabela:** `doctors` (`id`, `org_id`, `name`, `crm`, `crm_state`, `specialty`, `clinic_name`, `phone`, `email`, `status`).
   - **Objetivo:** Permitir selecionar o médico coordenador do PCMSO e médicos examinadores na emissão de ASOs.

2. 🏥 **Módulo de Gestão de Saúde Ocupacional (`/gestao-saude`):**
   - **Tabelas:** `pcmso_documents`, `employee_asos`, `medical_exams`.
   - **Objetivo:** Controle de exames admissionais, periódicos, demissionais, mudanças de risco e retorno ao trabalho, com alerta de vencimento de ASO.

3. 📋 **Módulo de Gestão de Responsabilidades (`/gestao-responsabilidades`):**
   - **Tabela:** `responsibility_matrix`.
   - **Objetivo:** Matriz de atribuição de responsabilidades operacionais e legais de SST por cargo e unidade.

---

## 4. Conclusão

- **Nenhuma rota existente ficou inacessível ou órfã.**
- **27 rotas principais** estão ativas no menu de topo.
- **3 módulos futuros** foram identificados e mapeados para desenvolvimento posterior no roadmap.
