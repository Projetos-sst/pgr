# Evidências de validação do alinhamento

## Escopo

Branch `codex/alinhamento-questionario-expedito`, baseada na pilha comercial em `15d81a986359164edc066e30fe6ed73c2186be94`. A matriz `2026-10-27-alinhamento.md` relaciona 28 NOBs trabalhadas e as 58 perguntas com implementação, lacunas e decisões externas. As migrations desta revisão são candidatas `0064–0068`, posteriores às comerciais `0060–0063`, ainda fora da develop verificada no início desta revisão.

## Verificações locais

- `npm run check`: formatação, lint, TypeScript e 194 suítes / 1.826 testes unitários aprovados. Quatro avisos preexistentes de `<img>`; zero erros de lint.
- PostgreSQL 16 temporário em loopback: suítes direcionadas de cadastro, módulos, compartilhamento de registros, fontes de riscos, autorizações, amostras, revisão de documento e cadeia oficial Drizzle. A conexão é criada com credenciais efêmeras e o cluster é encerrado ao final; nenhum banco da aplicação é usado.
- Sete suítes / 51 testes aprovados na rodada de revisão, migrations, cadastro, teste grátis, matriz financeira e dashboard. Uma rodada posterior de nove suítes válidas aprovou 68 testes de integração/contratos. A seleção também continha um caminho inexistente de teste da Medicina; foi corrigida pela seleção dos cinco arquivos reais abaixo, sem alterar ou excluir testes da aplicação.
- Lote 01 da Medicina: `overview`, `medicine-employees`, `rest-medicine`, `health-exams-isolation` e `health-exams-filters`: cinco suítes / 53 testes aprovados.
- A primeira rodada completa local encontrou duas falhas no preparo dos testes (fixture de 0056 usando coluna nova e declaração de teste aninhada). Ambas foram corrigidas e os arquivos foram reexecutados. Não apresentar essa primeira rodada como uma suíte completa aprovada. O CI no HEAD da PR deve ser o gate abrangente final.
- `drizzle-kit check`, `drizzle-kit generate` sem mudança adicional e validadores dos journals/snapshots: conferir o resultado no HEAD publicado.
- Rehearsal com o migrator oficial: instalação em banco vazio, reaplicação idempotente e atualização a partir da 0056 preservando os campos anteriores dos registros de NOB-98 e do Lote 01. O novo campo de revisão permanece falso nos documentos anteriores; inserts novos são verdadeiros e o runtime não pode desativá-lo.

## Cenários relevantes

- Action e REST compartilham o cadastro e o gate de owner para a seleção inicial de módulos. Falha no registro do evento desfaz empresa e módulos, evitando cadastro incompleto.
- CNPJ válido, concessão concorrente entre dois escritórios, impossibilidade de reiniciar a janela e de transferir o teste alterando o CNPJ. O ledger global é privado e não informa dados de outro escritório.
- DOCX real do template marcado no servidor; PDF legado recebe aviso de demonstração; a emissão `issue`, a assinatura pelo núcleo genérico e o arquivamento final continuam bloqueados no teste.
- Revisor distinto do elaborador, papel real de owner para designação, amostra/versão atuais, decisões concorrentes e histórico append-only.
- Conta restrita no Gratuito: consulta somente do documento designado, negação da listagem operacional de empresas, isolamento de outro PGR da mesma empresa e revogação sem apagar pareceres.
- Lookup Clerk somente por e-mail exato verificado; contas não verificadas, divergentes ou ambíguas são rejeitadas. Integração de rede substituída nos testes; nenhuma mensagem ou convite real foi enviado.
- Mapeamento DOCX dos seis grupos fictícios: físico, químico, ergonômico, biológico, mecânico e psicossocial. Sem inferir parecer técnico ou regras clínicas.

## Verificação visual

Dez combinações em Chrome headless: cadastro owner, cadastro colaborador, designação pelo owner, parecer pelo revisor e downloads de demonstração, em 390 e 1440 pixels. Zero erros de JavaScript e zero overflow horizontal. Componentes e CSS reais; Actions substituídas por fixtures fictícias. Isso valida apresentação, não autenticação Clerk ponta a ponta.

`responsive-results.json` registra os cenários. `reviewer-mobile.png` e `demonstration-mobile.png` preservam duas evidências. O script de CI de prévia sintética também gera DOCX e PDF reais com marca de demonstração, além da prévia normal; os arquivos devem ser inspecionados no artifact `pgr-review-preview` do HEAD da PR.

## Pendências antes da homologação

Testar com contas reais do Clerk (owner, colaborador e revisor restrito), e-mail verificado, troca de escritório e revogação; conferir Storage e expiração dos links; revisar visualmente os PDFs convertidos e receber aceite técnico. Acesso do mesmo revisor restrito a várias empresas de um escritório não é ampliado automaticamente. Conferir a numeração com o trabalho do Carlos antes do merge. Não aplicar SQL manualmente em produção.

A ACL operacional geral, os serviços de Segurança separados, a validação individual do inventário, o arquivamento/cancelamento completo e a carência financeira permanecem lacunas da matriz. Os geradores finais de Medicina e as decisões clínicas/modelos não foram declarados concluídos por este trabalho.
