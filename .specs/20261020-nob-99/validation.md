# NOB-99 — validação

- Integração: três suítes / 23 testes aprovados no PostgreSQL 16.14 temporário
  (empresas, funcionários e fluxo novo compartilhado).
- Tipagem: aprovada. Lint dos arquivos alterados: aprovado após renomear variáveis
  locais que colidiam com uma regra do Next.js. Formatação: Prettier.
- Sem nova migration; nomes e IDs são os dos cadastros existentes.
- Não foi executado teste manual autenticado no navegador nesta etapa.
- Build e suíte completa desta branch serão conferidos ao final da integração;
  a base NOB-97 já teve todos os três jobs de CI aprovados no GitHub.

Critérios comprovados: empresa/funcionário reutilizados, alterações refletidas
nas consultas dos módulos sem duplicação, separação por serviço habilitado,
tenant incorreto sem retorno e serviço desconhecido rejeitado como VALIDATION.
O filtro REST reutiliza os mesmos repositórios testados.
