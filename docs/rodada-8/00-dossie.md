# Rodada 8 — Dossiê compartilhado

> Contexto único de todos os agentes desta rodada. **Leia inteiro antes de agir.**
> Escrito pela sessão principal em 2026-08-21, a partir de exploração já feita —
> não refaça o que já está apurado aqui.

---

## 1. As ordens do autor, na íntegra

> Procure no meu computador esses arquivos `C:\Users\raafa\Downloads\lista bugs 20260807.xlsx`
> e `C:\Users\raafa\Downloads\fluxo_investidor_FORMULAS.xlsx` e
> `C:\Users\raafa\Downloads\20260730_EVI_Urbita_corrigido.xlsx`. Use a lista de issues como
> referência para itens que serão detalhados e criados issues uma por uma no repo real. Os
> outros documentos servem de referência para verificar contexto e fórmulas no app de
> viabilidade. Eu quero 6 subagentes trabalhando a partir daqui. Um deles vai olhar a lista
> de issues e trabalhar na descrição delas com detalhes e verificando com o repo atual o que
> já foi implementado para ser eliminado. Os outros 3 subagentes vão determinar cada um do
> seu jeito as regras que devem ser escritas de forma a representar corretamente no app de
> viabilidade os fluxos esperados em cada um dos documentos e situações — velocidade de
> vendas, condições de pagamento, financiamento a construção, capital de giro, empréstimos,
> etc. Os outros 2 subagentes vão entrar no ambiente do urbiverso nessa parte de tokens e
> fazer verificação de contas e cálculos além de buscar por erros visuais no ambiente atual.
> (…) Esses subagentes podem e devem poder se comunicar para identificar todos os problemas
> e trocar conhecimento de forma que todos se ajudem e o resultado seja um app muito mais
> aperfeiçoado.

Decisões que o autor tomou depois, ao ser consultado:

- **Escopo**: reverificar a lista e **reabrir só o que não foi entregue**. Não recriar os 47.
- **Erros visuais**: sem navegador — **API + leitura de código**.
- **Issues**: criadas de verdade via `gh`, uma por uma (pendente de `gh auth login`).

---

## 2. Regras da casa que valem para todo agente

Estão no `CLAUDE.md` da raiz. As que mais pegam nesta rodada:

| Regra | Consequência prática |
|---|---|
| **`main` é só para puxar** | O trabalho está na branch `claude/rodada-8-auditoria`. Não faça checkout de outra. |
| **O monorepo `C:\Users\raafa\urbiverso` é SÓ LEITURA** | Proibido editar, commitar, abrir issue ou PR nele. Ler é livre e é o uso legítimo. |
| **"A issue fechou" não é evidência de entrega. O diff é.** | Toda afirmação de "está implementado" precisa de `arquivo:linha`. |
| **`Closes #NNN` só fecha em inglês**, no corpo do PR ou na mensagem do commit | `Fecha #244`, `(#244)` e `Closes #273-276` falham **calados**. Repita a keyword por issue. |
| **Só primitivos `urbi-*` que existem, e só as props que declaram** | Atributo inexistente **não dá erro, só não faz nada**. |
| **Tokens CSS do design system, nunca cor literal** | Exceção real: o CSS de impressão em `frontend/exportar.ts`, que roda fora do escopo das variáveis do shell. |
| **Valor monetário de fórmula tem 2 casas** | % e R$/m² carregam precisão plena internamente e arredondam só para exibir. |
| **`versao` do `manifesto.json` só bumpa com migração nova** | Mudança só de frontend/backend **mantém** a versão. |

Validação:

    bash scripts/validar-frontend.sh    # sempre
    bash scripts/validar-backend.sh     # se tocou backend, schema.json ou migração

> Nesta máquina o `node_modules` **existe**, mas o `@urbiverso/sdk` é um **stub**
> (só `express.d.ts`/`express.js`, sem `dist/` e sem `docs/`). O `validar-backend.sh` pode
> abortar na etapa 1/5, no portão do SDK. **"Não deu para rodar" nunca é "passou"** —
> declare no relatório em vez de deixar implícito.

---

## 3. Os três arquivos, e como lê-los

| Arquivo | Conteúdo |
|---|---|
| `C:\Users\raafa\Downloads\lista bugs 20260807.xlsx` | 47 itens (numerados 1–41 e 43–48; **o 42 não existe**). Aba `bugs` + abas `#38`, `#39`, `#43`, `#45` com prints. É **a mesma lista da Rodada 7** (issues #309–#355). Colunas: `Item #`, `Tipo`, `Nível`, `Seção`, `Aba`, `Título`, `Issue` (a descrição longa). |
| `C:\Users\raafa\Downloads\fluxo_investidor_FORMULAS.xlsx` | Duas abas: `divida` e `equity`. Já transcrito em `docs/viabilidade/fluxo-investidor-formulas.md`, que é **spec vigente** de `divida` e `equity`. |
| `C:\Users\raafa\Downloads\20260730_EVI_Urbita_corrigido.xlsx` | 9 abas: `Projetos Inc`, `Areas e Precos`, `Etapas Incorp`, `Perfil Vendas`, `Premissas e Resultados`, `Incorp Individual`, `Simulação Geral`, `Resultados GERAL`, `Aux Graf URB`. |

### Como ler `.xlsx` neste ambiente

**Não há `openpyxl` nem `pandas`.** Um `.xlsx` é um zip de XML, e `unzip` existe. Receita:

    cd "/c/Users/raafa/Downloads"
    unzip -l "arquivo.xlsx"                          # ver a estrutura
    unzip -p "arquivo.xlsx" xl/workbook.xml          # nomes das abas, na ordem dos sheetN.xml
    unzip -p "arquivo.xlsx" xl/sharedStrings.xml     # tabela de strings
    unzip -p "arquivo.xlsx" xl/worksheets/sheet1.xml # as células

Parser mínimo em `node -e` (o `sheetN` corresponde à ordem em `workbook.xml`):

    const {execFileSync}=require('child_process');
    const f='arquivo.xlsx';
    const ss=execFileSync('unzip',['-p',f,'xl/sharedStrings.xml'],{maxBuffer:1e8}).toString();
    const strs=[...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)]
      .map(m=>[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
    const sh=execFileSync('unzip',['-p',f,'xl/worksheets/sheet1.xml'],{maxBuffer:1e8}).toString();
    for (const r of sh.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      for (const c of r[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
        const ehStr   = /t="s"/.test(c[3]);
        const formula = (c[4].match(/<f[^>]*>([\s\S]*?)<\/f>/)||[])[1];  // A FÓRMULA
        const valor   = (c[4].match(/<v>([\s\S]*?)<\/v>/)||[])[1];       // o valor calculado
        // ehStr ? strs[+valor] : valor
      }
    }

> ⚠️ **A fórmula está em `<f>`, o valor em `<v>`.** Quem quer entender *a regra* lê `<f>`;
> quem quer o número lê `<v>`. Extrair só `<v>` perde exatamente o que interessa.
> Entidades XML precisam ser decodificadas: `&lt; &gt; &amp; &#10;`.

---

## 4. Estado apurado do repositório — não redescobrir

Base: `main` em `475dd24`. App instalada em Pinguim: `viabilidade@0.1.28`, **a mesma versão
do `manifesto.json`** — a instância está em dia com a `main`.

### 4.1 Os 47 itens: 44 entregues, 2 parciais, 1 sem diff

O mapa item→issue está em `PROGRESSO.md:370-392` e `:404-430`. O que **não** se sustenta:

| Item | Situação | Evidência |
|---|---|---|
| **22** — data do projeto só mês/ano | **PARCIAL** | `frontend/tela-fluxo-cronograma.ts:155-167` persiste `mmm/AAAA` via `isoParaMesAno`/`mesAnoParaISO`, mas o seletor continua `urbi-input-data` **com dia**. O comentário `:161-165` declara que o primitivo não tem modo mês/ano. Fecha de verdade só com prop nova no shell — que é do monorepo, e portanto **texto pronto para o autor levar**, nunca commit nosso. |
| **31** — "Definições" sair da tela de Receitas | **PARCIAL** | Os controles saíram (RET virou global, `frontend/tela-financeiro.ts:174,188-193`, migração `027_ret_global.js`), mas o bloco `<h4>Definições</h4>` **continua** em `frontend/tela-fluxo-receitas.ts:728-737`, agora com dois `<p class="sec">` estáticos apontando para Custos. O pedido literal não foi cumprido. |
| **20** — Início de Obra travado | **sem diff próprio** | A regra existe desde a #224 (`backend/rotas/avancado.ts:82-85`: `obra.inicio_mes = fim do planejamento`, `travado_inicio = true`) + UI `frontend/tela-fluxo-cronograma.ts:242,265,269`. A #329 fechou **sem commit**, como "já correto na main" (`PROGRESSO.md:421-425`). |

Achados colaterais fora da lista, todos confirmados:

- `frontend/tela-fluxo-ver.ts:295` ainda diz *"Este estudo não tem camadas de **Capital Stack**"* — conceito apagado pela reescrita do item 48. Também em `:56,63` e `frontend/tela-financeiro.ts:13,22`.
- `frontend/viab-format.ts:25` — `fmtNum` só define `maximumFractionDigits`; `frontend/tela-proforma.ts:453` chama `fmtNum(v, 2)` prometendo 2 casas, e números redondos saem sem elas.

> ✅ **CORREÇÃO (A4, conferida pela sessão principal):** a afirmação de que
> `frontend/exportar.ts:10` ainda define `const R$ = v.toFixed(2)` próprio **é falsa**.
> A linha hoje é `import { fmtR$, fmtNum, fmtPct } from './viab-format.js';` — a duplicação
> de formatação monetária **já acabou**. O que resta da #281 é só o `fmtNum`.
> O `CLAUDE.md:471-477` ainda repete a versão vencida.

### 4.2 O backend não calcula nada — isto define o método

Todas as rotas do app são **CRUD puro** sobre `req.dados`: devolvem **inputs**, nunca
resultados. Nenhum arquivo de `backend/` importa `fluxo-caixa-motor.ts`, `proforma.ts`,
`funding-motor.ts` ou `proforma-avancado.ts`. O `schema.json` **não tem uma coluna derivada
sequer** — sem `vgv`, `resultado`, `tir`, `vpl`, `margem`.

O próprio código declara, em `backend/rotas/avancado.ts` acima do bloco de cenários:
*"o frontend reaplica os deltas ao motor (`aplicarCenario`) para recalcular o fluxo.
**Nenhum indicador derivado é gravado.**"*

**Consequência:** pela API você confere **inputs, integridade referencial e coerência de
premissas** — mas **não** VGV, resultado, margem, VPL, TIR, carteira ou serviço da dívida.
Conferir número exige **rodar o motor localmente**. Os motores são funções puras sem DOM e o
repo já roda TS headless (`node --import tsx/esm`; `tsx` está em devDependencies).

Única amarra: `frontend/proforma-avancado.ts` importa `fluxo-tabela.ts`, que importa `lit` —
funciona headless, mas é o único com essa dependência.

### 4.3 Topologia do motor financeiro

| Camada | Arquivo | Papel |
|---|---|---|
| Calendário / absorção / VGV / base financiável | `frontend/fluxo-shared.ts` (693 l) | funções puras compartilhadas |
| Motor de fluxo | `frontend/fluxo-caixa-motor.ts` (2113 l) | `calcularFluxo` + safras + indicadores |
| Editor do plano de pagamento | `frontend/fluxo-pagamento-editor.ts` (93 l) | normaliza/valida/persiste `fluxo_pagamento` |
| Motor de funding | `frontend/funding-motor.ts` (862 l) | 3 operações independentes, sem waterfall |
| Invariantes | `frontend/fluxo-invariantes.ts` (574 l) | reconciliação; não altera cálculo |
| Proforma econômica do Avançado | `frontend/proforma-avancado.ts` (126 l) | releitura de `FluxoCalc` |

### 4.4 ⚠️ Três comentários mortos que MENTEM — leia antes de decidir qualquer coisa

`CLAUDE.md:98-101` afirma que a cadeia EVI de recebíveis por safras "não está ligada a
`calcularFluxo`", citando `frontend/fluxo-caixa-motor.ts:505-511`. **Isso é falso desde a
#283.** A integração aconteceu, em modo **opt-in por linha de receita**:

    // frontend/fluxo-caixa-motor.ts:1340-1341 — dentro de recebimentoBrutoMensal
    const canonico = recebiveisComponentesLinha(linha, cronograma, prazoTotal);
    if (canonico) return canonico.recebimentoBrutoMensal;

Prova adicional: `recebiveisComponentesLinha` em `:1165-1183` (ativa quando
`Array.isArray(linha.fluxo_pagamento.componentes)`); agregação de juros/carteira/repasse em
`calcularFluxo:2025-2053`; teste `frontend/fluxo-caixa-motor.test.ts:1762-1787`
(*"#283 linha opt-in alimenta juros, principal e carteira no FluxoCalc"*) e o contrário em
`:1828-1854`.

**Os quatro lugares que ainda mentem** e precisam ser corrigidos:

1. `frontend/fluxo-caixa-motor.ts:510-514`
2. `frontend/fluxo-caixa-motor.ts:644-649`
3. `CLAUDE.md:98-101`
4. `docs/viabilidade/formulas.md:52`

O próprio arquivo já se contradiz em `:228-231`, `:626-627` e `:1340-1341`.

> ✅ **REFORÇO (A4, conferido):** a prova é **mais forte** do que "opt-in por linha".
> `frontend/fluxo-pagamento-editor.ts:82-93` mostra que `fluxoPagamentoParaSalvar` grava
> `componentes: componentesDoLegado(form, cronograma)` em **toda** escrita, sempre. Logo o
> caminho canônico está ligado para **todo Grupo já editado** desde a #248 — não é um modo
> opcional que ninguém acionou. Quem propuser "integrar o motor de safras ao `calcularFluxo`"
> como trabalho novo está propondo algo já feito.
>
> ⚠️ **Efeito colateral que ninguém decidiu:** dois Grupos com o **mesmo plano de pagamento**
> calculam **diferente** se um deles nunca passou pelo modal — um cai no caminho canônico,
> o outro no legado, e **nada em tela indica isso**.

### 4.5 As 17 lacunas de modelo — o backlog real desta rodada

1. **Juros de tabela nunca chegam a existir na prática.** A matemática está integrada, mas
   `fluxoPagamentoParaSalvar` (`frontend/fluxo-pagamento-editor.ts:90`) grava sempre
   `componentesDoLegado`, que fixa `taxaMensal: 0` e `sinalPct: 0`
   (`frontend/fluxo-caixa-motor.ts:589,601,608,617`). Não há campo de taxa nem de sinal no
   modal (`frontend/tela-fluxo-receitas.ts:741-816`). **`jurosClientes` é sempre 0 em estudo real.**
2. **Capital de giro / linha rotativa / empréstimo-ponte: AUSENTE.** Tipos aceitos hoje:
   `['financiamento_producao','divida','equity']` (`backend/rotas/funding.ts:43`);
   `capital_giro` é explicitamente rejeitado (`backend/rotas/funding.test.ts:26`). O padrão
   funcional exige o conceito (`docs/viabilidade/padrao-incorporacao.md:1820-1832`, §17.4).
3. **Correção monetária (INCC/IGPM/IPCA/CDI/TR)**: colunas persistidas (`schema.json:151-152`,
   `backend/rotas/estudos.ts:34`) e **zero leitura** no motor.
   > ✅ **CORREÇÃO (A4, conferida):** elas **não são renderizadas**. `frontend/tela-financeiro.ts:19-20`
   > é um **bloco de comentário** listando os 9 controles que a #279 **removeu** da tela —
   > entre eles `indice_correcao` e `indice_correcao_taxa_aa`. Ou seja: é **coluna morta sem
   > UI**, não UI inerte. Isso muda a issue: a pergunta não é "por que o campo não faz nada",
   > é "a coluna deve ganhar motor ou ser removida do schema".
4. **Curva de vendas só uniforme** dentro de cada janela (`frontend/fluxo-shared.ts:384-392`).
   Sem curva S de absorção, sazonalidade, VSO alvo ou velocidade em unidades/mês.
   `modo:'personalizado'` existe no motor (`:373-379`) mas a UI nunca o grava
   (`frontend/tela-fluxo-receitas.ts:533` fixa `modo:'distribuido'`).
5. **Pós-chaves travado em 12 meses** — `APOS_CHAVES_MESES` (`frontend/fluxo-shared.ts:237`),
   não editável. `pos_obra.duracao_meses` é **ignorado**.
   > 🔴 **DISPUTA ABERTA — não proponha desfazer isto sem o autor.** A4 achou **três fontes
   > discordando**: `docs/viabilidade/padrao-incorporacao.md:636-643` diz que o Pós-chaves é
   > "livre e editável" e **pede issue para travar em 12**; o §8.5 do *mesmo* documento diz
   > que 12 fixos **é** o modelo aprovado (foi o que a #226 implementou); e este dossiê o
   > listava como lacuna. **Tratar como pergunta ao autor (P1), não como defeito.**
   > Propor "devolver a edição do Pós-chaves" seria desfazer a #226 sem mandato.
6. **`correcao_estoque`** é editável (`frontend/tela-fluxo-receitas.ts:599-602`) e persistido
   (`backend/rotas/avancado.ts:283`), e **nenhum código o lê**.
7. **Cenários pobres**: `aplicarCenario` (`frontend/fluxo-caixa-motor.ts:1712-1730`) varia
   **só** `preco_m2` das tipologias e `orcamento_valor` do grupo `obra`.
8. **Carteira máxima e juros de clientes sem superfície de tela** — calculados
   (`:2050-2053`), exportados (`frontend/exportar.ts:351-352,442-443`), ausentes dos KPIs.
9. **Equity sem preferred return / hurdle / waterfall** (`frontend/funding-motor.ts:425-455`).
10. **Impostos além do RET inertes** — `regime_tributario`, PIS/COFINS/IRPJ/CSLL persistidos e não lidos.
11. **Vendas são % de VGV, não unidades** — sem estoque físico consumido pela absorção.
12. **Repasse não modelado como produto bancário** — travado em `fimObra + 1`
    (`frontend/fluxo-caixa-motor.ts:325`), sem prazo de análise, taxa ou parcialidade.
13. **Sem TIR/payback/exposição alavancados** — só o VPL da tabela alavanca
    (`frontend/fluxo-tabela.ts:525`).
14. **Financiamento à produção limitado a 1 por estudo** (`backend/rotas/funding.ts:150-158`),
    sem tarifas/taxa de administração/estruturação.
15. **Duas definições de "entrega" convivendo** — app usa o último mês de obra, a planilha usa
    o mês seguinte (assumido em `frontend/fluxo-shared.ts:601-604`).
16. **Inadimplência, distratos, securitização e antecipação**: ausentes por decisão explícita
    do autor (`docs/issues-evi-propostas-2026-07-31.md:1057`).
17. **Comentários mortos** — §4.4 acima.

---

## 5. Acesso à instância viva (só para A5 e A6)

- **Instância: Pinguim** — `https://homolog.urbiverso.com.br`. Laputa (`urbiverso.com.br`) e
  Gondoa (`dev.urbiverso.com.br`) devolvem `401` para este token.
- **Identidade**: token "Filler" → usuário **Teste F.E. - FIN** (`id 10`, natureza `servico`),
  `permissoes: { viabilidade: "escrita", fluxo_escrituras: "escrita" }`, `alcadas: []`.
- **O token NÃO está em nenhum arquivo deste repositório, e não pode entrar em nenhum.**
  Ele chega inline no prompt dos agentes que precisam dele. Nunca ecoar, logar ou gravar —
  nem o prefixo, nem o comprimento.

> ⚠️ **O token tem `somente_leitura: false`** — ele *pode* escrever, e a flag é imutável.
> A postura somente-leitura é **disciplina, não trava**: emita **exclusivamente `GET`**.
> Nada de "só um POST de teste".

### Estudos legíveis

| id | `id_legivel` | nome | nível | status |
|---|---|---|---|---|
| 6 | `inc_testepu1ideia1avancadovariacao_df_006` | `[teste] PU 1 Ideia 1 (Avançado variação)` | avancado | rascunho |
| 5 | `inc_testepu1ideia1avancadobase_df_005` | `[teste] PU 1 Ideia 1 (Avançado base)` | avancado | rascunho |
| 4 | `inc_testepu4reis_df_004` | `[teste] PU 4 Reis` | preliminar | rascunho |
| 3 | `inc_testepu3zoom_df_003` | `[teste] PU 3 Zoom` | preliminar | rascunho |
| 2 | `inc_testepu1ideia1_df_002` | `[teste] PU 1 Ideia 1` | preliminar | rascunho |
| 1 | `inc_testepu2esquadra_df_001` | `[teste] PU 2 Esquadra` | preliminar | rascunho |

Todos `incorporacao`, todos com `_funcao: editor`.

### Rotas GET disponíveis

Prefixo: `$URBI_BASE/api/viabilidade` (o shell monta `/api/<id-da-app>`, confirmado em
`urbiverso/shell/backend/src/carregador-rotas.ts:282,355`; a cadeia aceita cookie **ou** Bearer).

| Rota | Devolve |
|---|---|
| `/estudos` | lista; cada item com `_funcao`, imagem principal e `produtos[]` |
| `/estudos/:id` | **o registro inteiro de premissas** (~140 colunas) + `membros[]` + `imoveis[]` + `_permissao{}` |
| `/estudos/:id/preliminar/produtos` | catálogo de produtos — **fonte de VGV quando não-vazio** |
| `/config` | `parametros` da app (alíquotas padrão, corretagem, marketing…) |
| `/benchmarks?tipo_empreendimento=` | benchmarks + regras de comparação e faixas do medidor |
| `/estudos/:id/avancado/parametros` | `data_inicio_projeto`, `taxa_desconto_aa`, `tem_pre_lancamento`, `considerar_ret`, `ret_pct` |
| `/estudos/:id/avancado/cronograma` | eventos; os não salvos vêm com **defaults calculados**, sem escrita |
| `/estudos/:id/avancado/tipologias` | catálogo de tipologias |
| `/estudos/:id/avancado/fases?tipo=cronograma` ou `?tipo=receita` | fases com `alocacoes[]` embutidas |
| `/estudos/:id/avancado/receitas` | **linhas de receita montadas**, com `absorcao` e `fluxo_pagamento` |
| `/estudos/:id/avancado/custos` | linhas de custo (grupo, categoria, orçamento, `curva_id`, ancoragem, permuta) |
| `/estudos/:id/avancado/cenarios` | **só os deltas** `{nome, preco_venda_pct, custo_obra_pct, ordem}` |
| `/estudos/:id/avancado/funding` | operações de funding |
| `/avancado/curvas` | curvas de distribuição (lookup `curva_id → valores`) |
| `/estudos/:id/analise-mercado`, `/estudos/:id/apelo-comercial` | snapshots de IA |
| `/api/shell/auth/identidade` | quem sou eu, alçadas, permissões, e se a credencial é read-only |

**Não existe GET de fluxo, proforma, KPI, TIR ou VPL. Nenhum.**

Guarda-corpos: `403` numa rota de estudo = não é membro nem admin da app, **não é bug**;
`422 NIVEL_INVALIDO` = estudo Preliminar, confira só a proforma.

### Receita de conferência

    export URBI_BASE="https://homolog.urbiverso.com.br"
    # URBI_TOKEN vem do prompt do agente; NUNCA escrever em arquivo
    G(){ curl -s -m 30 -H "Authorization: Bearer $URBI_TOKEN" -H "Accept: application/json" \
           "$URBI_BASE/api/viabilidade$1"; }

> ⚠️ **Armadilha desta máquina:** `/tmp` do Git Bash não é visível ao `node` do Windows
> (`node` lê `C:\tmp\...`). Escreva em caminho absoluto no scratchpad da sessão ou passe o
> JSON por **stdin** (`curl ... | node -e "let s='';process.stdin.on('data',c=>s+=c)..."`).

Montagem do `FluxoConfig` — cópia literal de `frontend/tela-fluxo-ver.ts:103-147`:

    const config: FluxoConfig = {
      dataInicio:     params.data_inicio_projeto,              // GET /avancado/parametros
      taxaDescontoAa: Number(params.taxa_desconto_aa ?? 12),
      cronograma:     crono.dados,                             // GET /avancado/cronograma
      linhasReceita:  receitas.dados,                          // GET /avancado/receitas
      linhasCusto:    custos.dados,                            // GET /avancado/custos
      curvas:         curvas.dados,                            // GET /avancado/curvas
      areaTerreno:    Number(estudo.terreno_manual_area) || Number(estudo.area_terreno_nucleo) || 0,
      ret:            { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
    };

`ProformaInput` — de `frontend/tela-proforma.ts:168`:
`{ ...estudo, aliquota_ret_pct: config.parametros.aliquota_ret_pct ?? 4, produtos }`.

---

## 6. Como esta rodada está organizada

Seis agentes, três rodadas. **Agentes não se falam diretamente** — a sessão principal é o
barramento: cada um entrega seu documento, a principal compila o digest cruzado e reabre cada
agente com o que os outros acharam que lhe interessa.

| id | Papel | Entrega |
|---|---|---|
| **A1** | Curador de issues | `01-verificacao-47-itens.md`, depois `07-consolidado-issues.md` |
| **A2** | Regras pela lente **EVI Urbitá** | `02-regras-evi.md` |
| **A3** | Regras pela lente **funding/investidor** | `03-regras-funding.md` |
| **A4** | Regras pela lente **código × documentos** (adversarial) | `04-regras-reconciliacao.md` |
| **A5** | Conferência de contas na instância | `05-conferencia-numerica.md` |
| **A6** | Auditoria de UI e coerência visual | `06-auditoria-ui.md` |

**A2, A3 e A4 atacam a mesma pergunta por três caminhos.** A sobreposição é de propósito:
onde convergirem, a regra é sólida; onde divergirem, vira **pergunta ao autor**, nunca decisão
silenciosa.

### Formato de toda regra proposta

    ### R-<agente><n> — <título curto>
    **Veredito:** JÁ IMPLEMENTADA | DIVERGENTE | AUSENTE
    **Fonte:** <planilha!aba!célula, ou doc:linha>
    **No código hoje:** <arquivo:linha> — o que faz
    **Regra proposta:** <texto normativo, imperativo, testável>
    **Como verificar:** <o teste ou a conta que prova>
    **Custo/risco:** <o que muda de comportamento em estudo existente>

### O que NÃO fazer

- Não alterar comportamento de cálculo nesta rodada. Ela **especifica**; implementar é a
  rodada seguinte, issue por issue.
- Não escrever nada em `C:\Users\raafa\urbiverso`.
- Não gravar o token em arquivo nenhum.
- Não afirmar "está implementado" sem `arquivo:linha`.
- Não tratar número da planilha como valor a fixar no código: **os valores da EVI são
  exemplo, não hardcode** — viram campo editável por estudo.
