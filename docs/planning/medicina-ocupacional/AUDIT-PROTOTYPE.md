# AUDIT-PROTOTYPE — Protótipo "SST Ocupacional" e jornadas (Agente 2, Fase 0, somente leitura)

> Data da auditoria: 2026-10-21. Autor: Agente 2 (protótipo e jornadas). Nada foi alterado no protótipo,
> nenhum script foi executado e nenhum navegador foi aberto. Para citar código uso `arquivo:linha`. As linhas
> do HTML seguem o editor (1–2977). Rótulos usados: **HIPÓTESE** é interpretação minha, normativa ou técnica,
> ainda sem validação; **NÃO VERIFICADO** é algo que não consegui comprovar.

---

## 1. Escopo analisado

- O pacote inteiro `C:\Users\carlo\OneDrive\Documentos\Projeto-SST-Ocupacional\` (21 arquivos): app HTML,
  especificação (.docx + .md + 2 imagens), 5 planilhas, 10 scripts de teste e LEIAME.
- O HTML foi lido por inteiro, das linhas 1 a 2977, incluindo o JavaScript completo. Do CSS (linhas 5–168) li só
  as regras de mídia, impressão e marca d'água.
- O catálogo da Lista C (NTEP) embutido no protótipo, com análise estrutural feita por script stdlib.
- Especificação conferida contra o .docx (diff de texto) e as duas imagens.
- Planilhas: todas as abas lidas com `zipfile` + `xml.etree`, incluindo `sharedStrings` e fórmulas.
- Scripts `testes/*.py`: lidos, não executados.
- Fora do escopo: o código atual do PGR-e. Este agente só mapeia, pelo nome, as tabelas existentes no
  `develop-ro` (d6b787c) para registrar dependências. A auditoria desse código fica com outros agentes.

## 2. Fontes consultadas

| Fonte | Como | Observação |
|---|---|---|
| `app/saude-ocupacional.html` | Read integral + grep/contagens | Única fonte de código do protótipo |
| `especificacao/Especificacao-da-Plataforma-SST.md` | Read integral | Gerada a partir do .docx (mtime 21/10 00:42) |
| `especificacao/Especificacao-da-Plataforma-SST.docx` | `zipfile`: `document.xml` + `core.xml` | Diff de palavras contra o .md, razão 0,9953 |
| `especificacao/media/image1.png`, `image2.png` | Visualizadas | sha256 idêntico às imagens dentro do .docx |
| `planilhas/*.xlsx` (5) | Script stdlib com `sharedStrings` e fórmulas | Todas as abas |
| `testes/*.py` (10) | Leitura | Nenhum foi executado |
| `LEIAME.txt` | Leitura | Pacote de 14/10/2026, "versão 17" |
| `develop-ro/src/shared/db/schema/*` | `ls`/`grep` dos nomes de tabela | Só para a seção 8 (dependências) |

## 3. Arquivos reais (inventário)

Inventário dos 21 arquivos. Todos têm mtime 21/10/2026 00:37, que é a data da cópia; as exceções são o .md e
`media/`, com 00:42, gerados depois a partir do .docx. Integridade: os ZIPs passaram em `testzip()=None`, os PNGs
abrem e o HTML foi lido inteiro sem truncamento.

| # | Caminho | Formato | Bytes | Linhas | Integridade | Versão/data interna | Natureza | Status da regra |
|---|---|---|---|---|---|---|---|---|
| 1 | `LEIAME.txt` | texto | 1.279 | — | ok | "pacote de 14/10/2026 (versão 17 do app)" | doc | descritivo |
| 2 | `app/saude-ocupacional.html` | HTML+CSS+JS monolítico | 446.669 | 2977 (wc=2976, sem `\n` final) | lido inteiro | V17 (cruzando LEIAME e planilha 00) | **código** | regras **implementadas, não validadas** (pendências 5–7 da planilha 00) |
| 3 | `especificacao/…SST.docx` | DOCX (zip) | 278.602 | 327 parágrafos | zip ok | `core.xml`: revision 14, "Claude Docs node/8c719bea-34ac@14"; corpo "Oct 13, 2026 · @Expedito Junio" | doc | **proposta** (tem "Decisões em aberto") |
| 4 | `especificacao/…SST.md` | Markdown | 23.019 | 281 | ok | conversão do .docx | doc | idem .docx; texto equivalente (seção 4.3) |
| 5 | `especificacao/media/image1.png` | PNG | 176.948 | — | ok | igual a `word/media/image1.png` | doc | diagrama de arquitetura proposto |
| 6 | `especificacao/media/image2.png` | PNG | 96.992 | — | ok | igual a `word/media/image2.png` | doc | roadmap proposto |
| 7 | `planilhas/00-revisoes-consolidado.xlsx` | XLSX (openpyxl) | 28.876 | 6 abas | zip ok | created 2026-10-14T16:19Z; cobre V8→V17 | registro de revisão | relato de correções e pendências; números de teste "informados, não calculados" |
| 8 | `planilhas/01-revisao-geral.xlsx` | XLSX | 20.329 | 6 abas | zip ok | 2026-10-14T01:02Z; revisão de 13/10, V8 | registro | idem |
| 9 | `planilhas/02-revisao-portais.xlsx` | XLSX | 17.410 | 5 abas | zip ok | 2026-10-14T01:56Z; V10 | registro | idem |
| 10 | `planilhas/03-revisao-datas-retorno.xlsx` | XLSX | 17.084 | 5 abas | zip ok | 2026-10-14T02:22Z; V12 | registro | idem |
| 11 | `planilhas/05-revisao-assinaturas-teste.xlsx` | XLSX | 17.642 | 5 abas | zip ok | 2026-10-14T16:16Z; V17 | registro | idem. **Não existe planilha 04**: a revisão 4 só está no consolidado (LEIAME:20) |
| 12 | `testes/amianto.py` | Python+Playwright | 4.412 | 49 | lido | ajuste V11 | código de teste | 13 verificações |
| 13 | `testes/crawl.py` | idem | 4.348 | 79 | lido | V8+ | código de teste | varredura de cliques |
| 14 | `testes/demo.py` | idem | 5.708 | 55 | lido | V16 | código de teste | 20 verificações (uma em laço ×4) |
| 15 | `testes/fadiga.py` | idem | 8.376 | 90 | lido | V13 | código de teste | 35 |
| 16 | `testes/flow.py` | idem | 7.999 | 80 | lido | V8 | código de teste | 23 |
| 17 | `testes/portal.py` | idem | 11.582 | 138 | lido | V10 | código de teste | 38 (32+6) |
| 18 | `testes/rev3.py` | idem | 3.223 | 35 | lido | V12 | código de teste | 10 |
| 19 | `testes/rev4.py` | idem | 2.812 | 33 | lido | V14 | código de teste | 8 |
| 20 | `testes/rev5.py` | idem | 4.668 | 46 | lido | V17 | código de teste | 9 |
| 21 | `testes/teste.py` | idem | 6.646 | 70 | lido | V15 | código de teste | 23 |

A soma das verificações dos scripts (23+38+13+10+35+8+23+20+9 = **179**) bate com a aba `Testes` da planilha 00
(B20=179) e da 05. **Não executei os testes**, então "179/179 aprovadas" é o que a planilha relata, não um
resultado verificado por mim.

**Dados demonstrativos.** O seed `carregarExemplo` (`html:2642-2711`) usa nomes e registros marcados como
"EXEMPLO", CPFs/CNPJs de placeholder (zeros e repetições) e médicos e psicólogos fictícios. Os testes usam nomes
genéricos e CNPJs de teste. Não encontrei nada que pareça dado pessoal real. O LEIAME (linhas 9 e 13) cita dois
links de artifact do claude.ai, um da versão on-line do app e outro da especificação. Não os reproduzo aqui, e
**não verifiquei** se a versão on-line contém dados reais de clientes.

## 4. Evidências

### 4.1 Números do HTML, reais × históricos

| Métrica | Histórico | Real (medido) | Evidência |
|---|---|---|---|
| Linhas | 2.977 | **2.977** (o `wc -l` dá 2.976 porque falta o `\n` final) | último byte = `</html>` |
| Coleções | 23 | **23** | `COLS`, `html:314` |
| Funções nomeadas | 209 | **209** declarações `function nome(` (todas únicas) | grep |
| Arrow functions atribuídas (`const x = …=>`) | — | ~116 (contagem por regex, aproximada) | grep |
| Formulários (`id="form-*"`) | — | **27** | grep |
| Ações `data-act` distintas | — | **138** (123 `case` no handler de clique, 18 no `change`, `busca` no `input`) | grep |
| Abas do provedor / empresa / clínica | — | **14 / 13 / 3**, mais `acesso` e `carregando` | `html:527,569,570,571` |
| Geradores de documento (`doc*`) | — | **12** | seção 5.6 |
| Dimensões / itens COPSOQ | — | **28 dimensões / 47 itens** em 6 seções | `html:222-251` |
| Fatores psicossociais | — | **13** (12 do COPSOQ + "fadiga" sem dimensão) | `html:256-270` |
| Funcionalidades de IA | — | **8** | seção 5.11 |

Não há código morto entre handlers e botões. Os `case "ai-*"` parecem sem botão, mas os botões são gerados
dinamicamente por `aiBtn` (`html:524`) e só aparecem quando a IA está disponível.

### 4.2 As 23 coleções e o armazenamento

`empresas, funcionarios, asos, afastamentos, tabelas, campanhas, respostas, entrevistas, indicadores, riscospsi,
clinicas, encaminhamentos, assinaturas, equipe, config, solicitacoes, validacoes, pedidos, programa, consultas,
auditorias, prontuario, fadiga` (`html:314`).

- **Modo local:** sem `window.claude`, tudo vai para `localStorage["sst-ocupacional-v1"]` como um único JSON
  (`html:317-319`, `2963`).
- **Modo on-line (artifact claude.ai):** usa `window.claude.use("db")`, `("downloads")`, `("sample")` (IA) e
  `("user")` (`canEdit`, `id`) (`html:2959-2962`), com `onSnapshot` por coleção (`html:2966-2973`). Todos os
  visitantes compartilham o mesmo banco. O próprio app avisa: "Isolamento apenas na tela… um usuário com
  conhecimento técnico conseguiria ler registros de outras empresas" (`html:2820`). Ver também o comentário em
  `html:555`.
- Objetos embutidos (não são coleções): `empresa.funcoes[]` (com `riscos[]` e `exames[]`),
  `funcionario.historico[]`, `funcionario.posDem[]`, `afastamento.kit{}`, `encaminhamento.procedimentos[]`,
  `medidas{}`, `audio{od,oe}`, `espiro{}`, `aso.snap{}`, `riscopsi.medidas[]`, `assinatura.pagamentos[]` e
  `historico[]`, `programa.acomp[]`, `auditoria.itens[]`. Documentos fixos em `config`: `planos`, `servicos` e
  `portal` (`acessos{uid→vínculo}`, `exigirVinculo`, `empresaFixa`).
- Constantes-catálogo: `LISTA_C_BASE`, `TIPOS_ASO` (5), `TIPOS_RISCO` (5), `NATUREZAS` (5), `ESPECIES`
  (B31/B91/B92/B93/B94), `GRAU_EXP` (1–4, com adicional de 12/9/6%), `ESC`, `SECOES`, `COPSOQ`, `FATORES`,
  `HIER` (4 níveis), `MEDIDAS_LIB`, `ROTEIRO`, `CAP_CID`, `RISCO_CAP`, `ANEXOS`, `PLANOS_PADRAO`, `CAT_SERV`,
  `UNID`, `SERV_PADRAO` (7 serviços), `ENC_STATUS`, `FREQS`, `MEDIDAS` (12 sinais vitais), `AUD_ST`, `PED_ST`,
  `FAD_TIPOS`, `KSS`, `FAD_RES`, `FAD_CONDUTA`, `COND_NOME`.

### 4.3 Especificação: .md × .docx

A comparação de palavras dá razão 0,9953. As diferenças são só a numeração das listas e as legendas das imagens,
que existem no .docx e não no .md. Não há divergência de conteúdo, e as imagens são as mesmas (sha256
`fa582f10…`, `d187d60d…`).

### 4.4 Funções nomeadas (209), agrupadas

- **Regras/cálculo:** nivelRisco, probDePct, cpfOk, cnpjOk, fmtCNAE, normCID, cidInInterval, listaC, nr4Map,
  grauEmpresa, ntepGruposPorCNAE, ntepMental, checarNTEP, inicioContinuo, exigeRetorno, addMonths, diasEntre,
  diasAfast, periodicidade, ultimoASO, proximoPeriodico, statusVenc, afastAnteriorMesmoCID, funcoesDoTrab,
  agentesEspeciais, prazoGuarda, prazoDe, intervaloAmianto, anosExposicao, posDemAmianto, scoreDim, stats,
  respostasDe, entrevistasDe, avaliarFator, riscosPsiDe, nivelDe, riscosPsiASO, medidasAtrasadas, segunda,
  buckets, escopo, fimAfast, medir, fapDeIC, simularFAP, folhaEmpresa, custosPrev, periodoBaseFAP, indicesFAP,
  periodosFuncao, dispensaDemissional, pendenciasPPP, jaTestou, precoPlano, assin, efetiva, proRata,
  ultimasMedidas, condicoesDe, controle, itensAuditoria, calcIMC, classIMC, classPA, classFC, classGlic,
  classSpO2, classAudio, compAudio, audioRef, ultimoProc, procedimentosPara, somaMesmoCID, elegivelINSS,
  kitDatas, kitPendencias, evidencias, avaliarFadiga, critFadiga, resumoFadiga, recorrentesFadiga.
- **Parsers/IO:** lsLoad, lsSave, save, remove, removeMany, handleDbErr, parseListaC, parseNR4, askAI,
  loadScript, carregarPDFJS, arquivosParaImagens, importarResultadosIA, baixar, baixarPDF, carregarExemplo,
  gerarInventario, fadigaParaInventario, concluirEnc.
- **Perfis/portais:** perfilAtual, visao, ocultarPara, renderVerComo, trocarPerfil, dependentes,
  bloqueioExclusao.
- **Render (v*/f*/ps*/as*/sv*):** render, renderNow, renderTabs, toast, vPainel, vEmpresas, fEmpresa,
  vFuncionarios, fFuncionario, vAsos, fAso, vPCMSO, vPsi, barras, psiVisao, psiLev, fCampanha, vKiosk, psiEnt,
  fEntrevista, psiInd, fIndicador, matriz, psiInv, fRiscoPsi, psiRel, niceMax, barChart, vAbs, vFap, vPPP,
  vAfast, boxNTEP, fAfast, carimbo, barraValidacao, vAssin, asClientes, fAssin, asPlanos, asEquipe, fEquipe,
  asSolic, vServ, svPedidos, fPedido, svPrograma, fParticipante, svConsultas, fConsulta, svAuditorias,
  fAuditoria, svCatalogo, fCatalogo, vExames, msgClinica, vEncs, vClinicas, fClinica, badgeCls, fEnc, vKit,
  vTabelas, vPortalEmpresa, vMinhaAssin, vPortalClinica, vAcesso, asPortais, svCliente, psiFadiga, fFadiga,
  alertasPosDem, docWrap.
- **Documentos:** snapASO, docASO, docPCMSO, docPsi, docPPP, docGuia, docKit, docContest, docProposta,
  docPedido, docPrograma, docAuditoria, docFadiga.
- **Captura de formulário:** captureAssin, captureGen, captureEnc, captureClin, captureKit, captureProg,
  captureAud, capturePed, captureAny, readForm, captureEmpresa, captureAso, captureEnt, captureRisco, captureFad.

## 5. Funcionalidades existentes (o que o protótipo faz de fato)

### 5.1 Perfis simulados e visibilidade

Atenção: no modo on-line, **o navegador de qualquer usuário assina todas as 23 coleções** (`html:2966-2973`).
A função `visao` só decide o que a tela de cada perfil recebe durante o render (`html:618-622`), ou seja, não há
isolamento no cliente. A coluna "dados" abaixo descreve a projeção da tela, não o que está carregado.

| Perfil | Como é obtido | Abas | Dados que a tela do perfil recebe (`visao`, `html:572-586`) | O que fica oculto (`ocultarPara`, `html:589-592`) |
|---|---|---|---|---|
| **provedor** (editor) | `ADMIN=true`: editor do artifact ou modo local (`html:316,561,2962`) | 14 abas (`html:527`) | todas as coleções | nada |
| **colaborador sem vínculo** | `ADMIN=false`, sem acesso aprovado e `exigirVinculo` desligado | **visão completa do provedor** (`html:567`) | todas, porque o padrão é `exigirVinculo` desligado | Planos e equipe ficam desabilitados para não editores |
| **empresa** | "Ver como" (prévia) ou `config.portal.acessos[uid]` / `empresaFixa` | 13 abas (`html:569`) | só a própria empresa; funcionários dela; `asos`, `afastamentos`, `encaminhamentos` (objetos completos, **incluindo sinais vitais, audiometria e espirometria**) e `fadiga` desses funcionários; `respostas`, `campanhas`, `entrevistas`, `indicadores`, `riscospsi`, `validacoes`, `pedidos`, `auditorias` e `solicitacoes` da empresa; clínicas ativas; `equipe` completa | nova empresa, excluir empresa, nova clínica, aba Clínicas, editar e excluir encaminhamento, novo pedido, editar assinatura, renovar, backup, exemplo; com plano Completo também Entrevistas. **O ocultar não inclui `novo-aso`**: a empresa consegue emitir e editar ASO próprio (seção 7, R-05) |
| **clínica** | idem, com `tipo:clinica` | 3 abas (`html:570`) | `encaminhamentos` da própria clínica; funcionários dessas guias com salário apagado (`html:580`); **objetos completos das empresas**, inclusive RAT, FAP e folha (`html:581`); `riscospsi` e **`assinaturas` das empresas** (`html:582`, usadas para o bloqueio do teste); ASOs das próprias guias | excluir, nova clínica/empresa, novo encaminhamento, novo ASO, editar ASO, novo pedido, backup, exemplo, PPP |
| **pendente** | `exigirVinculo` ligado e usuário sem vínculo | `acesso` | só as próprias solicitações | — |
| **carregando** | não editor enquanto o banco on-line carrega (`html:562`) | `carregando` | nada | — |

**Não existem** login de médico, psicólogo, trabalhador, técnico de segurança ou escritório. Médicos e
psicólogos da "equipe" (`equipe`) e médicos examinadores da clínica (`clinica.medicos[]`) existem só como
registro, sem autenticação.

### 5.2 Telas, abas, modais e formulários

O inventário completo, com IDs estáveis, está na **seção 5.13**. Resumo: 14 abas no provedor, 7 subabas no
Psicossocial, 5 em Assinaturas, 5 em Serviços e 2 em Exames; modo "quiosque" para o questionário; 27
formulários; não há modais (a confirmação de exclusão é feita inline, em `delBtn`, `html:552`).

### 5.3 Validações implementadas

| Regra | Onde | Bloqueia? |
|---|---|---|
| Dígito verificador de CPF/CNPJ | `html:343-344`, usado em `2560`, `2563`, `2609` | Só avisa (a exceção é o pedido de acesso, que bloqueia CNPJ inválido) |
| CNAE com ≥ 4 dígitos | `html:2559` | Sim |
| CID no formato letra + 2 dígitos | `html:350`, `2572` | Sim |
| Fim do afastamento antes do início | `html:2573` | Sim; sobreposição só gera aviso (`2574`) |
| Desligamento antes da admissão | `html:2562` | Sim |
| ASO sem funcionário ou sem médico examinador | `html:2568-2569` | Sim. O CRM não é validado |
| Concluir encaminhamento sem conclusão, com procedimento sem data ou status, ou sem médico | `html:2054-2058` | Sim |
| Agendamento da clínica com data passada | `html:2499` | Sim |
| Pós-demissional de amianto com data futura ou anterior ao desligamento | `html:2486` | Sim |
| Programa de crônicos ativo sem consentimento | `html:2584` | Sim |
| Link de teleconsulta precisa ser https | `html:2585` | Sim |
| Check-in de fadiga: data futura; horas fora de 0–72; sono em 48 h menor que em 24 h; ausência de sono e KSS | `html:2612-2615` | Sim |
| Segundo teste grátis para o mesmo CNPJ | `jaTestou`, `html:1428`; `2578` | Sim |
| Questionário enviado com menos de 50% dos itens | `html:1006` | Sim (botão desabilitado) |
| Exclusão de clínica com guias abertas; exclusão pela empresa de funcionário ou empresa com ASO ou prontuário (guarda de 20/30 anos); exclusão pela empresa de ASO emitido pela clínica | `bloqueioExclusao`, `html:547-551` | Sim. **O provedor pode excluir em cascata**, só com aviso (`html:552`) |

### 5.4 Status e transições

| Entidade | Status | Transições observadas |
|---|---|---|
| Encaminhamento (`ENC_STATUS`, `html:1813`) | solicitado → emitido → agendado → realizado → concluido \| cancelado | Empresa cria em `solicitado` (`2593`). Clínica: `enc-agendar` → agendado (`2500`), `enc-realizado` → realizado (`2501`). `concluido` só sai de `concluirEnc` (`2053-2064`), que também cria o ASO. Com data agendada, `emitido`/`solicitado` passa a agendado no salvar (`2594`). A importação por IA leva emitido/agendado a realizado (`2040`). Cancelar: empresa, em solicitado ou emitido (`2503`). O provedor muda o status livremente pelo select |
| ASO.resultado | apto \| restricao \| inapto | livre no formulário; snapshot gravado na emissão (`2570`) |
| Assinatura (`assin`, `html:1434-1444`) | sem, teste, ativa, renovar (≤ 60 d), carencia (`fim` + `carenciaDias`, padrão 15; teste não tem carência), vencida, cancelada; flag `pagAtraso` | calculado a partir das datas; `bloqueado` = vencida ou cancelada |
| Validação técnica (`html:1462`) | rascunho, revisao, aprovado, ajustes | "Enviar para revisão" (qualquer perfil); **"Aprovar como \<profissional\>" é clicado pelo editor**, não pelo profissional (`html:1465`) |
| Solicitações | pendente → aprovada \| recusada (tipos: upgrade, teste, acesso) | `html:2353-2373`, `2506-2516` |
| Pedido de serviço (`PED_ST`, `html:1611`) | novo, proposta, contratado, execucao, concluido, perdido | livre |
| Contrato mensal | vigente enquanto `fimContrato ≥ hoje` (`html:1607-1608`) | o vencimento traz de volta a oferta "encerrado em" |
| Programa de crônicos | convidado, ativo, recusou, encerrado | só ativa com consentimento |
| Teleconsulta | agendada, realizada, faltou, cancelada | livre |
| Medida psicossocial | planejada, andamento, concluida; atrasada quando o prazo passa | — |
| Fadiga | liberado, atencao, impedido | `avaliarFadiga`, `html:2855-2865` |
| Item de auditoria | conforme, parcial, nao, na | automático por `itensAuditoria` (`1629-1658`) ou manual |
| Procedimento | pendente, normal, alterado | — |

### 5.5 Regras de negócio

As referências normativas citadas pelo próprio código são todas **HIPÓTESE até validação** pelo Dr. Alcides e
pelo jurídico.

- **Periodicidade do periódico:** usa `fn.periodicidade` da função; sem ela, 12 meses se houver riscos e 24 se
  não houver (`html:388`, "NR-7, 7.5.8" em `738`). O próximo periódico conta a partir do último ASO
  admissional, periódico, de retorno ou de mudança (`390-391`). A situação é "Vencido / Vence em ≤ 30 d / Em
  dia" (`392-393`).
- **Exames por tipo** (`procedimentosPara`, `1836-1844`): exame clínico sempre. Complementares: no periódico,
  só os vencidos em até 30 dias; no retorno, nenhum; no demissional, só audiometria. Fadiga: triagem de sono
  (Epworth/STOP-Bang). Motorista: toxicológico no admissional e no demissional. Riscos psicossociais de nível
  médio ou maior: COPSOQ.
- **Dispensa do demissional:** grau de risco ≥ 3 → 90 dias; caso contrário, 135 (`801-802`, `1317`, "NR-7
  7.5.11").
- **ASO de retorno:** afastamento por doença ou acidente com ≥ 30 dias contínuos. Registros encadeados são
  somados (`inicioContinuo`) e o alerta aparece só no último; "outros" (licenças) não entra (`366-372`).
- **Afastamentos e INSS:** empresa paga até o 15º dia e o benefício começa no 16º (`1410`). Mesmo CID em até 60
  dias soma os períodos ("art. 75 Decreto 3.048/99", `394-396`, `1412`).
- **NTEP:** extrai a classe CNAE com 4 dígitos (`348`), procura o grupo da Lista C cujo intervalo contém o CID
  (`359-364`); status `ntep`, `sem-nexo`, `sem-grupo` ou `invalido`.
- **Guarda de documentos:** 20 anos (NR-7). Passa a 30 anos se alguma função, atual ou do histórico, tiver
  agente com amianto/asbesto/crisotila ou radiação ionizante, detectado por regex e excluindo "não ionizante"
  (`399-406`). Os pendentes 7 da planilha 00 e da CNEN não foram conferidos.
- **Amianto pós-demissional:** 30 anos após o desligamento. Periodicidade pelo tempo de exposição nas funções
  com amianto: até 12 anos, a cada 36 meses; até 20, a cada 24; acima de 20, a cada 12 (`407-417`).
- **FAP/RAT:** `IC=(0,5·pG+0,35·pF+0,15·pC)·0,02`; IC < 1 → FAP = 0,5+0,5·IC; limitado a 0,5–2,0. Trava de
  bônus por morte/invalidez ou rotatividade > 75% ("Res. CNPS 1.347/2021", `481-486`). Índices próprios a
  partir dos afastamentos B91–B94 do período-base (`493-500`). Adicional de aposentadoria especial de 12/9/6%
  sobre salário × 13 (`209`, `490`).
- **Absenteísmo:** taxa = dias de ausência ÷ dias-trabalhador × 100, em dias corridos; custo da empresa até o
  15º dia = salário/30 (`471-478`).
- **Psicossocial:** escore por dimensão com tercis (cortes 2,33 e 3,67); comportamento ofensivo vira "risco"
  com qualquer ocorrência (`427-431`). P = máx(P do questionário, P das entrevistas), a partir do % em risco
  (`probDePct`, `310`). S parte do valor do fator e sobe 1 se ≥ 40% do grupo tiver efeitos (BO/ST/SD) ou se o
  CNAE tiver NTEP mental, **só para F30/F40** (`358`, `440-451`). Nível = P×S (1–4 baixo, 5–9 médio, 10–14
  alto, 15–25 crítico, `309`). Anonimato: `nMin` padrão 5, configurável com mínimo 3 (`426`, `1109`, `2618`).
  Riscos de nível médio ou maior aparecem no ASO, no PCMSO e na guia.
- **Fadiga** (`2846-2865`): menos de 5 h de sono em 24 h → impedido; menos de 6 h → atenção; menos de 12 h em
  48 h → impedido; acordado + jornada > sono em 48 h → atenção; acordado + jornada > 17 h → atenção; KSS ≥ 8 →
  impedido, KSS 7 → atenção; microssono → impedido; interjornada < 11 h → atenção; condução > 5,5 h → atenção
  (só motorista). O check-in alimenta o fator "fadiga" do inventário, com S = 5 quando há motorista (`2933-2940`).
- **Programa de crônicos:** elegibilidade por IMC ≥ 30, PA ≥ 140/90, glicemia ≥ 126 ou CIDs E66/I10-15/E10-14
  vindos dos afastamentos (`1616-1622`). Relatório agregado suprime grupos com menos de 5 pessoas (`1748`).
- **Classificações clínicas:** IMC, PA, FC, glicemia, SpO₂, audiometria (limiar ≤ 25 dB normal; "sugestivo de
  PAIR"; piora em relação ao referencial ≥ 10 dB na média 3/4/6 kHz ou ≥ 15 dB em qualquer frequência, "NR-7
  Anexo II"), espirometria (VEF1/CVF < 0,7) (`1817-1831`, `1947`).
- **Comercial:** plano Essencial = 1.200 + 24/trabalhador/ano; Completo = 3.600 + 60/trabalhador/ano, valores
  marcados "apenas exemplos" (`1420-1423`, `1533`). Upgrade proporcional (`1568-1570`). Teste grátis de 15
  dias, configurável de 1 a 60. Serviços com preço de assinante e de não assinante (`1595-1602`). Contrato
  mensal = qtd × preço × meses (`1609`).

### 5.6 Documentos gerados

Todos os documentos são HTML dentro de `div#doc`. O PDF sai pelo html2pdf, carregado de CDN, ou por fallback em
.html (`2624-2639`), e é baixado pela capacidade `downloads`; no modo local o download fica indisponível
(`2621`). **Nenhum documento tem assinatura eletrônica ou digital.** Há linhas para assinatura manuscrita e, no
plano Completo, um "carimbo" textual "Documento revisado e aprovado por \<nome\> — CRM/CRP" (`1454-1456`),
liberado pelo clique do editor.

| Doc | Função | Campos e origem | "Assinatura" |
|---|---|---|---|
| **ASO** | `docASO` `829-853` | Empresa (razão, CNPJ, CNAE/GR), função/setor, riscos (tipo + agente) e riscos psicossociais (fator, nível, P×S), todos do **snapshot** na emissão (`snapASO` `825-828`); nome, CPF e nascimento lidos **ao vivo** do cadastro; tipo, data, procedimentos com data, conclusão e observações do registro. Médico do PCMSO vem do snapshot; médico examinador vem do registro. No demissional com amianto, inclui texto de direito a exames por 30 anos | Linha "Médico examinador" com data, nome e CRM; linha "Ciente — trabalhador" |
| **PCMSO** | `docPCMSO` `869-908` | Identificação; objetivos; riscos por função (PGR + psicossocial ≥ médio); planejamento de exames por tipo; cronograma individual; vigilância NTEP (grupos da Lista C para a classe do CNAE); relatório analítico do período (contagem de ASOs por tipo, inaptos, afastamentos > 15 d, NTEP, CID F). Vigência = data-base + 12 meses | `carimbo` + linha do médico responsável |
| **Relatório psicossocial** | `docPsi` `1115-1176` | 11 seções: fundamentação (NR-01, Portarias MTE 1.419/2024 e 765/2025, vigência 26/05/2026), metodologia, participação, resultados COPSOQ (omitidos se n < nMin), entrevistas, indicadores, inventário com matriz, plano de ação, integração com PCMSO, conclusões | `carimbo` + linhas do responsável técnico e do médico do PCMSO |
| **PPP** | `docPPP` `1334-1367` | Seções I–IV: dados administrativos, CAT (de `afastamento.cat`), lotação por período (`historico`), profissiografia, exposição (agentes nocivos marcados ou F/Q/B, intensidade, técnica, EPC/EPI, CA, código 09.01.001 quando não há agente), responsável ambiental, monitoração biológica (lista de ASOs, **sem resultados**), representante legal. Aviso: o PPP oficial é eletrônico desde 2023 e este serve de espelho (`1322`) | Representante legal; trabalhador "Recebi a cópia" |
| **Guia de encaminhamento + ficha de coleta** | `docGuia` `1957-2002` | Clínica, agendamento, tipo, empresa, trabalhador (CPF, nascimento, sexo, função/CBO, setor), riscos, atividades, procedimentos solicitados, orientações ao trabalhador (repouso auditivo, jejum, espirometria), instruções à clínica; número `G-AAMMDD-XXXX` (`1848`); ficha em branco (sinais vitais, anamnese, exame físico, audiometria, espirometria, conclusão) | Emitente: médico do PCMSO ou representante legal; ficha: médico examinador |
| **Kit INSS** | `docKit` `2154-2215` | Quatro peças: (1) Declaração do Último Dia Trabalhado; (2) Relatório do médico do trabalho à Perícia (atividades, exposição PGR/LTCAT, riscos psicossociais quando o capítulo do CID se relaciona, medidas, ASOs, dados epidemiológicos de 24 meses, enquadramento NTEP, síntese, manifestação). O **CID só sai com a data de autorização preenchida** (`2174`); (3) Termo de ciência e autorização do trabalhador; (4) Orientações para o requerimento | Representante legal; médico do PCMSO; trabalhador e médico |
| **Requerimento de não aplicação do NTEP** | `docContest` `2216-2232` | Requerente, segurado, NIT, benefício, intervalo CID, data de ciência, fatos, fundamentação, anexos (`ANEXOS` `2069`), pedido | Representante legal + médico |
| **Proposta de assinatura** | `docProposta` `1571-1587` | Planos, preços por número de trabalhadores, valor proporcional do upgrade, condições (incluindo LGPD) | Provedor + aceite |
| **Proposta de serviço** | `docPedido` `1706-1715` | Escopo, investimento (mensal × meses ou por unidade), avisos (telessaúde, fadiga, crônicos, NTEP) | Provedor + aceite |
| **Relatório de auditoria** | `docAuditoria` `1794-1799` | Índice de conformidade, itens por grupo (14 itens automáticos, `1643-1657`), conclusão | Auditor |
| **Programa de crônicos** | `docPrograma` `1746-1758` | Participação e indicadores agregados (n < 5 suprimido), recomendações | Médico / equipe |
| **Programa de fadiga** | `docFadiga` `2941-2953` | Funções abrangidas, indicadores, por setor, inventário e plano, base legal | Médico + empresa "Ciente" |

**Teste grátis:** documentos da empresa em teste viram "demonstração" para quem não é editor do provedor:
marca d'água por CSS, `user-select:none`, bloqueio de copy/contextmenu/Ctrl+P/Ctrl+S e impressão em branco
(`163-165`, `855-860`, `2523-2526`). A proposta comercial continua baixável.

### 5.7 Fluxos de empresa, clínica, profissional e trabalhador

Resumo aqui; o detalhe está nas jornadas da seção 5.14.

- **Empresa:** cadastro da empresa (CNAE, GR, funções com riscos, exames e CBO), funcionários, solicitação de
  exame, registro de atestado, kit INSS, PPP, psicossocial (essencial: inclusive entrevistas e inventário),
  fadiga (se contratada ou em teste), serviços, minha assinatura (teste, assinar, upgrade).
- **Clínica:** fila "A agendar" → confirma data e hora → "Compareceu" → "Registrar resultados" (sinais vitais,
  audiometria, espirometria, procedimentos, importação por IA) → "Concluir e emitir ASO". Também mantém a
  própria clínica (médicos examinadores, exames e preços).
- **Profissional (médico/psicólogo):** **não tem login**. O editor do provedor executa por ele: emite ASO
  direto (`fAso`), aprova PCMSO e relatório "como" o profissional, redige o relatório à perícia e a
  contestação, cuida do programa de crônicos e agenda teleconsultas.
- **Trabalhador:** **não tem portal**. Participa pelo quiosque (tablet) do COPSOQ, com consentimento opcional de
  vínculo ao prontuário, marcado por um editor (`997`). Os documentos chegam a ele em papel (ASO ciente, PPP,
  termo de autorização, orientações INSS). O check-in de fadiga é registrado por terceiro (`registradoPor`).

### 5.8 Agendamentos e encaminhamentos

O encaminhamento guarda `dataPreferida` (da empresa), `dataAgendada` e `hora` (da clínica), `dataEmissao`,
`agendadoEm`, `dataConclusao` e `canceladoEm`. Painéis mostram vencidos, guias paradas há mais de 2 dias
(`660-661`), tempo médio da guia ao ASO e custo pela tabela da clínica (`1869`, `1846-1847`). Não há
notificações; existe um link `wa.me` montado com a mensagem pronta (`1854`, `1861`). Teleconsultas têm agenda
própria (data, hora, link, pagador, valor), separada do ASO.

### 5.9 Afastamentos e datas de retorno

Campos do afastamento: funcionário, CID, início, fim (vazio enquanto em curso), natureza, CAT, NB, espécie e
observações. Linha do tempo do kit: DUT = início − 1 (editável), 15º dia, 16º dia (S-2230), 30º dia (prazo do
requerimento), perícia e prazo de contestação = ciência + 15 (`2072`). Pendências "agora/acompanhar" ficam
neutras quando o fim passou há mais de 90 dias (`2083`). ASO de retorno: alerta no painel e no portal, pílula no
absenteísmo e item de auditoria.

### 5.10 Psicossocial, prontuário, PPP, FAP/RAT, serviços e indicadores

- **Psicossocial:** levantamentos com meta de adesão; quiosque com 47 itens; respostas anônimas gravam só o mês
  (`2437`); entrevistas por código com escala 0–3 por fator; indicadores (com preenchimento automático);
  inventário gerado por GHE × fator, preservando ajuste manual (`1177-1196`); plano em 4 níveis com biblioteca
  de medidas; relatório.
- **Prontuário:** a coleção `prontuario` só recebe COPSOQ identificado (`2439`). Não existe prontuário clínico
  geral; os resultados clínicos ficam dentro de `encaminhamentos` (sinais vitais, audiometria, espirometria e
  resultados por procedimento).
- **PPP:** pendências de preenchimento, registro de entrega, dispensa do demissional.
- **FAP/RAT:** KPIs, régua de 0,5 a 2,0, índices próprios, simulador e adicional de aposentadoria especial.
- **Serviços avulsos:** 7 itens (dossiê NTEP, escritório jurídico sem preço, teleconsulta médica,
  psicológica, programa de crônicos, programa de fadiga, auditoria); pedidos com prospect não cadastrado; KPIs
  de receita.
- **Indicadores:** painel do provedor com 8 KPIs e alertas (assinaturas, contratos, portais, INSS urgente,
  pós-demissional, fadiga, retorno); absenteísmo semanal, mensal ou anual por função e por capítulo CID.

### 5.11 IA

Executada no navegador via `window.claude.use("sample")` com `AI.json(prompt)`. No modo local fica desligada.

| Ação | Linha | O que vai ao modelo |
|---|---|---|
| `ai-funcao` (sugere riscos e exames) | `2300-2304` | nome da função, setor, CNAE e **razão social** |
| `ai-ent` (analisa entrevista) | `2441-2449` | anotações em texto livre ("sem nomes", mas sem filtro) |
| `ai-med` (medidas psicossociais) | `2465-2470` | fator, GHE, CNAE, P/S, base, fontes |
| `ai-rel` (análise do relatório) | `2473-2483` | agregados (omitidos se n < nMin) |
| `ai-aud` (conclusão de auditoria) | `2339-2343` | itens não conformes |
| `ai-kit` (síntese à perícia) | `2400-2418` | CID, função, atividades, riscos, números agregados, "sem nome" |
| `ai-contest` (viabilidade da contestação) | idem | idem; devolve `sustentavel` true/false |
| `importarResultadosIA` (lê laudos da clínica) | `2012-2043` | **imagens ou PDFs de ASO, ficha, audiometria e espirometria**, que normalmente trazem nome, CPF e dados clínicos |

### 5.12 Tabelas normativas e Lista C (NOB-113)

**Estrutura** (`html:182-202`): array de tuplas `[intervaloCID, descrição, "classes CNAE separadas por espaço"]`,
mapeado para `{cid, desc, cnaes[], origem:"base"}`. O usuário pode importar a lista colando texto na aba
Tabelas. `parseListaC` (`503-511`) reconhece `X00-X00` (separador `-`, `–` ou "a") e captura como CNAE qualquer
número de 4 dígitos ou no formato `dd.dd` do trecho. A importação substitui os grupos de mesmo intervalo
(`listaC`, `353-354`).

**Fonte declarada pelo próprio protótipo:** "Lista C – Anexo II do Decreto 3.048/99 (redação do Decreto
6.957/2009). Base PARCIAL (A15–K46)" (`182`). A aba Tabelas manda copiar de
`planalto.gov.br/ccivil_03/decreto/d3048anexoii.htm` (`2239`).

**Conteúdo real:** 18 grupos, 0 intervalos duplicados, nenhum CNAE duplicado dentro de um grupo, todos os
códigos com 4 dígitos numéricos e em ordem crescente, 222 classes CNAE distintas no total. Não encontrei erro de
digitação nas descrições.

| Linha | Intervalo | Descrição (no app) | Nº de classes | 1ª / última |
|---|---|---|---|---|
| 184 | A15-A19 | Tuberculose | 50 | 0810 / 9601 |
| 185 | E10-E14 | Diabetes mellitus | 41 | 1091 / 9420 |
| 186 | F10-F19 | Transtornos mentais por uso de substâncias psicoativas | 77 | 0710 / 9420 |
| 187 | F20-F29 | Esquizofrenia, transtornos esquizotípicos e delirantes | 59 | 0710 / 9420 |
| 188 | F30-F39 | Transtornos do humor (afetivos) | 78 | 0710 / 8800 |
| 189 | F40-F48 | Transtornos neuróticos, relacionados ao estresse e somatoformes | 51 | 0710 / 8610 |
| 190 | G40-G47 | Transtornos episódicos e paroxísticos | 53 | 0113 / 8129 |
| 191 | G50-G59 | Transtornos dos nervos, raízes e plexos nervosos | 51 | 0155 / 8610 |
| 192 | H53-H54 | Distúrbios visuais e cegueira | 50 | 0210 / 8129 |
| 193 | I05-I09 | Doenças reumáticas crônicas do coração | **1** | 4921 / 4921 |
| 194 | I10-I15 | Doenças hipertensivas | 10 | 0111 / 5120 |
| 195 | I20-I25 | Doenças isquêmicas do coração | 21 | 1621 / 6190 |
| 196 | I30-I52 | Outras formas de doença do coração | 52 | 0113 / 9420 |
| 197 | I60-I69 | Doenças cerebrovasculares | 44 | 0810 / 9420 |
| 198 | I80-I89 | Doenças das veias e vasos linfáticos | 66 | 1011 / 9601 |
| 199 | J40-J47 | Doenças crônicas das vias aéreas inferiores | 30 | 0810 / 8411 |
| 200 | K35-K38 | Doenças do apêndice | 27 | 0810 / 8610 |
| 201 | K40-K46 | Hérnias | 92 | 0113 / **4623** |

**Lacunas declaradas:** faltam os grupos M (osteomusculares, incluindo dorsalgias e LER/DORT) e S/T (lesões),
segundo o próprio app (`2239`) e a pendência #3 de todas as planilhas, aberta desde a revisão 1.

**Pontos a validar contra a fonte oficial** (não completei nem corrigi nenhum código):
1. **Integralidade de cada grupo existente.** **HIPÓTESE:** `K40-K46` termina em 4623, enquanto os grupos longos
   costumam chegar às divisões 8x/9x, o que pode indicar truncamento. `I05-I09` tem uma única classe, o que pode
   estar certo ou ser omissão. Conferir os 18 grupos, classe por classe, contra o Anexo II vigente.
2. **Grupos intermediários ausentes** além de M e S/T. Ver se a Lista C oficial tem intervalos que não estão
   aqui, por exemplo em H, J, L ou N. **NÃO VERIFICADO**: não consultei a fonte oficial.
3. **Redação vigente.** O protótipo diz "redação do Decreto 6.957/2009". Verificar se houve alterações
   posteriores ao Anexo II. **NÃO VERIFICADO.**
4. **Granularidade.** O protótipo cruza pela **classe CNAE de 4 dígitos** (`348`). **HIPÓTESE:** confirmar se a
   Lista C usa classe ou subclasse e como tratar o CNAE do estabelecimento.
5. **Formato das entradas.** O parser só reconhece intervalos `X00-X00`. **HIPÓTESE:** se a lista oficial tiver
   entradas com CID único ou com subcategoria, elas seriam descartadas na importação. O parser também pode
   capturar anos ou números de artigo do texto colado como se fossem CNAE.
6. **Agravamento por NTEP "mental"** usa só `F30-F39` e `F40-F48` (`358`) e ignora `F10-F19` e `F20-F29`.
   Essa é uma regra de produto e precisa de decisão clínica (Dr. Alcides).
7. **Sobreposição de intervalos.** Hoje não há; se a importação criar sobreposição, `find` devolve o primeiro
   grupo (`361`).

A tabela **NR-4 (grau de risco)** não vem embutida. Tem só o importador (`parseNR4`, `512-514`); sem ele, o grau
é digitado na empresa.

### 5.13 Inventário de telas (IDs estáveis)

Perfis: Pv = provedor (editor), Em = portal empresa, Cl = portal clínica, Pe = pendente, Tr = trabalhador
(quiosque). Sensibilidade: **S3** = dado de saúde individual ou CID; **S2** = dado pessoal (CPF, NIT, salário)
ou agregado de saúde; **S1** = cadastral ou comercial.

| ID | Tela | Função | Perfis | Objetivo | Campos principais | Ações | Docs | Coleções | Sens. |
|---|---|---|---|---|---|---|---|---|---|
| P-01 | Painel | `vPainel` 633 | Pv (Colab.) | KPIs e alertas | — | encaminhar, emitir ASO, kit, abrir assinaturas, portais, contratos | — | todas | S3 (nomes + CID) |
| P-02 | Empresas (lista) | `vEmpresas` 678 | Pv; Em ("Cadastro da empresa") | CNAE, GR, NTEP por empresa | — | editar, PCMSO, psicossocial, contratar, excluir | — | empresas, assinaturas | S1 |
| P-03 | Empresa (form) | `fEmpresa` 689 | Pv, Em | Cadastro + PGR por função | razão, CNPJ, CNAE, GR, endereço, médico, CRM, resp. PGR, data-base PCMSO; RAT, FAP, folha, vínculos, rotatividade; resp. LTCAT (nome, NIT, registro), rep. legal (nome, NIT); funções: nome, setor/GHE, periodicidade, fadiga, CBO, grau de exposição, atividades; riscos: tipo, agente, nocivo, cód. T24, intensidade, técnica, EPC, EPI, CA; exames: nome, meses | add/rm função, risco e exame; IA sugere | — | empresas | S1/S2 |
| P-04 | Funcionários (lista) | `vFuncionarios` 749 | Pv, Em | Vencimentos | busca nome/CPF, filtro empresa | ASO, PPP, editar, excluir | — | funcionarios, asos | S2 |
| P-05 | Funcionário (form) | `fFuncionario` 761 | Pv, Em | Cadastro | nome, CPF, nascimento, empresa, função, admissão, matrícula eSocial, sexo, NIT, CTPS, salário, situação, desligamento; histórico automático | salvar | — | funcionarios | S2 |
| P-06 | Exames › Encaminhamentos | `vEncs` 1862 | Pv; Em (sem "registrar") | Fila de guias | filtro abertos/concluídos/todos | guia, registrar resultados, ASO, excluir | — | encaminhamentos | S2 |
| P-07 | Encaminhamento / resultados (form) | `fEnc` 1910 | Pv; Em (só nova solicitação); Cl | Solicitar, emitir guia, lançar resultados, concluir | trabalhador, tipo, clínica, data preferida ou agendada, hora, situação, observações; procedimentos (solicitado, nome, resultado, data, status); 12 sinais vitais; audiometria OD/OE em 7 frequências; espirometria CVF/VEF1/%; médico examinador, data, conclusão, restrições | +procedimento, COPSOQ, **IA importa laudos**, concluir e emitir ASO | Guia | encaminhamentos, asos | **S3** |
| P-08 | Guia + ficha de coleta | `docGuia` 1957 | Pv, Em, Cl | Documento à clínica | — | PDF, copiar, WhatsApp | Guia/Ficha | — | S2 |
| P-09 | Exames › Clínicas e médicos | `vClinicas` 1881 | Pv; Cl (a própria) | Rede credenciada | — | editar, excluir | — | clinicas | S1 |
| P-10 | Clínica (form) | `fClinica` 1889 | Pv, Cl | Cadastro | nome, CNPJ, telefone, WhatsApp, e-mail, endereço, horário, situação; médicos (nome, CRM, UF); exames (nome, preço, prazo) | add/rm | — | clinicas | S1 |
| P-11 | ASO (lista) | `vAsos` 785 | Pv, Em, Cl ("ASOs emitidos") | Histórico | busca, filtro | ver, editar, excluir (Em: só ASO não emitido por clínica) | — | asos | S2 |
| P-12 | ASO (form) | `fAso` 797 | Pv, **Em** | Emissão direta | funcionário, tipo, data, conclusão, médico examinador, CRM, procedimentos com data, observações; alerta de dispensa ou retorno; resultado COPSOQ individual ("sigilo") | +procedimento, aplicar COPSOQ | ASO | asos, prontuario, respostas | **S3** |
| P-13 | ASO (documento) | `docASO` 829 | Pv, Em, Cl | Documento | — | PDF, copiar; kit demissional → PPP | ASO | asos | S3 |
| P-14 | PPP (lista) | `vPPP` 1319 | Pv, Em | Pendências e entregas | — | emitir, ASO demissional | — | funcionarios, asos | S2 |
| P-15 | PPP (documento) | `docPPP` 1334 | Pv, Em | Espelho do PPP | — | registrar entrega, PDF | PPP | — | S2/S3 (CAT) |
| P-16 | PCMSO | `vPCMSO` 863 | Pv, Em | Documento + validação | empresa | validação (enviar, aprovar como, ajustes, reabrir), PDF | PCMSO | todas da empresa | S2 |
| P-17 | Psicossocial › Resultados | `psiVisao` 932 | Pv, Em | Dimensões e mapa por GHE | empresa, período | gerar inventário | — | respostas, entrevistas | S2 (agregado) |
| P-18 | › Levantamentos | `psiLev` 956 | Pv, Em | Ciclos de coleta | — | novo, aplicar questionário, avulso | — | campanhas | S1 |
| P-19 | Levantamento (form) | `fCampanha` 973 | Pv, Em | — | nome, início, fim, método, meta %, público, objetivo | salvar | — | campanhas | S1 |
| P-20 | Questionário COPSOQ (quiosque) | `vKiosk` 987 | Tr (no aparelho do Pv/Em) | Coleta | GHE, consentimento de vínculo (só editor), 47 itens | enviar, cancelar | — | respostas, prontuario | **S3** quando identificado |
| P-21 | › Entrevistas | `psiEnt` 1009 | Pv, Em (oculta no Completo) | Lista | — | nova, abrir, excluir | — | entrevistas | S2 |
| P-22 | Entrevista (form) | `fEntrevista` 1016 | Pv, Em | Registro qualitativo | data, código, GHE, entrevistador, formato, levantamento, 13 fatores 0–3, anotações, síntese | IA analisa | — | entrevistas | S2/S3 (texto livre) |
| P-23 | › Indicadores | `psiInd` 1037 | Pv, Em | Série mensal | — | registrar | — | indicadores | S1 |
| P-24 | Indicadores (form) | `fIndicador` 1045 | Pv, Em | — | período, absenteísmo, rotatividade, horas extras, denúncias, acidentes, observações | preencher com dados do app | — | indicadores | S1 |
| P-25 | › Inventário e plano | `psiInv` 1065 | Pv, Em | Matriz 5×5 | — | gerar, avaliar e planejar | — | riscospsi | S2 |
| P-26 | Risco psicossocial (form) | `fRiscoPsi` 1076 | Pv, **Em** (edita inclusive no Completo: pendência #4) | Avaliação + plano | fontes, agravos, P, S, justificativa, existentes; medidas (nível, descrição, responsável, prazo, status, indicador) | biblioteca, IA sugere | — | riscospsi | S1 |
| P-27 | › Fadiga | `psiFadiga` 2872 | Pv, Em (contratado ou em teste) | Painel do programa | — | novo check-in, atualizar inventário, PDF | — | fadiga, pedidos | S3 |
| P-28 | Check-in de fadiga (form) | `fFadiga` 2908 | Pv, Em | Triagem antes da jornada | trabalhador, data, hora, turno, sono 24/48 h, acordado, jornada, interjornada, condução, KSS, microssono, medidas | registrar | — | fadiga | **S3** |
| P-29 | Relatório de fadiga | `docFadiga` 2941 | Pv, Em | Documento | — | PDF | Fadiga | — | S2 |
| P-30 | › Relatório psicossocial | `psiRel` 1104 | Pv, Em | Dados + documento | resp. técnico, registro, nMin (≥ 3), conclusões | IA redige, validação, PDF | Psicossocial | empresas, todas psi | S2 |
| P-31 | Afastamentos e NTEP (lista + consulta CID×CNAE) | `vAfast` 1370 | Pv, Em | Afastamentos e cruzamento | consulta: CID, CNAE | registrar, kit, abrir, excluir | — | afastamentos | **S3** (CID) |
| P-32 | Afastamento (form) | `fAfast` 1394 | Pv, Em ("Registrar atestado") | Registro | funcionário, CID, início, fim, motivo, CAT, NB, espécie, observações; alertas INSS/NTEP/60 d/30 d | kit, ASO de retorno | — | afastamentos | **S3** |
| P-33 | Kit INSS (form) | `vKit` 2102 | Pv, Em | Linha do tempo e peças | DUT, S-2230, entrega, autorização, protocolo, perícia, CAT; síntese, manifestação; espécie, NB, ciência, DCB; contestação (decisão, protocolo, resultado, fatos, fundamentação, anexos) | IA síntese e contestação, contratar dossiê | Kit, Contest. | afastamentos, pedidos | **S3** |
| P-34 | Kit INSS (documento) | `docKit` 2154 | Pv, Em | 4 peças | — | PDF | Kit | — | **S3** |
| P-35 | Requerimento de não aplicação do NTEP | `docContest` 2216 | Pv, Em | Peça | — | PDF | Contest. | — | S3 |
| P-36 | Absenteísmo | `vAbs` 1217 | Pv, Em | Indicadores | empresa, função, granularidade, outros | — | — | afastamentos, funcionarios | S2/S3 (lista > 15 d com CID) |
| P-37 | FAP e RAT (+ simulador) | `vFap` 1264 | Pv, Em | Custo previdenciário | percentis G/F/C, rotatividade, morte/invalidez | simular | — | empresas, afastamentos | S2 (salários) |
| P-38 | Tabelas (Lista C, NR-4, backup) | `vTabelas` 2235 | Pv | Base normativa | textos colados | importar, voltar à base, backup JSON | — | tabelas | S1 (o backup é S3) |
| P-39 | Assinaturas › Clientes | `asClientes` 1480 | Pv (Colab. consulta) | Carteira | — | criar ou gerenciar, teste grátis, renovar/converter, proposta | — | assinaturas | S1 |
| P-40 | Assinatura (form) | `fAssin` 1502 | Pv | Contrato | plano, início, fim, valor, forma de pagamento, médico, psicólogo, cancelada, pagamentos (vencimento, valor, ref., status), observações | gerar parcelas | — | assinaturas | S1 |
| P-41 | › Planos e preços | `asPlanos` 1524 | Pv | Configuração | nome, base, por trabalhador, itens; dados do provedor; dias de teste; carência | salvar | — | config | S1 |
| P-42 | › Equipe técnica | `asEquipe` 1545 | Pv | Profissionais | — | adicionar, editar, excluir | — | equipe | S1 |
| P-43 | Profissional (form) | `fEquipe` 1551 | Pv | — | nome, tipo, registro, UF, RQE, e-mail | salvar | — | equipe | S1 |
| P-44 | › Upgrades / teste | `asSolic` 1560 | Pv | Solicitações | — | liberar teste, aprovar, recusar, proposta | — | solicitacoes | S1 |
| P-45 | › Portais | `asPortais` 2813 | Pv (editor) | Acessos | exigir vínculo, cópia dedicada; vincular a | liberar, cadastrar + teste, recusar, remover, ver como | — | config, solicitacoes | S1 |
| P-46 | Proposta de assinatura | `docProposta` 1571 | Pv, Em | Documento | — | PDF | Proposta | — | S1 |
| P-47 | Serviços › Pedidos | `svPedidos` 1673 | Pv | CRM de serviços | — | abrir, proposta, kit, excluir | — | pedidos | S1/S3 (CID no escopo do dossiê) |
| P-48 | Pedido (form) | `fPedido` 1687 | Pv | — | serviço, empresa ou prospect (razão, CNPJ, contato, CNAE), qtd, início, meses, valor, escritório, responsável, origem, situação, prazo, escopo | salvar | — | pedidos | S1 |
| P-49 | Proposta de serviço | `docPedido` 1706 | Pv, Em | — | — | PDF | Proposta serv. | — | S1 |
| P-50 | › Programa de crônicos | `svPrograma` 1716 | Pv (Em vê aviso) | Elegíveis e participantes | — | convidar, incluir, relatório | — | programa, encaminhamentos, afastamentos | **S3** |
| P-51 | Participante (form) | `fParticipante` 1733 | Pv | Acompanhamento | trabalhador, condições, situação, consentimento, profissional, metas; acompanhamentos (data, peso, PA, glicemia, HbA1c, observação) | agendar teleconsulta | — | programa | **S3** |
| P-52 | Relatório do programa de crônicos | `docPrograma` 1746 | Pv | Agregado | — | PDF | Programa | — | S2 |
| P-53 | › Teleconsultas | `svConsultas` 1759 | Pv | Agenda e faturamento | — | agendar, sala, abrir | — | consultas | S2 |
| P-54 | Teleconsulta (form) | `fConsulta` 1767 | Pv | — | tipo, paciente, nome, profissional, data, hora, link https, pagador, valor, situação, observação administrativa | salvar | — | consultas | S2 |
| P-55 | › Auditorias | `svAuditorias` 1781 | Pv | Lista | — | nova, abrir, relatório, excluir | — | auditorias | S1 |
| P-56 | Auditoria (form) | `fAuditoria` 1784 | Pv | Checklist | empresa ou externa, data, auditor, 14 itens (situação, evidência), conclusão | recalcular, IA conclui | — | auditorias, pedidos | S1 |
| P-57 | Relatório de auditoria | `docAuditoria` 1794 | Pv | — | — | PDF | Auditoria | — | S1 |
| P-58 | › Catálogo (+ editar) | `svCatalogo` 1800 / `fCatalogo` 1803 | Pv | Serviços e preços | nome, linha, preços, unidade, executor, descrição | add/rm | — | config | S1 |
| P-59 | Portal empresa › Início | `vPortalEmpresa` 2716 | Em | Pendências do dia | — | solicitar exame, registrar atestado, cadastrar funcionário, kit, retorno, demissional, PPP, cancelar solicitação | — | filtrado | S3 |
| P-60 | Portal empresa › Minha assinatura | `vMinhaAssin` 2754 | Em | Plano, validações, pagamentos | — | pedir teste, assinar, upgrade, proposta | — | assinaturas, validacoes | S1 |
| P-61 | Portal empresa › Serviços | `svCliente` 2836 | Em | Catálogo + meus pedidos | — | solicitar | — | pedidos | S1 |
| P-62 | Portal clínica › Agenda | `vPortalClinica` 2777 | Cl | Fila, agenda, concluídos | data e hora por guia | confirmar, guia, compareceu, registrar resultados | — | encaminhamentos | S2 |
| P-63 | Acesso ao portal | `vAcesso` 2801 | Pe | Pedir vínculo | perfil, nome, razão, CNPJ, contato | pedir acesso | — | solicitacoes | S1 |
| P-64 | Carregando | inline 615 | não editor on-line | Evitar vazamento durante a carga | — | — | — | — | — |
| C-01 | Seletor "Ver como" + faixa de prévia | `renderVerComo` 594, `621` | Pv | Simular portais | — | trocar perfil, sair | — | — | — |
| C-02 | Faixa do teste grátis / bloqueio | `624-625`, `docWrap` 857 | Em | Comunicar teste ou vencimento | — | escolher plano | — | assinaturas | — |
| C-03 | Barra de validação técnica | `barraValidacao` 1457 | Pv, Em | Fluxo de revisão do Completo | observação | enviar, aprovar como, ajustes, reabrir | — | validacoes | S1 |

### 5.14 Jornadas ponta a ponta demonstradas

Montei as jornadas lendo o código e os testes. Nenhuma foi executada.

- **J-01 Empresa, exame ocupacional.** Pré-requisitos: provedor libera o acesso (P-45) e a empresa completa o
  cadastro (P-59 → P-03). P-59 "Solicitar exame" leva ao P-07 (trabalhador, tipo, clínica, data de preferência;
  procedimentos montados pela função, sem edição de resultados) e grava `status=solicitado`. A empresa acompanha
  em P-59/P-06 e pode cancelar enquanto o status for solicitado ou emitido. Depois que a clínica conclui, a
  empresa vê o ASO em "ASOs dos últimos 30 dias" (P-59) e em P-13, travado para edição. Testes `portal.py:30-47`
  e `68-69`.
- **J-02 Clínica, do pedido ao ASO.** P-62 "A agendar" → data e hora → `enc-agendar` (status agendado; "a empresa
  já vê a data") → "Compareceu" (realizado) → P-07: sinais vitais com classificação ao vivo, audiometria com
  comparação ao referencial, espirometria, resultado por procedimento, ou IA importando o PDF → médico
  examinador escolhido na lista da clínica → "Concluir e emitir ASO" (`concluirEnc`): cria o ASO com
  `encId` e o snapshot, e o encaminhamento passa a concluído. Testes `portal.py:49-66`.
- **J-03 Médico do trabalho.** **Não há jornada própria.** O médico aparece como (a) nome digitado no ASO
  (P-12) ou na empresa; (b) item da lista de médicos examinadores da clínica; (c) membro da equipe designado no
  Completo, cuja "aprovação" é um clique do editor (C-03); (d) autor presumido do relatório à perícia e do
  requerimento NTEP (P-33/P-34/P-35), redigidos pelo editor, com IA opcional; (e) profissional de referência
  no programa de crônicos e na teleconsulta.
- **J-04 Trabalhador.** **Não há portal.** Pontos de contato: o quiosque COPSOQ (P-20) em aparelho da empresa
  ou do provedor (pendência 10: o respondente consegue sair do quiosque e ver o app); o consentimento de vínculo
  ao prontuário marcado pelo editor; documentos em papel (ASO "ciente", PPP "recebi", termo de autorização ao
  INSS, orientações); a guia com orientações de preparo; o check-in de fadiga lançado por terceiro.
- **J-05 Afastamento → INSS → NTEP → FAP.** P-32 (CID, datas) → alerta INSS ou NTEP → P-33 (prazos S-2230,
  protocolo, relatório, manifestação) → decisão do INSS (espécie) → se B91 com NTEP: decidir contestação (IA
  diz se é sustentável) → P-35 → opcionalmente "Contratar dossiê técnico" (pedido em P-47) → B91–B94 entram nos
  índices do FAP (P-37) → retorno ≥ 30 d gera ASO de retorno (J-01 com `tipo=retorno`).
- **J-06 Ciclo psicossocial NR-01.** P-18/P-19 → P-20 (campanha, periódico pelo ASO/guia ou avulso) → P-21/P-22
  → P-23/P-24 → P-17 → "gerar inventário" → P-25/P-26 (medidas e IA) → P-30 (relatório + validação no
  Completo) → riscos de nível médio ou maior aparecem no ASO, PCMSO e guia.
- **J-07 Desligamento.** P-05 (situação "desligado", data) → P-14 mostra demissional pendente ou dispensável →
  ASO demissional (via clínica ou direto) → "Kit demissional: ASO + PPP" (`788`) → P-15 "Registrar entrega" →
  se houve amianto: alertas pós-demissionais por 30 anos (P-01/P-59) com registro de avaliação.
- **J-08 Comercial do provedor.** Exemplo → P-39/P-40 (plano, parcelas) → teste grátis (pedido em P-60 ou
  início direto) → conversão → upgrade proporcional → renovação/carência/bloqueio de emissão; serviços avulsos
  (P-47/P-48/P-49), inclusive prospects não cadastrados; contratos mensais com vigência e alerta de renovação.

## 6. Lacunas (o que o protótipo não tem)

1. **Autenticação e autorização reais:** perfis por tela; dados de todas as empresas no mesmo store;
   `exigirVinculo` desligado por padrão, o que dá visão completa a qualquer não editor (`567`).
2. **Perfis clínicos:** sem login de médico, psicólogo ou trabalhador; nenhuma separação entre perfil de saúde
   e gestor dentro da empresa (a planilha 01, pendência 1, diz que resultados de exames são visíveis a todo
   Colaborador).
3. **Assinatura eletrônica/digital** de ASO, PCMSO, relatórios e termos: nenhuma.
4. **Trilha de auditoria:** inexistente. Só há os campos `por`/`registradoPor`/`solicitante` = UID em algumas
   gravações.
5. **Prontuário médico:** inexistente como entidade. Resultados ficam em `encaminhamentos`; `prontuario` guarda
   só COPSOQ identificado.
6. **Anexos de laudo** (arquivos): a importação por IA lê o arquivo, mas não o guarda.
7. **Integrações:** eSocial (S-2210/2220/2230/2240), CNPJ, notificações, gateway, NFS-e, telessaúde: nenhuma.
   Há só o link wa.me e o registro manual de pagamentos.
8. **Lista C** incompleta (sem M e S/T) e **NR-4** vazia por padrão.
9. **Portal do trabalhador**, convites por e-mail, 2FA: ausentes.
10. **Versionamento de documentos emitidos:** só o snapshot do ASO; PCMSO e PPP são sempre recalculados ao
    vivo (o PPP lê o cadastro atual).
11. **Retenção:** a regra de guarda só bloqueia exclusão pela empresa. O provedor apaga em cascata; não há
    arquivamento.
12. **Escala:** cálculos no cliente; planilha 00, pendência 12: "acima de alguns milhares… lentos".

## 7. Riscos

| ID | Risco | Evidência | Sev. |
|---|---|---|---|
| R-01 | Vazamento entre empresas na versão on-line: isolamento só visual e `exigirVinculo` desligado por padrão | `html:555,567,2820`; planilha 00, pendências 1 e 2 | Crítica |
| R-02 | Mesmo no recorte de tela, o portal da empresa recebe os objetos completos de `encaminhamentos` (sinais vitais, audiometria, espirometria) e de `afastamentos` (CID). A UI esconde parte desses dados, mas a projeção definida já excede a regra "empresa não vê resultados" da spec. No navegador, todas as coleções estão carregadas (R-01) | `html:576`, `2966-2973`; planilha 01, pendência 1 | Alta |
| R-03 | A projeção da clínica inclui objetos completos das empresas (RAT, FAP, folha, rep. legal) e as assinaturas delas (valores e pagamentos), contra a spec ("não vê dados financeiros") | `html:581-582` | Alta (no desenho da plataforma) |
| R-04 | "Aprovar como \<médico/psicólogo\>" executado pelo editor; o carimbo atesta revisão de quem não clicou | `html:1465`, `1454-1456` | Alta (ético/legal: **HIPÓTESE**, validar com o Dr. Alcides) |
| R-05 | Empresa pode emitir e editar ASO próprio (`novo-aso` não está em `ocultarPara`), digitando qualquer médico; só o ASO emitido pela clínica fica travado | `html:590`, `791`, `795`, `2306` | Alta |
| R-06 | IA recebe imagens de laudos (nome, CPF, dados clínicos) e a razão social, executada no cliente; a spec exige o contrário | `html:2012-2027`, `2301` | Alta |
| R-07 | Re-identificação no COPSOQ: respostas guardam GHE e origem ("periodico" ligado ao ASO/guia); `nMin` pode cair para 3; o consentimento de vínculo é marcado por terceiro | `html:2437`, `1109`, `997` | Média (**HIPÓTESE**) |
| R-08 | NTEP com Lista C parcial: afastamentos M e S/T aparecem como "Grupo fora da base" | `html:2239`, `1392` | Alta para uso real |
| R-09 | Regras clínicas e normativas implementadas sem validação formal (periodicidade, dispensa, retorno, audiometria, fadiga, FAP) | planilha 00, pendências 5–7; seção 5.5 | Alta |
| R-10 | Exclusão em cascata pelo provedor apaga ASO e prontuário dentro do prazo de guarda (só avisa) | `html:552`, `2293` | Média |
| R-11 | Testes com datas fixas: `portal.py:37,54` agenda em "2026-10-21", e `enc-agendar` recusa data passada (`html:2499`). **HIPÓTESE:** falham a partir de 22/10/2026; não executados | `testes/portal.py` | Baixa |
| R-12 | Dados possivelmente reais na versão on-line (artifact claude.ai), fora de qualquer contrato de operador | LEIAME:9; **NÃO VERIFICADO** | A confirmar (Carlos/Expedito) |
| R-13 | (Descartado na revisão.) O select de clínica em P-07 continua habilitado para guias existentes (`html:1922`), mas no portal da clínica só lista a própria clínica, porque a projeção filtra `clinicas`. Não há troca indevida pela tela | `html:583`, `1922` | — |
| R-14 | Código com dependência de CDN (html2pdf, pdf.js, Google Fonts) e de capacidades `window.claude.*` não portáveis | `html:2-4`, `2004`, `2959-2962` | Média para migração |

## 8. Dependências

- **Com o PGR-e atual.** No `develop-ro` (d6b787c) já existem, pelo nome, as tabelas `health_exams`, `medicos`,
  `psychosocial_*` (campaigns, questions, responses, answers, risk_factors, risks), `accidents`,
  `schedule_events`, `esocial_*`, `signature_requests/captures` e `company_modules/company_module_events`. O
  protótipo tem equivalentes conceituais em asos/encaminhamentos, equipe/clinicas.medicos,
  campanhas/respostas/riscospsi, afastamentos, encaminhamentos/consultas, assinaturas e `assinaturas.plano`. **O
  mapeamento campo a campo não foi feito** e fica com o agente de código.
- **Normativas.** Precisam de conferência antes de qualquer porte: Anexo II do Decreto 3.048/99 (Lista C), NR-4
  Anexo I, NR-7 (itens citados), NR-15 Anexo 12, norma CNEN, NR-01 (psicossocial), Res. CNPS 1.347/2021, CLT
  66/168 §6, CTB 67-C, Res. CFM 2.323/2022, Parecer CFM 10/2025. Todas citadas pelo protótipo; nenhuma conferida
  por mim.
- **Decisões de produto** pendentes nas planilhas (inventário editável no Completo, ASO da clínica no teste) e na
  spec (estrutura societária, gateway, eSocial, telessaúde).
- **PR #112 / Linear NOB-98** (fontes de riscos para Medicina) e NOB-113 (Lista C, conforme o enunciado): a
  Lista C do protótipo é um insumo **parcial**, não é fonte.

## 9. Decisões pendentes

| # | Decisão | Para quem |
|---|---|---|
| D-01 | Isolamento: a spec recomenda **banco por cliente**; o PGR-e usa **banco compartilhado com RLS** (confirmado no código por AUDIT-ARCHITECTURE §4.5 e AUDIT-SECURITY §5; revisão cruzada). Manter RLS e registrar a divergência com a spec? | Douglas + Rikelvin; Expedito ciente |
| D-02 | Quais regras clínicas do protótipo viram requisito (periodicidade 12/24, dispensa 90/135, retorno ≥ 30 d, classificação audiométrica, critérios de fadiga, gatilhos do programa de crônicos) | Dr. Alcides |
| D-03 | Lista C: fonte oficial a usar, versão vigente, classe × subclasse, como validar os 18 grupos e completar M e S/T | Dr. Alcides (conteúdo) + **Carlos** (carga; NOB-113 está atribuída ao Carlos no Linear, conforme AUDIT-LINEAR-QA §4.3; correção da revisão cruzada) |
| D-04 | Quem pode emitir ASO: só a clínica/médico examinador, ou também a empresa e o provedor (hoje ambos podem) | Dr. Alcides + Expedito |
| D-05 | Validação "Aprovar como": exigir login e assinatura do profissional | Dr. Alcides + Douglas |
| D-06 | O que a empresa vê de saúde: CID dos afastamentos, resultados de exames, kit INSS com relatório médico | Dr. Alcides + Rikelvin (autorização) |
| D-07 | Escopo comercial: teste grátis, fadiga, contratos mensais e preços duplos (planilhas, 14/10) entram? A spec (13/10) não traz esses itens | Expedito |
| D-08 | IA: permitir leitura de laudos com PII? Executar no servidor e pseudonimizar? | Douglas + Rikelvin; jurídico |
| D-09 | `nMin` do COPSOQ: fixo em 5 (spec) ou configurável com mínimo 3 (protótipo); qual instrumento psicossocial é aceito (COPSOQ "adaptado") | Dr. Alcides/psicólogo + Expedito |
| D-10 | Inventário psicossocial editável pela empresa no plano Completo (planilha, pendência 4) | Expedito |
| D-11 | Retenção de 30 anos para radiação ionizante (CNEN) e política de exclusão/arquivamento | Dr. Alcides + jurídico; Douglas (implementação) |
| D-12 | Confirmar se a versão on-line do protótipo (artifact) tem dados reais e como migrar ou apagar | Carlos + Expedito |

## 10. Recomendações

1. Tratar o HTML como **especificação executável de comportamento**, não como base de código. Extrair regras
   (seção 5.5) para uma lista de requisitos numerada, cada uma com o status "validado/não validado" por Dr.
   Alcides (D-02).
2. Usar o inventário P-01…P-64 como backlog de telas da frente de Medicina, cruzado com as tabelas que já
   existem (seção 8), antes de criar schema novo.
3. Não importar `LISTA_C_BASE` como dado de produção. Carregar a Lista C a partir da fonte oficial validada e
   usar os 18 grupos do protótipo só como **teste de regressão** (os valores devem coincidir ou ter a diferença
   justificada).
4. Corrigir no desenho da plataforma, e não portar: R-02, R-03, R-04, R-05 e R-06.
5. Registrar formalmente a divergência D-01 (RLS × banco por cliente) num ADR, citando a tabela comparativa da
   spec.
6. Pedir a Expedito uma **posição única** sobre o que prevalece quando spec (13/10) e planilhas/HTML (14/10)
   divergem (seção 11.1).
7. Se for preciso reaproveitar os testes Playwright como especificação de aceitação, trocar as datas fixas por
   datas relativas.

## 11. Nível de confiança

- **Alto:** inventário de arquivos, contagens (linhas, coleções, funções, formulários, abas), estrutura e
  conteúdo da Lista C embutida, conteúdo das planilhas, leitura dos testes, equivalência .md/.docx. Tudo foi
  medido.
- **Médio-alto:** descrição de fluxos, perfis e visibilidade, a partir de leitura integral do código, sem
  execução.
- **Médio:** riscos marcados como HIPÓTESE (R-07, R-11) e a leitura dos efeitos em runtime do artifact
  claude.ai (regras de permissão da plataforma de artifacts desconhecidas).
- **Baixo / nenhum:** correção normativa ou clínica de qualquer regra (não é escopo e não consultei fontes
  oficiais).

### 11.1 Tabela de divergências (HTML × especificação × planilhas)

Datas: spec "Oct 13, 2026" (rev. 14 do Claude Docs); planilhas de 13 e 14/10; HTML V17 de 14/10, que é o mais
recente. Não assumi que a spec prevalece.

| # | Item | HTML (V17, 14/10) | Especificação (13/10) | Planilhas (13–14/10) | Mais recente | Decide |
|---|---|---|---|---|---|---|
| V-01 | Isolamento | filtro na tela, um store (`555`, `2820`) | banco por cliente + central | pendência 1 aberta ("resolver na plataforma") | HTML/planilha = estado; spec = alvo | Douglas/Rikelvin (D-01) |
| V-02 | Teste grátis 15 d e docs só leitura | implementado (V15/V16) | ausente | ajustes V15/V16 entregues | planilha/HTML | Expedito |
| V-03 | Programa de fadiga | implementado + serviço mensal | ausente ("oito ofertas") | V13; pendências 5 (critério clínico) e 6 (base legal) | planilha/HTML | Expedito + Dr. Alcides |
| V-04 | Cobrança de serviços mensais | qtd × preço × meses, fixo, com vigência (`1609`) | crônicos "fecha mensalmente pelo número de participantes ativos" | revisão 4 (V14) | planilha/HTML | Expedito |
| V-05 | Preço de auditoria | fixo "por empresa" (2.500/3.200) | "base + valor por trabalhador" | — | spec × HTML (sem data de decisão) | Expedito |
| V-06 | Atendimento psicológico | por sessão | "por sessão ou pacote" | — | — | Expedito |
| V-07 | Preço assinante × não assinante | dois preços por serviço | não detalha | V13 | planilha/HTML | Expedito |
| V-08 | Anonimato COPSOQ | `nMin` padrão 5, mínimo 3 | "menos de 5 nunca enviados ao navegador" | V8: ocultos abaixo do mínimo | conflito de regra | Dr. Alcides/psicólogo (D-09) |
| V-09 | Prazo de guarda | 20 anos; 30 com amianto ou ionizante | 20 anos (NR-7, "de memória") | V11; pendência 7 (CNEN não conferida) | planilha/HTML | Dr. Alcides + jurídico |
| V-10 | Perfis | provedor, colaborador, empresa, clínica, pendente | 9 perfis (inclui técnico de segurança, médico, psicólogo, escritório, trabalhador) | — | spec = alvo | Rikelvin + Expedito |
| V-11 | Portal do trabalhador | inexistente | fase 2 | pendência 10 (tablet) aponta para a plataforma | — | Expedito |
| V-12 | Assinatura digital | linhas manuscritas + carimbo | ICP-Brasil na fase 1 | — | spec = alvo | Douglas + Dr. Alcides |
| V-13 | IA e PII | envia imagens de laudos e razão social, no cliente | servidor, sem nome/CPF, pseudonimizado | V8: anonimato no que vai para a IA (só COPSOQ) | conflito | Douglas/Rikelvin (D-08) |
| V-14 | Cobrança | manual, carência 15 d, teste sem carência | gateway, NFS-e, régua, carência 15 d | V17: reassinatura e teste | parcial | Expedito |
| V-15 | Renovação | recalcula sempre por trabalhadores ativos (`2350`) | reajuste só se o quadro variar > 10% (o texto da proposta no HTML repete a spec, `1584`) | — | inconsistência interna do HTML | Expedito |
| V-16 | Resultados de exames × empresa | UI oculta, dados carregados (`576`) | "sem acesso da empresa" | planilha 01, pendência 1: visíveis a todo Colaborador | spec = alvo | Dr. Alcides + Rikelvin |
| V-17 | Dados da clínica | recebe empresas completas e assinaturas (`581-582`) | "não vê… dados financeiros da empresa" | — | spec = alvo | Rikelvin |
| V-18 | Notificações | só link wa.me manual | e-mail e WhatsApp a cada etapa | — | spec = alvo | Expedito |
| V-19 | Lista C | 18 grupos (A15–K46) | "completa carregada na base" (fase 1) | pendência 3 aberta em todas | spec = alvo | Dr. Alcides + Rikelvin |
| V-20 | Teleconsulta × ASO | sem ligação entre entidades (só texto) | "o sistema bloqueia emitir ASO a partir de teleconsulta" | — | compatível na prática | — |
| V-21 | Inventário psicossocial no Completo | empresa edita | não trata | pendência 4 aberta | — | Expedito |
| V-22 | Pendência "resultados visíveis a todo Colaborador" | — | — | 01 (13/10) diz isso; 00 (14/10) reescreve como "dados de todas as empresas no mesmo banco" | 00 | — (redação) |
| V-23 | Arquitetura de app | arquivo único com `window.claude.*` | Next.js ou similar + API Node/Python | — | spec alinhada ao stack do PGR-e | Douglas |

## 12. O que não foi possível verificar

- Execução de qualquer teste ou do app: os "179/179" são valores relatados pela planilha.
- Comportamento real do banco do artifact claude.ai (regras de leitura por papel, a "área restrita à equipe de
  saúde" citada na planilha 01, falha 5) e se há dados reais na versão on-line.
- Conformidade normativa de qualquer regra e da Lista C com a fonte oficial vigente. Não consultei planalto.gov.br
  nem outras fontes.
- Geração efetiva de PDF (biblioteca de CDN) e importação por IA. A própria planilha diz que não foram testadas
  (pendência 11).
- Mapeamento campo a campo entre o protótipo e o schema atual do PGR-e (só os nomes de tabela foram listados).
- Integridade visual e CSS completo do HTML (só as regras relevantes foram lidas).
- Conteúdo dos links de artifact citados no LEIAME (não abertos, por regra).
