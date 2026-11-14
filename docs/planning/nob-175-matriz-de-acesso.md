# NOB-175 — Matriz de acesso por empresa, obra e área

O escritório continua sendo a fronteira principal (`org_id` + RLS). Esta entrega acrescenta um segundo
limite dentro do escritório: o administrador escolhe, por membro, quais empresas, obras e áreas ele acessa.

## Como funciona

- Tabela `member_access_scopes` (migration `0083`): uma linha = membro + empresa + obra (opcional) + área.
- Áreas: `safety` (Segurança do Trabalho, serviço `pgr`) e `health` (Medicina do Trabalho, serviço `medicine`).
  O serviço continua vindo de `company_modules`; o escopo só filtra o que o membro enxerga dele.
- **Sem nenhuma linha, o membro acessa tudo, como antes.** A primeira linha passa a limitar o acesso.
- O administrador (`owner` ou `org:admin` do Clerk) nunca é limitado e é o único que concede ou revoga.
- Escopo sem obra vale para todas as obras da empresa. Registro sem obra (ex.: PGR da empresa inteira) é visto
  por quem tem qualquer escopo naquela empresa.
- A regra roda no banco: toda transação do tenant leva o usuário da sessão (`app.current_actor`) e as policies
  `<tabela>_actor_scope` aplicam o filtro. A mudança vale na requisição seguinte, inclusive em URL direta.

## Matriz

Legenda da coluna "Onde é garantido": **Banco** = policy RLS (vale para tela, Action, API e consulta);
**Servidor** = checagem na Action/handler/página; **Menu** = só esconde o link; **Pendente** = não existe.

| Papel                           | Operação                                                                                  | Escopo                                      | Onde é garantido                |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------- |
| Administrador (owner)           | Tudo que já fazia                                                                         | Todas as empresas, obras e áreas            | Banco                           |
| Administrador (owner)           | Conceder, listar e revogar escopo de um membro                                            | Membros do próprio escritório               | Banco + Servidor                |
| Colaborador sem escopo          | Tudo que já fazia                                                                         | Todas as empresas, obras e áreas            | Banco (regra "sem linha")       |
| Colaborador com escopo          | Ler e alterar empresa                                                                     | Só as empresas listadas                     | Banco                           |
| Colaborador com escopo          | Criar empresa                                                                             | Negado                                      | Banco                           |
| Colaborador com escopo          | Ler e alterar obra, GES, PGR, máquinas, campanha psicossocial                             | Só as obras listadas (ou todas, sem obra)   | Banco                           |
| Colaborador com escopo          | Funcionários, funções, acidentes, autorizações de risco                                   | Só as empresas listadas                     | Banco                           |
| Colaborador com escopo          | EPI, formulários, inspeções, permissões de trabalho                                       | Empresas listadas + registros do escritório | Banco                           |
| Colaborador com escopo          | Ordens de serviço                                                                         | Só obras que ele enxerga                    | Banco                           |
| Colaborador com escopo          | PGR, riscos e demais dados do serviço `pgr`                                               | Empresas com área Segurança                 | Banco (via `company_modules`)   |
| Colaborador com escopo          | Exames, ASO, PCMSO e demais dados do serviço `medicine`                                   | Empresas com área Medicina                  | Banco (via `company_modules`)   |
| Colaborador com escopo          | Telas só de Segurança sem regra de serviço (EPI, treinamentos, inspeções, OS, permissões) | Empresa e obra, sem corte por área          | Menu (corte por área: Pendente) |
| Colaborador com escopo          | Ver os grupos do menu                                                                     | Só as áreas concedidas                      | Servidor (layout) + Menu        |
| Colaborador (com ou sem escopo) | Ler os próprios escopos                                                                   | Só os dele                                  | Banco + Servidor                |
| Colaborador (com ou sem escopo) | Conceder ou revogar escopo                                                                | Negado                                      | Banco + Servidor                |
| Representante (`client`)        | Telas e Actions do escritório                                                             | Negado, como antes                          | Servidor                        |
| Representante (`client`)        | Fluxos delegados já existentes                                                            | Uma empresa (`scopedCompanyId`), como antes | Servidor                        |
| Representante (`client`)        | Várias empresas por escopo                                                                | Linhas aceitas e aplicadas no banco         | Banco; telas e fluxos: Pendente |
| Representante (`client`)        | Indicar o autorizador de riscos (NOB-176)                                                 | Empresas do vínculo ou do escopo            | Banco + Servidor                |
| Profissional externo            | Qualquer operação                                                                         | Perfil não existe                           | Pendente                        |
| Qualquer papel                  | Dados de outro escritório                                                                 | Negado, como antes                          | Banco                           |

## Campos de saúde

Nenhuma regra de saúde foi afrouxada. Acidentes, prontuário, afastamentos e autorizações de risco seguem com
as restrições que já tinham; o escopo é uma policy **restritiva** a mais, então só reduz o que se vê.
O único efeito de leitura a mais é em `org_memberships`: a policy `org_memberships_risk_actor_read` já liberava
a leitura dos membros do próprio escritório quando há usuário na sessão, e agora sempre há.

## Roteiro de migração

Nada muda ao publicar: nenhuma linha é criada pela migration, então todos seguem com o acesso atual.

1. Aplicar a migration `0084_member_access_scopes` (aditiva, sem backfill).
2. Conferir, em `/companies/{id}/services`, quais serviços cada empresa tem habilitados.
3. Em `/team`, o administrador abre "Configurar" no membro e concede os escopos:
   - **Só PGR:** uma linha por empresa (e obra, se quiser) com a área Segurança do Trabalho.
   - **Só Saúde:** uma linha por empresa com a área Medicina do Trabalho.
   - **Ambos:** duas linhas por empresa, uma de cada área.
4. Conferir com o próprio membro: o menu mostra só as áreas concedidas e as listas trazem só as empresas e
   obras dele. URL direta de outra empresa responde "não encontrado".
5. Para voltar ao acesso completo, remover todas as linhas do membro.

Cuidados:

- Remover a última linha devolve o acesso completo. Para tirar todo o acesso, remova o membro da equipe.
- Área concedida em empresa sem o serviço habilitado não mostra nada: habilite o serviço antes.
- Membro com escopo não cria empresa nova.

## Limites conhecidos

- Tabelas ligadas à empresa só de forma indireta (por funcionário, por GES ou por vínculo polimórfico, como
  planos de ação e documentos do GED) não têm policy própria de escopo.
- Telas só de Segurança sem regra de serviço são filtradas por empresa e obra, não por área: o menu esconde,
  mas a URL direta abre para quem tem a empresa na outra área.
- Para o membro com escopo, o serviço da área não concedida aparece como "Desabilitado".
- Revogação não tem histórico em tabela: fica só o log de auditoria da aplicação.
- Representante com várias empresas e o perfil de profissional externo ficam para issue própria.
