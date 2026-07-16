# Backlog — telas do redesign sem módulo implementado

> Companion de `docs/briefings/briefing-redesign-implantation.md`. Lista as telas dos mockups
> `sst-project/redesign/*.dc.html` cujo módulo de negócio **não existe** no sst-manager hoje.
> Nenhuma delas entra na fatia de implantação do redesign — cada uma vira spec própria quando o
> módulo correspondente for construído. Ao criar essa spec futura, usar o `.dc.html` listado aqui
> como referência de layout já pronta (mesma paleta/tipografia que a fatia de redesign fixar).

| Mockup                                      | Rota provável (mockup)    | Módulo                                | Nota                                                                                                            |
| ------------------------------------------- | ------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `medicos.dc.html`                           | `/medicos`                | Médicos                               | CRUD simples, mesmo padrão de lista dos demais cadastros                                                        |
| `veiculos.dc.html` / `veiculo-form.dc.html` | `/veiculos`               | Veículos                              | CRUD + form                                                                                                     |
| `inspecoes-veiculares.dc.html`              | `/inspecoesveiculares`    | Inspeções veiculares                  | Depende de veículos existir                                                                                     |
| `inspecoes-seguranca.dc.html`               | `/inspecoes-de-seguranca` | Inspeções de segurança                | —                                                                                                               |
| `planos-inspecao.dc.html`                   | `/planosdeinspecao`       | Planos de inspeção                    | Pode depender de inspeções veiculares/segurança                                                                 |
| `incidentes.dc.html`                        | `/incidentes`             | Incidentes (cadastro)                 | —                                                                                                               |
| `gestao-incidentes.dc.html`                 | `/gestaodeincidentes`     | Gestão de incidentes                  | Camada de gestão sobre incidentes                                                                               |
| `riscos-psicossociais.dc.html`              | `/gestaoriscospsico`      | Riscos psicossociais                  | Distinto do módulo `risks` genérico já existente                                                                |
| `gestao-saude.dc.html`                      | `/gestao-saude`           | Gestão de saúde ocupacional           | —                                                                                                               |
| `gestao-os.dc.html` / `os-nova.dc.html`     | `/gestaodeos`             | Gestão de Ordem de Serviço            | Não confundir com `/signatures` (assinatura genérica) já implementado                                           |
| `ged.dc.html`                               | `/ged`                    | Gestão Eletrônica de Documentos       | —                                                                                                               |
| `controle-formularios.dc.html`              | `/controle-formularios`   | Controle de formulários               | —                                                                                                               |
| `treinamentos.dc.html`                      | `/treinamentos`           | Treinamentos                          | —                                                                                                               |
| `esocial.dc.html`                           | `/esocial/dashboard`      | eSocial — dashboard                   | Integração externa (governo)                                                                                    |
| `esocial-eventos.dc.html`                   | `/esocial/lista`          | eSocial — eventos                     | —                                                                                                               |
| `esocial-config.dc.html`                    | `/esocial/configuracoes`  | eSocial — configurações               | —                                                                                                               |
| `planos-assinatura.dc.html`                 | `/planosdeassinatura`     | Planos de assinatura (pricing in-app) | O campo `plan` (`free`/`pro`) já existe no schema (spec 005); só falta a tela                                   |
| `perfil.dc.html`                            | `/user/perfil`            | Perfil de usuário                     | Hoje só existe o modal padrão do Clerk (`UserButton`); construir uma tela própria é decisão de produto separada |

**Fora desta lista** (não são do ePGR, ver `PAGINAS.md` §4): páginas institucionais/blog da marca
Riskon — nunca usar como referência de design.
