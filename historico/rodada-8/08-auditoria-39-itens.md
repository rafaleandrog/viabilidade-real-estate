# Rodada 8 · B1 — Auditoria dos 36 itens restantes da `lista bugs 20260807.xlsx`

> Agente **B1**. Branch `claude/rodada-8-auditoria`, base `main` @ `475dd24`.
> Escrito em 2026-08-22. Fonte do pedido: **corpo da coluna `Issue`** (coluna G) da aba `bugs`,
> lido pelo parser XML do §3 do dossiê, com entidades decodificadas. **Nenhum veredito aqui foi
> formado a partir do `Título`** — foi assim que a sessão principal errou o item 6.
>
> **Escopo:** os 36 itens que o A1 não reauditou. Ele cobriu 11 (6, 11, 13, 17, 20, 22, 24, 27, 31,
> 39, 46); o item 42 não existe na planilha. 11 + 36 = 47.
>
> **Ambiente:** o `@urbiverso/sdk` desta máquina é stub, então `validar-backend.sh` aborta no portão
> do SDK. Nada aqui depende dele — tudo é leitura de código na árvore de trabalho.
>
> ⚠️ **A árvore de trabalho NÃO está limpa.** No momento desta auditoria havia quatro arquivos
> modificados e não commitados (`frontend/proforma-avancado.ts`, `frontend/tela-fluxo-ver.ts`,
> `frontend/tela-dashboard.ts`, `frontend/fluxo-apresentacao.test.ts`, mais
> `frontend/fluxo-pagamento-editor.ts`), consertos que outros agentes desta rodada escreveram
> enquanto eu auditava. Onde isso muda o veredito, está dito **explicitamente** e a distinção
> "está na `main`" × "está só na árvore de trabalho" é feita item a item. Nada foi commitado por mim.

### Errata — 2026-08-22, depois da revisão da sessão principal

| # | O que mudou | Efeito no placar |
|---|---|---|
| **E1** | **§3.4-b retratado.** Eu tinha acusado `funding-motor.ts:421-423` de ser um "comentário que mente" sobre o alerta de caixa negativo. **Era falso positivo meu**: `validarFunding` implementa a D14 em `frontend/fluxo-invariantes.ts:377-387`, 15 linhas depois de onde parei de ler; a **#414 fechou** (commit `ba06add`, PR #417). Retratação com a causa-raiz na §3.4-b, não apagada | **nenhum** — era colateral, não veredito |
| **E2** | **§3.4-a agora declara divergência com o A3** sobre o `max(0, …)` do equity, com a evidência dos dois lados. Mantenho "fiel à spec"; ele mantém "defeito". Reflete-se na **P4** | **nenhum** |
| **E3** | **§3.1 (item 15) ganhou o mapa do precedente** — os 5 pontos exatos que a #314 tocou para resolver o item 16, que é o mesmo problema na tela irmã | **nenhum** — o item 15 já era REPROVADO |
| **E4** | Registrada a **verificação independente** dos consertos do B2 (§3.4-c/d) e respondida a **P6** | **nenhum** |

Nenhum dos 36 vereditos da §2 mudou. As quatro correções são de achados colaterais, de atribuição e
de detalhamento.

---

## 1. Placar

| Veredito | Qtd | Itens |
|---|---:|---|
| ✅ **CONFIRMADO** | **30** | 1, 3, 4, 5, 7, 8, 9, 10, 12, 14, 16, 18, 19, 21, 23, 25, 26, 28, 29, 30, 32, 33, 34, 35, 36, 37, 40, 44, 47, 48 |
| 🟡 **PARCIAL** | **2** | **2** (ordem das abas), **41** (a tabela ainda ganha bloco separado quando há funding) |
| 🔴 **REPROVADO** | **1** | **15** (o diff entregue conserta outro bug, não o pedido) |
| ⚪ **INDECIDÍVEL SEM TELA** | **3** | **45** (integral), **38** e **43** (uma cláusula cada) |

**Taxa de falha: 3 em 36 = 8,3%** — contra os 37,5% da amostra enviesada do A1, o que é coerente
com a hipótese dele: os itens de julgamento visual concentram o risco.

Somando as duas auditorias, a lista de 47 fica assim: **38 confirmados**, **5 parciais** (2, 11, 22,
24, 41), **2 reprovados/reabertos** (15, 31), **1 correto sem diff próprio** (20), **1 indecidível**
(45) — e 2 itens (38, 43) confirmados com uma cláusula pendente de print.

> **Nenhum dos 30 confirmados foi dado por bom pelo título.** Os quatro que teriam mudado de
> veredito se lidos só pelo título estão marcados na tabela com 📖.

---

## 2. Tabela por item

Ordem: os de número/regra de cálculo primeiro, depois estrutura, depois rótulo/layout — a ordem de
consequência pedida no encargo.

### 2.1 Número e regra de cálculo

| Item | Cláusulas | Veredito | Evidência `arquivo:linha` | Cláusula que falhou |
|---:|---|---|---|---|
| **9** | ① a linha "VGV sem permuta física" não pode ser igual à "Receita bruta (VGV)"; ② tem de refletir a permuta física | ✅ CONFIRMADO | `frontend/tela-proforma.ts:184` (`vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial`), `:259`; `frontend/proforma.ts:220-241` | — |
| **10** | ① todo campo do proforma igual a zero some, receita **ou** custo; ② reaparece ao mudar premissas | ✅ CONFIRMADO | `ocultarSeZero` em todas as 18 linhas de detalhe, `frontend/tela-proforma.ts:253,259-261,266-270,274-284,287-289`; filtro em `:336` (`Math.abs(r.v) < 0.005`) | — (ressalva: os **consolidados** — `= Deduções sobre VGV`, `= Custo direto total`, `= Custo indireto total` — não têm `ocultarSeZero` e aparecem com 0,00. Ver P2) |
| **12** | ① a variação da sensibilidade não pode depender da unidade selecionada em Premissas; ② diagnosticar a causa; ③ corrigir para a análise funcionar em qualquer unidade | ✅ CONFIRMADO | `frontend/proforma.ts:73-79,171-174` (`sensibilidade` virou parâmetro de `calcularProforma`), `:211,216,253,257,270,274` (o fator incide sobre o valor **canônico já resolvido**); testes por variável × modo em `frontend/proforma.test.ts:371-470` | — |
| **29** | ① Pré-lançamento entra/sai da Absorção conforme o Cronograma; ② a soma das 4 (ou 3) fases é 100% | ✅ CONFIRMADO | `frontend/tela-fluxo-receitas.ts:522,547,556,561` (linha condicional a `_temPreLancamento()`); `frontend/fluxo-shared.ts:324-326` (Pós-chaves derivado = 100 − Σ) e `:337-345` (`erroFormularioAbsorcao` bloqueia Σ > 100) | — |
| **30** | ① renomear "Após-chaves" → "Pós-chaves"; ② duração travada em 12 meses; ③ não confundir com a fase "Pós-obras" do Cronograma | ✅ CONFIRMADO | `frontend/tela-fluxo-receitas.ts:584` (rótulo), `:579-583` (comentário desambiguando); `frontend/fluxo-shared.ts:237` (`APOS_CHAVES_MESES = 12`), `:281`, `:366` | — |
| **32** | ① com "Ao longo da obra" marcado, "Nº Parcelas" fica **invisível**; ② a regra do backend continua valendo | ✅ CONFIRMADO 📖 | `frontend/tela-fluxo-receitas.ts:790-795` (`${!p.ao_longo_obra ? html\`<viab-num label="Nº parcelas"…\` : nothing}`); regra derivada intacta em `frontend/fluxo-caixa-motor.ts:598-603` (`tipo: 'ate_marco'`, `marcoMes: fimObra`) | — |
| **34** | ① retirar o campo "Após entrega"; ② travar o repasse no mês imediatamente seguinte ao fim das obras | ✅ CONFIRMADO | `frontend/fluxo-caixa-motor.ts:322-325` (`REPASSE_MESES_APOS_ENTREGA = 1`), `:615-618`; UI sem o campo — `frontend/tela-fluxo-receitas.ts:807-818` mostra só o % derivado; `frontend/fluxo-pagamento-editor.ts:14-18` documenta que o valor legado persistido deixou de ser lido | — |
| **37** | ① as opções vêm do Cronograma; ② fases adicionais aparecem; ③ falta a fase **Lançamento**; ④ vale para **todas** as abas de Custos | ✅ CONFIRMADO | `frontend/tela-fluxo-custos.ts:162` (`{ valor: 'lancamento', rotulo: 'Lançamento' } // BUG7-31`), `:840-842` (fases dinâmicas), `:657` + `:467` (`_colunas(g)` é uma só, usada pelos 5 grupos) | — |
| **38** | ① layout lado a lado, não empilhado; ② **não aumentar a largura atual da coluna** | ✅ ① / ⚪ ② | `frontend/tela-fluxo-custos.ts:330-332` (`display:flex` + larguras próprias 130px/90px), `:704-716` | ② **INDECIDÍVEL SEM TELA** — 130 + 6 + 90 = 226px contra `.orc` (coluna, `viab-num` 110px + badges que quebram linha). O comentário `:327-329` **afirma** que não alarga; nada no repo mede. Precisa do print da aba **#38** + medição no navegador |
| **40** | ① com categoria Preço, Distribuição só pode ter **um** seletor | ✅ CONFIRMADO | `frontend/tela-fluxo-custos.ts:784-806` — um `urbi-select` só, que achata `distribuicao_modo` + `curva_id` no valor da opção | — |
| **41** | ① só Receita bruta (VGV) + grupos de Receitas + os 5 tipos de Custo + o Fluxo — "**Somente isso**"; ② apagar a continuação "Programa Financeiro (Capital Sta…"; ③ funding refletido **dentro** das categorias já definidas; ④ mesma correção em Cenários | 🟡 **PARCIAL** | ② ✓ `frontend/fluxo-tabela.ts:476-479`; ③ ✓ `:562-569` (entradas) e `:574-590` (saídas em Custos Financeiros); ④ ✓ `frontend/tela-cenarios.ts:343` usa a mesma `tabelaFluxo` | **①** — quando há funding, a tabela **volta a ganhar um bloco separado**: `frontend/fluxo-tabela.ts:593-606` empilha `Financiamento à produção — <nome> (detalhamento)` com sub-linhas próprias, e `:610` acrescenta `Fluxo de Caixa Livre (antes do funding)`. Ver §3.2 |
| **45** | ① mostrar o cálculo automático de área permutada quando Permuta física é selecionada, **no formato da aba #45** | ⚪ **INDECIDÍVEL SEM TELA** | existe: `frontend/tela-fluxo-custos.ts:447-451` (`permutaFisicaPorTipologia`) e `:477-479` (par rótulo/valor "Área permutada · X m²" no rodapé do grupo Terreno) | O item **inteiro** delega o critério ao print da aba **#45**. Confirmo só que *existe* um total automático; não posso confirmar que é o que a imagem pede |
| **48** | ① apagar o resultado existente e recomeçar; ② dívida **e** equity; ③ 3 opções: Financiamento à produção, Dívida, Equity; ④ Fin. à produção só uma vez por estudo; ⑤ os outros, quantos quiser, nomeáveis; ⑥ dados/fórmulas/entrada no fluxo conforme `fluxo_investidor_FORMULAS` | ✅ CONFIRMADO | ①✓ Capital Stack apagado (`docs/viabilidade/funding-capital-stack.md` virou ADR); ③✓ `backend/rotas/funding.ts:43`; ④✓ `backend/rotas/funding.ts:150-158`; ⑥✓ `frontend/funding-motor.ts:237` (`simularDivida`) e `:425` (`simularEquity`) contra `docs/viabilidade/fluxo-investidor-formulas.md:110-148`; A3 reproduziu a dívida mês a mês (Δ R$ 0,06 de arredondamento) | — (duas ressalvas de spec, **não** de cláusula: §3.4) |

### 2.2 Estrutura

| Item | Cláusulas | Veredito | Evidência `arquivo:linha` | Cláusula que falhou |
|---:|---|---|---|---|
| **1** | ① o resumo com valores e cálculos passa a aparecer numa aba nova chamada "Produtos" | ✅ CONFIRMADO | `frontend/tela-premissas.ts:593` (`${this._renderResumo(lot)}` dentro de `secao === 'produtos'`); aba em `frontend/tela-preliminar.ts:51` | — |
| **2** | ① a aba "Produtos e Custos" vira duas: Custos e Produtos; ② Custos à direita de Terreno & Áreas; ③ **Produtos é a última da lista**; ④ Custos/Impostos/Deduções vão para Custos, o resto para Produtos | 🟡 **PARCIAL** | ①②④ ✓ `frontend/tela-preliminar.ts:49-52`; `frontend/tela-premissas.ts:536-580` (Custos/Impostos/Deduções) e `:582-594` (Produtos) | **③** — a ordem hoje é Terreno & Áreas · Custos · **Produtos** · **Permutas**. O commit `74cb2c7` leu "última da lista" como "última das duas novas, antes de Permutas". Literalmente, Produtos deveria ficar **depois** de Permutas. Cláusula ambígua — ver P1 |
| **3** | ① adicionar e remover produtos; ② colunas Nome (texto editável), Área média do lote, Preço de venda, Unidades, VGV (= área × preço × unidades); ③ última linha consolidada com VGV total e total de unidades | ✅ CONFIRMADO | `frontend/tela-premissas.ts:749-779` (as 5 colunas + linha `Total`), `:781-800` (`_linhaProduto`), `:742-746` (Adicionar); `frontend/proforma.ts:91-93` (`vgvProduto`), `:96-102` (`totalProdutos`) | — |
| **4** | ① escolher o **tipo de produto cadastrado** para retirar do VGV; ② visão de tabela com seleção da unidade; ③ unidades: **unidade** (nº de lotes), m², % área venda | ✅ CONFIRMADO | `frontend/tela-premissas.ts:115-134` (as 3 opções, `'unidade'` em 1º), `:700-717` (`urbi-select` do produto + quantidade), `:719-730` (canônico em m² = área média × qtd); consumido em `frontend/proforma.ts:211,216` | — |
| **5** | ① um checkbox por custo, para Custo do terreno + Marketing global/estrutura + Gestão e outros custos indiretos + Contingências; ② marcado FALSO → o campo fica **como o Custo do terreno já fica hoje** | ✅ CONFIRMADO | `frontend/tela-premissas.ts:51-63` (os 4 pares), `:541-548` (os 4 checkboxes), `:553` + `:642,654` (`?atenuado`); `frontend/viab-num.ts:32,97-99`; efeito no motor em `frontend/proforma.ts:261,287,293,295` | — (nota: o campo fica **atenuado**, não removido do DOM, e segue editável — mas é exatamente o comportamento do Custo do terreno, que é a referência que o próprio pedido cita) |
| **43** | ① Fluxo de Caixa = tabela principal + urbi-kpis, 1ª aba; ② Proforma com os itens da linha **no formato da imagem da aba #43**; ③ 3ª aba com os principais indicadores + a diferença entre Fluxo de Caixa Livre e Fluxo de Caixa real; ④ levar os gráficos existentes para a 3ª aba | ✅ ①③④ / ⚪ ② | ①✓ `frontend/tela-avancado.ts:104-108` + `frontend/tela-fluxo-ver.ts:54,211-214`; ③✓ `frontend/tela-fluxo-ver.ts:264-295` (tabela FCL × FC real); ④✓ `:297-312` | ② **INDECIDÍVEL SEM TELA** — a segmentação existe (`frontend/proforma-avancado.ts:110-126`), mas a fidelidade "mesmo formato da imagem" só o print da aba **#43** decide. Ver também §3.3 (o número dessa aba estava errado até 2026-08-22) |
| **44** | ① a seção "Fluxo de Caixa" passa a se chamar "Resultados"; ② "Fluxo de Caixa" vira aba dentro dela | ✅ CONFIRMADO | `frontend/tela-avancado.ts:57` (`{ id: 'fluxo', label: 'Resultados' }`), `:73-75` (slug público `resultados`, `fluxo` como alias), `:105` (aba `Fluxo de Caixa`) | — |
| **16** | ① achar onde as curvas foram parar; ② trazer para a tela geral, numa **aba nova ao lado de Estudos, Terrenos e Benchmark** | ✅ CONFIRMADO | `frontend/tela-dashboard.ts:144-149` (4ª aba `Curvas`), `:330,341-343` (`urbi-hospedeiro`); `manifesto.json:52-56` (item novo em `nav`); `frontend/index.ts:35-37` (deep link) | — |
| **15** | ① "não consigo acessar em lugar nenhum essa página de admin"; ② **torne isso visível para o admin** | 🔴 **REPROVADO** | o diff entregue (`c487cce`) troca `somenteLeitura` de `@property` para getter em `frontend/viabilidade-config-mercado.ts:22-27` e `viabilidade-config-curvas.ts` — conserta **não-admin vendo botão de escrita**, que é o problema **inverso** | **②** — nenhuma superfície nova foi criada. `manifesto.json:70-74` continua expondo a tela **só** em `telas_config`, e `frontend/tela-analise-mercado.ts:260` ainda manda o usuário para *"Admin → Apps → viabilidade → Regiões monitoradas"* — exatamente o caminho que ele disse não achar. Ver §3.1 |

### 2.3 Rótulo, layout e comportamento de tela

| Item | Cláusulas | Veredito | Evidência `arquivo:linha` | Cláusula que falhou |
|---:|---|---|---|---|
| **7** | ① remover o KPI "Preço Médio/Unid"; ② alinhar e espaçar os KPIs restantes para não se sobreporem | ✅ CONFIRMADO | `frontend/tela-proforma.ts:203-212` (o KPI não existe mais); `:47-53` (`repeat(auto-fit, minmax(180px, 220px))` + `.kpis urbi-kpi { min-width: 0 }`) — é o padrão que o A1 identificou na §2.4 como o **correto** | — |
| **8** | ① a Receita bruta (VGV) ganha o mesmo colapso que os grupos de custo; ② com uma sub-linha por tipo de unidade cadastrada | ✅ CONFIRMADO | `frontend/tela-proforma.ts:249` (`toggle: 'receita'`), `:250-255` (sub-linha por produto do catálogo), `:337` (filtro de colapso) | — (ressalva: numa incorporação **sem** catálogo de Produtos o toggle existe sem sub-linhas — o botão fica sem efeito) |
| **14** | ① a seção passa a se chamar "Análise de Mercado" | ✅ CONFIRMADO 📖 | `frontend/tela-preliminar.ts:39,140`. O item é `Nível: Preliminar`; `frontend/tela-avancado.ts:60` continua "Apelo Comercial" **de propósito** (BUG7-13/D2 — o Avançado já tem uma aba "Análise de mercado" que é outra coisa) | — |
| **18** | ① retirar os KPIs de **payback**, **VGV vendável** e **VGV em permuta física** (três, nomeados no corpo) | ✅ CONFIRMADO 📖 | `frontend/tela-resumo.ts:176-184` — sobraram VPL, TIR, Exposição máxima, VGV, Resultado, Margem líquida, ROI; nenhum dos três nomeados está lá; `:24` registra a remoção. **O título diz "Retirar urbi-kpis" (todos); o corpo nomeia 3.** A auditoria de 2026-08-17 tinha razão em classificar a #325 como falso positivo | — |
| **19** | ① checkbox junto ao campo de data de início; ② se não existe, some da lista de fases, do gantt e **de qualquer outro campo**; ③ se existe: Pré-lanç. trava no fim do Planejamento e Lançamento trava no fim do Pré-lanç.; ④ se não existe: Lançamento trava no fim do Planejamento | ✅ CONFIRMADO | ①✓ `frontend/tela-fluxo-cronograma.ts:168-177` (imediatamente após o `urbi-input-data` de `:155-167`); ②✓ `backend/rotas/avancado.ts:390-391` (cronograma), `:271-277` (absorção), `frontend/tela-fluxo-custos.ts:836-839` (combo de Custos); ③✓ `backend/rotas/avancado.ts:49,53`; ④✓ `:89` | — |
| **21** | ① a fase passa a se chamar "Pós-obras"; ② não pode se confundir com a variável Pós-chaves (12 meses fixos) | ✅ CONFIRMADO | `frontend/fluxo-shared.ts:128` (`pos_obra: 'Pós-obras'`), `:124` e `:235` (notas de desambiguação); `frontend/tela-fluxo-custos.ts:164`, `frontend/tela-funding.ts:74` | — |
| **23** | ① diagnosticar por que o Nome apaga/volta ao digitar rápido; ② consertar | ✅ CONFIRMADO | `frontend/tela-empreendimento-tipologias.ts:283-287` (`_editarNome` só grava rascunho local — **nenhum PATCH por tecla**), `:289-296` (`_salvarNome` explícito), `:246-248` (botão ✓ só quando sujo). A corrida servidor↔input que causava o efeito deixou de existir | — (ressalva de UX, fora de cláusula: sair da tela com o rascunho sujo o descarta em silêncio) |
| **25** | ① coluna nova **ao final**, "Área total" = área privativa × unidades, por linha | ✅ CONFIRMADO | `frontend/tela-empreendimento-tipologias.ts:195` (cabeçalho, última coluna de dado), `:242` (`fmtNum(n(t.area_privativa_m2) * n(t.quantidade))`) | — |
| **26** | ① o "Total de área privativa" sai do seu lugar e passa a ficar **embaixo da coluna Área total** | ✅ CONFIRMADO | `frontend/tela-empreendimento-tipologias.ts:202-210` — a célula sob "Área privativa" está **vazia** (`:204`) e o total aparece sob "Área total" (`:208`) | — |
| **28** | ① o nome padrão de grupo novo em Receitas passa a ser "1º Grupo", "2º Grupo"… | ✅ CONFIRMADO | `backend/rotas/avancado.ts:912-921,948,952` (`tipo === 'receita' ? \`${n}º Grupo\` : \`Fase ${n}\``) — a numeração busca a **primeira lacuna**, não o `count` | — |
| **33** | ① retirar a badge "Mensal" (sempre será mensal) | ✅ CONFIRMADO | `frontend/tela-fluxo-receitas.ts:773-782` — a badge saiu; a periodicidade continua persistida porque o motor a lê (`frontend/fluxo-caixa-motor.ts:318-320`) | — |
| **35** | ① retirar o texto "Total dos componentes: 100%."; ② manter a regra por trás | ✅ CONFIRMADO | `grep -rn "Total dos componentes" frontend/ backend/` → **zero ocorrências**; a regra vive em `frontend/fluxo-pagamento-editor.ts` (`erroFormularioPagamento`, checagem de Σ componentes = 100%) | — |
| **36** | ① nenhuma categoria fica obrigatória/indelével; ② todas as linhas ficam iguais; ③ a lista de single-select traz o que existe **em cada aba** (Terreno, Obras, Diretos, Indiretos, Financeiro) | ✅ CONFIRMADO | `frontend/tela-fluxo-custos.ts:658-673` (`urbi-select` sempre editável, `#335 (reverte #179)`), `:925-932` (botão de remover em **toda** linha, sem guarda por `obrigatoria`), `:659` (`CATEGORIAS[g.id]`); nenhuma guarda de `obrigatoria` na rota de DELETE (`backend/rotas/avancado.ts`) | — |
| **47** | ① o gráfico tem de ter **duas linhas**; ② usando primitivo de UI do urbiverso que já faz isso | ✅ CONFIRMADO | `frontend/tela-cenarios.ts:323-332` — `urbi-grafico-linha` com `.series` de **dois** elementos (Cenário real / Cenário simulado), sempre os dois | — (a #264, aberta, é sobre o que exibir com o slider em 0% — não é este item) |

---

## 3. Os que falharam, em detalhe

Formato das issues: o mesmo do bloco 8-A do A1 (§4 de `01-verificacao-47-itens.md`). `Closes #NNN`
só fecha **em inglês**, no corpo do PR ou do commit, nunca no título.

---

### 8-B.1 — item 15 · "Regiões monitoradas" continua sem superfície acessível

> **Pedido literal:** "Não consigo acessar em lugar nenhum essa página de admin. **Torne isso
> visível para o admin**."

O diff que fechou a #313 (`c487cce`) é **legítimo e conserta um bug real** — mas outro. Ele troca
`somenteLeitura` de `@property` para getter derivado de `urbiVerso.contexto()?.nivel`, porque o
shell instancia a tela com `document.createElement` sem passar props. Isso impedia um **não-admin**
de ver botões de escrita que tomavam `403`. A própria mensagem do commit diz: *"O mecanismo
(manifesto.json, elemento registrado, backend) **já estava correto**"*.

Ou seja: o veredito da #313 foi "não há nada a tornar visível". Mas o autor não relatou permissão —
relatou **não achar a tela**. Depois do diff, o único caminho para ela continua sendo
`telas_config.mercado_regioes` (`manifesto.json:70-74`), e a própria app segue mandando o usuário
para lá por escrito, em `frontend/tela-analise-mercado.ts:260`:

```
<strong>Admin → Apps → viabilidade → Regiões monitoradas</strong>
```

#### O item 16 é o precedente, e ele está resolvido neste mesmo repositório

Este é o argumento decisivo, e é o que torna a issue barata de fechar: **o item 16 é o item 15 com
outro nome**, e já foi resolvido.

| | **item 15** | **item 16** |
|---|---|---|
| Queixa do autor | *"Não consigo acessar em lugar nenhum essa página de admin"* | *"Isso aparecia antes na página de admin mas agora não aparece mais e não consigo encontrar"* |
| Tela | `viabilidade-config-mercado` (Regiões monitoradas) | `viabilidade-config-curvas` (Curvas) |
| Exposição antes | só `telas_config` | só `telas_config` |
| Tocada por `c487cce` | ✅ sim | ✅ sim — **o mesmo commit**, a mesma correção de `somenteLeitura` |
| Ganhou 2ª exposição | ❌ **não** | ✅ **sim**, pela #314 (`ff0b63f`) |

As duas telas são irmãs: mesmo padrão de componente, mesmo bloco em `telas_config`, e o **mesmo
commit** `c487cce` fez nelas a mesma troca de `@property` por getter. Depois disso, uma recebeu a
saída e a outra não. Isso não tem cara de decisão — tem cara de esquecimento, e a mensagem do
`ff0b63f` reforça: ela descreve a mudança como *"a 2ª exposição, no mesmo padrão do Benchmark"*, sem
nunca mencionar por que a tela irmã ficaria de fora.

**O que a #314 mexeu, e que é literalmente o gabarito desta issue** (linhas conferidas na `main`
@ `475dd24`):

| Arquivo | Linha | O que é |
|---|---|---|
| `manifesto.json` | `:52-56` | item novo no array `nav` — `{ "titulo": "Curvas", "rota": "/curvas", "icone": "fa-solid fa-wave-square" }` |
| `frontend/index.ts` | `:35-37` | `if (partes[0] === 'curvas') return { tela: 'dashboard', aba: 'curvas' };` — deep link sobrevive a reload |
| `frontend/tela-dashboard.ts` | `:92-94` | `aba` aceita o valor novo no tipo e na prop |
| `frontend/tela-dashboard.ts` | `:148` | item em `_abas` |
| `frontend/tela-dashboard.ts` | `:330`, `:341-343` | rota da aba + `urbi-hospedeiro` hospedando o componente |

> ⚠️ **Os números acima são da `main`.** Na árvore de trabalho, com o diff não commitado do B2 em
> `tela-dashboard.ts`, os mesmos pontos estão em `:88-90` e `:144`. Confira pelo conteúdo, não pelo
> número, se o PR do B2 tiver mergeado antes deste.

Trocar `curvas` → `regioes` e `viabilidade-config-curvas` → `viabilidade-config-mercado` nesses cinco
pontos é, essencialmente, o diff inteiro. **A #314 não removeu `telas_config.curvas`**, e esta issue
também não deve remover `telas_config.mercado_regioes`: a dupla exposição é o padrão já aceito para
Benchmark e Curvas.

**Título**

```
fix(nav): expor "Regiões monitoradas" fora de Admin → Apps, como a #314 fez com Curvas
```

**Corpo**

```markdown
**Contexto** — item 15 da `lista bugs 20260807.xlsx`; issue original #313 da Rodada 7. O diff que a
fechou (`c487cce`) conserta um bug real e diferente do pedido: `somenteLeitura` era `@property` e o
shell instancia a tela por `document.createElement` sem passar props, então um não-admin via botões
de escrita que tomavam 403. Esse conserto fica — não é o que esta issue desfaz.

**Comportamento atual**
- `manifesto.json:70-74` — `mercado_regioes` existe **só** em `telas_config`.
- `frontend/viabilidade-config-mercado.ts:22-27` — `somenteLeitura` derivado do contexto (correto).
- `frontend/tela-analise-mercado.ts:260` — a app instrui o usuário a ir a
  "Admin → Apps → viabilidade → Regiões monitoradas", que é o caminho que ele relatou não achar.

**Por que não atende** — o pedido é *"torne isso visível para o admin"*. Nenhum diff criou
superfície nova. O item **16**, com a queixa idêntica sobre a tela irmã (`viabilidade-config-curvas`,
tocada pelo **mesmo** commit `c487cce`), foi resolvido criando a aba de topo `/curvas`
(`manifesto.json:52-56`, `frontend/tela-dashboard.ts:148`, `frontend/index.ts:35-37`), sem remover a
exposição de Admin. As duas telas receberam tratamentos opostos para o mesmo problema.

**O precedente já resolvido, no mesmo repo** — a #314 (`ff0b63f`) resolveu a queixa **idêntica** do
item 16 sobre a tela **irmã** (`viabilidade-config-curvas`), que o **mesmo commit** `c487cce` tinha
tocado. O diff dela é o gabarito deste, ponto a ponto (linhas da `main` @ `475dd24`):

| Arquivo | Linha | O que fazer aqui |
|---|---|---|
| `manifesto.json` | `:52-56` | copiar o item de `nav` (`titulo`/`rota`/`icone`) para "Regiões monitoradas" |
| `frontend/index.ts` | `:35-37` | caso novo em `parsearSubRota` + o valor no tipo `Rota.aba` |
| `frontend/tela-dashboard.ts` | `:92-94` | aceitar o valor novo no tipo e na prop `aba` |
| `frontend/tela-dashboard.ts` | `:148` | item novo em `_abas` |
| `frontend/tela-dashboard.ts` | `:330`, `:341-343` | rota da aba + `urbi-hospedeiro` com `viabilidade-config-mercado` |

⚠️ Na árvore de trabalho, com o diff não commitado que mexe em `tela-dashboard.ts`, os dois últimos
pontos estão em `:88-90` e `:144`. **Confira pelo conteúdo, não pelo número.**

**Comportamento esperado** — dar a `mercado_regioes` uma segunda exposição, no mesmo padrão da
#314, **sem** tirar `telas_config` (a #314 também não tirou `telas_config.curvas`; a dupla exposição
é o padrão já aceito para Benchmark e Curvas). Duas alternativas, e o autor escolhe:

1. **Aba de topo** `/regioes`, ao lado de Estudos · Terrenos · Benchmark · Curvas — simétrico à
   #314, custo idêntico (item em `nav`, `_abas`, `urbi-hospedeiro`, `parsearSubRota`).
2. **Link contextual** a partir de `frontend/tela-analise-mercado.ts:260`, que hoje descreve o
   caminho em texto e poderia navegar até ele.

A opção 1 é a que fecha o item pela letra ("visível"); a 2 só encurta o caminho.

A escrita continua admin-only nos dois casos — `somenteLeitura` já deriva do contexto e o backend
repete a checagem. Uma aba de topo visível a não-admin em modo leitura é o comportamento que
Benchmark e Curvas já têm.

**Critério de aceite**
1. Existe caminho para "Regiões monitoradas" **fora** de Admin → Apps, alcançável pela navegação da
   própria app.
2. `telas_config.mercado_regioes` continua em `manifesto.json` (não é substituição, é adição).
3. Não-admin não vê botão de escrita (regressão da #313).
4. Escolhida a opção 1, o `git diff` desta issue é **estruturalmente igual** ao de `ff0b63f` — se
   for muito maior que ele, provavelmente está fazendo algo que a #314 não precisou fazer.
5. `bash scripts/validar-frontend.sh` verde. Sem migração → **`versao` não bumpa**.

**Fora de escopo** — a configuração de `mercado_busca_url`/`mercado_busca_chave`, que é pendência do
autor no ambiente autenticado.

Sem-fechamento: #313 executora original do item 15, já fechada; entregou outro conserto (legítimo),
não a cláusula "torne isso visível"
Sem-fechamento: #314 precedente de solução para a tela irmã (Curvas), a copiar aqui
```

---

### 8-B.2 — item 41 · com funding, a tabela de fluxo volta a ganhar bloco separado

> **Pedido literal:** "As linhas devem conter o VGV total (Receita bruta (VGV)), as divisões por
> grupos definidos em Receitas, os 5 tipos de Custos e o Fluxo ao final. **Somente isso.** (…) Essa
> continuação da tabela com o título que começa com "Programa Financeiro (Capital Sta…" deve ser
> apagada e essas relações de fluxo do funding com capital entrando e a dívida saindo deve ser
> refletida **na tabela principal dentro das categorias de receita e custos já definidas**."

Três das quatro cláusulas foram entregues, e bem: a tabela "Programa Financeiro (Capital Stack)"
sumiu, as entradas de funding viram bloco de receita e as saídas entram em **Custos Financeiros**,
com os subtotais somando corretamente (`frontend/fluxo-tabela.ts:562-590`); Cenários usa a mesma
função (`frontend/tela-cenarios.ts:343`).

O que sobrevive é a cláusula "Somente isso" — e ela sobrevive **exatamente na condição que a issue
existia para tratar**: quando há funding. `frontend/fluxo-tabela.ts:593-606` empilha, depois dos
grupos de custo, um bloco por operação de financiamento à produção:

```
Financiamento à produção — <nome> (detalhamento)
```

com linha-título de total/VPL zerados e sub-linhas próprias. O comentário `:594-597` o justifica como
"bloco de AUDITORIA, fora da aritmética da tabela" — o que é verdade e resolve a contagem dupla, mas
não muda o fato: é uma **continuação da tabela específica de funding**, que é o que a frase *"além de
um campo separado para quando há funding na operação. Isso não deve acontecer"* proíbe. O rótulo
mudou de "Programa Financeiro (Capital Stack)" para "Financiamento à produção — … (detalhamento)".

Colateral menor, no mesmo escopo: `:610` acrescenta a linha `Fluxo de Caixa Livre (antes do
funding)` no rodapé quando há funding. É defensável (o autor pediu, no item 43, a diferença entre
FCL e FC real) — mas o lugar onde ele pediu isso foi a **aba Análise Financeira**, onde ela também
existe (`frontend/tela-fluxo-ver.ts:276-292`). Aqui é duplicação.

**Título**

```
fix(fluxo): o detalhamento do financiamento à produção sai da tabela principal
```

**Corpo**

```markdown
**Contexto** — item 41 da `lista bugs 20260807.xlsx`; issue original #349 da Rodada 7, que entregou
3 das 4 cláusulas. A que ficou é a mais literal do pedido: *"Somente isso"*, e *"além de um campo
separado para quando há funding na operação. Isso não deve acontecer."*

**Comportamento atual**
- `frontend/fluxo-tabela.ts:593-606` — para cada operação de financiamento à produção, a tabela
  empilha um grupo `Financiamento à produção — <nome> (detalhamento)` com sub-linhas próprias
  (liberações, juros, amortizações), com total e VPL zerados e colapsado por padrão.
- `frontend/fluxo-tabela.ts:610` — com funding, aparece também a linha de rodapé
  `Fluxo de Caixa Livre (antes do funding)`.
- Os dois só existem quando há funding; sem funding a tabela é exatamente a pedida.

**Por que não atende** — o bloco é uma continuação da tabela que só existe por causa do funding, que
é a forma exata do defeito relatado. Que ele seja "de auditoria" e esteja fora da aritmética não o
tira da tela: a issue é sobre a tabela ter ficado *"gigante e com várias linhas desnecessárias"*, e
esse bloco reintroduz o padrão sob outro rótulo. A informação **não** se perde ao sair: as
liberações, juros e amortizações já estão nas linhas de funding dentro de Custos Financeiros
(`:574-590`) — é o próprio comentário `:594-597` que diz isso, ao explicar por que o bloco tem
total zerado.

**Comportamento esperado**
1. Remover o bloco `Financiamento à produção — … (detalhamento)` da tabela principal (e, por
   consequência, da de Cenários, que é a mesma função). Se o detalhamento for julgado necessário
   para auditoria, seu lugar é a aba **Análise Financeira** ou a Reconciliação — não a tabela que a
   #349 acabou de enxugar.
2. Remover a linha de rodapé `Fluxo de Caixa Livre (antes do funding)` da tabela principal: a
   comparação FCL × FC real é o conteúdo da aba Análise Financeira
   (`frontend/tela-fluxo-ver.ts:276-292`), onde já existe, com as duas pontas e a ponte entre elas.
3. `chavesColapso` (`frontend/fluxo-tabela.ts:618-624`) perde as chaves `fin-prod-*` junto; o
   `chavesColapsoBase` não muda.

**Critério de aceite**
1. `grep -n "detalhamento" frontend/fluxo-tabela.ts` **não retorna nada**.
2. Com um estudo com financiamento à produção, a tabela de Fluxo tem exatamente: Receita Bruta —
   VGV (+ grupos de Receitas) · a ponte de deduções quando houver · Funding — Capital (entradas) ·
   Custo Total (+ os 5 grupos, com as saídas dentro de Financeiro) · Fluxo Mensal · Fluxo Acumulado.
3. Os totais e o VPL do rodapé **não mudam** — o bloco removido já tinha total e VPL zerados, então
   este é um teste de regressão barato e decisivo.
4. `bash scripts/validar-frontend.sh` verde. Sem migração → **`versao` não bumpa**.

**Fora de escopo** — o bloco `Funding — Capital (entradas)` (`:562-569`). Ele é a tradução direta da
cláusula "capital entrando" do pedido e não tem categoria de receita preexistente onde caber; se o
autor quiser que ele também vire sub-linha de outro grupo, isso é decisão dele, não defeito.

Sem-fechamento: #349 executora original do item 41 na Rodada 7, já fechada; esta issue cobre a
cláusula "Somente isso" na condição com funding
```

---

### 8-B.3 — item 2 · "Produtos é a última da lista" (cláusula ambígua)

Não escrevo issue pronta para esta: **é uma frase do autor que resolve**, e escrever uma issue antes
disso seria inventar o requisito. Ver **P1** na §5.

Fato: a ordem hoje é `Terreno & Áreas · Custos · Produtos · Permutas`
(`frontend/tela-preliminar.ts:49-52`). O commit `74cb2c7` declara a interpretação que usou, na
própria mensagem: *"Produtos (última da lista, **antes de Permutas**)"*. Antes da divisão, a ordem era
`Terreno & Áreas · Produtos & Custos · Permutas`, então a posição relativa a Permutas não mudou.
Custa uma linha corrigir, se o autor quiser Produtos em último de verdade.

---

### 3.4 Achados colaterais — não são cláusulas falhas, mas são reais

Nenhum destes reprova o item onde apareceu. Estão aqui para não serem "descobertos" de novo.

**(a) Item 48 — `simularEquity` pode devolver retorno negativo. ⚠️ DIVERGÊNCIA DECLARADA COM O A3.**

`frontend/funding-motor.ts:441,444` calcula `saidas[t] = round2(n(receitaLiquidaMensal[t]) * pct)` e
`round2(resultadoFinal * pct)`, **sem `max(0, …)`**. Com base mensal ou resultado final negativos, o
"retorno" do investidor fica negativo — na leitura do fluxo, o investidor **paga** o projeto. O fato
não está em disputa; o veredito está.

| | Veredito | Fundamento |
|---|---|---|
| **A3** | **defeito** — falta `max(0, …)` | o retorno de um equity não pode ser negativo: é participação em resultado, não obrigação |
| **B1 (eu)** | **fiel à spec** — não é bug de implementação | a fórmula transcrita em `docs/viabilidade/fluxo-investidor-formulas.md:135` é `D — Retorno equity = SE(C24; C * C25; SE(t = C8; C19 * C25; 0))` — **também sem `MAX`**, ao contrário de `F — Saldo` da aba `divida` (`:116`), que **tem** `MAX(0; …)` e foi implementado com ele |

O argumento que me faz manter o veredito é o **contraste interno da própria planilha**: ela usa
`MAX(0; …)` onde quer piso (aba `divida`, coluna F) e não usa onde não quer (aba `equity`, coluna D).
Isso torna a ausência difícil de ler como esquecimento do autor da planilha. Então: pôr `max(0, …)`
no motor **agora** faria o app divergir da spec vigente em silêncio — que é o defeito estrutural que
esta rodada inteira existe para caçar.

**Os dois vereditos são compatíveis na prática, e é isso que importa:** o A3 está certo de que o
comportamento é indesejável; eu estou certo de que a origem é a spec, não o código. A consequência
muda a **forma** do conserto: não é um `fix` pontual no motor, é **mudar a spec e o motor na mesma
issue**, com o autor decidindo. É a **P4**. Registro a divergência em vez de convergir à força — se
o autor decidir "nunca negativo", o `fluxo-investidor-formulas.md` precisa dizer isso **antes** de o
motor mudar, ou a próxima auditoria reabre isto como divergência código × spec.

**(b) ~~Item 48 — um comentário que mente~~ — 🔴 RETRATADO. Era falso positivo meu.**

> **O que eu tinha escrito, e está errado:** que `frontend/funding-motor.ts:421-423` mentia ao
> afirmar que o risco de caixa alavancado negativo *"é sinalizado pela Reconciliação
> (`validarFunding`)"*, porque `validarFunding` só checava saldo de dívida e reconciliação do fluxo.

**O comentário está certo e a D14 está implementada.** `validarFunding` tem uma **terceira**
checagem, logo depois do laço de reconciliação em que parei de ler:

```ts
// frontend/fluxo-invariantes.ts:377-387
// D14: caixa acumulado do projeto DEPOIS do funding. Um só item por estudo —
// o mês em que mergulha basta para investigar, e um estudo com 40 meses
// negativos geraria 40 linhas idênticas na Reconciliação.
const mergulho = nf.fluxoAcumulado.findIndex((v) => Number(v) < -tol);
if (mergulho >= 0) out.push({
  codigo: 'CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING', severidade: 'alerta', mes: mergulho, …
```

A **#414** (D14) **fechou** — commit `ba06add`, PR #417, confirmado pelo A4. Conferi a linha eu mesmo
antes de escrever esta retratação.

**Como o erro aconteceu, porque isso importa mais que o erro:** li `validarFunding` até a linha 375,
onde o laço de reconciliação termina com um `break`, e tratei o `break` como fim da função. A função
segue por mais 15 linhas. Foi **exatamente a mesma falha** que este documento acusa em outros — ler
um trecho e concluir sobre o todo —, cometida num achado cuja tese era "comentários mentem". Num
documento que sustenta que só o código é evidência, uma acusação de comentário mentiroso que não se
sustenta contamina os outros 35 vereditos. Fica registrada em vez de apagada, que é a regra da casa.

**O que sobra deste item: nada.** Não há issue, não há pendência. `funding-motor.ts:421-423` descreve
corretamente o que `validarFunding` faz.

> ℹ️ **Os itens (c) e (d) abaixo são consertos do agente B2**, escritos com autorização explícita do
> autor enquanto eu auditava, e ainda não commitados. **Eu os conferi por conta própria** — li o
> diagnóstico no código da `main` e o conserto na árvore de trabalho, sem partir do relato de
> ninguém. Isso é **verificação independente**, e está registrado aqui de propósito: serve de
> evidência para a revisão do PR que a sessão principal vai abrir (§5, P6). Onde eu discordasse,
> diria — não discordo em nenhum dos dois.

**(c) Itens 32–35 — o defeito de persistência do modal foi consertado *na árvore de trabalho*,
não na `main`.** A5/A6 acharam que abrir o modal de Fluxo de pagamento e clicar "Aplicar" sem mudar
nada reescrevia o plano, porque `formularioPagamento` não lia `fp.componentes` e
`fluxoPagamentoParaSalvar` regenerava tudo do espelho legado com `taxaMensal: 0`. Confirmo o
diagnóstico e confirmo que **outro agente desta rodada já o consertou**, sem commit:
`frontend/fluxo-pagamento-editor.ts:29,49-66` (o form passa a carregar `componentes`) e `:118-146`
(`componentesParaSalvar`, com o caso "mesma estrutura → devolve o persistido verbatim"). Isso **não
altera nenhum veredito** dos itens 32–35 — nenhum deles tinha cláusula de persistência —, mas
precisa **entrar num PR** para valer. Enquanto estiver só na árvore, a `main` continua com o
defeito.

**(d) Item 43 — o número da aba Proforma estava errado até hoje, e o conserto também está só na
árvore de trabalho.** A5 mediu: `frontend/proforma-avancado.ts` recebia `funding` e somava
`linhasSaida` (serviço da dívida **inteiro**, amortização + juros) ao grupo `financeiro`, sem nunca
creditar as entradas — margem −47,87% onde o real era 18,94%, nos dois estudos Avançados de Pinguim.
O conserto (remover o parâmetro `funding` da assinatura, tornando a proforma explicitamente
desalavancada) está em `frontend/proforma-avancado.ts:99-112` **não commitado**. Mesma observação de
(c): sem PR, a `main` segue errada.

**(e) Item 10 — os consolidados de valor zero continuam aparecendo.** Todas as 18 linhas de detalhe
têm `ocultarSeZero`; os 6 headers/consolidados (`= Deduções sobre VGV`, `= Receita líquida`,
`= Custo direto total`, `= Receita operacional`, `= Custo indireto total`, `= Resultado`) não. Num
estudo sem custo indireto, a linha `= Custo indireto total 0,00` aparece com nada embaixo. Esconder
`= Resultado` quando zero seria errado; esconder um grupo vazio, não. É a **P2**.

**(f) Item 8 — toggle sem sub-linhas.** Numa incorporação sem catálogo de Produtos, a linha
`Receita bruta (VGV)` mostra o botão ▾ mas não tem sub-linha nenhuma
(`frontend/tela-proforma.ts:249-255`). Cosmético; registrado para não virar bug reportado.

---

## 4. Itens que dependem dos prints — e o que eu precisaria ver

Não consigo ver imagens. As abas `#38`, `#39`, `#43` e `#45` do `.xlsx` contêm prints (confirmado:
`xl/media/image1..7.png`, referenciados por `drawing1..4.xml`, um por aba). O item **39** é do A1 e
ele o confirmou por código (`frontend/fluxo-tabela.ts:57-92`). Sobram três:

| Item | Aba | O que a imagem decide | O que eu já sei sem ela |
|---:|---|---|---|
| **38** | `#38` | O layout-alvo da coluna Orçamento com Permuta física, e **qual é a "largura atual" que não pode aumentar** | Lado a lado ✓ (`frontend/tela-fluxo-custos.ts:330-332`). Falta medir: `urbi-select` 130px + gap 6px + `viab-num` 90px = **226px** contra o caso normal (`.orc` em coluna, `viab-num` 110px + badges que quebram linha). O comentário `:327-329` afirma que não alarga; **nada no repo mede isso**. Quem tiver a tela aberta resolve com um `getBoundingClientRect()` na `<td>` de uma linha de permuta e de uma linha comum, no mesmo grupo Terreno |
| **43** | `#43` | O **formato da tabela** da aba Proforma do Avançado — quais linhas, em que ordem, com que agrupamento. O pedido diz explicitamente que *"é diferente da segmentação encontrada em fluxo de caixa"* | A tabela existe e tem segmentação própria (`frontend/proforma-avancado.ts:110-126`: Receita bruta → deduções → Receita líquida → Custo direto → Custo indireto → Resultado, com Terreno/Construção/Gestão/Decoração/Manutenção/Despesas Financeiras no direto e só Marketing global + Gestão indireta no indireto — a `proforma-avancado.ts:124-126` afirma ser "a tradução da segmentação da imagem"). **Não posso confirmar essa afirmação.** Basta o autor olhar a aba e dizer se bate |
| **45** | `#45` | **Todo o critério do item.** O corpo é literalmente *"Olhe a aba #45 para saber como mostrar o cálculo automático de área permutada"* — não há requisito textual nenhum | Existe um total automático, no rodapé do grupo Terreno, como par rótulo/valor "Área permutada · X m²", só quando > 0 (`frontend/tela-fluxo-custos.ts:447-451,477-479`). Se a imagem mostrar o total **por tipologia**, ou dentro da tabela em vez do rodapé, o item não está entregue — `permutaFisicaPorTipologia` já devolve a quebra por tipologia e o código a **soma** |

**Como destravar sem mim:** o autor abre as três abas e diz "bate" / "não bate"; ou um agente com
acesso à instância tira o print equivalente da tela atual e o autor compara os dois. Não é preciso
que eu veja nada — só que alguém que veja emita o veredito.

---

## 5. Perguntas ao autor

**P1 · Item 2 — "Produtos é a última da lista" quer dizer depois de Permutas?**
Hoje: `Terreno & Áreas · Custos · Produtos · Permutas`. O implementador leu como "última das duas
novas, antes de Permutas" e registrou isso na mensagem do commit `74cb2c7`. Se a leitura literal
valer, é trocar duas linhas em `frontend/tela-preliminar.ts:51-52`. Uma frase sua fecha ou reabre o
item.

**P2 · Item 10 — "todo campo igual a zero some" inclui os subtotais?**
As 18 linhas de detalhe já somem. Os 6 consolidados (`= Deduções sobre VGV`, `= Custo direto total`,
`= Custo indireto total`, `= Receita líquida`, `= Receita operacional`, `= Resultado`) não. Um estudo
sem custo indireto mostra `= Custo indireto total 0,00` com nada abaixo. Três posições possíveis:
(a) como está; (b) some o **grupo inteiro** quando todos os seus itens são zero, mantendo
`= Resultado` e `= Receita líquida` sempre; (c) some tudo que for zero, inclusive o Resultado.
Recomendo (b).

**P3 · Itens 43 e 45 — quer que eu abra issue "conferir contra o print", ou você confere direto?**
Abrir issue para algo que uma olhada sua resolve em 30 segundos gera backlog sem trabalho. Mas
deixar sem registro é como o item 45 chegou até aqui sem ninguém notar que ninguém o verificou.

**P4 · Item 48 — equity com base negativa deve devolver retorno negativo? ⚠️ Eu e o A3 divergimos.**
`frontend/funding-motor.ts:441,444` não tem `max(0, …)`: com receita líquida mensal negativa ou
resultado final negativo, o "retorno" do investidor fica negativo, ou seja, **o investidor paga o
projeto**. O **A3 classificou como defeito**; eu classifico como **fiel à spec**, porque
`docs/viabilidade/fluxo-investidor-formulas.md:135` também não tem `MAX` — e a **mesma planilha usa**
`MAX(0; …)` na aba `divida` (`:116`), o que torna a ausência difícil de ler como esquecimento.
Evidência dos dois lados na §3.4-a. A divergência não muda o que você precisa decidir, muda a
**forma do conserto**: se a resposta for "nunca negativo", spec e motor mudam **na mesma issue**, com
o `fluxo-investidor-formulas.md` corrigido **antes** do código — senão a próxima auditoria reabre
isto como divergência código × spec.

**P5 · Item 41 — o "detalhamento" do financiamento à produção pode sair da tabela?**
A 8-B.2 assume que sim, porque a informação já está nas linhas de Custos Financeiros e o bloco tem
total/VPL zerados. Se você usa esse bloco na prática para conferir liberação × juros × amortização,
diga — a issue vira "mover para a aba Análise Financeira" em vez de "remover".

**P6 · Consertos não commitados — ✅ RESPONDIDA pela sessão principal, não precisa de você.**
Os cinco arquivos modificados que encontrei (§3.4-c e §3.4-d) são do **agente B2**, que está
consertando os 3 bugs com autorização explícita sua; **a sessão principal abre o PR**. Fica
registrado que eu **conferi os dois diagnósticos e os dois consertos de forma independente**, lendo
o código em vez do relato — o que vale como evidência na revisão desse PR. O ponto operacional
permanece e é só isso: **enquanto não mergear, a `main` continua com a margem −47,87% na aba
Proforma e com o "Aplicar" reescrevendo o plano de pagamento.**

---

## 6. O que este documento deliberadamente NÃO fez

- **Não commitou nada, não abriu PR, não fez checkout de outra branch.** Só escreveu este arquivo.
- **Não rodou `validar-backend.sh`** — o SDK desta máquina é stub e ele aborta no portão. Nenhum
  veredito acima depende dele: tudo é leitura de código.
- **Não reauditou os 11 itens do A1** (6, 11, 13, 17, 20, 22, 24, 27, 31, 39, 46). Onde precisei do
  resultado dele — o padrão de `.kpis` do item 17, aplicado ao item 7 — citei a §2.4 dele em vez de
  refazer.
- **Não conferiu número na instância.** Onde o número importava (itens 43 e 48), usei as medições do
  A3 e do A5, atribuídas.
- **Não propôs mudança de cálculo.** A P4 é a única questão de modelo levantada, e está como
  pergunta, não como issue.
