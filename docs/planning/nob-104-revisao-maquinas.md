# NOB-104 — revisão do cadastro de máquinas e equipamentos

Status: levantamento preparado; implementação do contexto de exposição pendente.
O usuário autorizou preservar as regras atuais enquanto o modelo é revisado.

## Evidências do código atual

| Requisito                           | Situação                                              | Evidência                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro e edição                   | Existente como catálogo compartilhado                 | `src/shared/db/schema/epis.ts`, `epiCatalog`, tipo `machine`; `src/shared/domains/pgr/epi-catalog.ts`                                     |
| Nome, descrição, fabricante e norma | Existente; campos livres, sem certificação automática | Mesmo schema e CRUD `src/shared/db/repositories/epi-catalog.ts`                                                                           |
| Empresa                             | Referência opcional existente                         | `epi_catalog.company_id`; não atribuir itens globais a todas as empresas                                                                  |
| Ambiente/GES da máquina             | Ausente no catálogo                                   | O GES não possui relação de inventário de máquinas                                                                                        |
| Inspeções                           | Existentes, finalidade diferente                      | `src/shared/db/schema/inspections.ts`, `equipment_catalog_id`, `company_id`, `notes`; inspeção não representa toda a instalação/exposição |
| Histórico de edição                 | Existente no catálogo                                 | `src/shared/db/repositories/epi-catalog-audit.ts` e chamada `recordEpiCatalogAudit`                                                       |
| Composição do PGR                   | Parcial                                               | `pgr-consolidated.ts` e `pgr-docx-extras.ts` agregam EPIs por risco, mas não o inventário de máquinas por ambiente                        |

Não criar um segundo catálogo. Não usar o vínculo `epi_risk` para máquinas:
ele representa indicação de EPI e neutralização, com outra semântica.

## Decisões a registrar com o responsável

| Decisão                                                           | Situação                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| Versão e páginas do modelo aprovado que descrevem máquinas        | Pendente; NOB-93 está em revisão, sem anexo na issue      |
| Contexto: instalação por obra, por GES ou ambos                   | Pendente; não inferir que uma máquina atende todos os GES |
| Equipamento físico individual ou quantidade de itens equivalentes | Pendente                                                  |
| Campos de segurança, anexos e obrigatoriedade por tipo            | Pendente; não inventar requisitos de NR/certificação      |
| Seção/tabela de destino no PGR                                    | Pendente; NOB-105 deve usar o mesmo mapeamento aprovado   |

## Próxima etapa de implementação

Após a confirmação, acrescentar uma relação entre o item `machine` existente e
o contexto aprovado, com dados locais de descrição/segurança e histórico das
revisões. A relação deve validar tenant, tipo, empresa e ambiente, e permitir
consulta somente com PGR habilitado, respeitando o acesso operacional existente.

Arquivos previstos: schema novo para a relação e eventos; repositório próprio;
domínio de entrada; Actions com `officeAction`; REST espelho; formulário no
contexto do GES/obra; API/Postman; agregação em lote no consolidado/DOCX.
Confirmar os nomes/colunas somente depois das decisões acima.

Migration aditiva, sem alterar os itens atuais ou inferir instalações legadas.
A NOB-98 possui migrations ainda não integradas: regenerar o encadeamento das
novas migrations após atualizar a base, evitando snapshots conflitantes.

## Validação necessária

- Cadastro/edição e histórico preservam origem e autor da sessão.
- Item `epi` não pode ser vinculado como máquina.
- Referências de outra empresa/tenant e GES divergente são rejeitadas.
- Colaborador opera somente o contexto permitido; cliente e PGR desabilitado
  são bloqueados sem excluir registros anteriores.
- Consolidado e documento exibem somente o equipamento do contexto selecionado.
- Catálogo e inspeções atuais continuam funcionando.
- Responsável técnico revisa campos e amostras; testes automáticos não são parecer.

## Critérios de aceite

Cadastro/revisão do catálogo: existente. Informações de segurança no ambiente
correto e integração completa ao documento: **não entregues nesta etapa**.
Este levantamento não conclui NOB-104 e não contém nova migration ou regra técnica.
