# PROGRESSO — App `viabilidade`

Memória entre sessões. Uma etapa por sessão. Atualizar ao fim de cada etapa.

---

## A linha de deduções deixa de ser pintada como receita no Fluxo de Caixa — #591 (2026-08-29)

Rodada 10, item A10-12. Pedido do autor, literal: *"Arrumar linha no fluxo de Impostos que aparece
na parte de receitas hoje"*. A linha `(-) Impostos e deduções sobre a receita` saía com a classe
`receita` no `<tr>` e o CSS a pintava com o token de **sucesso**, na mesma faixa verde dos grupos de
VGV logo acima — uma dedução com a cor de receita.

**A saída escolhida foi a D2 da issue (marcar como custo), e a razão não é "é a mais barata": é que
a Proforma do Avançado já classifica ESTA MESMA linha como `custo`.** O Fluxo de Caixa era o lado
divergente. Uniformizar na outra direção teria mudado a Proforma, que estava certa.

**O efeito colateral que a issue previa para a D2 não se materializa, e isso está medido, não
suposto.** A D2 muda cor **e** notação contábil, porque `ehCusto` governa as duas — mas a série de
deduções é `líquida − bruta`, logo ≤ 0, e `negativoContabil` já põe valor negativo entre parênteses
com ou sem `custo`. O teste assere exatamente isso, mês a mês: `celula(v, true) === celula(v,
false)` para os valores reais da linha. O que muda é a cor; o número sai escrito igual.

**Tela e exportação leem a MESMA constante.** `DEDUCOES_RECEITA_EH_CUSTO` mora em
`frontend/fluxo-shared.ts` — **um** dos cinco módulos que `fluxo-tabela.ts` e `exportar.ts` já
importavam, de modo que a constante não cria aresta nova no grafo de imports (o cabeçalho de
`exportar.ts` explica por que a direção dele importa). ⚠️ A primeira redação desta entrada dizia "o
**único** módulo", e era **falsa**: `viab-format.ts` — dono de `celula` e `negativoContabil` — é
igualmente compartilhado e serviria de lar. A escolha é por **assunto** (a constante diz o que a
linha é no fluxo, não como se formata), não por exclusividade. A paridade da #449 passa a ser **estrutural**: não há como mover
uma ponta sem a outra.

**A prova da tela é render, e ela tem dois qualificadores por necessidade.** O caso
`frontend/render/casos/tabela-fluxo.ts` exige `tr.subgrupo.custo[data-linha="deducoes"]`. Sem o
`data-linha` — atributo novo, sem efeito visual, nenhuma regra do CSS o seleciona — o seletor
`tr.subgrupo.custo` sozinho já casa com os subgrupos de custo (Terreno, Obra, …) e **ficaria verde
com o defeito de volta**; sem a classe, o `data-linha` não diz nada sobre cor. Nenhuma camada de
lógica pura deste repositório lê classe de CSS chegando ao DOM.

**A linha irmã `= Receita Líquida do Projeto` continua receita, de propósito** (critério 4): ela é o
total de receita a que a dedução chega, não uma redução. A ordem das duas não muda — é ela que faz
a leitura aritmética de cima para baixo fechar.

**Sem migração e sem bump de `versao`**: é apresentação, nada persistido muda, e estudo antigo com
RET ou permuta financeira passa a exibir certo sem ser reeditado. Paridade Loteamento ×
Incorporação coberta por fixture de cada padrão — `tabelaFluxo`/`linhasFluxo` não ramificam por
padrão hoje, e o segundo fixture é a trava contra alguém introduzir a ramificação depois.

---

## #621 · tabela de Terreno & Áreas do Loteamento transborda abaixo de ~1280px (2026-08-29)

Etapa 5 da Rodada 10, achado colateral do PR 620 (#612): o primeiro caso de render de
`viab-tela-premissas` montado sobre um Loteamento expôs um defeito de layout pré-existente que nunca
tinha ido a DOM.

**Medido antes do conserto** (Chromium, harness `scripts/render-check.mjs`, busca binária): a 600px
de viewport, `div.area-seletor` (3 badges de unidade + `viab-num` de 130px, `flex-wrap: nowrap`) mede
251px contra uma célula de 219px — 6 transbordos de caixa; a 900px a célula mede 245px — mesmos 6
transbordos, mais 6 sobreposições do input sobre a coluna "Área (m²)" ao lado. A 1280px a tela já era
limpa. `table.areas { width: 100% }` deixava o auto-layout espremer a coluna abaixo do conteúdo
mínimo dela em vez de crescer a tabela.

**Conserto:** `min-width` em `table.areas` (`frontend/tela-premissas.ts`), forçando o auto-layout a
respeitar o conteúdo mínimo das colunas antes de espremer; o excedente rola dentro do
`.areas-wrap`, que já tinha `overflow-x: auto` — mesma solução de `.tabela-wrap table.crono`
(Cronograma). Piso varrido por busca binária: limpo a partir de 874px (600px de viewport); 900px é
esse piso com folga, mesma margem que `cronograma-sufixo-mes.render.test.ts` usa (18ch→21ch).

**Paridade (critério 3 da issue):** `table.areas` é o MESMO seletor usado por
`_renderTabelaAreasIncorporacao` — o conserto vale para as duas cascatas. Reconferido em Chromium:
`cascata-areas-incorporacao`, `cascata-areas-incorporacao-deficit` e `alocacao-areas-loteamento`
seguem limpos nas três larguras.

**A restrição `larguras: [1280]`** de `cascata-areas-loteamento-deficit.render.test.ts` (posta pelo
PR 620 exatamente para este defeito alheio não falsear a lente) foi retirada do teste de layout —
volta a rodar 1280/900/600, critério 2 da issue. O teste de cores mantém `larguras: [1280]`, mesma
convenção de `cronograma-sufixo-mes.render.test.ts` (cor não depende de viewport).

**Prova de mutação:** apagar o `min-width` (voltando a `width: 100%` sozinho) deixa
`cascata-areas-loteamento-deficit.render.test.ts` VERMELHO — 12 achados de `transbordoDeCaixa`
(6 a 600px, 6 a 900px) — confirmando que a lente enxerga a regressão.

---

## Funding em `urbi-abas` — #586 (2026-08-29)

Rodada 10, item A10-09a. A tela de Funding tinha três botões no topo que **adicionavam** operações a
um feed único de cards; agora tem **quatro abas** — Operações · Financiamento à produção · Dívida ·
Equity —, com os nomes literais do pedido do autor.

**É chassi, não reescrita, e isso é verificável no diff.** A separação por tipo **já existia** na
camada de campos; o que não existia era na navegação. Os três `_renderCampos*` foram para dentro das
abas **inteiros** — eles não aparecem no diff, e é por isso que o critério 4 (*"nenhum campo é
perdido no caminho"*) se confere por leitura direta dele, não por inventário à mão.

**Sem schema, sem migração → a `versao` não bumpa.** Estudo com operações já criadas abre com todas
distribuídas nas abas certas: a distribuição é `o.tipo`, que sempre existiu na tabela.

**A reordenação passou a ser POR TIPO, e a issue mandava o PR decidir.** Continuar global produziria
defeito visível: com um Financiamento à produção entre duas Dívidas na ordem global, clicar ↑ na 2ª
Dívida trocaria a Dívida com o Financiamento — e a aba Dívida, que **não mostra** o Financiamento,
não mudaria nada na tela. O usuário clica e não acontece nada. Reusar `reordenarCamadas` com o
**subconjunto** do tipo também não serve: ela renumera `ordem` de 0…n−1 sobre a lista que recebe,
então o subconjunto colidiria com as `ordem` dos outros tipos. Entrou `reordenarDentroDoTipo`, que
**troca** a `ordem` entre os dois vizinhos do mesmo tipo — a sequência global continua sendo uma
permutação dos mesmos valores, com teste que afirma exatamente isso.

**A classe `.barra` saiu junto com a barra.** O critério 3 é literal e greppável
(`grep 'class="barra"'` não pode casar). Reusá-la para o botão de dentro da aba faria o grep casar
**e** descreveria errado o que a regra faz — virou `.acao-aba`, e a regra morta `.barra .espaco`
foi removida (o único `span.espaco` desta tela vive em `.op-cab`).

> ⚠️ **Armadilha de linguagem que custou uma rodada inteira de validação, e é fácil repetir:**
> **crase dentro de template literal FECHA o template.** Escrevi comentários com `` `.barra` `` e
> `` `urbi-abas` `` dentro de `` css` `` e de `` html` ``; o arquivo virou 4 erros de sintaxe. Quem
> acusou foi o **guard de UI** — *"o TypeScript nao parseia este arquivo"* —, não o typecheck, que
> nem chegou a rodar naquela ordem. Os comentários foram reescritos sem crase, **com a razão anotada
> dentro deles** para ninguém "melhorar" de volta.

> ⚠️ **E a classe de defeito nº 2 apareceu de novo, com sete citações de uma vez.** O diff empurrou
> as linhas de `tela-funding.ts` e sete endereços `arquivo:linha` — em `render/casos/ind-funding.ts`,
> `tela-resumo.ts`, `tela-fluxo-ver.ts`, `tela-cenarios.ts`, `scripts/conferir-estudo.ts`, neste
> arquivo e no `CLAUDE.md` — deixaram de resolver. Quem pegou foi o `guard-enderecos-doc`, na
> execução do `validar-frontend.sh`. **Conferência à mão não teria pegado**: ela é feita antes do
> último conserto e envelhece nele. (O `CLAUDE.md` fica **fora** do guard da R1 de propósito — o
> próprio `guard-pr-escopo-processo.mjs` o declara —, então a correção de endereço lá não é mudança
> de processo dentro de PR sob revisão.)

**A prova de fiação é de RENDER, e tinha de ser.** `frontend/funding-abas.test.ts` prova a
reordenação (função pura) e o particionamento (a aba Operações é a união exata das outras três,
por id e não só por contagem; e todo tipo de `TIPOS` tem aba, senão um tipo novo sumiria da UI). Mas
**nenhum dos dois enxerga se a tela monta as abas** — apagar o `<urbi-abas>` do `render()` deixa
aquele arquivo verde. Só `frontend/render/casos/funding-abas.ts`, com `exigir` sobre `urbi-abas`,
quatro `urbi-hospedeiro` e `urbi-tabela`, enxerga. É a classe de defeito nº 1.

> **Um detalhe do teste que quase virou falso positivo:** o regex que lia os tipos da fonte era
> `{ valor: 'x', rotulo:` solto sobre o arquivo inteiro — e essa é a forma de **mais três arrays**
> do mesmo arquivo (`MODOS_RETORNO`, `EVENTOS_ANCORA`). Ele devolvia 11 valores e reprovava com
> *"TIPOS mudou"* sobre um `TIPOS` intacto. O conserto foi recortar o **bloco da declaração** antes
> de casar.

**Colisão declarada com a #592**, em execução em paralelo: ela varre a frase *"O Fluxo de Caixa real
é igual ao Livre"*, e este PR **move** essa linha para dentro da aba Operações. A string ficou byte
a byte idêntica; o merge pode exigir resolução manual, e está dito no corpo do PR.

---

## Custos antes de Viabilidade na lista lateral do Avançado — #589 (2026-08-29)

Rodada 10, item A10-10. O pedido do autor é de uma linha: *"Inverter a ordem entre as seções
Viabilidade e Custos"*. O diff de produção **são duas linhas trocadas** em `PAGINAS`
(`frontend/tela-avancado.ts`), e o resto do PR existe para provar que **nada mais andou junto** —
as três armadilhas que a issue nomeia (id interno `'obra'` preservado pela #40, slugs públicos
`custos`/`resultados` com os aliases antigos das #250/#350, e a aba default `'resumo'`, que no
código de produção é um LITERAL, não `PAGINAS[0]`).

**Uma das três armadilhas não é aferível por teste, e isso está medido.** A independência entre a
aba default e a ordem do array **não tem como ser provada de caixa-preta enquanto `resumo` for a 1ª
página**: trocar as duas origens do default (`_aba` inicial e o fallback do setter) por
`PAGINAS[0].id` deixa a suíte inteira verde. O teste mede o que dá para medir — sem URL e com slug
desconhecido a aba resolvida é `resumo` — e o arquivo diz esse limite com todas as letras, em vez
de anunciar uma defesa que não existe.

**A prova ancora na CHAMADA, não na constante.** `PAGINAS` é privada do módulo; testá-la seria
testar a declaração. `frontend/nav-avancado.test.ts` roda o `render()` real de `ViabTelaAvancado` e
lê o valor que o binding `.secoes` de `<urbi-nav>` recebe de fato — quem trocar `PAGINAS` por um
literal escrito à mão no template continua sendo aferido. Localiza o binding pelo **texto estático
que o precede** (`strings`/`values` do `TemplateResult`), não por índice posicional, que qualquer
edição vizinha deslocaria em silêncio. Roda sem DOM porque `render()` só constrói `TemplateResult`s
— mesma constatação de `carregamento-corrida.test.ts:15-17`.

**Por que não é caso de render.** O stub de `scripts/render-check.mjs` não reproduz `.secoes`
(binding de propriedade — o Lit nem escreve atributo): o `<urbi-nav>` sobe sem item nenhum e a
ordem da lista simplesmente **não existe** no DOM medido. Nenhuma camada em Chromium deste
repositório enxerga este requisito.

**Sem migração e sem bump de `versao`** — é ordem de apresentação, nenhum dado persistido muda, e
estudo antigo abre com o menu novo. Paridade Loteamento × Incorporação é estrutural (o Avançado não
ramifica o menu por padrão de estudo) e tem teste que barra a introdução da ramificação.

**Ficou pendente de decisão do autor** o critério 6 da issue: se a inversão equivalente deve
alcançar o Preliminar. Ela não tem tradução literal lá — `frontend/tela-preliminar.ts:35-41` não
tem página "Viabilidade" nem página "Custos" no nível 1 (só Premissas, Resultado, Gráficos e
Análise de Mercado; "Custos" existe como **sub-aba** de Premissas, sem par a inverter). O PR
entrega o Avançado e deixa a pergunta registrada.

---

## #593 · cor por natureza de linha na Proforma do Avançado (2026-08-29)

Item 14 da leva Avançado da Rodada 10. Pedido do autor, literal: *"Modificar tela do proforma para
deixar com as cores que diferenciam os itens de cada linha — mesmo princípio que já acontece no
estudo Preliminar"*.

**O diagnóstico da issue estava certo, e é o tipo de defeito que não fica vermelho em lugar
nenhum:** as classes de natureza (`receita`, `custo`, `resultado`, `informativo`, mais `n0`/`n1`)
**já chegavam ao DOM** — `tela-fluxo-ver.ts` sempre montou `<tr class="n${nivel} ${tipo}">`. O que
não existia eram as REGRAS: no bloco `table.proforma` não havia `tr.receita` nem `tr.custo`, as duas
classes mais numerosas da tabela. Elas chegavam e não pintavam nada.

**A cópia é literal, e isso é a defesa.** As declarações novas são as MESMAS de
`frontend/tela-proforma.ts` (o Preliminar) — mesmos tokens, mesmas proporções de `color-mix`,
mesmos fallbacks —, e `frontend/proforma-cores.test.ts` **confronta os dois arquivos entre si**, par
de regras a par de regras. Comparar contra uma constante escrita no teste deixaria passar
exatamente o defeito que se quer barrar: a constante teria de ser copiada de um dos lados, e a
partir daí os três podem divergir sem nada acusar. É a mesma razão de `proforma-ordem-linhas.test.ts`
comparar tela × exportação.

**A única lógica nova é o sinal.** `sinalLinhaProformaAv` (`frontend/tela-fluxo-ver.ts`) espelha
`sinalSensibilidade`/`ehLinhaReceitaOuResultado` do Preliminar (decisão da #567): só receita e
resultado ganham `pos`/`neg`; custo e informativo, nunca — na Proforma do Avançado o custo é
negativo por construção, e marcá-lo de vermelho diria que o estado normal está errado. O teste
confronta as duas funções valor a valor, em vez de reafirmar a regra.

**As duas camadas de verificação são complementares, e nenhuma sozinha basta.** Apagar o CSS deixa o
teste de comparação vermelho e o caso de render VERDE; apagar a fiação (`class="num ${sinal}"`)
deixa o caso de render vermelho e o teste de comparação VERDE. O caso
`frontend/render/casos/proforma-avancada-cores.ts` é deficitário de propósito, para que `pos` e
`neg` apareçam no mesmo caso — receita positiva, resultado negativo, como o
`proforma-deficitaria.ts` do Preliminar.

**Duas decisões de desenho ficaram declaradas no PR, não escondidas:** o `tipo` do Avançado não
distingue "receita bruta" de "receita consolidada" (o Preliminar pinta a primeira de azul e a
segunda de verde), então as duas linhas de receita saem verdes — separar exigiria um campo novo em
`proforma-avancado.ts`, que o critério 4 proíbe tocar; e o fundo vermelho a 8% das linhas `(-)` vem
da tabela de sensibilidade do Preliminar, porque a tabela PRINCIPAL dele não tinta despesa —
não havia um "mesmo" a copiar, e o mapeamento da issue escolheu essa origem.

Sem migração, `versao` não bumpa: é CSS mais uma classe de apresentação. Nenhum número muda —
`proforma-avancado.ts` não foi tocado.

### Rodada 2 da revisão — a SEGUNDA `table.proforma` estava sem sinal (achado P2 do Codex)

O motor adversarial achou o que a rodada 1 não tinha como achar: `tela-fluxo-ver.ts` tem **duas**
`<table class="proforma">`, e as regras novas foram escritas com o seletor `table.proforma …`, que
alcança as duas. A fiação (`class="num ${sinal}"`), porém, entrou só em `_renderProforma`. A
segunda tabela — a da aba **Análise Financeira** (`_renderAnaliseFinanceira`, `vista: 'analise'`) —
tinha as três células como `<td class="num">`, sem classe de sinal.

**Consequência, e ela é regressão introduzida por este diff:** num estudo com Fluxo de Caixa Livre
**negativo**, a linha "Fluxo de Caixa Livre" passava a ser pintada de **verde**, porque
`table.proforma tr.receita td` casa e o override `td.neg` nunca era aplicado. Antes deste PR não
havia regra nenhuma alcançando aquela tabela; depois dele, havia — e a metade `neg` do par ficou
para trás.

O conserto é a mesma função nas três células, com o mesmo mapeamento do Preliminar (#567):
`livre` como `receita`, `real` como `resultado`, e a linha do efeito do funding como `custo`, isto
é, **sem sinal de propósito** — ali o negativo é o estado normal.

**A causa raiz não era o cálculo, era a AUSÊNCIA de caso de render.** Na base deste PR, `vista:
'analise'` não aparecia em caso NENHUM — os três que fixam a prop fixavam `'proforma'` ou
`'fluxo-caixa'` (`git grep -n "vista:" <base> -- frontend/render/casos/`). Enquanto a aba não for
montada por algum caso, defeito de fiação nela é invisível para a suíte inteira. Daí a defesa ser um caso novo,
`frontend/render/casos/analise-financeira-sinal.ts` (estudo deficitário **com** funding, para que
`livre` e `real` saiam os dois negativos), e não mais um teste de `sinalLinhaProformaAv` — a função
já estava correta e verde o tempo todo, com a chamada ausente.

**Verificação.** `scripts/validar-frontend.sh` verde nas 8 etapas, medido **depois** do merge de
sincronização com a `main`: **890** testes de lógica pura e **65** casos de render. Este PR não
acrescentou teste de lógica pura nenhum ao conserto, e isso está certo pelo mesmo motivo de sempre:
o defeito morava na fiação, e teste de função pura não a alcança.

**Prova de mutação, com controle verde antes e depois:** apagar `${sinal…}` das três células novas
de `_renderAnaliseFinanceira` (voltando a `class="num"`) → **os dois testes do caso
`analise-financeira-sinal` ficam vermelhos e nenhum outro**, rejeitados pelo `exigir` em
`tr.n0.receita td.neg` e `tr.n0.resultado td.neg`. É essa segunda metade — nenhum outro caso muda de
cor — que mostra que a medição é DESTE caso, e não de carona num vizinho.

Duas honestidades sobre o alcance dela. **A célula do funding não é medida por essa mutação**, e não
tem como ser: `sinalLinhaProformaAv({ tipo: 'custo', … })` devolve `''` sempre, então apagar
`${sinalFunding}` produz exatamente o mesmo DOM. Ela está ali para o mapeamento ficar explícito e
greppável junto das outras duas, não porque um teste a segure — e o desfecho correto daquela linha é
justamente *não* ter classe. E a aritmética das três linhas foi conferida à parte, porque agora ela
é o que a cor afirma: na fixture do caso, `livre` = −219.202.399,98, `−custoFunding` = −1.053.567,77
e `real` = −220.255.967,75, com `livre − custoFunding == real`. Os dois `td.neg` são exercitados por
valores de verdade, não por um caso de borda de arredondamento.

---
## Eficiência de aproveitamento vira indicador: medidor no benchmark e métrica na Proforma (2026-08-29)

Issue **#613** (Rodada 10, achado 8 da auditoria #574). **Decisão do autor (2026-08-28), verbatim:**
*"Deveria ter. indicadores no benchmark e as métricas"* — as duas metades, e elas são superfícies
diferentes.

`INDICADORES_SUPORTADOS` tinha 4 campos e nenhum era `eficiencia_aproveitamento`, o **único
benchmark exclusivo do Loteamento** (`backend/rotas/benchmarks.ts`, `benchmarksPadrao`). O número
existia (`p.eficienciaPct`) e já era comparado ao benchmark no Resumo de Premissas, mas na aba
Gráficos caía em `descartados` com motivo genérico e um `console.warn`: a Incorporação desenhava 4
medidores e o Loteamento também 4, faltando exatamente o dele.

**As duas metades entregues.** *Benchmark:* o campo entrou na tabela compartilhada e
`tela-graficos.ts` passa `eficienciaParaFaixa(p)` ao resolvedor — não `p.eficienciaPct` cru, pela
razão da #611 (sem gleba o valor cai em 0 e o ponteiro pousava na banda vermelha, falso alarme sobre
grandeza não medida). *Métricas:* o KPI "Vendável / gleba" entrou nas métricas da **Proforma**, que
é a tela de métricas do Preliminar e era a única superfície do indicador que não o mostrava
(Premissas e PDF já mostravam).

**O rótulo foi unificado, e a escolha tem um motivo além do gosto.** O mesmo número tinha dois nomes
— "Vendável / gleba" na tela, "Eficiência" no PDF. Ficou o da tela **em todo o app**, porque
"Eficiência" sozinho já designa OUTRA razão na especificação (área privativa / área construída, a
eficiência de projeto da Incorporação): adotá-lo plantaria a colisão rótulo↔fórmula que
`frontend/rotulos-indicador.ts` existe para acusar, no dia em que a Incorporação ganhar a dela. O par
está registrado no inventário, cujo teste de wiring confere o texto no fonte de cada arquivo citado.

> **Um efeito colateral que só aparece lendo o resolvedor.** `tela-resumo.ts` (o medidor do
> Avançado) importa a MESMA tabela, mas não calcula eficiência — ele não passa valor para o campo
> novo. Antes da #613 esse ramo era **inalcançável** (as duas telas passavam os 4 campos suportados),
> e o descarte caía no motivo genérico sem custo. Com um 5º campo que só o Preliminar fornece, "sem
> indicador correspondente" viraria **mentira** no `console.warn` — manda procurar um indicador que
> existe. Entrou `SEM_VALOR_NESTA_TELA_MOTIVO` para separar "o app não tem esse indicador" de "esta
> tela não calcula o valor". Não é polimento: é a consequência direta da mudança, e ela não tinha
> quem a acusasse.

**Verificação.** `scripts/validar-frontend.sh` verde nas 8 etapas: **862** testes de lógica pura
(baseline da base **829** medido antes do diff, pelo glob `frontend/*.test.ts`) e **58** casos de
render (baseline **56**) — o caso novo é `medidor-eficiencia-loteamento`, o segundo Loteamento do
harness.

Mutações, **todas com controle verde antes e depois**: apagar `eficiencia_aproveitamento:` de
`_renderMedidores` derruba o caso de render (5 medidores viram 4) e o teste de fiação de
`tela-graficos.test.ts`; trocar `eficienciaParaFaixa(p)` por `p.eficienciaPct` cru derruba o mesmo
teste; apagar o `kpis.push` do ramo do Loteamento derruba `tela-proforma.test.ts`; e apagar o
argumento `lot` da chamada de `_renderKpis` vira **`TS2554` no typecheck** — o parâmetro é
obrigatório de propósito, para a mutação ser erro de compilação em vez de silêncio.

**O que NÃO mudou, e é decisão registrada:** o KPI novo sai **sem cor** (`variante: ''`). A #611
deixou a eficiência sem cor por decisão do autor, e o escopo da #613 é o indicador **aparecer**, não
recolorir card. Trocar o `0,0%` por "—" quando a gleba não foi informada continua dependendo de
`eficienciaPct: number | null` (o padrão da #571) — é o resto da #611, ainda adiado.

---

## #583 · o sufixo de mês não salta mais da caixa do campo no Cronograma (2026-08-28)

Item 6 da leva do Avançado de 2026-08-26 (com screenshot), **P2**. Nos campos Início e Duração da
tela de Cronograma, `jan/27` / `dez/27` eram **pintados por fora da borda arredondada** do campo.

**A causa, medida.** O `.input-wrap` do `viab-num` é um flex de **uma linha** com quatro filhos que
não cedem: o `input` (piso de `min-width: 4ch`, posto pela #245), o `.stepper` e os **dois**
`.afixo` (`sufixo` = a unidade, `sufixo-mes` = o mês). A soma mínima deles dá **139–148px** — e o
teto do campo era `max-width: 18ch`, que na fonte real da tabela (`td` em `0.8125rem`) vale
**128px**. Como o `.input-wrap` não declara `overflow`, `flex-wrap` nem `text-overflow`, o
excedente não é cortado nem quebrado: ele vaza para fora da borda. 11 a 20px por campo.

**É o eixo que a #245 não mediu.** Aquela issue mediu **truncamento** (`scrollWidth > clientWidth`
do input e de cada afixo) e acertou: o número parou de ser cortado. Só que ele parou de ser cortado
**porque os afixos deixaram de ceder**, e o preço foi empurrá-los para fora da caixa — outro eixo,
sem lente nenhuma.

**Como ficou.** O teto de `.campo-mes viab-num` sobe de `18ch` para **`24ch`**. Não se fez os afixos
encolherem (`min-width: 0` + `ellipsis`) porque isso trocaria o transbordo por um mês **amputado**
(`jan/2…`) — perder o dado em silêncio é a mesma classe de defeito que a #245 corrigiu no número.
O piso foi **medido no harness**: com 20ch ainda há campo transbordando; **21ch já sai limpo**;
24ch é esse piso com folga. E continua **abaixo** do `max-content` do `.input-wrap` (~280px), o que
importa porque é o **teto**, e não o conteúdo, que iguala a largura de Início e Duração — "º mês" e
"meses" rendem diferente, e só o teto mordendo os dois mantém o critério da #245.
`.params viab-num` fica em 18ch: nenhum `viab-num` é montado dentro de `.params` hoje.

**A rede nova.** `frontend/render/casos/cronograma-sufixo-mes.ts` + o teste ao lado montam a tela
com valores de 1 a 3 dígitos, linhas travadas e editáveis, fases fixas e customizadas, em
1280/900/600px. `viab-num` é componente **deste** repositório: o harness mede o markup real do
shadow DOM, não um stub.

**As duas lacunas de `scripts/render-check-cronograma.mjs`, e por que ele passava.** A rede manual
da #245 (1) só tinha a lente de **truncamento**, e (2) copiava a tela **sem o `font-size` do `td`**
— então o `ch` do `max-width` resolvia contra os 16px do root e o campo nascia com **183px** ali
contra 128px na tela: largo demais para o defeito caber. As duas foram fechadas: a sonda ganhou a
lente de **transbordo do `.input-wrap`**, e o `td` do fixture ganhou o `font-size` da tela. Com isso
o script passou a **enxergar** o bug (`--largura …max-width:18ch` ⇒ 4 campos, 12px por fora) e a
passar limpo com o conserto.

**Verificação.** `bash scripts/validar-frontend.sh` verde — 871 testes de frontend e **59** casos de
render (baseline da `main` em `3c0a1a9`: 871 e 57; o PR não acrescenta teste unitário, só render).
Mutação com controle antes e depois: `24ch` → `18ch` deixa o caso novo **vermelho com 66 achados**
de `transbordoDeCaixa` (22 por largura, 3 larguras; `scrollWidth` 139–148px contra `clientWidth`
128px), e o controle volta verde ao desfazer. O **piso foi varrido**, não estimado: 18ch e 20ch
vermelhos, 21ch e 22ch limpos. Sem migração → **a `versao` não bumpa**.

> ⚠️ **O `transbordoDeTexto` de um `<text>` do gantt em 1280px é ANTERIOR e alheio** — medido igual
> antes e depois do conserto. Por isso o teste assevera zero em `transbordoDeCaixa` (a lente
> determinística, que é a forma deste bug) e restringe a asserção de texto aos campos de mês, em vez
> de zerar uma lente dependente de fonte sobre uma região que este PR não toca.

## #610 · a sub-aba Cenários ganha o estado vazio da Proforma sem catálogo (2026-08-28)

Achado da auditoria #574, aprovado pelo autor. A **#563** mandou a Proforma para o estado vazio
quando não há catálogo efetivo, mas gateou **só a tabela principal**. O resultado era o mesmo estudo
respondendo coisas opostas em duas abas vizinhas: "não há receita modelada" na Proforma, e
**Bear/Base/Bull inteiros** em Cenários — com os números vindos exatamente da fonte que a #563
tinha acabado de recusar (os pares legados de área × preço, sem campo em tela nenhuma), agora
multiplicados por ±10% em três colunas. **Um número-fantasma estressado continua fantasma.**

**Como ficou.** `_renderSemProdutos` passou a receber o **título do card** e é chamada pelas duas
sub-abas: `'Proforma'` numa, `'Análise de sensibilidade'` na outra. Ícone, mensagem e submensagem
são os MESMOS — é o pedido literal da issue, e a submensagem já nomeia o que falta ver ("VGV,
custos e resultado"), que é o conteúdo das duas tabelas da sensibilidade também. Duplicar o texto
para "adaptá-lo" criaria duas cópias para divergirem.

**O parâmetro é obrigatório de propósito.** Um default deixaria um chamador novo herdar "Proforma"
dentro da aba errada, em silêncio. Sem default, esquecê-lo é `TS2554` — medido: apagar o argumento
das duas chamadas dá erro de compilação nas duas linhas.

**A verificação vem em ordem invertida, e é o que dá valor a ela.** O caso de render
`cenarios-sem-produtos` foi escrito e rodado **ANTES** do conserto, e falhou **pelo motivo certo**:
`faltou "div.pf-vazio": exigia 1 visível(is), achou 0`, com 144 nós já montados — as tabelas da
sensibilidade desenhadas sobre um estudo sem catálogo, em Chromium. Não é dedução a partir do
código: é a tela medida no estado do defeito.

> **A ausência precisava de prova, e o harness não tem asserção de ausência.** `exigir` só sabe
> exigir presença — um ramo que desenhasse o estado vazio **e** as tabelas passaria por ele. A
> tentação era declarar um `seletoresAusentes` no caso; isso teria sido **pior que nada**, porque o
> harness ignora campo que não conhece **em silêncio**, exatamente como a prop inexistente de
> primitivo `urbi-*` que o `CLAUDE.md` descreve. Conferi a superfície real em
> `scripts/render-check.d.mts` antes de confiar: o campo não existe.
>
> A prova saiu do mecanismo que já existe, pelo avesso: o caso **não declara**
> `urbi-select.label`/`.opcoes` em `aceitaNaoReproduzido`. Se a sensibilidade voltar a renderizar
> nesta condição, o `urbi-select` aparece, as duas props entram em uso sem declaração e o
> `naoDeclaradas` fica vermelho. **Medido**, não presumido: com um ramo que desenha as duas coisas,
> o teste reprova com `props NÃO reproduzidas e NÃO declaradas: urbi-badge.cor, urbi-select.label,
> urbi-select.opcoes`.

**Verificação.** `scripts/validar-frontend.sh` verde nas 8 etapas: **842** testes de lógica pura e
**57** casos de render (baseline da `main` em `4ab2b88`: 842 e 56). O teste de lógica pura **não
mudou de número, e isso está certo** — `semProdutos` já é coberto por `frontend/proforma.test.ts`, e
o que faltava não era cálculo, era fiação. Acrescentar teste de função pura aqui seria decoração:
nenhum deles monta a tela, e o gate ausente os deixava todos verdes.

Mutações, com controle verde antes e depois: apagar o gate do ramo `cenarios` (volta ao
comportamento da `main`) → **1 vermelho**; ramo que desenha estado vazio **e** sensibilidade →
**1 vermelho** (pelo `naoDeclaradas`, como acima); apagar o argumento `titulo` → **2 erros TS2554**.
O caso `cenarios-sensibilidade` (COM catálogo) segue verde — o caminho normal não foi tocado.

`docs/viabilidade/formulas.md` dizia que `semProdutos` manda "a Proforma inteira" para o estado
vazio. Era a descrição do que a #563 pretendia, não do que ela entregou; **com esta issue a frase
passou a ser literal**, e o doc agora diz desde quando.

## #595 · a série do cenário simulado no card de comparação (2026-08-28)

Item 16 da leva Avançado da Rodada 10, **P1**, com screenshot. Pedido do autor, literal: "Visual do
gráfico de linha ainda continua errado mesmo após tantas tentativas de arrumar (…) ajuste para que a
linha que se sobressai nessa imagem apareça de fato e com outra cor (hoje são só pontos)".

**O1 — a hipótese de DADOS foi descartada, e com mecanismo, não só medição.** A issue manda checar
primeiro se as duas séries divergem em comprimento ou trazem valor não finito: seria a única causa
que é defeito **deste** repositório, porque coordenada inválida derruba o `path` inteiro e deixa só
os marcadores — exatamente o sintoma. Medido nos dois níveis, nas duas views e em 4 pares de deltas
(inclusive ±30%): **nunca divergem**. E não é coincidência — o horizonte deriva SÓ de tempo
(cronograma, custos, recebíveis, funding, em `calcularFluxo`) enquanto `aplicarCenario` escala SÓ
valores (`preco_m2`, `orcamento_valor`), então `base.prazo === cenario.prazo` por construção.

**O que ERA defeito deste repositório: a crença sem fonte de que a cor viaja no dado.** A tela
entregava `cor: 'var(--cor-primaria, #7c5cff)'` dentro de cada item de `series`. O espelho
`docs/ui-urbiverso/primitivos.json` declara `series` como `Array` e **não declara a forma dos
itens** — não há como afirmar que `cor` é honrada. Pior: `var()` só resolve em **valor de
propriedade CSS**; num **atributo de apresentação SVG** (`stroke="var(...)"`) o valor é inválido, o
agente de usuário descarta o atributo, o traço cai para o inicial (`none` — some a linha) e o
marcador para o `fill` inicial. O comentário de `tela-cenarios.ts` que afirmava
"SerieGrafico só declara { rotulo, valores, cor }" (herdado da #185) era a origem da crença, e foi
**corrigido no mesmo diff** (critério 6): a parte que continua verdadeira — o primitivo não declara
prop de dasharray nem de anotação — segue escrita, com a fonte que a sustenta.

**A saída, sem inventar prop.** O espelho declara, no `:host` de `UrbiGraficoBase`, as custom
properties `--urbi-grafico-cor-1..8`, e o próprio `scripts/guard-tokens-css.mjs` as reconhece como
ponto de customização legítimo. As duas primeiras passam a ser definidas no CSS de
`tela-cenarios.ts`, com tokens do app. É CSS de verdade, onde `var()` resolve, e vale **qualquer que
seja** o tratamento que o primitivo dê a `serie.cor` — por isso `cor` saiu do dado em vez de
conviver: mantê-la só preservaria o único valor que pode ser inválido.

**Função pura nova `comparacaoCenario` (`frontend/fluxo-graficos.ts`)**, que monta eixo e as duas
séries fora do template. O eixo passa a ser o do cenário **mais longo** dos dois (truncar pelo da
base esconderia meses de um cenário que estique o horizonte) e `alinharAcumulado` garante uma
entrada por coluna. Repetir o último valor **não é inventar dado**: numa série ACUMULADA, depois do
último mês em que algo entra ou sai o saldo permanece onde estava. Hoje o reparo é NO-OP — e o teste
assere as duas coisas separadamente, porque "não há divergência hoje" e "o gráfico sobrevive se
houver" são afirmações diferentes.

**O que ficou NÃO EXECUTADO, declarado (critério 4):** se o primitivo desenha as duas séries como
linha é comportamento do markup interno dele. O harness de render usa **stub** gerado do espelho e
não reproduz esse markup; o `dist/index.d.ts` do SDK, que responderia, não existe neste ambiente
(GitHub Packages privado, 401). **Quem confirma é o autor, na instância intermediária (Pinguim)** —
mesma sessão em que ele pode fechar a #264. Por isso o PR **não** declara `Closes #595`.

Validação: `bash scripts/validar-frontend.sh` verde (847 testes, 56 casos de render). Sem migração —
`versao` não bumpa.
## #581 · R$ sem centavos no card de KPI — a única exceção declarada ao C7 (2026-08-28)

Item 4 da leva Avançado da Rodada 10. Pedido do autor, literal: "Ajustar valores em R$ nos
urbi-kpis para não terem casas decimais e quando % para ter uma casa decimal". **Não é bug — é
decisão do autor que abre exceção a um contrato vigente**, e o app estava integralmente conforme ao
C7 antes deste PR (a #449/#281 fecharam justamente essa unificação). Por isso a exceção entra
redigida no `CLAUDE.md` § Contratos inegociáveis, em `docs/viabilidade/formulas.md`
§ Precisão de resultado e na linha C7 do anexo A de `padrao-incorporacao.md` **no mesmo diff** —
senão o próximo revisor acusa o diff como violação do C7, com razão, e o conserto seguinte reverte
o que o autor pediu.

**A metade "%" do pedido já estava atendida e o que faltava era travar.** `fmtPct` é 1 casa com
mínimo e máximo e é o que todo card de percentual chama; `fmtPctEntrada` (2 casas, valor DIGITADO)
tem 3 call sites, nenhum deles card — um banner em `tela-premissas.ts` e duas células `<td>` em
`tela-fluxo-receitas.ts`.

**A metade "R$" é a que mudou.** Função nova `fmtR$Kpi` (`frontend/viab-format.ts`), com
`minimumFractionDigits` E `maximumFractionDigits` em 0 — os dois, pelo mesmo motivo que a #492 fixou
os dois em `fmtR$`: só o máximo entregaria "até 0 casas". **Função própria, não um segundo parâmetro
de `fmtR$`:** parâmetro opcional espalharia a exceção por um argumento que qualquer chamador passa
por engano, que é a classe de defeito que a #449 apagou. Símbolo próprio torna a exceção greppável.

28 call sites, nas 6 telas do inventário da issue: `tela-resumo.ts` (4), `fluxo-tabela.ts` (7, os
`div.kpi-card` monetários de `kpisFluxo`), `tela-cenarios.ts` (1), `tela-graficos.ts` (1),
`tela-premissas.ts` (2 — VGV no ramo Loteamento e Preço médio/unid. no ramo Incorporação, que é a
paridade do critério 8) e `tela-funding.ts` (13 — os `.ind-card` da Visão do investidor mais o
resumo de Financiamento à produção).

**Fora do escopo, por decisão registrada:** o `title` do card "VGV Vendável" (`fluxo-tabela.ts`),
que é uma LISTA de 6 grandezas de detalhe e não a figura do card; e os cards de comparação de
`tela-analise-mercado.ts`, que publicam R$/m² — derivada não monetária, fora do C7, e ausente do
inventário da issue.

**A trava é `frontend/kpi-casas-decimais.test.ts`, e ela lê o FONTE de propósito.** O que a issue
pede é propriedade do INVENTÁRIO (a exceção em todos os cards e em nenhum outro lugar), e isso é
fiação — a classe de defeito nº 1 do `CLAUDE.md`: apagar a chamada no componente deixa a suíte
inteira verde. A lista fecha nos dois sentidos por CONTAGEM EXATA (a menos = card voltou a exibir
centavos; a mais = a exceção vazou), com o motivo escrito por entrada, mais três zeros: `exportar.ts`,
`tela-proforma.ts`, `tela-fluxo-custos.ts`, `tela-fluxo-receitas.ts`, `tela-fluxo-ver.ts` e
`tela-dashboard.ts` não podem conhecer `fmtR$Kpi`, e em `viab-format.ts` a contagem esperada é 1 — a
declaração —, porque 2 significaria que `celula` passou a chamá-la e a exceção entraria em toda
célula de tabela e em todo CSV/PDF.

Vale para estudos existentes: mudança só de apresentação, nada persistido muda, sem migração —
O critério 8 (paridade) ganhou asserção de VALOR além da de inventário: um estudo de Loteamento e
um de Incorporação passam por `calcularProforma`, e o mesmo número sai do card sem centavos e da
tabela com centavos — é o que prova que o arredondamento é de exibição, não de dado.

`versao` não bumpa. Validação: `bash scripts/validar-frontend.sh` verde (850 testes, 56 casos de
render).
## Notação de sinal da Proforma unificada entre tela, CSV e PDF (2026-08-28)

Registro dos PRs 617/618 — achado 10 da auditoria #574, sem issue própria. **Decisão do autor
(2026-08-28), verbatim:** *"se for fácil, implemente isso. Se não, anote e aguarde nova versão"*.
**Veredito: fácil**, e o motivo está abaixo.

A tela decidia parênteses × sinal por `celulaProforma`; o CSV e o PDF formatavam com `fmtR$` **cru**.
Uma Receita operacional negativa saía `-R$ …` no arquivo e `(…)` na tela, **sobre o mesmo número**.
Junto veio um segundo desvio do mesmo eixo, que a auditoria não tinha separado: a coluna **% VGV**
da exportação usava `Math.abs` em **todas** as linhas, inclusive no Resultado — uma margem negativa
aparecia **positiva** no arquivo e negativa na tela.

**Por que era fácil, e por que quase não era.** A dificuldade real não era formatação, era a
**direção do grafo de imports**: `tela-proforma.ts` importa `exportar.ts` (pelos botões de
exportar), então a exportação não podia importar a notação da tela sem fechar um **ciclo de
módulos**. A saída já estava escrita no próprio repositório — `avisoPermutaCapada` mora em
`exportar.ts` exatamente por isso, com o motivo comentado ao lado. `ehLinhaReceitaOuResultado` e
`celulaProforma` **mudaram para `exportar.ts`** e a tela as **reexporta**, então nada que as
importava de lá precisou mudar. Sem esse precedente, o caminho seria criar um módulo novo e mover
mais de cem linhas — e aí a resposta teria sido "anote e aguarde".

**Como ficou.** `LinhaPf` (exportação) passou a carregar `tipo`/`natureza` — os MESMOS campos da
`Linha` da tela, porque são eles que decidem a notação —, e as duas colunas monetárias saem por
`celulaProforma`. A coluna % VGV saiu por `pctVgvProforma`, com a regra da tela (sinal no
Resultado, magnitude nas demais). O símbolo **"R$" saiu das células** do PDF: o cabeçalho da coluna
já o informa, e é o que a tela sempre fez. Os KPIs do topo do PDF mantêm o símbolo — ali não há
cabeçalho que o diga.

**A defesa contra a divergência voltar não compara com um formato escrito à mão.** O teste de
paridade (`frontend/proforma-ordem-linhas.test.ts`) confronta os **dois lados entre si**, célula a
célula, em **quatro** fixtures — mais a classificação `tipo`/`natureza` linha a linha. Comparar
contra uma constante deixaria passar exatamente o defeito que se quer barrar, porque a constante
teria de ser copiada de um dos dois lados.

> **O quarto fixture existe por uma medição, não por simetria.** Os três primeiros (Incorporação
> com e sem permuta, Loteamento) fecham **no azul**, e num estudo lucrativo `Math.abs(v)` é a
> **identidade** — a asserção de % VGV passava sem nunca exercer a única linha em que o sinal
> importa. Medido: com `pctVgvProforma` revertida para `Math.abs` em todas as linhas, os três
> continuavam **verdes**; só o teste direto de notação acusava. Entrou então `INC_DEFICITARIO`
> (terreno de R$ 40M contra VGV de R$ 26,4M), e com ele a mesma mutação passou a derrubar também a
> paridade. A sentinela `notação: o fixture deficitário É deficitário` guarda essa propriedade: se
> um ajuste futuro devolver o estudo ao azul, ela fica vermelha em vez de os dois casos voltarem a
> passar por vacuidade.
>
> É a classe 1 do `CLAUDE.md` com uma volta a mais — o teste **chamava** a função certa, com o
> argumento certo, e ainda assim não media nada: o **fixture** é que não continha o caso.

**Verificação.** `scripts/validar-frontend.sh` verde nas 8 etapas: **856** testes de lógica pura
(baseline da `main` em `c82239e`, medido trocando os dois arquivos de teste pelos da `main`: **842**)
e **56** casos de render. Sem caso de render novo porque **a tela não muda** — a mudança é do
arquivo exportado, que o harness não desenha; quem cobre a tela são os casos
`proforma-deficitaria` que já existiam.

Mutações, todas com **controle verde antes e depois** (29 testes nos dois arquivos): CSV de volta
ao `fmtR$` cru → **2 vermelhos**; PDF de volta → **2**; % VGV de volta ao `Math.abs` → **2**;
"Receita líquida" perder `natureza: 'receita'` → **5**; "Resultado" perder `tipo: 'resultado'` →
**6**.

O merge da `main` também deslocou `_renderKpis` em `tela-proforma.ts` (a saída das duas funções
encurtou o arquivo em 13 linhas), e o `guard-enderecos-doc` **reprovou** a citação
`tela-proforma.ts:477-495` em `frontend/render/casos/kpis-proforma-longos.ts` — corrigida para
`:464-482`. Duas outras citações mudaram de **arquivo**, não só de linha, e o guard não as pega
porque uma não tem número (`frontend/viab-format.ts`) e a outra o tinha errado desde antes
(`padrao-incorporacao.md`): as duas apontavam `celulaProforma` para `tela-proforma.ts`, e agora
apontam para `exportar.ts:69`.

---

## #609 · duplicar um estudo copia absolutamente tudo (2026-08-28)

Achado 2 da auditoria #574, **P1**. `POST /estudos/:id/duplicar` copiava as colunas de `estudos`,
`estudo_imoveis` e — só no Avançado — cronograma/tipologias/fases/alocações/custos/cenários.
**Nada copiava `preliminar_produtos`.** Antes da #563 o fallback dos pares legados mascarava;
depois dela a cópia nascia em **estado vazio** — sem VGV, sem Proforma, sem KPIs — carregando todas
as premissas do original.

**Decisão do autor (2026-08-28), verbatim:** *"o correto é copiar absolutamente tudo, se for
difícil fazer isso me avise"*. Então o escopo passou a ser o inventário INTEIRO das estruturas
filhas, não só o catálogo. O que a varredura achou, além do achado original:

- **`avancado_funding_operacoes` também não era copiada** (tabela viva desde a #355): um Avançado
  duplicado perdia a estrutura de capital inteira, e o fluxo alavancado da cópia nascia diferente
  do original sem aviso;
- **`permuta_tipologia_id` viajava CRU** em `avancado_linhas_custo` — a linha de permuta física da
  cópia apontava para uma **tipologia do estudo original**. Mesma classe do `fase_ancora_id` que a
  #167 já tinha consertado ao lado, e igual de silenciosa: o motor lê a tipologia alheia sem erro;
- **`analise_mercado` e `apelo_comercial`** (uma linha por estudo, dado do estudo) não eram
  copiadas.

**Como ficou.** `FILHAS_SIMPLES` (`backend/rotas/estudos.ts`) declara as filhas de remapeamento
simples com os campos que viajam em cada uma, e `montarCopiasFilhas` — função **pura**, testada —
monta as linhas. `duplicarDadosAvancado` ganhou o mapa `id antigo → id novo` das linhas de custo,
o remapeamento de `permuta_tipologia_id` e a cópia das operações de funding, com `fase_ancora_id` e
`custo_linha_ids` (lista de ids em JSON, `remapearCustoLinhaIds`) reapontados. **Nada na cópia
aponta para o original**; id sem correspondência é descartado, nunca mantido.

`CAMPOS_OPERACAO` **mudou de arquivo** (`funding.ts` → `avancado.ts`, exportada): a duplicação
precisa da mesma lista que a rota grava, e `funding.ts` já importa de `avancado.ts` — declarar lá e
importar de volta fecharia um **ciclo de módulos** por uma lista de strings.

> ⚠️ **DUAS AUSÊNCIAS ESPERAM DECISÃO DO AUTOR — é o "me avise" da decisão.**
>
> · **Arquivos** (`estudo_documentos`, `apelo_comercial_documentos`): a coluna `documento` é do tipo
> `arquivo` e o binário é do **shell**. Copiar a linha com o mesmo id deixa dois registros sobre o
> mesmo arquivo (apagar um pode levar o do outro), e duplicar o binário exige um verbo do SDK que
> **não dá para conferir nesta sessão** (pacote privado, 401). Consequência declarada: a cópia leva
> o apelo comercial sem os documentos que o geraram.
>
> · **Membros** (`estudo_membros`): é ACL, não dado do estudo — copiar concederia acesso a
> terceiros a um estudo que eles não sabem que existe, e dispara notificação. O criador da cópia já
> entra como editor.

**Verificação.** 156 testes de backend (baseline da `main`: 144 — +12), todos verdes; frontend
intocado e verde (824 + 46). Mutações: apagar o laço da rota → **1 vermelho** (e as funções puras
todas verdes — classe 1); tirar `preliminar_produtos` de `FILHAS_SIMPLES` → **2**; não copiar
funding → **1**; `permuta_tipologia_id` cru de novo → **1**; `remapearCustoLinhaIds` mantendo id
órfão → **1**.

> ⚠️ **O typecheck do backend NÃO roda nesta sessão, e o que dá para medir foi medido.** Sem o SDK
> no disco, a augmentação de `Request` não existe e todo `req.dados`/`req.contexto` vira `TS2339`:
> **208 erros na `main`, 212 nesta branch**. O delta é **+4, todos da MESMA classe** (os 4
> `req.dados!` novos) — **nenhuma classe de erro nova**. "Não deu para rodar" não é "passou": a
> validação de backend continua sendo do autor, no ambiente autenticado.
## #582 · rótulos de marco escalonados no gráfico de Fluxo de Caixa (2026-08-28)

Item 5 da leva Avançado da Rodada 10. Pedido do autor, literal: "Sobreposição de palavras no
gráfico de área em Resumo em Fluxo de Caixa Acumulado. Arrumar para nao acontecer em nenhum
campo". `graficoFluxoAcumulado` (`frontend/fluxo-graficos.ts`) não tinha NENHUMA detecção de
colisão para os rótulos de marco do cronograma (Lançamento, Início/Fim Obra), Payback e Exposição
Máx. — as quatro famílias disputavam a mesma faixa superior do SVG com `y` **constante**, e dois
marcos a poucos meses um do outro imprimiam o texto em cima um do outro. `graficoFluxoMensal` já
tinha uma tentativa (`(idx % 2) * 10`), mas só alterna DOIS níveis por paridade de índice — três
marcos próximos ainda colidem dois a dois na mesma paridade, e ela nunca soube da existência do
Payback nem da Exposição Máx.

**Como ficou.** Função pura nova, `resolverColisoesRotulos` (`frontend/fluxo-graficos.ts`):
recebe uma lista de rótulos `{x, y, texto, cor}`, ordena por `x` (desempate por `y`, depois por
`texto` — sem isso o resultado dependia da ORDEM de entrada para itens com `x`/`y` idênticos, o
caso extremo de três marcos no mesmo mês) e escalona verticalmente quem colidiria com um rótulo já
posicionado, com uma estimativa de largura de glifo deliberadamente generosa (a decisão real de
pixel é do Chromium, medida pelo harness). `graficoFluxoAcumulado` agora resolve marcos + Payback +
Exposição Máx. no MESMO pool — é o que impede um marco de colidir com o Payback, não só com outro
marco; `graficoFluxoMensal` trocou o `(idx % 2) * 10` pela mesma função. As linhas verticais
tracejadas (marco/Payback) e o círculo da Exposição Máx. continuam na posição original — só o
TEXTO escalona.

**`frontend/exportar.ts` (a versão do PDF) foi conferida e NÃO precisou de mudança:**
`svgFluxoMensal`/`svgFluxoAcumulado` nunca desenharam rótulo de marco nenhum (só barras/linha +
eixo de meses + o texto de Payback, isolado verticalmente do eixo) — o defeito deste issue não
existe ali. Vale para estudos existentes: mudança só de apresentação, nada persistido muda, sem
migração — `versao` não bumpa.

**Verificação por render, camada nova.** `scripts/render-check.mjs` ganhou a lente
`sobreposicaoTexto`: compara só `<text>` × `<text>` por `getBoundingClientRect`, complementar à
`sobreposicao` de "caixas pintadas" que já existia (e que exclui toda forma de SVG de propósito —
path cruza text por projeto). Caso novo `frontend/render/casos/marcos-fluxo-colados.ts` monta DUAS
instâncias de `viab-tela-resumo` — cronograma de Incorporação com Lançamento/Início Obra a exatos 2
meses (o limite do critério 1) e cronograma de Loteamento com os TRÊS marcos no mesmo mês (o
extremo do critério 2); `marcos()` lê `EventoCrono` sem ramificar por `tipo_empreendimento`, então
as duas instâncias provam paridade por construção.

**Mutação medida:** 8 testes de lógica pura novos (`frontend/fluxo-graficos.test.ts`) cobrem a
função isolada; apagar a chamada de `resolverColisoesRotulos` nos dois gráficos (voltando ao `y`
constante / `(idx % 2) * 10` originais) deixa a lógica pura 832/832 verde — a função continua
correta, só não é chamada — e o caso de render vermelho de verdade: **24 sobreposições de texto
medidas pelo Chromium real** (8 por largura × 3 larguras). É a classe 1 do CLAUDE.md (o defeito
mora na fiação) de novo.

---

## #611 · eficiência e ROI sem cor quando a grandeza não é medida (2026-08-28)

Achado 5 da auditoria #574. A #571 tornou `margemLiquidaPct`/`custoObrasVgvPct`/
`receitaLiquidaSobreVgvPct` `number | null`; **`eficienciaPct` e `roiPct` ficaram de fora** e
continuam caindo em `0`. `eficienciaPct` é o indicador exclusivo do Loteamento: sem área de gleba o
Resumo mostrava `Vendável / gleba = 0,0%` **pintado de vermelho** por `varianteFaixa`, um falso
alarme de benchmark estourado sobre grandeza que ninguém mediu — ao lado de uma margem que já
mostrava "—".

**Decisão do autor (2026-08-28), verbatim:** *"por enquanto deixe sem cor então"*. Só a COR sai
nesta entrega; **o resto da issue continua pendente**, e o PR usa `Sem-fechamento: #611` em vez de
`Closes` — os critérios 1, 2 e 3 pedem `number | null` no motor, `fmtPctOuIndef` nos consumidores e
o "—" no Painel e no PDF, e nada disso foi feito.

**Como ficou.** O motor ganhou duas flags, `eficienciaMedida` e `roiMedido`, **nomeadas ao lado da
própria divisão** e reusadas por ela — assim o predicado ("há denominador") e a conta não podem
divergir. Dois helpers exportados, `eficienciaParaFaixa`/`roiParaFaixa`, devolvem `null` quando a
grandeza não foi medida, e as duas pontas que colorem passaram a chamá-los:
Premissas → Produtos (`varianteFaixa`) e o medidor de ROI da aba Gráficos (`montarMedidor`). As
duas funções já eram null-safes desde a #571 — o conserto é passar o `null`, não mexer nas faixas.

**O valor exibido NÃO muda**, e a separação é deliberada: a tela continua imprimindo `0,0%`. O que
passou a existir é a distinção entre *quanto* o indicador vale (sempre `number`) e se há base para
*julgá-lo*.

**Verificação.** 830 testes de lógica pura (baseline da `main`: 824) e 48 casos de render (baseline:
46), todos verdes. Mutações: reverter a fiação de Premissas → lógica pura **830/830 VERDE**, render
**2/2 VERMELHO** (`achou 5` dos 6 KPIs sem cor); reverter a fiação do medidor de ROI → **1
vermelho**; apagar as flags do objeto devolvido → `TS2739`; fazer a flag mentir
(`eficienciaMedida = true`) → **2 vermelhos**.

> ⚠️ **O caso de render nasceu VERDE sob mutação, e a causa vale registrar.** `viab-tela-premissas`
> tem `estudo` como `@property`: atribuí-lo dispara `_init()`, que refaz o fetch e **sobrescreve**
> `this.benchmarks` com `bm?.dados || []`. O benchmark posto por `forcarEstado` sobrevivia só até o
> `Promise.all` resolver; depois dele `varianteFaixa` não achava medidor e devolvia `''` com e sem o
> conserto. Os outros casos de `viab-tela-premissas` não tropeçam nisso porque declaram
> `benchmarks: []` — o mesmo valor que o fetch devolve. O caso agora **stuba `urbiVerso.api`** e
> espera um segundo ciclo de render. É a segunda vez nesta leva que uma mutação verde revelou teste
> medindo o ponto errado, e a forma é a mesma: o fixture deixava de fornecer a condição que o
> defeito precisa para aparecer.

**Fica pendente, e está dito no PR:** o padrão `number | null` da #571 para os dois indicadores; o
"—" em `frontend/exportar.ts` (PDF) e na coluna ROI de `frontend/tela-dashboard.ts`; e o ROI do
**Avançado** em `frontend/tela-resumo.ts`, que tem a mesma classe de defeito noutra grandeza e por
**dois mecanismos**: o KPI é colorido por sinal (`custoTotal > 0 ? … : 0`, `roiPct >= 0` → fica
**verde** quando não medido), e o MESMO `roiPct` alimenta o medidor de benchmark
(`resolverIndicadoresBenchmark`/`montarMedidor`), que sem custo medido desenha o ponteiro em 0 na
banda **vermelha** — o mecanismo idêntico ao que este conserto apaga em `tela-graficos.ts`. Não
tocado por ser fora do escopo da decisão (grandeza do Avançado; a #611 é do motor Preliminar).
## #579 · o VALOR do KPI para de saltar da caixa, nas 9 telas do inventário (2026-08-28)

Item A10-03 da leva Avançado (2026-08-26), rodada 10 — o defeito IRMÃO da #488: aquela consertou a
CAIXA transbordando a TRACK (`width` imposto de fora a um `urbi-kpi`); esta conserta o VALOR
transbordando a CAIXA (`R$ 171.448.400,00`, 9 dígitos, não cabe na track). Retomada de um WIP
parcial e não validado (commit `427fced`) — o WIP já cobria 7 das 9 linhas do inventário da issue
(as duas de Cenários — o `urbi-kpi` avulso de "Resultado após custo financeiro" e os 9
`.kpi-card` do Fluxo de Caixa — somam UM conserto só, `fluxo-tabela.ts`, contado como 1 lugar na
tabela abaixo); esta sessão completou as **2 linhas que faltavam, as duas do Preliminar**
(**Proforma** e **Premissas**) e consertou um bug de fiação no caso de render de Funding que fazia
o teste montar um elemento inexistente.

**Os 9 lugares, o conserto e o `arquivo:linha` de cada `.kpis`/grade:**

| Onde | Track antes → depois | `arquivo:linha` |
|---|---|---|
| Resumo (Avançado) | `minmax(180px,1fr)` → `minmax(230px,1fr)` | `frontend/tela-resumo.ts:81` |
| Proforma (Preliminar) | `minmax(180px,220px)` → `minmax(230px,260px)` | `frontend/tela-proforma.ts:241` |
| Premissas (Preliminar) — 3 grades (Resumo/aproveitamento #569/área alocada #573) | `minmax(180px,1fr)` → `minmax(230px,1fr)` | `frontend/tela-premissas.ts:359` |
| Fluxo de Caixa / Cenários — `.kpi-card` | `minmax(180px,1fr)` → `minmax(210px,1fr)` + `overflow-wrap`/`word-break` em `.valor` | `frontend/fluxo-tabela.ts:64,97-98` |
| Apelo Comercial | `minmax(170px,1fr)` → `minmax(210px,1fr)` | `frontend/tela-apelo.ts:34` |
| Funding — `.ind-card` | `overflow-wrap`/`word-break` em `.val` (track ficou em 150px, não mudou) | `frontend/tela-funding.ts:182-183` |
| Análise de mercado — `.comp` | `min-width:0`+`overflow-wrap`/`word-break` em `.comp-linha .val` | `frontend/tela-analise-mercado.ts:110` |
| Gráficos — "Resultado" | sem conserto — a track (`minmax(300px,1fr)`, filho solto) já tinha folga | `frontend/tela-graficos.ts:172` |

**Prova de fiação (critério 2 e 3 da issue) — 8 casos novos/estendidos em `frontend/render/casos/`
e 8 testes `#579` em `frontend/render/*.render.test.ts`**, cada um com um valor de 9 dígitos (o
exemplo literal `R$ 171.448.400,00`, ou o equivalente do mesmo comprimento quando a célula não é
R$). Mutação MEDIDA (reverter o conserto e rodar o teste isolado), não presumida:

- **Track sozinha prova** — `kpis-resumo` (rótulo "ROI sobre custo total" estoura em 600px no
  piso antigo de 180px) e `kpis-premissas-resumo` (Preço médio/unid., escopado ao card Resumo —
  o resto da sub-aba tem transbordo de texto PRÉ-EXISTENTE, medido igual nos dois pisos de track,
  documentado e reportado em vez de assegurado).
- **Track sozinha prova, isolada** — `scores-apelo` (`urbi-kpi`, sem `overflow-wrap` possível pelo
  shadow boundary): reverter só a track a 170px reabre o defeito — o rótulo "Segurança jurídica"
  estoura em 600px.
- **`overflow-wrap` sozinho prova** — `ind-funding`: a track do `.ind` nunca mudou (fica em
  150px, `urbi-kpi` não é usado aqui, é markup próprio); apagar só o `overflow-wrap` de
  `.ind-card .val` já reabre o defeito sozinho (2 achados em 900px).
- **Redundantes entre si** — `kpis-fluxo-longos`: track E `overflow-wrap` sozinhas continuam
  verdes (uma cobre a outra); só apagar as DUAS ao mesmo tempo reabre (36 achados, 3 larguras).
  Defesa em profundidade genuína, não decoração.
- **Não fecha vermelho, documentado com o número medido** — `comp-analise-mercado` (a track de
  260px já dava folga antes do conserto: nota já deixada pelo WIP, conferida de novo aqui) e
  `kpis-proforma-longos` (a faixa da Proforma tem só 4 cards de rótulo curto e sem R$ — nem "Nº de
  unidades" em até 12 dígitos sem casas decimais, nem "Área vendável" nos mesmos 9 dígitos do
  exemplo da issue estouram o teto antigo de 220px; só ultrapassei forçando a área a 18 dígitos,
  bem além de qualquer estudo real). Track sobe mesmo assim pelo motivo estrutural que a issue cita
  nominalmente: um teto MENOR que o piso do resto do app.

**Bug de fiação achado e consertado nesta sessão:** `frontend/render/casos/ind-funding.ts` criava
`document.createElement('viab-tela-funding')` — tag que não existe (o componente real é
`@customElement('viab-funding')`, `frontend/tela-funding.ts:108`). Um elemento não-registrado não
tem shadow DOM: o caso "montava" um nó vazio (1 nó, 0 visíveis), e o harness reprovava por
`exigir` não satisfeito — nunca chegou a medir nada. Corrigido para `viab-funding`; o
`aceitaNaoReproduzido` do caso também precisou ser recalibrado (a montagem real, ao contrário do
elemento vazio, renderiza o banner regulatório §17, o checkbox "Distribuir aporte" e o select
"Mês do aporte" — nenhum dos três estava declarado — e não usa `urbi-badge.cor`/os 4
`urbi-botao` de edição, que o WIP tinha declarado sem uso real).

**Endereços `arquivo:linha` reconciliados** (3 citações que a `main` andando desde o WIP tinha
deslocado — `frontend/premissas-conversao.ts`, `frontend/render/casos/ind-funding.ts`,
`frontend/render/casos/comp-analise-mercado.ts`) — achados pelo `guard-enderecos-doc` na
etapa 5/8, não à mão.

**Regras transversais da leva (autor, 2026-08-26), como se cumprem:** "vale para estudos
existentes" — é mudança só de CSS, nenhum valor persistido muda, sem migração, sem bump de
`versao`. "Paridade Loteamento↔Incorporação exceto custos" — nenhuma das 9 grades ramifica por
tipo de empreendimento; os casos de Premissas/Resumo cobrem o ramo Incorporação (o de Loteamento
usa a mesma `.kpis`, mesmo CSS, sem branch de tipo no template).

**Validação:** `bash scripts/validar-frontend.sh` verde — 824 testes de lógica + 53 casos de
render (medido no head do PR, após o merge da `main` que trouxe o PR 620 e seus casos novos),
guards 1-6 e 8 ok, typecheck ok, build ok. Sem migração → `versao` não bumpou.

**Colisão com #578 verificada:** a #578 (listagem de estudos, worktree própria) mexe em
`tela-dashboard.ts`; esta issue não toca esse arquivo — sem overlap de blocos. (#578 mergeou como
#619 enquanto esta sessão estava em andamento — ver a entrada abaixo.)
## #615 · o Loteamento não tem mais fonte legada de preço (2026-08-28)

Residual do achado 1 da auditoria #574, depois de o PR 607 (#570) resolver o caso **com** catálogo.
`estudos.preco_venda_m2` valorava a permuta física do Loteamento pela fonte legada, e o campo **não
tem entrada em tela nenhuma** — o array `PRODUTOS_LOT` que o declarava sobrevive só dentro de
`TODOS_NUM`, para o tipo numérico do Salvar — **nem `padrao` no schema**. Consequência: estudo
criado depois da reestruturação do Preliminar tinha a coluna vazia, a permuta deduzia **área** e não
deduzia **VGV**; estudo antigo, com a coluna preenchida, deduzia. Mesma premissa, resultados
diferentes, sem nada na tela dizendo por quê.

**Decisão do autor (2026-08-28), verbatim:** *"retire isso então"*. Das duas saídas que a issue
listava (dar entrada/`padrao` ao campo, ou declarar a permuta indefinida com aviso), o autor
escolheu uma terceira: retirar o caminho.

**Como ficou.** `precoLot` deixou de existir; `precoR`/`precoNR` são `0` no Loteamento e seguem
legados só na Incorporação. `precoMedioM2` perdeu o ramo `lot` — as duas famílias usam agora
`vgv / areaVendavelLiquida`, e com isso o memo `valorPermutaFisica` e a dedução do VGV passam a
falar o mesmo número (critério 4). `precoSugeridoM2` parou de escrever o campo no override do
Loteamento, que virava movimento de um valor que ninguém lê.

**O campo saiu do `ProformaInput`, e não só do cálculo** — é a defesa que faz a remoção durar:
voltar a lê-lo no motor é `TS2339`, não uma linha que passa na revisão. A coluna continua no
`schema.json` (removê-la é mudança de schema, logo outro escopo) e continua chegando no payload,
inerte.

**Por que zero aqui não é "dedução zerada em silêncio"** (o que o critério 1 proíbe): sem catálogo
efetivo o estudo não tem receita modelada, e desde a #563 a Proforma inteira é estado vazio — sem
VGV, sem tabela e sem o KPI de área permutada ao lado. É a mesma filosofia, no eixo do preço: sem
fonte visível, nenhum número-fantasma. A consequência que sobra — **`permutaCapada` inalcançável
pela fonte legada do Loteamento, por construção** — está **declarada** em
`docs/viabilidade/formulas.md`, que é a saída que o critério 3 oferece.

**Verificação.** 818 testes de lógica pura (baseline da `main`: 815), 42 casos de render, todos
verdes. Mutações medidas: voltar a ler o campo no motor → `TS2339`; restaurar `precoLot` em
`precoR` → **2 vermelhos**; restaurar o ramo `lot` de `precoMedioM2` → **3 vermelhos**.

> ⚠️ **A primeira rodada de mutação deste PR saiu VERDE, e o erro era do teste, não do motor.**
> Restaurar `precoLot` não movia nada porque os casos novos herdavam o fixture `LOT` **sem** a
> coluna legada e **sem permuta física**: `precoLot` dava zero por ausência de DADO, não por
> ausência de CAMINHO. Os testes passaram a injetar a coluna por `as any` — o payload real de um
> estudo antigo — **e** a permuta, que é o multiplicando sem o qual qualquer preço dá zero. É a
> lição da Rodada 9 ("medir o ponto certo") reencontrada pelo avesso: uma medição verdadeira sobre a
> pergunta errada é indistinguível de uma verificação boa.

**Fora de escopo, registrado:** a Incorporação tem a MESMA classe de defeito —
`preco_venda_m2_residencial`/`_nao_residencial` também só sobrevivem em `TODOS_NUM`, sem campo
renderizado —, e lá a fonte legada continua valendo. A assimetria é deliberada (o escopo da #615 é
o Loteamento) e precisa de decisão do autor para ser fechada.

---

## #612 · piso em zero na cascata de áreas do Loteamento (2026-08-28)

Achado 6 da auditoria #574. `calcularCascata` (`frontend/areas-cascata.ts`) subtraía **sem piso**:
deduções somando mais que a poligonal davam Área Líquida de Venda **negativa**, e dela saíam
eficiência negativa, um KPI "Área vendável" em m² negativos e — o pior — infraestrutura no modo
`R$/m²` como **custo negativo**, que reduzia o custo direto e **inflava o resultado**.

**Decisão do autor (2026-08-28), verbatim:** *"Nunca pode ser negativo, não faz sentido ser menor
que zero em nenhum caso."* Das duas alternativas que a issue colocava (piso com aviso × banner de
validação impedindo salvar), o autor escolheu a primeira — a mesma filosofia do cap do VGV da
permuta na #563: **capar e avisar**, com o número honesto na tela.

**Como ficou.** O piso é aplicado na **passada 1** de `calcularCascata`, antes de a linha entrar em
`resolvidosM2` — então é o valor cortado que as linhas seguintes e a âncora 2 enxergam, e o piso
não pode ser contornado por composição. Vale para **todas** as linhas, não só as computadas: um
negativo digitado numa editável também deixa de **inflar** a linha computada seguinte
(`base − (−500)` = `base + 500`, o mesmo defeito pelo avesso). Cada linha devolve em `deficitM2`
(campo **obrigatório** de `LinhaResolvida`) o tamanho do corte; `deficitsDaCascata` filtra pelo
limiar de meio centésimo de m², para resíduo de ponto flutuante não virar banner.

**O aviso** é `urbi-banner.aviso-area-negativa` em Premissas → Terreno & Áreas
(`_renderAvisoAreaNegativa`, `frontend/tela-premissas.ts`), a tela onde se corrige — critério 2 da
issue —, e a linha cortada ganha `tr.deficit` na tabela, para o `0,00 m²` de corte não se confundir
com o de cadastro em branco. **Rodada 1 de revisão (App do Codex + lente):** o aviso passou a ser
das DUAS cascatas — a da Incorporação tem cinco linhas editáveis, e um negativo digitado nelas
também é cortado pelo piso; e o motor (`calcularProforma`) passou a ler as áreas digitadas da
Incorporação pelo MESMO piso (`areaM2`), para tabela e cálculo nunca divergirem. O limiar de corte
virou predicado exportado (`linhaCortada`), usado pelo banner e pela linha `tr.deficit` sem
duplicação.

**Verificação.** 813 testes de lógica pura (+6) e 44 casos de render (+2), todos verdes. Mutações
medidas: apagar `Math.max(0, bruto)` → **5 vermelhos**; apagar `deficitM2` do objeto devolvido →
`TS2322` no typecheck; apagar `${this._renderAvisoAreaNegativa(linhas)}` do template → **813/813
verdes** na lógica pura e **2/2 vermelhos** no render; apagar a classe `deficit` da `<tr>` → o mesmo
placar. É a classe 1 do `CLAUDE.md` (o defeito mora na fiação) exercitada de propósito.

**Achado colateral, NÃO consertado aqui (regra R3).** Este é o primeiro caso de render de
`viab-tela-premissas` montado sobre um **Loteamento**, e ele expôs um defeito de layout que nunca
tinha ido a DOM: `div.area-seletor` (3 badges + `viab-num` de 130px) mede **251px** contra células
de **219px a 600px** e **245px a 900px** — 6 transbordos de caixa e 6 sobreposições do input sobre
a coluna "Área (m²)". A 1280px a tela é limpa. Não é regressão do diff (o piso não move largura
nenhuma) e está declarado no caso de render, com os números medidos. **Vira issue própria.**
## #578 · remover a segmentação "Meus estudos / Equipe" da listagem (2026-08-28)

Item 2 da leva Avançado da Rodada 10. Pedido do autor, literal: "Divisão em Estudos de Meus
estudos e Equipe não faz sentido. Tirar isso e deixar como estava antes, sempre mostra a tabela
com os estudos direto". Os dois chips (`frontend/tela-dashboard.ts`, `_renderEstudos`) escondiam
estudo de outro autor atrás do padrão "Meus estudos" ao abrir a aba — uma peneira só do CLIENTE por
cima do que `GET /estudos` (`backend/rotas/estudos.ts:263-282`) já filtra por membership. Saíram: o
estado `escopo`, o bloco `<urbi-chips-atalho>` e a cláusula `Number(e.autor_id) === Number(eu)` de
`_linhasFiltradas`.

**Regra transversal da leva (autor):** vale para estudo já persistido, não só novo. Como não há
coluna/campo novo envolvido (o filtro era só de apresentação, sem contraparte no schema), não há
migração nem `versao` bumpada — todo estudo antigo já volta a aparecer assim que o filtro de autor
sai, porque o backend sempre devolveu a linha; era o cliente que a escondia.

**Paridade Loteamento↔Incorporação:** a função é ortogonal a `tipo_empreendimento` — mesma tabela,
mesmo filtro para os dois tipos; teste dedicado cobre as 4 combinações de autor × tipo.

**Refatoração de testabilidade:** `_linhasFiltradas` (privado) virou wrapper de
`linhasEstudosFiltradas` (nova, pura e exportada, mesmo padrão de `resumoListagem`/`nivelExibicao`
já estabelecido pela #577) — só assim a remoção do filtro de autor fica testável sem montar o
componente Lit.

**Prova de mutação, controle antes (`frontend/tela-dashboard.test.ts`, 27 testes no arquivo — 8 do
#578 — todos verdes no controle):**

- **Mutação 1 (regra de negócio volta):** reintroduzida a cláusula de autor dentro da função pura
  (parâmetros extras com default, para não quebrar a assinatura da chamada). Resultado medido:
  **20 pass / 7 fail** — os 6 testes de comportamento de `linhasEstudosFiltradas` (segmentação,
  regra transversal, tipo, status, arquivado, paridade) mais 1 acerto incidental do teste de fonte
  (a string `escopo` reapareceu no arquivo pela própria mutação).
- **Mutação 2 (só a FIAÇÃO regride — classe 1 do CLAUDE.md, "o defeito mora na fiação, não no
  cálculo"):** o chip `<urbi-chips-atalho>` com "Meus estudos"/"Equipe" volta ao template, mas
  **sem** tocar `linhasEstudosFiltradas` nem `_linhasFiltradas` (classe UI pura, indistinguível de
  código morto para quem só olha o motor). Resultado medido: **26 pass / 1 fail** — os 6 testes de
  comportamento continuam verdes (a função pura nunca mudou), e só o teste de leitura de fonte
  (`FONTE_DASHBOARD.includes('chips-atalho'/'Meus estudos')`) acusa. Prova que a suíte de função
  pura sozinha NÃO pegaria essa classe de regressão — motivo de ter incluído o teste de fonte
  (técnica de `tela-graficos.test.ts`, comentários removidos antes do `includes`).

Depois de cada mutação, arquivo restaurado do backup (`cp`) e conferido `diff -q` antes de seguir —
controle final: **815 testes de lógica pura + 42 casos de render, 0 falhas**
(`bash scripts/validar-frontend.sh`).

**Caso de render:** não entregue, mesmo motivo estrutural da #577 (critério 5 dela) —
`urbi-tabela`/`urbi-chips-atalho` recebem `colunas`/`linhas`/`opções` por *binding de propriedade*
(`so_propriedade: true`, sem atributo), e o harness de render filtra fora qualquer prop sem
atributo antes de montar o stub (`scripts/render-check.mjs:294`). Como este PR REMOVE conteúdo em
vez de adicionar, um caso de render não teria seletor novo para exigir de qualquer forma — a prova
de "o chip sumiu" é a leitura de fonte acima, não render.

## #574 · auditoria do Preliminar de Loteamento (2026-08-28)

Item 9 da lista de bugs da Rodada 10 — 37 conferências tela a tela e fórmula a fórmula contra
`docs/viabilidade/formulas.md`, com evidência `arquivo:linha` por linha conferida em
`docs/rodada-10/relatorio-574-loteamento.md`. Veredito: **o motor do Loteamento está correto
linha a linha**; o que a auditoria achou é superfície de verificação menor que a da Incorporação
(zero casos de render de Loteamento até este PR) e 11 achados: 2 P1, 5 P2, 2 P3 e 2 registros.

**Consertado no próprio PR:** a pizza "Alocação de áreas da gleba" (`tela-graficos.ts`, ramo
`lot`) lia os 7 campos de "% da gleba" **aposentados pela migração `020`** — estudo novo mostrava
uma fatia só ("gleba 100% vendável"), estudo migrado mostrava a composição congelada de antes da
migração. Agora a composição sai da mesma cascata que Premissas edita, via `itensAlocacaoGleba`
(`areas-cascata.ts`, com `areaTerrenoM2` obrigatório — mutação vira `TS2554`). Junto: a spec de
área do Loteamento em `formulas.md` descrevia a fórmula revogada pela `020` (corrigida) e nasceu
o primeiro caso de render de Loteamento (`alocacao-areas-loteamento`).

**Destinos dos demais achados:** 1 → entregue no PR 607 (#570) com residual na #615; 2 → #609
(duplicar não copia produtos, P1); 3 → #610 (Cenários sem estado vazio); 5 → #611 (eficienciaPct/
roiPct em 0,0% vermelho); 6 → #612 (ALV negativa, exige decisão); 7 → entregue no PR 617 (#572);
8 → #613 (benchmark de eficiência sem medidor); 10 → registro (sinal na exportação, decisão do
autor). A #574 fica aberta de propósito: o critério 3 dela (encerramento da Rodada 10 no mesmo
diff) pertence ao último PR da rodada, com a leva Avançado ainda em execução.

## #572 · ordem das linhas de permuta unificada entre tela e exportação (2026-08-27)

Item 8 da lista de bugs da Rodada 10. Diagnóstico: a tela mostrava "Receita bruta (VGV)" ANTES do
bloco de permuta física ("VGV sem permuta física" + as duas deduções), enquanto a exportação
(CSV/PDF, `frontend/exportar.ts`) já mostrava o bloco de permuta ANTES — lida de cima para baixo,
só a ordem da exportação fecha a identidade real: `VGV sem permuta física − permuta física (R+NR) =
Receita bruta (VGV)`.

**Conserto: a tela passou a seguir a ordem que a exportação já usava** (a exportação não mudou de
ordem — só ganhou o rótulo do achado 7, abaixo). `_linhas` (privado, `frontend/tela-proforma.ts`)
virou uma função pura e exportada, `montarLinhasProforma`, com o bloco de permuta movido para ANTES
do push de "Receita bruta (VGV)". `linhasProformaVisiveis` (nova, exportada) aplica o mesmo filtro
`soLot`/`soInc`/`ocultarSeZero` que `linhasProforma` (exportar.ts) já aplicava internamente —
extraído para não reimplementar o predicado numa terceira cópia; `_renderTabela` chama as duas.

**Nota da auditoria #574, achado 7 — resolvido junto (dentro do escopo desta issue):** a exportação
usava sempre "(-) Permuta física residencial", inclusive no Loteamento, onde a tela já usa
"(-) Permuta física" (sem "residencial") desde a #570. `linhasProforma` (exportar.ts:81-84) ganhou o
mesmo `lot ? … : …` que a tela já tinha — não é rótulo novo, é a exportação parar de divergir.

**Achado 10 da mesma auditoria (notação de sinal da #567 não alcança CSV/PDF, `fmtR$` cru em
`frontend/exportar.ts:137,163`) FICOU DE FORA desta issue** — é consistência de FORMATAÇÃO/sinal, não de
ORDEM, os 4 critérios de aceite da #572 não cobrem isso, e é uma mudança de superfície maior
(toda célula monetária das duas exportações, não só o bloco de permuta). Registrado como
`Sem-fechamento: #574 <achado 10, formatação de sinal fmtR$ cru na exportação — fora do escopo de
ordem da #572>` no corpo do PR; o autor decide se vira issue própria.

**Testes** (`frontend/proforma-ordem-linhas.test.ts`, novo): paridade estrutural tela×exportação
(Incorporação com/sem permuta, Loteamento com permuta) por `assert.deepEqual` da lista de rótulos;
um teste de ORDEM explícito (índice de "VGV sem permuta física" < índice de "Receita bruta (VGV)",
nos dois lados) que é o que pega mutação de reordenação sem depender de mais nada mudar; e a cadeia
aritmética (VGV sem permuta → Receita bruta → Receita líquida → Receita operacional → Resultado)
lida **das próprias linhas** (por rótulo), nos dois lados — não dos campos brutos de `Proforma`.
Mutação verificada manualmente (reverter a ordem em `montarLinhasProforma`): 3 dos 7 testes novos
caem para vermelho (as 2 paridades estruturais com permuta e o teste de índice); os 4 verdes são
os 2 de identidade aritmética (lookup por rótulo, indiferentes a posição), a paridade da fixture
sem permuta (a mutação não a alcança) e o "só filtra, não reordena" — confirma que o teste de
índice é o que prova a fiação da ordem especificamente.
## #573 · indicador de área privativa alocada — produtos × Terreno & Áreas (2026-08-27)

Item 6 da lista de bugs da Rodada 10, aba Produtos. `frontend/proforma.ts` ganha 3 campos
derivados, sempre null-safe: `areaProdutosAlocada` (Σ área média × unidades do catálogo EFETIVO,
Residencial + Não Residencial somados — a mesma soma independente de bucket que
`resumoCatalogoProdutos` usa), `diferencaAreaAlocada` (`alocada − registrada`, SEMPRE definida —
é subtração, não razão) e `pctAreaAlocada` (`null` sem área registrada, nunca "0%" falso — mesmo
padrão de `pctAproveitamentoCoef`, #569). "Registrada" é `areaPrivativa`, a mesma grandeza que o
teto de aproveitamento já usa como "usada" (ALV da cascata no Loteamento; soma das 4 parcelas PVT
na Incorporação) — nenhum campo novo no schema.

`frontend/tela-premissas.ts:_renderAreaAlocada` desenha 3 `urbi-kpi` (alocada / registrada /
diferença) logo abaixo da tabela de Produtos — o KPI de área alocada carrega junto o percentual
(`pctAreaAlocada`) quando há denominador, para o campo derivado ter consumidor de UI (achado da
revisão do PR 616) — com `variante` ecoando o sinal da diferença — em
branco quando tudo alocado, `alerta` quando sobra por alocar, `erro` quando o catálogo excede — e
um `urbi-banner` condicional nos dois estados não neutros. Some da tela só quando os dois lados
estão em zero (estudo recém-criado, nada para comparar ainda); qualquer outro caso — inclusive só
um lado preenchido — desenha.

**Adaptação Loteamento (decisão desta issue, não do corpo original — ele não distinguia os dois
tipos).** A soma R+NR é agnóstica a quantas categorias existem por construção, então nenhum ramo
`lot` foi necessário no motor: o catálogo do Loteamento (bucket único residencial desde o PR 607)
soma do mesmo jeito. Na tela, o rótulo da área registrada ficou genérico ("Área registrada em
Terreno & Áreas", não "privativa de venda") porque o termo "privativa" é da Incorporação — o
Loteamento chama a mesma grandeza de ALV/área vendável. O indicador aparece nos dois tipos.

**Prova de mutação.** Apagar a chamada de `_renderAreaAlocada()` no template: os 3 `urbi-kpi` e o
`urbi-banner` somem do DOM — o caso de render novo (`area-alocada-excedente`) vira vermelho por
seletor ausente, e o caso `catalogo-produtos-tipo` (#565, cujo fixture também fecha em excesso
desde este PR) vira vermelho por "declaração ociosa em `aceitaNaoReproduzido`" — a mesma classe de
prova que `aproveitamento-coeficiente-excedido` usa para o indicador irmão (#569). Nenhum teste de
lógica pura vê o DOM, então a suíte pura sozinha ficaria toda verde com a chamada apagada.

Testes de lógica pura em `frontend/proforma.test.ts` (`#573: ...`): alocada == registrada
(diferença zero, 100%), excesso (diferença positiva), sobra (diferença negativa), sem NADA
registrado (percentual `null`, diferença ainda definida), catálogo e registro ambos zerados
(diferença zero, percentual `null`), e o caso Loteamento (ALV × catálogo bucket único).

**Efeito colateral em teste existente.** O fixture do caso de render `catalogo-produtos-tipo`
(#565) aloca 7.160 m² contra 4.960 m² registrados no `ESTUDO` base — excesso não intencional pelo
próprio propósito daquele caso, mas real: o `urbi-banner.aviso-area-alocada` passou a aparecer ali
também, e a lista `aceitaNaoReproduzido` ganhou `urbi-banner.variante` para não falsear o veredito.

## #577 · A listagem de Estudos mostra Preliminar/Avançado (2026-08-27)

Item 1 da leva Avançado da Rodada 10. A tabela do Painel já **sabia** o `nivel_analise` de cada
linha — usava para escolher a fórmula de VGV/Margem (`numeroTitulo`, `frontend/tela-dashboard.ts`)
— mas só expunha isso via `title` (tooltip nativo), invisível sem passar o mouse. Coluna nova
"Nível" entre `status` e `area_terreno`, badge `Preliminar`/`Avançado` (mesmo padrão de badge da
coluna `status`), sem `largura` fixa — segue o mesmo auto-dimensionamento das outras colunas de
badge/texto da tabela (só `imagem` fixa largura, por ser miniatura quadrada).

**Critério 2 (ambiguidade de nome) — decisão tomada, não deixada em aberto:** a issue propunha duas
saídas e pedia confirmação do autor; escolhi a proposta principal dela mesma, por ser a menos
invasiva e a que o próprio diagnóstico já defendia — coluna nova = "Nível", filtro existente
(que filtra `tipo_empreendimento`, não `nivel_analise`) renomeado de "Tipo de estudo" para "Tipo de
empreendimento" (`frontend/tela-dashboard.ts`, `_renderEstudos`). Os dois deixam de ser homônimos.

**Critério 3 (estudos existentes):** sem migração — `nivel_analise` já tem `padrao: "preliminar"`
no schema, e uma linha antiga sem o campo explícito lê "Preliminar" pela nova função pura exportada
`nivelExibicao(l)`, o mesmo default que `resumoListagem` já assumia para escolher o motor. `versao`
do manifesto **não bumpa** (sem migração, como a issue previa).

**Critério 4 (paridade):** a coluna é sobre `nivel_analise`, ortogonal a `tipo_empreendimento` — é
a MESMA `_colunas()`/tabela para Loteamento e Incorporação, então as 4 combinações resolvem pela
mesma função. Teste dedicado cobre as 4 (`frontend/tela-dashboard.test.ts`).

**Critério 5 (render case) — declarado, não entregue, com motivo estrutural:** `urbi-tabela` recebe
`colunas`/`linhas` por *binding de propriedade* (`so_propriedade: true`, sem atributo —
`docs/ui-urbiverso/primitivos.json`); o harness de render só desenha texto para props `rotulo`/
`valor` (`scripts/render-check.mjs:216`) e filtra fora qualquer prop sem atributo antes mesmo de
gerar o stub (`:294`, `p.props.filter((x) => x.atributo)`). Um caso de render aqui montaria um
`<urbi-tabela>` de caixa vazia — não desenha nenhuma célula, badge ou coluna — provando zero sobre
overflow de largura. **Nenhum caso hoje exercita `urbi-tabela`** (`tabela-fluxo.ts` mede
`viab-fluxo-ver`, que usa `<table>` HTML crua, não o primitivo); criar esse suporte no harness é
mudança de infraestrutura de teste, fora do escopo de uma coluna nova (R3). Mitigação: sem
`largura` fixa (mesmo padrão das outras colunas de texto/badge da tabela — nenhuma delas tem caso
de render hoje).

**Prova de mutação, nos dois sentidos:**
- Lógica: invertendo o `? :` de `nivelExibicao`, **6 dos 19 testes de `tela-dashboard.test.ts`**
  ficam vermelhos.
- Fiação: apagando o bloco da coluna nova dentro de `_colunas()` (privado, só alcançável com o
  componente montado em DOM — que os testes deste arquivo, por convenção do próprio arquivo
  (`resumoListagem` já é assim), nunca fazem), a suíte inteira continua com os **19 verdes** — é a
  classe 1 de defeito que o `CLAUDE.md` nomeia, e a defesa aqui não existe além da revisão visual do
  diff (2 linhas de mudança, adjacentes ao ponto testado): a issue #577 não cria nenhum mecanismo
  novo de wiring que caiba num parâmetro obrigatório, e o caso de render que pegaria isso não
  fecha, pelo motivo do critério 5.

`bash scripts/validar-frontend.sh` verde (controle e final). Sem migração, sem toque em backend —
`validar-backend.sh` não roda. `frontend/proforma.ts`, `tela-proforma.ts`, `tela-premissas.ts` e
`exportar.ts` (fila de merges do Preliminar) não foram tocados — nenhum critério desta issue
exigia.

## #597 · A corrida de carregamento em Proforma e Premissas (2026-08-27)

Achado colateral da revisão do PR 580 (#563): `tela-proforma.ts:_init()` e
`tela-premissas.ts:_init()` marcavam `_idCarregado` **antes** do `await` e gravavam
`benchmarks`/`aliquotaRet`/`produtos` sem reconferir o id ao voltar — mesma classe de defeito que
`tela-graficos.ts` teve. Navegar do estudo A para o B antes de A responder deixava a resposta
atrasada de A sobrescrever o estado de B em silêncio; em Premissas era pior, porque a tela é
editável e um Salvar em cima do estado misturado grava o catálogo errado.

Conserto: reuso de `respostaAindaVale` (`frontend/viab-imagem-principal.ts:41`), o mesmo padrão que
`tela-graficos.ts` já usa — importada, não recopiada. Guarda nos dois pontos de escrita (sucesso e
`catch`, seguindo os três pontos de `viab-imagem-principal.ts:_carregar()`) e `produtos` limpo na
troca de estudo, para o catálogo de A não continuar na tela durante o carregamento de B.

**Varredura do padrão (critério 6 da issue):** as 4 telas com `_idCarregado` no repo são
`tela-graficos.ts` (já corrigida, PR 580), `tela-financeiro.ts` (`_init()` **síncrono**, sem fetch —
sem risco de corrida) e as duas corrigidas aqui. Nenhuma outra tela usa `_idCarregado`.

**Teste da corrida** (`frontend/carregamento-corrida.test.ts`, novo): sem harness de DOM neste repo,
o teste chama `_init()` diretamente nas duas classes reais (`ViabTelaProforma` incorporação,
`ViabTelaPremissas` loteamento — um estudo de cada tipo, critério 8), com `urbiVerso.api` mockado
por promises controláveis. Resolve o estudo B primeiro, depois A com valores diferentes, e confirma
que `produtos`/`benchmarks`/`aliquotaRet` continuam os de B. Mais um par de testes por tela cobrindo
o `catch` guardado. **Prova de mutação (critério 5):** removida cada uma das 4 guardas (sucesso e
catch, nas duas telas) manualmente, uma de cada vez — as 4 mutações deixaram exatamente o teste
correspondente vermelho, suíte restaurada e reconferida verde depois. `docs/viabilidade/formulas.md`
e `frontend/premissas-conversao.ts` tiveram citações `arquivo:linha` corrigidas (deslocadas pelo
diff, acusadas pelo `guard-enderecos-doc`).

Sem mudança de schema/migração — `versao` não bumpou.

## #570 · permutas Física e Financeira sobre o total de CADA categoria (2026-08-27)

Item 3 da lista de bugs da Rodada 10, e o fim do interim que a #315 deixou aberto. Com a
classificação R/NR da #565 no lugar, `frontend/proforma.ts` passou a ler o catálogo **por
categoria** (`totaisPorTipoProdutos`, exportada e testada): VGV, área total, preço médio ponderado
(`Σ VGV ÷ Σ área`) e nº de unidades de cada `tipo`. Sobre esses totais incidem as três coisas que
antes olhavam para a fonte errada:

- **VGV** — `vgvNaoResidencial` era **0 por construção**; agora é o VGV das linhas
  `nao_residencial`, líquido da permuta física delas. `numUnidadesNaoResidencial` idem (o preço
  médio NR aparecia zerado ao lado de um VGV NR que existia).
- **Permuta física** — `% área venda` converte sobre a área do catálogo da categoria (era
  `area_pvt_*_fechada`), e os m² entregues são valorados pelo **preço médio da categoria** (era
  `preco_venda_m2_*`, campos sem tela desde a reestruturação do Preliminar).
- **Permuta financeira** — o `%` NR incidia sobre zero: campo aceitava valor e não deduzia nada.
  É o defeito nominal do item 3.

**Decisão registrada: o cap da permuta física é POR CATEGORIA.** Cada uma capa no VGV bruto da
própria categoria, sem corte proporcional entre as duas — o corte proporcional da #563 existia
porque o cap era global sobre um bucket único, e mantê-lo deixaria o excedente de uma categoria
comendo o VGV da outra, destruindo a base que a permuta financeira daquele tipo precisa. Cada VGV
é o resíduo da sua base quantizada menos a sua permuta quantizada, então as duas identidades por
categoria fecham ao centavo por construção (a invariante da #563, agora em dobro).

Consequência intencional de leitura: no modo `% área venda` o cap deixou de ser alcançável abaixo
de 100%, porque o `%` incide sobre a mesma área que dá o preço médio. O cap segue guardando o modo
m² absoluto, o canônico e o fator de sensibilidade.

**Fonte legada intacta.** Sem catálogo efetivo (`semProdutos`) nada muda: bases e preços legados
como estavam, sem fallback em nenhum dos dois sentidos — a mesma decisão da #315.

**Fiação da tela (critério 5).** `_ctxConversao` de `frontend/tela-premissas.ts` montava o ctx à
mão e lia os campos legados nas duas bases de área — a badge convertia sobre uma base e o motor
calculava com outra. A tradução virou `ctxConversaoPreliminar(p)`
(`frontend/premissas-conversao.ts`), pura, alimentada por duas saídas novas do motor
(`areaBasePermutaResidencial`/`areaBasePermutaNaoResidencial`).

`avisoPermutaCapada` (`frontend/exportar.ts`) foi reescrito: a frase dizia "a receita bruta do
catálogo é X" com X = permuta efetiva, o que só era verdade sob o cap global. Com uma categoria
capando e a outra não, X é menor que o bruto — a frase passou a dizer "a permuta considerada é X"
e a declarar a regra do cap por categoria.

**Prova de mutação.** Controle pós-reconciliação: **771/771 + 39/39 render**. As cinco medidas
abaixo são anteriores ao merge da #568, sobre o glob de então (`frontend/*.test.ts`, 729 testes) e
o controle de então (756/756 + 37/37); a sexta, do ponto de encontro, está no parágrafo acima: neutralizar a separação por categoria → **17 vermelhos**; preço da permuta de volta
ao campo legado → **10**; base de área de volta ao campo legado → **5**; cap de volta a global →
**4**. A quinta é a que só a fiação pega: reverter `_ctxConversao` para o objeto literal deixa
**728 verdes e 1 vermelho** — o teste de fonte de `frontend/premissas-conversao.test.ts`, a única
camada que enxerga "a tela parou de chamar".

**Reconciliação com a #568** (PR 606, mergeado enquanto esta branch estava aberta). Os dois PRs
reescrevem o mesmo trecho do motor, e o acordo é a ORDEM das operações:
`catalogoEfetivo` → `aplicarFatorPreco` (fator clampado em 0 **na fonte**, invariante da #563) →
`totaisPorTipoProdutos` → permutas e cap por categoria. Duas consequências, e as duas viraram
código:

1. `totaisPorTipoProdutos` **deixou de filtrar** — passou a ter o contrato de `totalProdutos`, e
   quem filtra é `calcularProforma`, uma vez, ANTES de reprecificar. Refiltrar depois faria um
   fator 0 zerar os preços, derrubar as linhas no filtro e a categoria perder suas unidades só
   naquele cenário, enquanto `numUnidades` continuaria certo.
2. `precoPermuta*` **NÃO reaplica** `fatorSens('preco')`: `precoMedioM2` sai do catálogo já
   reprecificado, e reaplicar elevaria o fator ao QUADRADO — a permuta escalaria mais rápido que a
   própria base e o cap quebraria. Pela fonte legada (`semProdutos`) o fator entra em
   `precoR`/`precoNR`, como a #568 deixou.

Um teste novo mede só a interação (`#568×#570`, cenário Bear sobre catálogo misto com permuta nas
duas categorias): os dois VGV brutos por categoria escalam pelo fator, a permuta de cada uma escala
**uma vez só**, as duas identidades de cap fecham ao centavo dentro do cenário, a proporção
permuta ÷ base não muda de cenário, e com fator 0 a contagem por categoria sobrevive. Mutação no
ponto de encontro (`porTipo` calculado sobre o catálogo SEM fator): **8 vermelhos em 744** — o
teste novo mais cinco da própria #568, que é o sinal de que as invariantes das duas issues passaram
a se sustentar na mesma linha.

**Conserto da rodada 1 de revisão (P1) — o Loteamento não tem categoria NR.** A separação nova
movia para o bucket NR o produto que alguém marcasse "Não Residencial" no grid, mas a tela de
Permutas do Loteamento só expõe os controles **residenciais** e `areaBasePermutaNaoResidencial` é
zero por construção lá: o produto saía da única base editável, a permuta física passava a
ignorá-lo e o `%` financeiro incidia só sobre o resto — dedução subestimada em silêncio. Consertado
nas **duas pontas**, para UI e motor andarem juntos: o motor normaliza o catálogo do Loteamento
para o bucket residencial antes de separar, e o grid de Produtos deixa de desenhar a coluna "Tipo"
quando o estudo é Loteamento (controle cuja escolha o cálculo ignora não pode ficar editável). O
campo continua no schema e no backend — só não é editável nem exibido ali.

As colunas do grid viraram `colunasProduto(lot)`, exportada, e dela saem `colgroup`, cabeçalho,
corpo e linha de Total — a contagem de células não desalinha por esquecimento de um dos quatro. A
**ausência** de coluna não é provável pelo harness de render (ele só sabe exigir presença), então a
prova mora em teste de unidade sobre a lista, como a #566 fez com `opcoes`. `lot` e `colunas` são
parâmetros **obrigatórios**: apagar o argumento dá `TS2554` (medido).

**Interação com a auditoria do Loteamento (#574), medida na `main` sem este diff.** Lá a permuta
física do Loteamento é valorada por `precoLot = n(e.preco_venda_m2)`, e `estudos.preco_venda_m2`
não tem campo em tela nenhuma nem `padrao` no schema — Loteamento novo tinha permuta que reduzia
área e **não** reduzia VGV. Com catálogo, este diff conserta isso: o preço passa a ser o médio do
catálogo. Teste novo com o campo legado **ausente** do fixture (o `LOT` declara `preco_venda_m2:
1000`, e foi por isso que o defeito atravessou as suítes). Sem catálogo o comportamento continua o
da `main`, sem fallback — o residual é issue própria.

**E a base da ÁREA no Loteamento voltou a ser a ALV da cascata.** A troca de base para o catálogo é
semântica da **Incorporação** (critério 2 da #570): no Loteamento o `%` sempre incidiu sobre a área
loteável, que é grandeza do terreno. As duas fontes convivem lá de propósito — **área** da cascata,
**preço** do catálogo —, e há teste com catálogo de área diferente da ALV para a asserção não ficar
ambígua.

**Sem backend, sem schema, sem migração** — a coluna `tipo` já existia (#565), então a `versao` do
manifesto não bumpa. ⚠️ Fica um comentário obsoleto em `backend/rotas/preliminar-produtos.ts:19-21`
("o motor da Proforma ainda não lê este campo"): não foi tocado porque o escopo da issue exclui
`backend/`, e mexer ali arrastaria a validação de backend, que não roda nesta sessão (SDK 401).

---

## #568 · A sensibilidade alcança o catálogo de Produtos (2026-08-27)

Quarta issue do Trilho A da Rodada 10. `fatorSens('preco')` escalava só os campos legados
`preco_venda_m2*` — que desde a #563 sobraram como preço da **permuta física** —, então com
catálogo presente (o caso normal) Bear/Base/Bull saíam com o **mesmo VGV**. `aplicarFatorPreco`
reprecifica o catálogo efetivo dentro de `calcularProforma`; a filtragem vem **antes** da
reprecificação, para `semProdutos` continuar sendo fato cadastral e não do cenário. Base e permuta
escalam pelo mesmo fator, então o cap do excedente (#563) e os indicadores indefinidos (#571) não
mudam de veredito por causa do cenário.

Junto, o critério 4 da issue: a tabela de cenários formatava com `fmtR$` cru e discordava da tabela
principal sobre a mesma grandeza — passou a usar `celulaSensibilidade`, que **é** `celulaProforma`.

**Rodada 1 de revisão, 1 bloqueante (P2):** o benchmark aceita `variacao_negativa_pct > 100` e a
tela deriva `1 − varNeg/100`, então o Bear podia pedir fator **negativo** — catálogo reprecificado a
preço negativo, VGV bruto negativo, e o cap escolhendo `Math.min(0, negativo)`: a tela mostrava
"VGV" negativo com "Receita bruta" zero, violando o invariante da #563. Piso em 0 aplicado **na
fonte** (`fatorSens`), não dentro de `aplicarFatorPreco`: só na fonte o catálogo e a valoração da
permuta legada recebem o MESMO fator e a identidade do cap continua valendo por construção.

Fixture dourado único (`frontend/fixtures/sensibilidade-catalogo.ts`, VGV do print:
R$ 24.764.117,40 → Bear 22.287.705,66 / Bull 27.240.529,14) servindo motor, notação e o **primeiro
caso de render da sub-aba Cenários** — antes dela `secao: 'cenarios'` nunca tinha sido montado em
Chromium. Medido: neutralizar o fator no motor deixa 6 testes vermelhos; quebrar `_aplicarFator` na
tela deixa os **747 testes de lógica pura verdes** e derruba só o caso de render novo.

---

## #566 · fim da permuta física por seleção de unidade (2026-08-27)

Item 4 da lista de bugs da Rodada 10. A opção "Unidade" (seleção de produto do catálogo +
quantidade, #317) saiu da Permuta física nos dois padrões — Loteamento (`PERMUTA_UNIDADE`) e
Incorporação (`PERMUTA_FIS_R`/`PERMUTA_FIS_NR`, `frontend/tela-premissas.ts`); só `m²` e `% área
venda` sobrevivem. Removido junto: `_campoProdutoQuantidade`/`_editarPermutaProduto` (handlers),
o desvio de render que os chamava, o campo `produto?` da interface `CustoUnidade`, e o CSS
`.cu-produto`. `schema.json` encolheu `opcoes` de `permuta_fisica_modo`/`permuta_fisica_nr_modo`
para `["area_m2","pct_area_venda"]`; as colunas `permuta_fisica_produto_id`/`_quantidade` (e o par
`_nr_`) ficam **inertes** — sem leitor, sem escritor — porque remover coluna é mudança de schema
fora deste escopo (`scripts/guard-tabelas-obsoletas.mjs` não as alcança: o registro dele é por
TABELA, não por coluna).

Migração **`036_fim_permuta_unidade.js`** converte todo estudo com `permuta_fisica_modo`/
`permuta_fisica_nr_modo === 'unidade'` para `'area_m2'`, usando o m² já resolvido no campo
canônico (`permuta_fisica_area_canonica`/`_nr_area_canonica`) — mesmo padrão de backfill de
`015`/`021`. Bump `manifesto.json` `0.1.34 → 0.1.35`.

Estudo salvo ANTES da migração rodar não quebra a tela: nova função pura exportada
`modoEfetivo(cu, valorForm)` trata modo persistido ausente de `cu.opcoes` (o `'unidade'`
aposentado, ou qualquer valor desconhecido) como o `padrao` do campo — a badge cai em `area_m2` e
o valor mostrado vem do canônico, sem indexar `opcoes` fora do array.

**Prova de mutação, nos dois sentidos que a issue exigia:**
- Migração: neutralizando as duas condições `=== 'unidade'` em `036_fim_permuta_unidade.js`, a
  asserção nova de `scripts/migracoes-harness.mjs` (adicionada junto com uma 2ª linha na fixture
  `SEED.estudos`, id 2, com os dois modos em `'unidade'`) fica vermelha — harness confirmado
  36/36 com a migração restaurada.
- Frontend: reintroduzindo `{ valor: 'unidade', ... }` em `PERMUTA_UNIDADE.opcoes`, 2 dos 4 testes
  novos de `frontend/tela-premissas.test.ts` (que importa `PERMUTA_UNIDADE`/`PERMUTA_FIS_NR`/
  `modoEfetivo`, agora exportados) ficam vermelhos; restaurado, 4/4 verdes. Não existe caso de
  render (Chromium) para a badge sumida — o harness de render deste repo só suporta
  `exigir`/`minimo` (prova de presença, nunca de ausência ou contagem exata), então não dá para
  provar mecanicamente "só 2 badges, não 3" por ali; o teste de unidade sobre o array `opcoes` é
  a prova robusta, porque é o MESMO objeto que o template consome (`cu.opcoes.map(...)`) — sem
  gap de fiação possível entre o array e o que renderiza.

`bash scripts/validar-frontend.sh` (8/8) e `node scripts/migracoes-harness.mjs` (36/36) verdes.
Backend/schema não têm typecheck neste ambiente (401 do SDK) — migração `036` real em Postgres
fica para o autor, como todas as anteriores.

---

## Rodada 10 aberta · lista de bugs dos estudos Preliminares (2026-08-26)

O autor enviou `lista_bugs_20260826.xlsx` com 9 itens sobre os estudos Preliminares — 8 de
Incorporação (Premissas: Terreno & Áreas, Produtos, Permutas; Resultado: Proforma e Cenários) e 1
de conferência geral de Loteamento — mais 2 screenshots de produção com a Proforma e a Análise de
sensibilidade erradas. As abas `#38/#39/#45` da planilha são resquícios (decisão do autor); a
`#43` (prints da EVI "PROFORMA INCORPORAÇÃO") é gabarito de cálculo.

**O diagnóstico que abriu a rodada:** o motor não erra a aritmética — o estudo do screenshot tem
**VGV negativo** (catálogo de Produtos presente porém vazio zera a base e a permuta física deduz
sem trava) e a tela imprime módulo nas linhas de receita, o que fabrica a leitura "custo somado em
vez de subtraído". Os "—" da coluna % VGV e os 0,0% dos badges são o mesmo `vgv ≤ 0`. Defeito
independente: o fator da sensibilidade não alcança o catálogo de Produtos — estressar Preço/m² não
move o VGV. Detalhe completo, com evidência, nas issues.

**As 12 issues:** #563 (fonte do VGV/estado vazio/negativo, P1), #567 (notação contábil da tela,
P1), #571 (indefinido ≠ 0,0%, P1), #568 (sensibilidade×catálogo, P1), #572 (ordem tela×export,
P2), #564 (cascata de áreas Incorporação, P2), #569 (indicador de aproveitamento, P2), #565
(classificação R/NR nos produtos, P2 — migração 035), #566 (fim da permuta por unidade, P2 —
migração 036), #570 (permutas por categoria, P2), #573 (área alocada nos produtos, P3), #574
(conferência Loteamento + encerramento, P2). Mapa item→issue e fila de PRs em
`docs/rodada-10/planejamento.md`.

**Decisões do autor (2026-08-26, vinculantes):** VGV nunca negativo (excedente de permuta capado
com aviso); estudo sem produto mostra estado vazio explícito; rótulos da Proforma mantidos como
estão (Loteamento e Incorporação); merge autorizado à sessão, em fila, por PR revisado com zero
bloqueantes; revisão via `@codex review` em todo PR (a conexão existe segundo o autor — o primeiro
PR testa na prática).

Fora do escopo da rodada, seguem abertas de antes: #504, #512, #514, #515.

---

## Onda 1 · A referência de UI do urbiverso vira artefato deste repositório (2026-08-23)

Primeiro PR da onda que existe para fazer correção visual ser **verificável**. Este entrega a
**referência**; os guards e o render-check vêm nos dois seguintes.

### O impasse que ele resolve

A fonte canônica de props `urbi-*` e de tokens é o **bundle do SDK**, e aqui ele **não existe** —
GitHub Packages privado, 401 no `pnpm install` e no `npm view`. Isso já era sabido. O que não estava
escrito é o efeito composto:

- a referência virava **leitura ad-hoc** — um agente abre `ui/src/`, confere uma prop, e o
  conhecimento morre com a sessão;
- a skill de revisão **proíbe** ler o monorepo para compensar a falta do bundle, e **com razão**: o
  `main` está à frente do publicado, e validar contra ele faz a revisão *passar* citando contrato que
  a instância não tem;
- resultado: a lente de UI marcava **NÃO EXECUTADA** em toda revisão, e ninguém cobrava, porque a
  marca parecia normal.

`docs/ui-urbiverso/`, gerado por `scripts/sincronizar-referencia-ui.mjs`, quebra o impasse: a leitura
do monorepo vira **um passo explícito e auditável** — a execução do script, revisável no PR — e o
resultado é **conteúdo deste repositório**. Quem revisa lê daqui, o que respeita a letra da proibição
sem ficar cego.

⚠️ **Ele fecha o eixo do recorte, não o do tempo.** O espelho sai da `main`; a pergunta *"isso está
publicado?"* continua sendo pergunta ao autor. Por isso tudo carrega **carimbo de SHA e data**, e o
`LEIA.md` obriga a citá-lo em qualquer achado.

### O que ele já provou, sozinho

Na primeira execução, o gerador acusou:

```
atenção: padding/border no :host sem box-sizing → urbi-kpi
```

É **o mecanismo exato** do defeito reportado quatro vezes (#176, #262, #326, #352), fechado quatro
vezes, e vivo — agora recuperado como **#488**. Levou cinco passadas humanas para alguém ler a cadeia
do shadow DOM à mão e achar. O espelho acusa **mecanicamente**, em um segundo, e vai continuar
acusando enquanto a plataforma não declarar `box-sizing: border-box` no `:host` do primitivo.

### Detalhes que custam tempo se forem redescobertos

- **`atributo` ≠ `propriedade`.** Vários primitivos declaram `attribute:` e renomeiam — `caixaAlta`
  vira `caixa-alta`. Escrever o nome errado **não dá erro**; o atributo só não faz nada.
- **O parser tira comentário de bloco antes de extrair.** Sem isso, o exemplo de uso no JSDoc de
  `urbi-primitivo-conteudo.ts` — que declara um `export class UrbiMeuWidget` fictício — era capturado
  como se fosse a classe base real, e o **`:host` herdado sumia do espelho**. Justamente o `:host`
  que diz se existe `box-sizing`.
- **Determinístico por SHA:** a data vem do commit do monorepo, não do relógio. Rodar o script duas
  vezes sem o monorepo mudar produz **diff vazio** — ressincronizar sem motivo não suja PR.
- Espelha só os **29 primitivos que o frontend usa**, não os 89 do monorepo. Espelho que ninguém lê
  não protege ninguém.
## As três regras de escopo viram contrato, e a maquinaria de revisão fica pronta (2026-08-23)

PR de processo puro, feito **numa passada só** — que é o que a regra que ele institui manda fazer.
Fecha a **#495** e resolve o que o incidente do PR 494 apurou.

### O que muda para toda sessão futura, em qualquer conversa

As três regras entraram no **`CLAUDE.md` § Processo obrigatório**, e não só no `PROGRESSO.md`. A
diferença importa: o `CLAUDE.md` é lido no começo de **toda** sessão deste repositório; o
`PROGRESSO.md` é memória que alguém precisa abrir.

| | Regra | Como se sustenta |
|---|---|---|
| **R1** | Mudança de processo não entra em PR sob revisão | **Guard no CI** — `scripts/guard-pr-escopo-processo.mjs`, job `escopo-processo` |
| **R2** | O ciclo fecha por convergência: zero bloqueantes pendentes, sem teto de rodadas | Prosa — não é decidível por caminho de arquivo |
| **R3** | Um assunto por PR | Prosa, com a exceção declarada do PR único de documentação (D-Q04) |

O guard da R1 barra o PR que misture `.claude/**` com `frontend/`, `backend/`, `migracoes/`,
`schema.json` ou `manifesto.json`. **O `CLAUDE.md` ficou de fora da lista de propósito:** a regra
vale para uma seção dele, o guard só enxerga caminho de arquivo, e marcá-lo inteiro barraria todo PR
que documenta a própria mudança — que é o que a convenção do monorepo exige. Guard que atrapalha
trabalho legítimo é guard que alguém desliga.

`guard-processo.mjs` passou a exigir o script novo: **20 verificações**, não mais 19.

### A maquinaria de revisão, com os sete consertos da #495

Todos já tinham sido escritos e revisados dentro do PR 494 e foram **revertidos de propósito** —
agora voltam num diff só, com os quatro documentos propagados juntos:

1. **Colisão das duas `revisar-pr-apps`** — desempate **material**, no `CLAUDE.md`, a única
   superfície que nenhuma skill sombreia. ⚠️ A solução óbvia (conferir
   `git rev-parse --show-toplevel`) **não funciona e está registrada como reprovada**: carregar a
   skill do monorepo não muda o diretório da sessão, então a cópia errada passa no teste; e o aviso
   mora na cópia que não é lida quando a outra é servida.
2. **Caminho de recuperação derivado**, nunca cravado — o checkout do Codex fica em `/workspace/…`.
3. **O GitHub App do Codex documentado** no `motor-revisao.md`, que só conhecia o CLI local.
4. **Sequência obrigatória do App** — marcar a linha de base **antes** de acionar, esperar review
   posterior a ela *e* no head certo, colher os threads, verificar, só então atestar.
5. **Timeout deixa o portão vermelho** — `bloqueantes=1`. ⚠️ Omitir a linha de máquina **não serve**,
   e isso também está registrado como reprovado: o job varre todos os comentários do head e
   republica um `success` anterior.
6. **App e fan-out são duas camadas que somam.** O condicional é CLI × nativo, dentro da fan-out.
7. **Nada de contador do estado corrente da revisão** dentro do artefato revisado.

### Por que isto é um PR separado

Porque é literalmente a regra R1. Os arquivos de `.claude/` se referenciam, então toda regra nova
precisa aparecer em todos, e o revisor acusa — com razão — cada um que ficou para trás. Editá-los de
dentro de um PR em revisão produz um ciclo que **não converge por construção**: cada conserto vira o
achado da rodada seguinte. Num PR só, propagados juntos, o ciclo tem onde fechar.

---

## Rodada 9 aberta — e o Bloco 8-A, que a Rodada 8 perdeu no caminho (2026-08-23)

A Rodada 8 fechou em 2026-08-22 com **19.931 linhas** de auditoria em `docs/rodada-8/`, **61 issues** e
**zero linhas de código de app** (o autor autorizou 3 consertos e reverteu; a árvore ficou idêntica à
`main`). Duas issues fecharam por decisão — #461 (D13, fora de escopo) e #480 (D11, sem interruptor)
—, restando **59 abertas**. Ela **não escreveu nada aqui**: `grep "Rodada 8" PROGRESSO.md` dava zero.

### O achado que abriu esta rodada

🔴 **Seis issues foram escritas e nunca criadas.** O `07-consolidado-issues.md` redigiu o **Bloco
8-A** — a dívida da Rodada 7 — completo: título, corpo, mecanismo em `arquivo:linha`, critério de
aceite. **Nenhuma entrou em `25-issues-final.md`**, que é o arquivo que alimenta
`scripts/criar-issues-rodada-8.mjs`. Conferido título por título: `fix(resumo): urbi-kpi` → 0
ocorrências no arquivo final, `fix(proforma): sensibilidade` → 0, `Data de início por mês` → 0,
`larguras da tabela` → 0, `Exposição máxima coerente` → 0. As 59 abertas eram só o Bloco 8-B.

A causa é uma linha de resumo. `LEIA-PRIMEIRO.md` dizia *"8 **não se sustentam** (2, 11, 15, 17, 22,
24, 31, 41)"*, que se lê como "o bug relatado não existe". Os vereditos individuais dizem outra
coisa: `01-verificacao-47-itens.md:199` (item 17) tem título "NÃO SE SUSTENTA" e corpo que prova o
**oposto** — o bug é real, com conserto de uma linha; o que não se sustenta é a **correção da #326**.
Idem `:254` item 24 ("PARCIAL — reaberto"), `:405` item 22, `:435` item 31, `:137` item 11
("parcial"). **Nenhum é "o bug não existe".**

O custo: entre as seis está a do `urbi-kpi` sobrepondo, que o autor reportou em **#176 → #262 → #326
→ #352** — quatro issues fechadas, o bug vivo, e na quinta passada a issue sumiu do backlog. A queixa
dele de que *"issues visuais nunca são realmente resolvidas"* estava literalmente certa: não estavam
na lista.

Recuperadas como **#488–#493**. Correção da linha de resumo e apêndice novo em `25-issues-final.md`
na mesma alteração.

> **Lição:** um resumo que colapsa *"a correção falhou"* em *"o pedido não procede"* apaga trabalho —
> e apaga **calado**, porque ninguém confere um balde de 8 números contra os 8 vereditos que ele
> resume. Vale para todo balde: quem escreve o resumo carrega a semântica de cada item, ou não
> agrupa.

### O mecanismo do `urbi-kpi`, finalmente escrito

`urbiverso/ui/src/urbi-kpi.ts:41-46` põe `padding: 14px 16px` + `border: 1px` no `:host` e **não**
declara `box-sizing: border-box`. A cadeia inteira foi conferida e não há reset em lugar nenhum:
`UrbiPrimitivoDeConteudo.estiloConteudo` (`urbi-primitivo-conteudo.ts:39-48`) só traz
`display`/`flex-direction`/`min-height`; a única ocorrência no arquivo está em `:81`, dentro de
`.estado-erro`, e não alcança o `:host`; `compartilhado/tokens.css` não tem reset global.

`box-sizing` não é herdado. Logo `tela-resumo.ts:67` (`.kpi-cel urbi-kpi { width: 100% }`) define
largura de **conteúdo**, e a caixa mede `100% + 32px + 2px`. O Preliminar acerta porque
`tela-proforma.ts:53` usa **só** `min-width: 0` — grid `stretch` dimensiona a **border box**. O autor
já tinha dado o gabarito: *"nos estudos Preliminares isso já está certo"*.

Duas agravantes de método: o commit `bd1244e` **nomeia o mecanismo na mensagem** e mantém o
`width: 100%`; e o comentário `tela-resumo.ts:63-65` chama `fluxo-tabela.ts:73-74` de "padrão já
comprovado" quando aquele código **não usa `urbi-kpi`** — é uma `<div>` do próprio app. Um `div` da
sua folha é caixa que você controla; um custom element com `:host` estilizado no shadow DOM não é.

### O que mudou de ambiente, e derruba a decisão D4

A D4 da Rodada 8 dizia *"erros visuais sem navegador — não proponha usar browser"*. Ela foi tomada
descrevendo a máquina Windows do autor. **Nesta sessão de nuvem não vale:** Chromium e Playwright
estão instalados (`/opt/pw-browsers/chromium`), e o repositório **já tem**
`scripts/render-check-cronograma.mjs` usando os dois desde a #245. Medido em 2026-08-23: passa verde
na `main` e **sai com código 1** sob regressão injetada (`--largura 148px`). E ele **nunca rodou no
CI**: na `main`, `git grep -n "render-check" -- '*.sh' '*.yml' '*.json' '*.md'` devolvia **zero
ocorrências** — nenhum script de validação, workflow ou doc o invocava.

O autor autorizou o caminho. A Rodada 9 generaliza aquele script; hoje são **408 testes de frontend e
zero tocam DOM**, então um bug de CSS atravessa grep + JSON + tsc + `node --test` + esbuild e sai com
"✅ Frontend validado".

### Baseline medido nesta sessão (números da doc estavam desatualizados)

| | Doc dizia | Medido |
|---|---|---|
| testes de frontend | 411 | **408** |
| testes de backend | 104 | **101** |
| `pnpm` existe? | "NÃO existe nesta máquina" | **existe** (`/opt/node22/bin/pnpm`) |

⚠️ **Para rodar os testes de backend é preciso chamar `scripts/validar-backend.sh` antes**, mesmo
sabendo que ele aborta na etapa 1/5 no portão do SDK: as etapas 0 e 1 rodam primeiro e **linkam o
`express`** do store virtual. Sem isso, os 5 arquivos de `backend/rotas/` falham com
`ERR_MODULE_NOT_FOUND: Cannot find package 'express'` — que **não** é teste quebrado, é a cascata do
401 do `@urbiverso/sdk`. Não confunda um com o outro numa sessão futura.

### Três issues perderam a dependência de instância viva

Decisão do autor: a correção tem de valer para todos, sem depender de teste externo.
**#468** (baseline dos KPIs) deixou de ser um retrato colado dos estudos 5 e 6 de Pinguim e virou
**fixture de regressão no repo** — uma catraca: PR que move KPI sem declarar fica vermelho.
**#469** trocou o cadastro de 3 operações de equity por `POST` por **três casos de teste** que
afirmam as divergências de hoje. **#464** passou a fechar com a função de contagem testada e o
subcomando, com o número virando comentário em vez de critério.

Continua fora de alcance de sessão de nuvem: Pinguim e produção são **inalcançáveis** (403 no proxy
de saída), e o token é do autor.

### Estado dos hooks nesta sessão — a rede do processo estava INERTE

O projeto do Claude Code é `/home/user`, e **`/home/user/.claude/` não existe**: o
`.claude/settings.json` do app mora num subdiretório. `CLAUDE.md` e skills são descobertos em
subdiretório; **hooks e `permissions.deny` não**. Prova empírica: `cd /home/user/urbiverso && node -e
"…"` **executou**, quando `guarda-monorepo.sh:122-124` deveria tê-lo bloqueado com exit 2.

Consequências: não houve linha `[processo]`; não houve lembrete por prompt; **a proteção de escrita
do monorepo esteve desligada** a sessão inteira. E o CI `processo-integro` seguiu **verde**, porque
ele confere que os arquivos existem, não que o harness os carrega — a falha calada de sempre, num
lugar novo. Resolver isso é ação de ambiente do autor, não do repositório.

### Colisão de skills, e por que nada foi apagado

Existem **duas** `revisar-pr-apps` no catálogo da sessão — a do app e a de `/home/user/urbiverso`,
mesmo nome, sem prefixo de caminho na listagem. A do monorepo aplica a regra **upstream** da `versao`
(bumpar quando `shell_min` sobe), que aqui é **invertida** pela #422: invocar a errada acusa
bloqueante inventado em todo PR que suba piso.

Nada foi apagado, e cada caso tem motivo: `acompanhar-revisao` **não existe mais** e
`guard-processo.mjs:100-104` **reprova o CI** se ela voltar (*"a geração de duas sessões foi apagada
de propósito"*); `revisar-pr-shell`, `revisar-pr` e `qa` moram no monorepo, que é somente-leitura e
cujas próprias sessões as usam.

⚠️ **O conserto NÃO entra neste PR — e a razão é a lição mais cara desta sessão.** Ele foi escrito,
revisado dez vezes e **revertido de propósito**; o desenho aprovado e todos os achados estão na
issue de acompanhamento.

**Por que reverter.** Este PR nasceu para recuperar seis issues perdidas. Eu o deixei crescer para
dentro da maquinaria de revisão — `SKILL.md`, `motor-revisao.md`, `CLAUDE.md` —, e aí o ciclo parou
de convergir. O mecanismo é estrutural, não acidente: **os quatro documentos de processo se
referenciam**, então toda regra nova precisa ser propagada aos quatro, e o revisor acusa
corretamente cada um que ficou para trás. Dez rodadas, dezenove achados, **nenhum falso** — e o
gerador era eu, editando o processo dentro do processo.

**A regra que fica, e vale para todo PR deste repositório:** mudança em arquivo de processo
(`.claude/**`, a § *A revisão em si* do `CLAUDE.md`) **não entra em PR que está sob revisão**. Vai
em PR próprio, feita de uma vez, com os quatro documentos propagados no mesmo diff.

> ⚠️ **A segunda metade desta regra foi revogada em 2026-08-23 (PR 507).** Ela dizia "o teto é de
> 2 rodadas por PR, salvo bloqueante de código". **Não há teto** — o upstream nunca teve, e contar
> rodadas trata como igual a rodada que acha defeito novo e a que gira em falso. O ciclo fecha por
> **convergência**: zero bloqueantes pendentes. Ver `CLAUDE.md` § As três regras de escopo.

**O que o ciclo apurou, e não se perde** — está tudo na issue de acompanhamento, com o texto pronto:

- a primeira tentativa (porta de runtime conferindo `git rev-parse --show-toplevel`) **não funciona**:
  carregar a skill do monorepo não muda o diretório da sessão, então a cópia errada **passa** no
  teste; e o aviso mora na cópia que **não é lida** quando a outra é servida;
- o desempate tem de ser **material** e morar no `CLAUDE.md`, a única superfície que nenhuma skill
  sombreia — dois discriminadores (a regra da `versao`, a superfície de contratos) e a precedência
  declarada;
- caminho de recuperação **derivado** de `git rev-parse --show-toplevel`, nunca cravado;
- no timeout do App, publicar `bloqueantes=1`; **omitir a linha de máquina não serve**, porque o job
  varre todos os comentários do head e republica um `success` anterior;
- o predicado de espera precisa exigir review **posterior ao acionamento**, não só com o head certo
  — numa rodada que nasce de comentário o head não muda;
- App e fan-out são **duas camadas que somam**; o condicional é CLI × nativo, dentro da fan-out;
- **não citar contagem de rodadas nem de achados dentro do artefato revisado** — o contador envelhece
  a cada rodada por construção, e foi o que gerou metade dos achados deste ciclo.

### Codex — os três caminhos, medidos

| Caminho | Estado |
|---|---|
| **GitHub App (`@codex review`)** | ✅ **instalado e funcionando — é o caminho normal deste repositório.** Exercitado em rodadas sucessivas no PR 494 (~2 min cada), com achados P1 e P2 reais. O placar vive no PR, não aqui |
| CLI local (`codex exec`), o único que o `.claude/motor-revisao.md` documenta hoje | ✅ funciona em `urbiverso/urbiverso` (PR #2595, `gpt-5.6-terra`/`sol`). ❌ **não sobe aqui** |
| ChatGPT/Codex web sobre a URL do PR | ✅ funciona, e não depende de `OPENAI_API_KEY` |

> 🔴 **Eu afirmei que o App não estava instalado, e estava errado.** A afirmação vinha de
> `commenter:app/chatgpt-codex-connector` → 0 resultados em 40 PRs. A busca estava certa; a
> conclusão, não: zero comentários provava que ele nunca fora **chamado** aqui, não que estivesse
> ausente. Bastou comentar `@codex review`. **Lição de método:** ausência de uso não é ausência de
> capacidade — e o custo de confundir os dois foi quase adotar o motor mais fraco tendo o melhor
> disponível.

Para o **CLI local** faltam **duas** coisas neste ambiente, e a doc do repo só citava a primeira:
`OPENAI_API_KEY` nas variáveis do *cloud environment*, **e** `api.openai.com` liberado na política de
rede — medido: o proxy devolve **403 no CONNECT**, com `connect_rejected` registrado. O ambiente do
`urbiverso` evidentemente libera; este não. **Nada disso é bloqueio**, porque o App não passa por
aqui: ele roda na infraestrutura da OpenAI, acionado pelo GitHub.

**App e lentes nativas somam.** No PR 494 a divisão foi limpa: o Codex achou os defeitos de
**lógica** (uma guarda que não testava o que dizia testar; um caminho absoluto inexistente noutro
layout; uma atestação que podia sair antes da revisão chegar), e as lentes nativas acharam as
**imprecisões factuais** do texto. Nenhum dos dois acharia o conjunto sozinho.

### Também nesta alteração

`release.yml` ganhou `timeout-minutes: 15`. Era o único job dos quatro workflows sem ele,
contrariando a regra que o `CLAUDE.md` chama de "sem exceção" — e sem o timeout o default é **6
horas**, com a API servindo log só de job concluído.

---

## Revisão de PR vira processo fixo, e o monorepo vira só-leitura (2026-08-21)

O autor pediu duas coisas: que **todo** pedido de trabalho neste app passe por PR + revisão, e que
ficasse proibido mexer em `urbiverso/urbiverso`, que ele usa só como referência.

**O que já existia estava morto, não desatualizado.** Os três arquivos portados em 2026-08-18
(`protocolo-revisao-pr.md`, `skills/acompanhar-revisao/`, `skills/revisar-pr-apps/`) implementavam
revisão em **diálogo entre duas sessões**. Duas descobertas mataram a cópia:

1. `revisar-pr-apps/SKILL.md:182` procurava o plugin `codex-companion.mjs` em
   `~/.claude/plugins/cache/*/codex/*/scripts/` e, não achando, mandava **PARAR e perguntar**. O
   plugin **não existe** neste ambiente e não vai existir — a arquitetura do upstream mudou para
   `codex exec` direto. Invocar a skill produzia **uma pergunta, nunca uma revisão**.
2. Ela usava `gh repo clone`, e o `gh` não existe aqui — o próprio `CLAUDE.md` já dizia isso.

E o upstream tinha apagado o modelo inteiro no commit `b0361f6` (PR #2540): *"era o contorno para
despachar revisão a agentes de outro provedor de outra máquina, e o contorno morreu quando a mesma
sessão passou a conseguir isso sozinha."*

**Portada a geração nova**, com `.claude/motor-revisao.md` (motor único: preflight do Codex, fan-out
em Bash de fundo, colheita com guarda contra falha virar laudo limpo, fallback nativo **declarado**)
e `revisar-pr-apps` reescrita. As adaptações estão marcadas `ADAPTADO` **com o motivo ao lado**, para
o próximo port não desfazê-las. A maior: **a regra da `versao`**. O upstream manda bumpar quando o PR
mexe em `shell_min`/`sdk_min`; aqui é o oposto (§ Versão do manifesto, decisão da #422). Sem essa
correção, o revisor acusaria bloqueante inventado em **todo** PR que sobe piso.

**Três achados de ambiente que valem mais que o port:**

- **`npm view @urbiverso/sdk` dá `E401`**, não só o `pnpm install`. Ou seja: a camada de contratos da
  revisão é **estruturalmente inexecutável** aqui, e a checagem *"esse verbo está publicado?"* não
  tem como ser feita. Vira pergunta ao autor no relatório, nunca achado de memória.
- **`node_modules/` não existe** num clone novo — o `CLAUDE.md` afirmava o contrário (§ Validação),
  e o texto estava **vencido**. Consequência real: `validar-backend.sh` aborta na etapa 1/5.
  Corrigido na mesma alteração.
- **O monorepo está clonado em `/home/user/urbiverso` e é gravável**, contrariando o pressuposto de
  `urbiverso/CLAUDE.md` § "Sessão de app não enxerga o monorepo", em que as skills descansavam.

**A rede que torna o processo fixo**, e o que cada peça de fato garante, está na tabela do
`CLAUDE.md` § Processo obrigatório. O resumo honesto: `permissions.deny` **não** alcança `Bash` nem
ferramenta MCP (casa nome de ferramenta, não argumento) e falha **calado** se o padrão de caminho não
casar — por isso o `PreToolUse` `guarda-monorepo.sh` é a peça que realmente sustenta a proibição, com
57 casos de teste versionados. E o guard `revisao-registrada` é **autoatestação**: confere forma,
nunca substância.

Duas decisões de desenho que custaram um erro cada, e vale não repetir:

- A regex do guard casava `request` como verbo de escrita e **bloqueava
  `mcp__github__pull_request_read`** — isto é, quebrava a própria revisão. Falso positivo em guard
  não é inofensivo: guard que atrapalha é desligado. Agora casa por **prefixo** ou sufixo `_write`.
- O `revisao-registrada` é **workflow separado** e o **job sempre passa** — quem reprova é o commit
  status. Se o job falhasse, o check ficaria vermelho e nenhum comentário posterior o pintaria de
  verde; e o gatilho `issue_comment` precisa existir porque o relatório é postado **depois** do
  último push.

**Pendências do autor** (nenhuma dá para fazer daqui):

- ~~`OPENAI_API_KEY` nas variáveis do *cloud environment*~~ — 🔄 **deixou de ser pendência em
  2026-08-23.** O texto dizia que sem a chave a revisão roda no motor nativo *"para sempre"*. **Não
  roda:** o **GitHub App do Codex está instalado** e revisa a `@codex review`, sem chave nenhuma. A
  chave segue sendo o que falta ao **CLI local**, junto com a liberação de `api.openai.com` na
  política de rede (hoje **403 no CONNECT**) — mas o CLI é o fallback, não o caminho.
- **Branch protection** com `revisao/bloqueantes` como required check — sem isso o guard é conselho,
  não portão, e `main` está `protected: false` hoje.
- Decidir se o monorepo continua anexado a estas sessões — a defesa hermética seria não anexar.
- Fazer os hooks do repo carregarem: o projeto do Claude Code é `/home/user`, e o
  `.claude/settings.json` do app mora num subdiretório, então **hooks e `permissions.deny` não são
  lidos** (ver a seção de estado dos hooks, acima).

---

## Retorno declarativo de migração: a `003` sai do `remover_colunas` (2026-08-19)

A auditoria de obsolescências da plataforma acusou **um** arquivo desta app:

```
[migracao-remover-colunas] Retorno declarativo de migração de app (`remover_colunas` /
`remover_tabelas`) — breaking após 2026-08-23
 * migracoes/003_receitas_fases_alocacoes.js
```

`migracoes/003_receitas_fases_alocacoes.js` terminava em
`return { remover_colunas: { avancado_tipologias: ['linha_receita_id'] } }` — o único ponto do repo
com retorno declarativo. Isso é **migração declarando estrutura**, o oposto do que o `schema.json`
passou a garantir: a estrutura de uma app é 100% derivada dele, e migração só toca DADOS.

**Por que não dava para deixar passar.** O item está marcado `"gate": true` em
`sdk/obsolescencias.json`: passado **2026-08-23** ele deixa de ser aviso e **reprova a app na
instalação**. A allowlist de perdão nominal do detector cobre só as 8 migrações históricas que já
estavam no monorepo quando o contrato apertou, e está **congelada** — esta app nunca foi bundled,
então nada aqui casa. O caminho prescrito pela própria plataforma para esse caso é reescrever a
migração no fluxo canônico antes do fim da janela.

**Metade do caminho já estava feita e ninguém tinha reparado:** `linha_receita_id` já não está no
`schema.json`. Faltava só o passo de DADO. A `003` agora faz
`await dados.limparColuna('avancado_tipologias', 'linha_receita_id')`, sem `return`. No boot: o
reconciliador não toca na coluna (ela tem dado) → a migração esvazia → a poda pós-migrações derruba
a estrutura vazia. Numa instância onde a coluna nunca recebeu dado, a poda pré-migrações já a
derrubou e o `limparColuna` vira **no-op com log** — o mesmo release converge nas duas populações.

Reescrever migração já aplicada é seguro: o runner é forward-only e rastreia por número em
`shell.versoes`. Quem já rodou a `003` não a roda de novo; quem está atrasado roda a versão nova e
chega ao mesmo estado final.

### O defeito irmão, que era o pior dos dois

A `003` lia com `dados.listar(..., { por_pagina: 100000 })`. **Até o shell 0.53.8 esse `por_pagina`
era ignorado** e a chamada devolvia **100 linhas**, sem erro e sem aviso. Encostado num
esvaziamento de coluna, isso é a receita que os docs da plataforma marcam como irreversível: migra
100 tipologias e apaga a coluna de **todas**. As duas leituras passaram a `dados.varrerTudo`, que
não tem número para chutar. O aviso de obsolescência não falava disso — apareceu porque a correção
obrigou a olhar o arquivo inteiro.

### `shell_min`: `0.50.3` → `0.53.8`

| Verbo | Piso |
|---|---|
| `dados.limparColuna` | shell **0.53.5** |
| `dados.varrerTudo` | shell **0.53.8** |

O `shell_min = 0.50.3` estava listado como contrato inegociável no `CLAUDE.md`, no
`INSTRUCOES-CODE.md` e no `README.md` — os três foram atualizados na mesma alteração. **O piso
existe para ser honesto**, e não havia alternativa: sem `limparColuna` a remoção não tem passo de
dado. Risco baixo — o monorepo está em `0.53.11`, e o próprio aviso de obsolescência só é emitido
por shell ≥ 0.53.x. `sdk_min` **não** entrou: exige `shell_min ≥ 0.53.10` pareado e um SDK em
versionamento inteiro ("SDK N"), e a app segue pinada em `@urbiverso/sdk 0.50.3`, anterior a esse
esquema. **`versao` intocada** (`0.1.28`): não há migração nova nem mudança de schema, e o guard do
`validar-backend.sh` reprova bump sem migração nova.

### Prevenção — duas defesas, porque uma não bastava

- **`scripts/migracoes-harness.mjs`:** o banco em memória ganhou `varrerTudo`, `limparColuna` e
  `limparTabela`; a etapa 4 passou a **afirmar sobre o efeito** (depois da cadeia,
  `avancado_tipologias.linha_receita_id` tem que estar vazia — a fixture semeia a coluna
  preenchida); e existe uma etapa **5** que executa cada migração e reprova retorno com
  `remover_colunas`/`remover_tabelas`. Conferido que as duas ficam **vermelhas** sem o conserto.
- **`.github/workflows/pr-guards.yml`:** job `migracao-declarativa`, só `grep`, que barra
  `remover_colunas`/`remover_tabelas` **fora de comentário** em `migracoes/`. Fica no CI leve
  porque o `validation.yml` depende do token do SDK e pode nem rodar.

Uma executa, a outra lê o texto: o harness pega o retorno construído de qualquer jeito, o guard
pega o PR mesmo quando o CI pesado não roda.

### Pendente do autor (ambiente autenticado)

- **confirmar que a instância-alvo roda shell ≥ 0.53.8** antes de publicar a release — abaixo disso
  a app é reprovada na atualização com `422`;
- `pnpm exec urbi-empacotar viabilidade`;
- execução real da cadeia `001`→`029` no Postgres (segue nunca rodada em produção).

Issue **#422**. Validado aqui: `guard-json.mjs` ✓ · harness de migrações ✓ (etapas 1–5) · guard de
`versao` ✓.

---

## A app nunca foi instalável do zero — ciclo de FK no `schema.json` (2026-08-18)

O autor tentou instalar a app na **Pinguim** (`homolog.urbiverso.com.br`), para depois removê-la da
**Gondoa** (`dev.urbiverso.com.br`). A instalação reprovou:

```
[dry_run_schema] relation "viabilidade.estudos" does not exist
```

**Causa: ciclo de chave estrangeira.** `preliminar_produtos.estudo_id` aponta para `estudos`
(obrigatório, `cascata`) e `estudos.permuta_fisica_produto_id` / `_nr_produto_id` apontavam de volta
para `preliminar_produtos`. O sincronizador do shell emite a FK **inline no `CREATE TABLE`** e, ao
topar um ciclo, apenas **desiste da aresta** (`sincronizador.ts` — comentário literal
`// Circular reference — skip to avoid infinite loop`): não reprova, não adia a FK, cria as tabelas
fora de ordem. Simulando o algoritmo real contra o nosso `schema.json`, a ordem saía
`mercado_regioes, preliminar_produtos, estudos, …` — `preliminar_produtos` nascia **antes** de
`estudos`, e o seu `REFERENCES viabilidade.estudos(id)` estourava. A mensagem do erro é literalmente
essa linha.

**O que mais importa aqui não é o ciclo, é o que ele revela: a app nunca foi instalável do zero.**
`preliminar_produtos` chegou na migração `021` e os `permuta_fisica_*_produto_id` na `022` — em
instância que já tinha a app, as colunas nasceram por `ALTER TABLE ADD COLUMN`, onde o alvo já
existe. A instalação virgem **pula as migrações** e materializa tudo pelo `schema.json`: é o único
caminho que exercita a ordem de criação. Dev estava verde havia meses sobre um schema que não
instala. Só a primeira instância nova podia acusar — e acusou.

**Correção:** os dois `*_produto_id` viraram `inteiro` (referência lógica, sem FK). O lado forte
(`preliminar_produtos.estudo_id`) ficou como estava. Custo real nenhum: os dois campos são memória
da seleção da UI, não fonte de cálculo — o motor consome o canônico em m² gravado na edição
(`frontend/tela-premissas.ts:719-729`), e nenhum ponto do backend dereferencia o `produto_id`.
`referencia` e `inteiro` são o mesmo `INTEGER` no DDL, e o reconciliador do shell poda sozinho a FK
que deixou de ser derivável — sem migração, sem bump de `versao` (segue `0.1.28`).

**Prevenção:** `scripts/guard-schema-ciclos.mjs`, na etapa 1/5 do `validar-frontend.sh` e como job
`schema-ciclos` no `pr-guards.yml`. Conferi que ele reprova o `schema.json` anterior (aponta o ciclo
por extenso) e passa no corrigido. Esta é a mesma família do guard de aspas curvas e do de JSON
estrito: falha **silenciosa** — typecheck, testes, esbuild e o harness de migrações ficam todos
verdes, e o defeito só aparece na instalação de outra instância. O validador estático do shell não
ajuda: ele reprova ciclo que passe por uma `referencias` **composta**, e diz explicitamente que
"ciclo só de `referencia` simples continua valendo como sempre"
(`docs/shell/banco-de-dados.md`). É um buraco do shell — vale abrir issue em `urbiverso/urbiverso`,
mas não está no caminho crítico.

### Segundo defeito, independente: a release nascia já homologada

O autor notou no GitHub que a release disponível estava com `prerelease=false`. Causa: o
`release.yml` chama `gh release create` **sem `--prerelease`**, enquanto o `urbi-release` do SDK
publica sempre como prerelease. Para a plataforma, "não homologado" ⟺ `prerelease=true`, então toda
release nossa nascia **atestada por ninguém** — e produção, que roda em `aceitacao = 'homologado'`,
passava a enxergá-la na hora. A doc da plataforma já nomeava a virada como pendência do repo do app
(`distribuicao.md`: "a data de corte é por repo: o dia em que o workflow do repo do app passa a
publicar `prerelease: true`").

Acrescentado `--prerelease` ao workflow, com o ciclo documentado em `CLAUDE.md` § "A release nasce
NÃO homologada". Dois pontos que se aprende errado e ficaram escritos: prerelease **não** trava a
primeira instalação (install de app nova é soberano — basta marcar "Incluir não homologadas" na
tela), e o botão **Homologar** só existe numa instância com `aceitacao = 'releases'`.

**Fica com o autor, no ambiente autenticado:** disparar o release (Actions → release → Run
workflow), instalar na Pinguim marcando "Incluir não homologadas", pôr a Pinguim em
`aceitacao = 'releases'`, testar, clicar em Homologar, e desinstalar da Gondoa.

---

## Workflow de revisão de PR em diálogo portado do monorepo (2026-08-18)

Pedido do autor, a partir de um workflow que ele já usa noutras apps: implementar numa sessão,
abrir o PR, disparar a revisão numa **segunda** sessão independente, e deixar as duas
convergirem trocando comentários no PR — merge nunca automático.

O mecanismo (duas skills mais um protocolo de comentário) já existia em
`urbiverso/urbiverso` (`.claude/skills/{acompanhar-revisao,revisar-pr-apps}` e
`.claude/protocolo-revisao-pr.md`), mas invisível para uma sessão que só tem este repo
anexado — regra do próprio `CLAUDE.md` do monorepo (§ "Sessão de app não enxerga o monorepo").
Portei os três arquivos **verbatim** para `.claude/` deste repo (conferido: nenhum caminho de
monorepo vazava neles — `revisar-pr-apps` já é desenhada para rodar contra repo de app externo,
usando o bundle publicado do `@urbiverso/sdk`, não o monorepo). `revisar-pr-shell` ficou de
fora — é exclusiva de PR no próprio `urbiverso/urbiverso`.

Documentado em `CLAUDE.md` § "Revisão de PR em diálogo" (dentro de § Merge). **É cópia, não
link vivo**: se o protocolo ou as skills mudarem no monorepo, a atualização não chega aqui
sozinha — alguém precisa portar de novo.

Não disparei um ciclo de verdade nesta sessão (não havia PR aberto no momento); fica para a
próxima vez que houver uma mudança real a revisar.

---

## Auditoria de issues fechadas sem entrega — 4 lacunas (2026-08-17)

Auditoria pedida pelo autor: procurar issues **fechadas cujo trabalho não foi de fato entregue**,
trazendo só o que fosse certo. Método da triagem de 2026-08-03 — ler o critério de aceite e conferir
contra `arquivo:linha` no código de hoje —, aplicado às 29 "parciais" daquela triagem (hoje todas
fechadas) e à Rodada 7 inteira (#309–#355), a leva menos auditada.

**As 29 parciais quase todas se resolveram**, umas por entrega posterior (#240/#245/#248/#252/#255/
#257/#268/#269/#279/#281/#283), outras por substituição deliberada (#256 revertida pela #335; #241
pela #349; #272–#276 pela reescrita da #355). Descartei também 4 falsos positivos que o código
desmente (#320, #341, #325, #266 — detalhe nos comentários das issues novas).

**Sobraram 4 lacunas certas — e 3 são passos do próprio plano publicado na #355:**

| Issue | Lacuna | Evidência |
|---|---|---|
| **#413** | `docs/viabilidade/fluxo-investidor-formulas.md` **nunca existiu em git**, apesar de `funding-motor.ts:9`, `funding-motor.test.ts:11`, `migracoes/029:4` e `funding-capital-stack.md:17,35,453` a citarem como a spec vigente (link markdown quebrado) | passo **F11.1** |
| **#414** | decisão **D14** — alerta de caixa acumulado negativo após funding — nunca implementada; `validarFunding` só olhava saldo devedor e reconciliação | `fluxo-invariantes.ts:332-368` |
| **#415** | o aviso regulatório da **§17** sumiu: entregue pela #277 (PR #296) em `tela-capital-stack.ts`, não transportado quando a #355 criou `tela-funding.ts` | zero `urbi-banner` na tela nova; §17 não está entre as seções supersedidas |
| **#416** | `CLAUDE.md` e `PROGRESSO.md` ainda diziam "Rodada 7 aberta" e "#355 bloqueada pela D6", com as 47 issues fechadas e o código na `main` | passo **F11.6** |

**As quatro foram corrigidas nesta sessão.** A #414 acrescentou
`CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` (severidade `alerta`, um item por estudo, 4 testes) — ele
importa porque `divida` e `equity` pagam **sem checar o caixa do projeto**, e era esse buraco que a
D14 existia para tornar visível. Suíte de frontend: **393 testes verdes**.

Nada aqui toca backend, `schema.json` ou migração → `versao` permanece **0.1.28**.

> **O padrão que a auditoria expôs:** as três lacunas da #355 são passos de **documentação e de
> estado**, não de código. Nenhum teste fica vermelho quando eles são pulados, e o plano que os
> declarava vivia num comentário de issue — que sessão nenhuma lê. Passo de plano que não deixa
> rastro no repo morre calado.

---

## Financiamento à Produção — modelo da planilha implementado (2026-08-11)

Trabalho **fora da Rodada 7**, a partir de um pedido do autor com a planilha `20260730_EVI_Urbita`
anexada. Fecha a dívida que o `funding-capital-stack.md` declarava explicitamente em aberto: as
nuances de financiamento à produção achadas na planilha (exposição mínima antes da 1ª liberação,
cash sweep condicional a flag/fase de Chaves) tinham ficado **fora da Rodada 6 por decisão do autor
em 2026-08-03**. Não é a #355 — aquela é a reescrita do Funding/Capital Stack, que na data desta
entrada seguia bloqueada pela D6 (faltava o `fluxo_investidor_FORMULAS`) e isolada por exigência do
autor. *(Atualização de 2026-08-17: a D6 foi levantada em 2026-08-11 e a #355 entregue pelo PR #412;
o modelo desta entrada foi preservado de propósito — é a §4.3, a única parte vigente do
`funding-capital-stack.md`.)*

**O diagnóstico.** O app já tinha a camada `financiamento_producao`, mas ela liberava dívida
**por necessidade de caixa** (`min(disponível, necessidade)`). A planilha faz o oposto: libera
**incondicionalmente** contra medição de custo. Os dois modelos produzem números diferentes para o
mesmo estudo. Oito divergências decodificadas fórmula a fórmula de `Incorp Individual!BW:CH`:
liberação incondicional · gatilho de exposição mínima · janela de obra/chaves · catch-up retroativo
na 1ª liberação · caixa disponível sem a liberação do próprio mês · teto de amortização sem a
liberação do próprio mês · toggle de amortização antecipada + gate de chaves · ausência de teto de
crédito.

**Decisão do autor (respondendo à D2 do plano):** a regra vale para **todos** os estudos já salvos,
com autorização explícita para apagar campos que deixam de existir. Por isso
`financiamento_producao` passou a ser **sempre** o modelo da planilha — sem seletor de modalidade —
e a migração `028` limpa `sistemaAmortizacao`/`politicaAmortizacao`/`prazoMeses`/`carenciaMeses`/
`vencimentoMes`/`liberacaoProgramada` dessas camadas (são parâmetros de Price/bullet, que §43 do
pedido diz que este produto não tem) e grava os defaults da planilha (exposição 20%, financiado 80%,
amortizar com caixa = sim). `versao` 0.1.26 → **0.1.27**.

**Regressão:** `frontend/financiamento-producao-golden.test.ts` reproduz os 80 períodos do cenário
real da planilha — 1ª liberação R$ 17.108.298,25 no mês 5, juros R$ 168.749,08 no mês 6, pico
R$ 95.884.494,59 no mês 29, quitação no mês 36, totais R$ 83.236.939,35 liberados +
R$ 15.040.168,42 de juros = R$ 98.277.107,77 amortizados. Desvio máximo **R$ 0,12**, todo de
`round2` (contrato C7); tolerância do teste é R$ 0,15. Mais os 7 casos extremos do §42 e a
não-regressão do caminho `por_necessidade`.

> ⚠️ **Achado lateral, corrigido junto:** o glob de teste era `frontend/*.test.ts`, que **não
> alcança subdiretório** — os 16 golden cases do Capital Stack
> (`frontend/fixtures/capital-stack-golden.test.ts`, 269 linhas) **nunca rodaram**, nem em
> `pnpm test` nem em `scripts/validar-frontend.sh`. Estavam escritos, commitados e mortos desde a
> Rodada 6. O glob agora inclui `frontend/fixtures/*.test.ts` nos dois lugares; a suíte foi de 325
> para **424 testes**, todos verdes.

**Pendências do autor:** rodar a migração `028` no Postgres (junto com a cadeia `001`–`027`, que
segue nunca executada em produção) e o `urbi-empacotar`. Nada aqui toca `schema.json` — as premissas
novas moram na coluna `config` (json) da camada, que não exige DDL.

**Nota de ambiente:** `scripts/validar-backend.sh` **não rodou completo nesta sessão** — aborta na
etapa 1/5 porque `node_modules/@urbiverso/sdk` não existe neste clone remoto (o `CLAUDE.md` afirma
que está em disco; nesta máquina não estava). Rodei as duas etapas que não dependem do SDK:
`scripts/migracoes-harness.mjs` verde (contrato, banco vazio, reexecução e cadeia completa, com uma
camada semeada no harness para exercitar a transformação) e o guard de `versao` conferido à mão
(1 migração nova, versão bumpada). O typecheck do backend não foi exercido — mas esta entrega **não
altera nenhum arquivo em `backend/`**.

---

## Rodada 7 — Fases 9–10 concluídas (E41–E46, issues #349–#354), portão antes da Fase 11 (2026-08-11)

Sessão contínua a partir do checkpoint anterior, uma issue de cada vez, mesma disciplina de
branch → PR → CI verde → merge → confirmação de fechamento via `issue_read`.

- **Fase 9 — Avançado: Resultados** (E41–E43, #349–#351): reconstruiu a tabela de fluxo reduzindo-a
  aos blocos pedidos (Receita Bruta + grupos de Receitas, 5 tipos de Custos, Fluxo), absorveu o
  funding do Capital Stack nas categorias de receita/custo via `fundingNoFluxo()` (nova função pura
  em `capital-stack-motor.ts`, fonte única para tabela e exportação), preservando as KPIs
  desalavancadas (§8.1) com uma nova linha "Fluxo de Caixa Livre (antes do funding)"; renomeou a
  seção para "Resultados"; e dividiu em três sub-abas (Fluxo de Caixa · Proforma · Análise
  Financeira), com `proforma-avancado.ts` novo derivando a leitura econômica do mesmo `FluxoCalc` do
  Fluxo de Caixa (não do `proforma.ts` do Preliminar, que precisa de campos fixos que o Avançado não
  tem).
- **Fase 10 — Avançado: Cenários** (E44–E46, #352–#354): variação % dos 6 KPIs de `kpisFluxo()`
  passou a viver DENTRO da caixa do card (D7 — abandonou `urbi-kpi` nesses cards por markup + tokens
  próprios, já que o primitivo não tem slot); Exposição Máxima passou a comparar por MAGNITUDE
  (`Math.abs`, `maiorMelhor=false`) em vez do valor assinado — exposição maior agora é seta pra cima
  + vermelho, menor é seta pra baixo + verde; e o gráfico de Cenários passou a mostrar SEMPRE as duas
  séries (Cenário real × simulado, com `marcadores`), mesmo com os sliders em 0% — fechando o ponto
  que a #264 tinha deixado pendente de confirmação.

**Todas as 6 issues de E41 a E46 estão fechadas** (confirmado via `issue_read` após cada merge).
Nenhum portão de fase pulado.

**Próximo passo — Fase 11 (E47/#355), isolada por exigência explícita do autor**: reescrita do
Funding/Capital Stack. Na data desta entrada continuava **bloqueada pela D6** — faltava o autor
anexar o documento `fluxo_investidor_FORMULAS`, que não estava no repositório. Sessão parou aqui;
não avançou unilateralmente para a última fase sem esse documento.

> ✅ **Desfecho (2026-08-12):** o autor anexou a planilha em 2026-08-11, o diagnóstico exigido pelo
> critério de aceite foi publicado como comentário da #355 antes de qualquer código, e a Fase 11 foi
> entregue pelo **PR #412** — 3 operações independentes (`financiamento_producao` única por estudo ·
> `divida` · `equity` em 2 modos) em `frontend/funding-motor.ts`, `frontend/tela-funding.ts` e
> `backend/rotas/funding.ts`, tabela `avancado_funding_operacoes` (migração `029`), com o Capital
> Stack removido do código. `financiamento_producao` **não** migrou para a matemática de calendário
> da planilha nova: preservou o modelo da #405 (§4.3), por decisão do autor de 2026-08-12.
> A spec entrou no repo só depois, pela **#413** — ver a entrada de 2026-08-17 no topo.

---

## Rodada 7 — Fases 1–8 concluídas (E01–E40, issues #309–#348), portão antes da Fase 9 (2026-08-10)

Sessão contínua, uma issue de cada vez, cada uma com seu próprio branch → PR → CI verde → merge →
confirmação de fechamento (nunca assumido). Sem desvio do plano de execução E01→E47.

- **Fases 1–6** (E01–E26, Preliminar/Mercado-IA/Resumo-KPI/Cronograma/Tipologias): mergeadas em
  segmentos anteriores desta mesma sessão.
- **Fase 7 — Avançado: Custos** (E27–E32, #335–#340): reverteu categorias obrigatórias (D5, com
  alerta de duplicata em vez de bloqueio), achatou a distribuição do Preço num único select, alinhou
  os campos de permuta física lado a lado, somou a área permutada no rodapé de Terreno, acrescentou
  `lancamento` às âncoras de Cronograma (migração `026`, `versao`→`0.1.25`) e o aviso de unidades não
  alocadas em Tipologias.
- **Fase 8 — Avançado: Receitas** (E33–E40, #341–#348): nome padrão "Nº Grupo" por maior sufixo
  (não contagem — corrige colisão pós-exclusão), removida a badge de periodicidade e o texto redundante
  de "100%", campo Nº Parcelas oculto (não só desabilitado) em "Ao longo da obra", repasse travado em
  1 mês após a obra nos três pontos do motor, RET promovido a controle GLOBAL do estudo (migração
  `027`, `versao`→`0.1.26`, saiu do bloco Definições em Receitas para Custos → Financeiro), Absorção
  de vendas passou a acompanhar o Pré-lançamento do Cronograma com soma travada em 100% (frontend e
  backend) e a janela comercial renomeada para "Pós-chaves".

**Todas as 40 issues de E01 a E40 estão fechadas** (confirmado via `issue_read` após cada merge, não
assumido pela existência do PR). Nenhum portão de fase pulado.

**Próximo passo — Fase 9 (E41–E43, #349–#351)**: reconstrução da tabela de fluxo (absorve o Capital
Stack legado nas categorias de receita/custo, cruza a fronteira arquitetural que hoje separa
`fluxoLivreMensal` do funding) e a divisão em três abas (Fluxo de Caixa/Proforma/Análise Financeira).
São os dois itens 🔴 muito alta risco do plano inteiro, fora **E47**/#355. Sessão parou aqui para
confirmar com o autor antes de entrar nessa fase — não é decisão unilateral de continuar.

---

## Rodada 7 — planejamento e abertura das 47 issues (2026-08-10)

O autor entregou `lista_bugs_20260807.xlsx` (47 itens, numerados 1–41 e 43–48 — **o item 42 não
existe na planilha**; 4 abas extras `#38`/`#39`/`#43`/`#45` continham só imagens de referência,
extraídas e anexadas às issues correspondentes). Esta sessão fez o diagnóstico completo de cada
item (3 agentes de exploração em paralelo cobrindo Preliminar, Cronograma/Tipologias/Receitas e
Custos/Fluxo/Cenários/Funding), montou uma ordem de execução em **11 fases com portão de merge**
entre elas (E01→E47, respeitando pré-requisitos), e criou as **47 issues** (`#309`–`#355`) no
GitHub, uma por item, com o diagnóstico `arquivo:linha`, o que fazer e o critério de aceite.

**Ponto de partida:** zero issues abertas antes desta sessão (a Rodada 6 estava de fato encerrada),
`main` em `54d7df0`. A cadeia EVI de recebíveis (bloqueio de rodadas anteriores) já estava integrada
pela #283 — não afeta esta rodada.

**Achados transversais registrados nas issues:**
- Vários itens (15, 20, 47) podem já estar corrigidos na `main` e o autor estar reportando contra a
  **versão publicada**, que segue atrás por causa das pendências crônicas do autor (`urbi-empacotar`,
  sync do `schema.json` pelo SDK, migrações reais no Postgres). As issues correspondentes (#313,
  #329, #354) pedem confirmação contra a instância antes de qualquer mudança de código.
- Causa-raiz comum aos itens 9 e 12 (#310, #320): o campo `*_canonico` sempre ganha do campo por
  unidade (`proforma.ts:100`), mas duas rotinas da tela (VGV sem permuta e a sensibilidade) escalam
  só os campos legados — o resultado é a mesma linha repetida e Bear=Base=Bull.
- `urbi-kpi` (monorepo) não tem slot nem prop de variação — é a causa de #326 (sobreposição) e #352
  (variação fora da caixa); a correção fica inteira no app (wrapper CSS / card próprio), sem exigir
  mudança no SDK nem bump de `shell_min`.
- Seis decisões (D1–D7) ficaram documentadas issue a issue, com o padrão seguido na ausência de
  resposta do autor. A mais bloqueante é **D6**: a #355 (item 48, reescrita do Funding/Capital
  Stack) está formalmente bloqueada até o autor anexar o documento `fluxo_investidor_FORMULAS`
  (não está no repositório) — é a última da fila de qualquer forma, e o próprio autor pediu que
  fosse trabalhada isolada de qualquer outra issue.

**Próximo passo:** implementar E01 em diante, fase por fase, com portão de merge ao final de cada
uma. `CLAUDE.md` § *Estado do backlog* foi atualizado no mesmo commit deste registro.

---

## Por que os problemas se repetem: 4 causas-raiz (2026-08-06)

O autor perguntou por que erros, imprevistos e "issues não implementadas de verdade" continuam
acontecendo, apesar das rodadas anteriores terem sido dadas como concluídas. Investigação do
histórico (git log, `docs/triagem-issues-2026-08-03.md`, o próprio `fluxo-caixa-motor.ts`) cruzada
com o estado atual das issues no GitHub. **O pior já tinha sido corrigido**: das 53 issues
"fantasma" de 2026-08-03, restavam nesta data só **4 abertas** (#252, #264, #268, #269) — o sistema
já tinha reagido ao próprio incêndio. O que faltava era parar de reagir issue a issue e prevenir a
*próxima* rodada do mesmo padrão.

**As 4 causas-raiz, com evidência:**

1. **"Mergeado" virou proxy falso de "entregue"** — sem checagem final linha-a-linha antes de
   fechar. As Rodadas 5–6 foram dadas como concluídas, mas a triagem de 2026-08-03 achou que só
   23/53 issues se sustentavam em `arquivo:linha`; 29 eram "parcial". Ex.: #256 foi dada como
   pronta, mas o `DELETE .../custos/:cid` não recusava a linha oficial de Preço — critério de
   aceite não cumprido, só o commit existia.
2. **Motor construído e testado, mas não ligado ao caminho de cálculo real** ("código morto"
   recorrente). Nove issues (#230, #232–#237, #240, #241) tinham matemática pronta e testada que o
   próprio motor declarava, em `frontend/fluxo-caixa-motor.ts:505-511`, não alimentar
   `calcularFluxo`. **Já corrigido** pela integração da #283 (`f1de233`/`2bf3969`); a varredura por
   marcadores residuais não achou mais nenhuma ocorrência fora de um caso já documentado e
   intencional (`:1905`, decisão de arquitetura sobre a fonte legada de permuta física, não bug).
3. **Falha silenciosa por natureza da plataforma** — cada guard nasceu reativo, depois do
   incidente. Aspas curvas em atributo Lit (#160) e comentário `//` em `schema.json` (derrubou a
   v0.1.19) sobreviveram a rodadas inteiras "validadas ✓" porque nenhuma etapa do pipeline lia
   aquele artefato. `guard-json.mjs` e o grep de aspas curvas só nasceram depois do estrago.
4. **Convenção de processo presumida, nunca imposta mecanicamente até quebrar.** As 53 issues
   fantasma existiam porque a regra "só `Closes #NNN` fecha issue" morava no `CLAUDE.md` do repo
   errado. De ~88 menções a issue em commit, só 6 usaram `Closes` — exatamente as 6 que fecharam.
   Mesmo padrão, de novo, em 2026-08-06: `validation.yml` sem `timeout-minutes` deixou a PR #304
   pendurada até o default de 6h do GitHub (ver seção de CI travado nesta mesma sessão).

**Padrão comum:** o processo tratava "parece pronto" (compila, testa, PR aberto, commit menciona a
issue) como equivalente a "está pronto", e só descobria a diferença via auditoria manual posterior —
nunca por um gate que existisse *antes* do incidente. As causas #2 e #4 já tinham correção mecânica.

**Tentativa e reversão do dia:** a primeira versão desta investigação (branch
`claude/blindar-fechamento-issue`) tentou endereçar #1 e #3 com dois guards novos — uma segunda
exigência de `Evidência: #NNN arquivo:linha` em cima do `guard-issue-fechamento.mjs`, e um guard
inteiramente novo (`guard-divida-conhecida.mjs`) varrendo o diff atrás de frases como "código
morto". **O autor pediu para reverter os dois** no mesmo dia: a ferramenta simples que ele queria já
existia desde 2026-08-03 (o próprio `guard-issue-fechamento.mjs`, que levou o total de issues abertas
de 53 para 4 em três dias) — as duas adições eram complexidade não pedida em cima de algo que já
funcionava, e um guard de texto não confirma critério de aceite mesmo assim (só confere se a linha foi
escrita). **Revertido**: os dois arquivos voltaram ao estado de antes desta sessão. Se a causa #1
precisar de correção mecânica no futuro, vale desenhar de novo — mas simples, e só se o autor pedir.

Causa #3 (falha silenciosa por design da plataforma) permanece sem correção estrutural — é inerente
ao UrbiVerso (prop/atributo inexistente "simplesmente não faz nada") e cada novo caso ainda vai
exigir um guard reativo específico. Registrado aqui para a próxima sessão não redescobrir o padrão do
zero.

**Sobre o `validation.yml`, separadamente:** o autor perguntou se esse workflow (CI de
typecheck/teste/build) era a causa dos problemas recorrentes. Não é — ele só existe desde
2026-08-06 (entrou "de carona" num commit da PR #303, que era sobre a issue #266, não sobre CI),
três dias **depois** das 53 issues fantasma. O único incidente que ele causou (a PR #304 pendurada
por falta de `timeout-minutes`) já foi corrigido no PR #305, mergeado. Ele roda os mesmos dois
scripts (`validar-frontend.sh`/`validar-backend.sh`) que já existiam desde antes de 2026-08-03 como
gate manual — só automatizou o que já era prática documentada. Recomendação: manter.

## CI travado na PR #304 — diagnóstico e blindagem dos workflows (2026-08-06)

**Sintoma.** A PR #304 (`agent/268-permuta-fisica-motor`, `Closes #268`) ficou sem veredito: os
quatro jobs do `pr-guards` fecharam verdes em ~10s, mas o job `validation / Testes, typecheck,
build e validadores` (run `31106430684`) entrou em `in_progress` às 13:33:05 e **nunca concluiu**,
preso no passo `Testes` (`started_at 13:33:17`, sem `completed_at`). Como a API do GitHub só serve
log de job **concluído**, não havia nada para ler — "travado e sem logs".

**Baseline que prova o travamento.** O mesmo job, no run verde imediatamente anterior
(`31105953077`, PR #303): **33 segundos no total**, passo `Testes` em **4s**, suíte inteira com
**325 testes em 2,2s**. Não é lentidão, é não-terminação.

**Causa-raiz ainda em aberto entre duas hipóteses** (o desempate é cancelar e re-rodar o job):
*infra* — corrobora o `pages build and deployment` da `main` (run `31106037967`) ter travado em
`deployment_queued` na mesma janela de 10 min, até `Timeout reached, aborting!`; *código* — o diff
da #304 são 3 arquivos e a função nova `reservarPermutasFisicas` tem laços de limite fixo; o único
`while` do motor é `periodosAnuais` (`frontend/fluxo-shared.ts:79`), que só diverge com `prazo`
infinito, e o prazo destes testes vem do `CRONO` (≈53 meses). Nenhum candidato estático convincente.

**O que foi corrigido aqui** — o defeito de processo, que é independente de qual das duas hipóteses
vencer: *um job podia pendurar por 6 horas sem produzir sinal nenhum*.

- `validation.yml`: `timeout-minutes: 10` (baseline 33s); `concurrency` com `cancel-in-progress`;
  `edited` removido dos `types` (editar a descrição do PR re-disparava a suíte pesada inteira);
  passos soltos `Testes` e `Typecheck` removidos por serem **subconjunto estrito** dos dois
  validadores — `pnpm build` fica, porque é o único passo que gera de fato `backend/rotas.js`.
- `pr-guards.yml`: `timeout-minutes: 5` nos quatro jobs (baseline 6–13 **segundos**).
- `--test-timeout=60000` em todo `node --test` (`package.json`, os dois validadores) **e** um
  `com_limite` (wrapper de `timeout`, com fallback quando o binário não existe) nos dois scripts.
  As duas defesas são necessárias e nenhuma cobre a outra: o `--test-timeout` mata teste
  **assíncrono** pendurado e diz o nome dele, mas **não pega laço síncrono** — `while(true){}`
  bloqueia o event loop e o timer do próprio runner nunca dispara; quem pega esse é o `timeout`,
  que mata o processo inteiro.
- `actions/setup-node@v4 → v7` e `pnpm/action-setup@v4 → v6`, encerrando o aviso de depreciação do
  Node 20 que aparecia em todo run ("forced to run on Node.js 24").

**Regra nova, sem exceção: todo job de CI deste repo declara `timeout-minutes`, e todo
`node --test` declara `--test-timeout`.**

**Pendências do autor** (fora do ambiente Claude Code): cancelar e re-rodar o run `31106430684` para
desempatar infra × código; decidir o **GitHub Pages** em Settings → Pages (desligar, se o site não é
usado — hoje ele deixa um ✗ fixo na `main`; não há workflow de Pages no repo, o deploy é o nativo
por branch); e tirar a #304 de **draft** antes de qualquer merge.

**Já corrigido antes deste diagnóstico, registrado para não reabrir investigação:** o run
`31105745581` falhou com `frontend/tela-fluxo-custos.ts(1033,1): error TS1128` (erro de sintaxe
real, corrigido no commit seguinte) e o run `31105863591` falhou com o binário nativo do esbuild
sendo lido como JS (`SyntaxError: Invalid or unexpected token` sobre o cabeçalho `ELF`) —
resolvido em `f04cd84`, que passou a invocar `"$esbuild_bin"` direto.

## #241 — hierarquia econômica completa no fluxo e exportações (2026-08-05)

O `FluxoCalc` agora expõe séries mensais canônicas de contratação bruta,
desconto e contratação líquida; contratação por Grupo/tipologia; Receita Bruta
por componente comercial (**À vista, Tabela curta, Tabela longa — Obra,
Repasse e Após-chaves**); e Carteira por componente (**Curta, Longa — Obra e
Saldo a repassar**). Estudos legados permanecem matematicamente inalterados e
entram numa categoria explícita, sem reclassificação retroativa.

A tabela mensal/anual ganhou blocos próprios para **Vendas contratadas** e
**Carteira de clientes**, mantendo Receita Bruta, Receita Líquida, custos e
Funding separados. CSV e PDF usam a mesma função de hierarquia; o novo gráfico
econômico compara contratação líquida, Receita Bruta, Carteira e Repasse a
partir dos mesmos arrays. Testes provam o fechamento por Grupo/tipologia e por
componente, agregação anual, grupos colapsáveis, zeros, desconto negativo e
números longos.

## #240 — invariantes e relatório de reconciliação concluídos (2026-08-05)

O módulo puro de validação passou a cobrir e distinguir: estoque/alocação e
permuta por tipologia; baixa mensal e estoque terminal; contratação
bruta/desconto/líquida; Receita Bruta, principal e juros; carteira negativa ou
terminal; repasse repetido ou superior ao recebido; dívida negativa/terminal;
e reconciliação mensal do caixa com fluxo livre e funding. A tolerância
monetária explícita permanece em R$ 0,01.

O relatório deixou de ser código isolado: a tela **Fluxo de Caixa** carrega o
catálogo, executa as invariantes a cada recálculo e mostra o diagnóstico com
código, severidade, linha/mês, esperado, encontrado e diferença. Erros são
quebras de cálculo; lacuna de funding é alerta de premissa agressiva. O mesmo
relatório acompanha CSV e PDF, inclusive com o estado “Tudo reconciliado”.

Os testes dedicados cobrem sucesso e falha de produto, contratação, carteira,
repasse, dívida, caixa e a classificação não bloqueante da lacuna de capital.

## #237 — Receita Bruta canônica concluída; #241 avançada (2026-08-05)

A integração por safras da #283 já produzia `receitaBrutaMensal`, principal,
juros, carteira e repasse, mas a apresentação principal ainda chamava de
“Receita” a série líquida pós-RET e não reconciliava o bruto por linha e
tipologia.

Esta entrega cria `linhasReceitaBruta`, derivada da mesma fonte canônica do
total, com fechamento por Grupo/tipologia; adiciona o KPI **Receita Bruta —
VGV**; separa na tabela e nas exportações **Receita Bruta — VGV** de **Receita
Líquida do Projeto**; e mantém principal, juros, repasse e carteira visíveis.
O teste dedicado prova que RET e corretagem destacada não reduzem a Receita
Bruta e que as tipologias fecham exatamente com o total.

A #241 avança na hierarquia comercial e no compartilhamento das fontes entre
tela, Cenários, CSV e PDF, mas permanece aberta para o redesenho integral de
contratação e funding previsto em seu próprio escopo.

## #255 — matriz de ancoragem de custos executada e documentada (2026-08-04)

A #255 exige a matriz **5 abas × 3 tipos de âncora × (novo | legado)**. Ela existe porque a
correção parcial já aconteceu **duas vezes**: a #120 tratou só a linha Construção, a #167 tratou só
o Início.

**Decisão sobre a dimensão "aba", para não se rediscutir:**

| Camada | A aba importa? | Por quê |
|---|---|---|
| **Backend** | ❌ não | `ancorarLinhaCusto` e `resolverTravamentoCusto` **não recebem `grupo`** — iterar 5 grupos rodaria o mesmo código 5 vezes. Argumento já registrado em `backend/rotas/avancado-ancoragem.test.ts:18-24`, e mantido. |
| **Frontend** | ✅ sim | O regime é decidido por **grupo + categoria**. É aqui que a aba muda o resultado — e era exatamente aqui que não havia teste nenhum. |

**Causa estrutural encontrada:** a classificação estava **inline no `render()` de
`tela-fluxo-custos.ts`, repetida idêntica nas três colunas** (Cronograma, Início, Duração). Essa
repetição É o mecanismo das duas correções parciais — corrigir uma coluna e esquecer as outras.

Extraída para `regimeCronogramaLinha` em `frontend/fluxo-shared.ts`, com 5 regimes:
`sem_cronograma` (Corretagem #121; permuta e Preço distribuído #194) · `fixo_obra` (Construção
#120) · `fase_ancora` (#167) · `evento_fixo` · `customizado`. `eConstrucao` e
`CATEGORIA_CONSTRUCAO` migraram junto, para o lado dos predicados irmãos.

**A matriz, em `frontend/custos-ancoragem.test.ts` (13 testes):** 5 abas × 4 formas de ancorar
(evento fixo, fase do Cronograma, customizado e **legado sem o campo gravado** — o caso que a issue
relatava descoberto); as exceções legítimas com seus números de origem; a precedência entre elas; e
robustez a entrada nula/parcial.

**Garantia da extração:** um teste reproduz literalmente o `if`-chain original e exige concordância
em **960 combinações** (5 abas × 4 categorias × 3 subcategorias × 4 modos de distribuição × 4
âncoras). Reordenar as condições em `regimeCronogramaLinha` quebra esse teste — que é o ponto.

266 testes de frontend verdes. Sem migração, sem schema: `versao` segue `0.1.19`.

---

## Triagem executada: 23 fechadas, 30 seguem abertas com o que falta (2026-08-03)

> 📌 **Tudo nesta entrada é o estado de 2026-08-03 e ficou como está, de propósito** — é registro
> histórico, não descrição do runtime. **Três afirmações dela venceram**, e ficam listadas aqui em
> vez de serem editadas frase a frase no corpo (foi tentado; o resultado foi um texto que se
> contradizia em dois parágrafos):
>
> | O que a entrada diz | O que vale hoje |
> |---|---|
> | as funções de safra "NÃO estão ligadas a `calcularFluxo`" e **"nenhum estudo real passa por elas"** | a **#283** ligou: `recebimentoBrutoMensal` consulta `recebiveisComponentesLinha` primeiro (`fluxo-caixa-motor.ts:1353`) e o `FluxoCalc` agrega as séries (`:2040-2046`) |
> | a #283 está **"não implementada de propósito"** | implementada e mergeada |
> | o que resta da #281 é **`exportar.ts:10` ter o seu próprio formatador** | `exportar.ts` passou a **importar** `fmtR$`; o que resta são `fluxo-tabela.ts:34`, `tela-proforma.ts:314` e `tela-fluxo-receitas.ts:382-383` |

Conferência das 53 issues **contra o código da `main`**, critério de aceite a critério de aceite.
Relatório com evidência `arquivo:linha` por issue: `docs/triagem-issues-2026-08-03.md`.

| Veredito | Qtd | Issues |
|---|---:|---|
| ✅ CONFIRMADA — fechada com comentário de evidência | **23** | #220–#229, #231, #244, #246, #247, #249, #253, #258, #261, #265, #267, #270, #271, #278 |
| 🟡 PARCIAL — segue aberta, com comentário do que falta | **29** | #230, #232–#238, #240, #241, #245, #248, #252, #255–#257, #259, #260, #266, #268, #269, #272–#277, #279, #281 |
| ⚪ NÃO É CÓDIGO — depende do autor | **1** | #264 |

**Menos da metade se sustenta no código.** Fechar as 53 em bloco teria enterrado 29 pendências
reais. Confirmado no GitHub após a execução: **31 issues abertas** (30 + a #283 nova), exatamente o
previsto.

**Achado estrutural — a #283 nasceu daqui.** Nove issues da cadeia EVI de recebíveis (#230,
#232–#237, #240, #241) têm a matemática construída e testada, mas **não ligada ao cálculo real**.
Não é inferência: `frontend/fluxo-caixa-motor.ts:505-511` declara que as funções "NÃO
estão ligadas a `receitaMensalLinha`/`calcularFluxo`" e que "o motor legado continua sendo o único
caminho de cálculo real". `pmt`, `pagamentosPrazoFixo`, `pagamentosAteMarco`, `pagamentosConcentrado`,
`receitaBrutaSafra`, `jurosSafra`, `componentesEfetivosSafra` existem, têm teste, e **nenhum estudo
real passa por elas**.

A **#283** (`[EVI-023] ligar o motor de componentes/safras ao calcularFluxo`) foi aberta com o
escopo, o raio de impacto (10 módulos consumidores, fixtures Calliandra a revalidar) e a
**precondição de UI**: `frontend/tela-fluxo-receitas.ts:748+` ainda edita o modelo legado
(`entrada`/`pct`/`parcelas`), e `ComponentePagamento` não aparece em tela nenhuma. Não implementada
de propósito — ligar o motor muda o resultado de todo estudo existente e exige decisão de
compatibilidade do autor.

**Correção de doc pega pela triagem:** o `CLAUDE.md` afirmava que `fmtR$` usava
`maximumFractionDigits: 0`. Falso desde `e72c111` — `viab-format.ts:14` usa 2 casas. A nota foi
corrigida; o que resta da #281 é `exportar.ts:10` ainda ter o seu próprio formatador.

**Confiabilidade da triagem:** 6 verificadores em paralelo, um por família de issues, cada um
conferindo contra o código. **11 vereditos ✅ foram re-conferidos manualmente** antes de qualquer
fechamento — todos bateram. Regra anti-carimbo aplicada: ✅ sem `arquivo:linha` vira 🟡.

---

## 53 issues implementadas continuavam abertas — faltou a keyword de fechamento (2026-08-03)

**Sintoma:** o autor tinha **53 issues abertas** no GitHub descrevendo trabalho já feito, mergeado e
declarado concluído neste arquivo e no `CLAUDE.md` — as Rodadas 5 (EVI, #220–#241) e 6 (lista de
bugs, #244–#281) inteiras.

**Causa raiz (confirmada por contagem em `origin/main`):** os commits citam a issue como **menção**,
nunca como keyword de fechamento:

```
fix(terreno): garantir uma única linha Preço obrigatória, também em legados (#256)
feat(financeiro): motor dos 4 instrumentos + waterfall (FIN-04+05+06+07, #273-276)
feat(financeiro): aba Capital Stack — editor de camadas (FIN-08+09, #277+278)
```

| keyword na `main` | ocorrências | issues fechadas |
|---|---|---|
| `Closes #NNN` | 6 | **6** (#239, #250, #251, #254, #262, #263) |
| `Fixes` / `Resolves` | 0 | 0 |
| menção `(#NNN)` sem keyword | ~82 | **0** |

As 6 que usaram `Closes` são exatamente as 6 que fecharam. **A falha é silenciosa** — não há erro, o
PR mergeia, e a lista de pendências passa a mentir sobre o estado do projeto.

Duas armadilhas específicas, que uma regra genérica não pega: **intervalo/composto** (`#273-276`,
`#277+278`) não fecha nem com keyword — o GitHub exige a keyword repetida por issue; e
`Closes #1, #2` fecha só a **#1**.

**Por que a regra não pegou:** ela existe, escrita em detalhe — mas no `CLAUDE.md` do monorepo
`urbiverso/urbiverso`. O `CLAUDE.md` **deste** repo, o único que uma sessão trabalhando no app lê,
não dizia nada sobre fechamento de issue.

**Prevenção implementada:**
- `scripts/guard-issue-fechamento.mjs` (novo) — barra PR que cita issue sem declarar o que faz com
  ela. Detecta menção sem keyword, intervalo/composto e keyword seguida de lista. Escape consciente
  para citação legítima: `Sem-fechamento: #NNN <motivo>`. Não obriga a fechar — obriga a **decidir**.
  Node puro, sem dependência, mesmo padrão do `guard-json.mjs`.
- Job `issue-fechamento` no `.github/workflows/pr-guards.yml`, lendo corpo do PR **e** mensagens dos
  commits (o GitHub fecha pelos dois; foi na mensagem de commit que as 53 foram citadas).
- `CLAUDE.md` — seção nova **§ Fechamento de issue** com a tabela das formas que falham caladas, e
  correção da § Estado do backlog, que declarava as rodadas concluídas sem dizer que as issues
  seguiam abertas.

**Verificado:** 9 casos de fixture nos dois sentidos (entrega com `Closes`, menção nua, intervalo,
lista, `Sem-fechamento:`, `Fecha` em português, auto-referência da própria PR, PR sem issue,
multi-keyword) · **contraprova histórica**: o guard reprova os 4 commits reais que causaram o
problema (`4f920a6`, `bbf87eb`, `1b6eea9`, `e7d11f4`), apontando `#273-276` pelo nome.

**PENDENTE — não feito nesta sessão, por decisão do autor (custo de tokens):** conferir os critérios
de aceite das **53 issues** uma a uma contra o diff e **fechar as cumpridas**. O levantamento já
está pronto: **todas as 53 têm commit de implementação mergeado na `main`** (mapeamento
issue→commit feito nesta sessão), e uma amostra foi validada em profundidade (#244 →
`montarCopiaEstudo` em `backend/rotas/estudos.ts`, com 3 testes dedicados, critérios atendidos).
**Mas "tem commit" ≠ "critério de aceite cumprido"** — a conferência real continua devendo. Duas
exceções já conhecidas: a **#254** (epic de rastreio, sem diff próprio) já fechou, e a **#264** tem
critério de aceite que não é código (confirmação da versão publicada na instância).

---

## Release v0.1.19 reprovada na instalação — comentário `//` no `schema.json` (2026-08-03)

**Sintoma:** o modal "Atualizar Estudo de Viabilidade" mostrava `v0.1.19_b57117c` (rótulos
`schema · roda migração`, `homologada`, `recomendada`) e recusava com **"Pacote reprovado na
validacao"**.

**Causa raiz (confirmada rodando o validador do shell, não por hipótese):** a fase 4 da cascata de
áreas (commit `4041d1f`) inseriu um bloco de **8 linhas de comentário `//`** no `schema.json`
(linhas 46–53, descrevendo a tabela de áreas em cascata). **JSON não tem comentário.** O shell faz:

```
shell/backend/src/validacao/schema.ts
  try { raw = JSON.parse(conteudo); }
  catch (e) { return [{ check: 'schema', detalhes: `JSON invalido: ${e.message}` }] }
→ validacao.ok = false
→ instalacao-apps.ts:463  falhar('validacao', 422, 'Pacote reprovado na validacao')
```

O pacote era reprovado **antes de o shell olhar uma única tabela** — nada a ver com a migração 020,
com o bump `0.1.18→0.1.19` (que está correto) nem com conflito de dado no banco (esse teria a
mensagem diferente, "Pacote reprovado no dry-run de schema"). Era a primeira vez em toda a história
do repo que o `schema.json` continha comentário: o commit anterior (`9e577df`) tinha zero.

**Por que atravessou tudo em verde** — é a mesma família do #160/#162 (falha silenciosa que nenhuma
etapa enxerga): `tsc`, os 334 testes, o `esbuild` e o harness de migrações **não leem o
`schema.json`**. Quem lia era o `scripts/validar-schema.mjs` (que faz `JSON.parse` estrito, criado
depois do pacote `0.1.12` reprovado por `"tipo": "logico"`) — mas ele é a **etapa 2/5** do
`validar-backend.sh`, e a **etapa 1/5 aborta com `exit 1` quando `node_modules/@urbiverso/sdk` não
existe**, que é a regra do ambiente Claude Code (SDK privado, 401). Ou seja: o único parse estrito
do repo nunca chegava a rodar aqui.

**Correção:**
- `schema.json` — as 8 linhas de comentário removidas. Diff de **8 deleções e nada mais**: nenhuma
  tabela, coluna, tipo ou índice mudou. O conhecimento que o comentário carregava já vive nos
  lugares certos — a semântica `_modo`/`_valor` no cabeçalho de `frontend/areas-cascata.ts`, e a
  soma de `faixas_nao_edificaveis_pct`/`areas_privativas_nao_vendaveis_pct` no cabeçalho da
  `migracoes/020_areas_cascata_loteamento.js`.
- `scripts/guard-json.mjs` (novo) — guard de JSON estrito para `schema.json` e `manifesto.json`.
  **Não depende de SDK, rede nem `node_modules`**, que é exatamente o que fazia o check existente
  ser pulado. Quando reprova, aponta a linha e lista as linhas de comentário.
- Ligado em **três** pontos, para não depender de ninguém lembrar: etapa 1/5 do
  `validar-frontend.sh` (o script que sempre funciona neste ambiente), etapa **0/5** do
  `validar-backend.sh` (**antes** do portão do SDK que abortava cedo) e job `json-estrito` no
  `.github/workflows/pr-guards.yml` (só `node`, sem credencial — pega quem não rodou nada local).

**Verificado nesta sessão:** o `validador-schema.ts` real do shell rodado contra o `schema.json`
corrigido (via `node --experimental-strip-types`, os dois arquivos são TS só de anotação) →
**19 tabelas, zero erros**; harness de migrações verde (contrato, banco vazio, reexecução e cadeia
001→020); guard reprovando o estado anterior e passando no corrigido (contraprova com `git stash`).

**`versao` continua `0.1.19`** — e tem que continuar: a `versao` descreve o **schema**, e o schema
não mudou (só saiu comentário). Como não há degrau de versão, a plataforma só instala este build
pelo caminho **mesma versão com `build_sha` à frente**, o que exige a tag carregando o sha:
`viabilidade-v0.1.19_<sha8>`. Disparar o `release.yml` por **workflow_dispatch** (Actions → release
→ Run workflow), que gera a tag com sha sozinho. Tag sem sha trava o upgrade dentro da mesma versão.

---

## Fase 10 — Fechamento da trilha: Rodadas 5 (EVI) e 6 (lista de bugs) ENCERRADAS (2026-08-02)

Em 2026-08-01 o autor aprovou uma **trilha única de 10 fases** unificando a Rodada 5 (EVI,
#220–#241) e a Rodada 6 (lista de bugs, #238/#239/#244–#281 — 37 destinos), plano em
`~/.claude/plans/me-ajude-a-criar-crystalline-wombat.md` (fora do repo). Esta entrada fecha a
trilha; o detalhe de cada fase individual não foi registrado neste arquivo fase a fase — só nesta
entrada de fechamento — porque as sessões da trilha inteira ocorreram em sequência contínua.

### O que foi entregue, por fase

- **Fase 0** — aprovação das 12 emendas da revisão Calliandra (issues #220,#227,#229,#230,#231,
  #232,#233,#234,#236,#237,#240,#241), com 4 decisões de autor resolvidas (`N_s≤0` bloqueia,
  corretagem sobre bruto/VGV, modelo de 4 componentes, juros no mês da contratação default falso).
- **Fase 1** — ganhos rápidos de UX/navegação, zero matemática: #244, #245, #247, #250+#251, #262,
  #263, #264 (sem diff — ver nota abaixo), #265.
- **Fase 2** — portões #220 (fixtures dourados Calliandra) e #221 (inventário de dados legados).
- **Fase 3** — nomenclatura (#222, #223) + cronograma (#224→#225→#226) + custos (#249+#261, #255,
  #252, #246).
- **Fase 4** — fundação comercial/fiscal/temporal EVI: #227→#228→#229, #230, #231.
- **Fase 5** — recebíveis por safra, o núcleo matemático: #232, #233 (corrige a premissa publicada
  errada — 1ª parcela é `s+1`, não no mês da venda), #234, #236, #237, #235.
- **Fase 6** — valor canônico + terreno: #259→#281→#260→#256→#257→#258(#266→#267→#268)→#253. 4
  migrações novas, `versao` 0.1.12→0.1.16.
- **Fase 7** — #238, permuta financeira bruta/líquida do terreno. 1 migração, `versao`→0.1.17.
- **Fase 8** — #240 (invariantes), #269 (reconciliação permuta física), #241 (apresentação/KPIs),
  #248 (editor de pagamento por componentes).
- **Fase 9** — epic #239 (Programa Financeiro / Capital Stack) + FIN-01…FIN-10 (#270–#279), em 4
  grupos. 1 migração (019), `versao`→0.1.18. Motor dos 4 instrumentos (§4), prioridade de funding
  (§5) e waterfall (§6) — promovido do oráculo de 16 golden cases do #270 em vez de reimplementado,
  por não existir planilha real de Capital Stack para comparar.
- **Fase 9 (segunda verificação, pedida pelo autor após o merge)** — releitura linha a linha de
  tudo contra `docs/viabilidade/funding-capital-stack.md`. **3 defeitos reais corrigidos:** ordem
  principal×remuneração invertida no §6.1 (Preferred Equity modo A pagava a remuneração antes do
  principal); migração 019 gravava `preferred_equity` com um shape que o motor nunca lê
  (`aporteValor`/`retornoTipoLegado` em vez de `aportes`/`modo`) — todo instrumento migrado do
  Bloco G ficaria permanentemente inerte mesmo após ativação; `prioridade_pagamento` (coluna real,
  campo do §9) nunca era lida pelo motor nem editável na UI. Nenhum dos 16 golden cases exercia os
  3 cenários (exigem caixa insuficiente concorrente ou 2+ instrumentos do mesmo tipo). **2 lacunas
  documentadas, não corrigidas** (decisão de produto pendente): só um Sponsor Equity é simulado por
  vez; ambiguidade de leitura §3.1×§7 sobre a ordem de aportes vs. cálculo de necessidade.
- **Fase 10 (esta entrada)** — fechamento: confirmado que as 59 issues distintas das duas rodadas
  estão mergeadas na `main`, exceto #254 (fecha por rastreio, sem diff próprio) e #264 (ver nota).
  Suíte completa (313 testes), harness de migrações e build (esbuild) verdes na `main` pós-merge.
  `CLAUDE.md` atualizado declarando as duas rodadas encerradas.

### Nota sobre #264

O último release publicado antes da trilha era `viabilidade-v0.1.12_6655ac74` (2026-07-29). A `main`
já mostra as duas séries de Cenários quando qualquer slider sai do zero, e o estado 0% é decisão
explícita das #131/#132 — não sobrou bug de código. O critério de aceite restante da #264 é o autor
confirmar, no ambiente autenticado, que a instância publicada roda uma versão que inclui todo o
trabalho desta trilha (senão o sintoma reaparece por build desatualizado, não por regressão).

### Pendências do autor no ambiente autenticado (consolidado)

`urbi-empacotar`; sincronização do `schema.json` pelo SDK (`analise_mercado`/`mercado_regioes`/
`mercado_coletas` + a tabela nova `avancado_capital_instrumentos`); execução real da cadeia
completa de migrações `001`–`019` no Postgres (nunca rodada em produção); confirmação de que o
shell descobre `export { rotinas }` em `backend/rotas.ts`; configuração de
`mercado_busca_url`/`mercado_busca_chave`; e a confirmação de versão publicada da #264.

---

## Planejamento da lista de bugs — 24 itens, Rodada 6 aberta (2026-08-01)

Branch `claude/viabilidade-buglist-matrix-t2yjz3`, a partir de `c0586ef`. Sessão **documental e de
backlog**, conforme autorização explícita do autor. **Diff só em `.md`** —
`git diff --stat c0586ef -- ':!*.md'` volta vazio. Sem schema, sem migração, sem backend, sem
frontend, sem `manifesto.json`; `versao` **não muda**.

### O que foi feito

A planilha `lista_bugs_revisada_para_issues_todos_itens.xlsx` trouxe **24 itens**. Cada um foi
conferido **contra a `main`**, com evidência em `arquivo:linha`, e recebeu um destino GitHub
individual. **Zero itens sem destino; zero implementações duplicadas.**

| | |
|---|---:|
| Novas issues, epics e trackers | **22** (#244–#265) |
| Sub-issues da epic de permuta física | **4** (#266–#269) |
| Issue existente emendada (item 16) | **#238** |
| Issue existente convertida em epic (item 24) | **#239** |
| Sub-issues do programa financeiro | **10** (#270–#279) |
| Issues implementadas | **0** |

Mapa mestre em `docs/lista-bugs-planejamento-2026-07-31.md`; especificação do item 24 em
`docs/viabilidade/funding-capital-stack.md`.

### Cinco correções ao diagnóstico recebido

O backlog anexado à planilha divergia do código em cinco pontos. **Todas as issues foram abertas já
com a versão corrigida** — e a razão de cada divergência ficou registrada, para não se reintroduzir:

1. **#249 (item 6) — a assimetria Início × Duração é de backend também.** O diagnóstico dizia que
   "a tela não aplica a regra". A rota **aceita deliberadamente** sobrescrever a duração derivada
   (`backend/rotas/avancado.ts:1130,1144` — `if (req.body.duracao_meses === undefined)`) enquanto
   trava o início com 422 (`:1134,1148`). Corrigir só a UI deixaria a API divergente. Pior: quando
   o Cronograma muda, `reancorarCustos` reescreve as duas grandezas e apaga sem aviso a duração
   editada.

2. **#257 (item 14) — a regra de migração proposta era insustentável.** O backlog mandava migrar
   por `distribuicao_modo` (`unit_delivery`→física, `sales_revenue`→financeira). Mas
   `fluxo-caixa-motor.ts:385` trata **toda** linha `Preço/Permuta` como permuta *financeira*, e
   `distribuicao_modo` é curva de rateio (`tela-fluxo-custos.ts:163-167`: receita em caixa × VGV
   vendido). A permuta física vem de `unidades_permutadas` nas Tipologias. A regra proposta
   removeria a dedução de caixa de linhas financeiras e contaria a permuta física em dobro.
   **Regra aprovada pelo autor: toda `Permuta` legada → `Permuta financeira`.**

3. **#259 (item 17) — "o Preliminar já está correto" precisava de ressalva.** São **duas
   arquiteturas**: Premissas guarda um campo por unidade e tem a heurística de round-trip da #119
   (`tela-premissas.ts:334-358`), que falha quando o campo companheiro está dessincronizado; Custos
   guarda **um único** `orcamento_valor` + `orcamento_unidade` e arredonda à precisão de exibição a
   cada clique (`tela-fluxo-custos.ts:873-875,882-896`), sem preservação nenhuma. Não dá para
   "copiar a regra do Preliminar" — o contrato canônico tem de cobrir as duas.

4. **#262 (item 20) — escopo reduzido.** A parte de "empurrar cards vizinhos" **já foi corrigida
   pela #176** (`min-width:0`, `fluxo-tabela.ts:53-57`). O que sobra é `.kpi-var` em
   `position:absolute` (`:58-63`) sobrepondo o valor dentro do card.

5. **#265 (item 23) — é reversão de decisão, não correção de descuido.** `table.cen{width:auto}` foi
   introduzido de propósito pela #187 (ver a entrada dela mais abaixo neste arquivo: "tabela deixou
   de esticar a 100%"). A issue registra isso e pede a reversão consciente.

### Diferença de release — descartada como causa, com prova

O último release publicado é **`viabilidade-v0.1.12_6655ac74`** (2026-07-29 15:18).
`git log 6655ac74..origin/main` devolve **somente commits de documentação**.

> **Não há código na `main` além do que já foi publicado.** Se o autor ainda vê o sintoma dos itens
> 2, 20, 22 e 23 no app instalado, a instância está rodando **build anterior** (v0.1.4 ou mais
> velho) — não é a `main` que está atrás.

Isso muda o item 22 de "bug" para "verificação + decisão": a `main` **já mostra as duas séries**
quando qualquer slider sai do zero (`tela-cenarios.ts:250-260`); o estado 0% é decisão explícita das
#131/#132. O trabalho real da #264 é confirmar a versão instalada e registrar/testar a decisão do 0%.

### Decisões do autor nesta sessão

1. **Alvo do item 24 = `Viabilidade → Financeiro`** (`tela-financeiro.ts`, o Bloco G), conforme a
   especificação §1 e a #239. A planilha registrava "Seção: Custos · Aba: Financeiro", mas o
   conteúdo do pedido é o do Bloco G. `Custos → Financeiro` permanece grupo de custos operacionais —
   a FIN-10 (#279) declara isso ao encerrar o programa.
2. **Taxonomia GitHub = prefixo no título** (`[BUGLIST-0NN]`, `[FIN-0N]`), labels só
   `bug`/`enhancement`. Nenhum label novo — mesmo padrão de `[EVI-0NN]`, preservando o que a
   auditoria da Rodada 5 registrou.
3. **Migração da `Permuta` legada = toda para `Permuta financeira`** (ver correção 2 acima).

### Contrato de precisão monetária — a decisão que fechou a #259

Ao rever a dúvida da #259, o autor fixou o princípio geral:

> **Todo valor monetário que é resultado de fórmula tem 2 casas decimais** — na apresentação, na
> entrada e no motor. Representações derivadas **não monetárias** (`% do VGV`, `R$/m²`) carregam
> **precisão plena** internamente e arredondam **só para exibir**.

Isso responde a pergunta arquitetural: **o canônico é o valor monetário, a 2 casas**; percentual e
R$/m² são derivados dele. Reproduzir o caso relatado deixa de ser pré-requisito e vira caso de teste.

Registrado como convenção **C7** (`padrao-incorporacao.md`, Anexo A) e replicado no `CLAUDE.md`, no
`INSTRUCOES-CODE.md`, em `modelo-de-dados.md` (§ Regras de precisão, agora separando **precisão de
persistência** de **precisão de resultado**) e em `formulas.md`.

**Ao verificar o alcance do princípio no código, apareceu uma violação que não estava em issue
nenhuma:**

| Ponto | Casas hoje | |
|---|---|---|
| `frontend/viab-format.ts:8` — `fmtR$`, **53 usos em 11 telas** | **0** | ❌ |
| `frontend/tela-fluxo-custos.ts:638,873-875` — Orçamento em `rs` | **0** | ❌ |
| `frontend/exportar.ts:9` — `toFixed(2)` | 2 | ✅ |
| `frontend/fluxo-caixa-motor.ts` — resultados monetários (`Math.round` só em meses) | float | ❌ |

**A tela e a exportação mostram números diferentes para o mesmo estudo hoje** — a persistência nunca
foi o problema (`decimal(12,2)` desde sempre). Como `fmtR$` é definido num ponto só, a correção é
pequena, mas muda **toda** a apresentação monetária do app de uma vez; por isso ganhou destino
próprio — **#281** (`BUGLIST-017-A`), sub-issue da #259 — em vez de virar ajuste pontual. A
quantização dos resultados do motor entrou no escopo da **#260**.

Emendas aplicadas: **#259** (contrato + dúvida resolvida + sub-issue) e **#260** (quantização no
motor + fechamento de soma). Total de destinos da Rodada 6 passa de 36 para **37**.

### Pendências deixadas em aberto

- **#256 e #258** — dependem do inventário de produção (**#221**): quantos estudos têm linha `Preço`
  sem `obrigatoria=true`, e quantos têm `unidades_permutadas > 0`. Não é verificável neste ambiente.
- **#266** — base de valoração quando a mesma tipologia tem `preco_m2` diferente por Grupo.
  **Não usar média implícita**; ADR antes de código.
- **As 12 emendas EVI continuam pendentes.** A autorização desta sessão cobria editar apenas #238 e
  #239. As demais ficam como estão no GitHub, agora rastreadas pela epic **#254** — que existe
  justamente para impedir o padrão #165–#169 (backlog preparado que ninguém pega).

### Declaração

Nenhuma linha de runtime foi alterada. `frontend/`, `backend/`, `schema.json`, `migracoes/`,
`manifesto.json` e `scripts/` estão intactos. Nenhuma issue foi fechada. As #220–#241 continuam
**todas abertas, nenhuma implementada**. PR **draft**, sem merge, sem keyword de fechamento — este
PR não fecha issue nenhuma, ele as cria.

---

## Revisão de recebíveis por safras — referência Calliandra (2026-07-31)

Branch `claude/cashflow-formulas-rules-km5538`, a partir de `519bfbf`. Sessão **documental e
diagnóstica**, conforme instrução de sessão recebida do autor. **Diff só em `.md`** —
`git diff --stat 519bfbf -- ':!*.md'` volta vazio. Sem schema, sem migração, sem backend, sem
frontend; `versao` **não muda**; `validar-frontend.sh`/`validar-backend.sh` não se aplicam.

### A conclusão

> **Cada mês de contratação cria uma safra própria.** O caixa mensal é a soma dos pagamentos
> imediatos das vendas do mês com as parcelas e liquidações de todas as safras anteriores ainda
> ativas — e a **primeira parcela recorrente vence em `s + 1`**, não no mês da venda.

Isso **derruba uma premissa que estava escrita no repo**: o padrão anterior dizia
`prazo da safra = último mês da Obra − mês da venda + 1`, com a primeira parcela no mesmo mês. O
modelo correto é `N_s = M − s` com primeira parcela em `s + 1`. A premissa errada já tinha sido
copiada para o corpo da issue **#233 / EVI-013**, inclusive no critério de aceite.

Também ficou claro que **a "tabela longa" não é um modelo único**: prazo fixo (120 parcelas) e até
marco (parcelas até o fim da Obra + repasse concentrado) são regras temporais distintas.

### O que foi conferido, não presumido

O cenário de **prazo fixo** foi reconciliado contra `20250820_EV_Calliandra_rg_1.xlsx` (aba `Fluxo`,
coluna `Receita Total (VGV)`) e bate **exatamente** nos 10 meses de controle. A mecânica foi
reproduzida por construção: taxa mensal `1,15^(1/12) − 1 = 1,1714917%`, à vista
`20% × 0,95 × contratado`, PMT com primeira parcela em `s + 1`, N = 36 e N = 120. O mês 13 fecha em
`4 × 11.059,94 + 8 × 8.294,95 = 110.599,40` na curta.

O cenário **até Obra + repasse** vem de outro arquivo, não fornecido. Os inputs que faltavam foram
reconstruídos por engenharia reversa e fecham nos três pontos de controle: base
R$ 28.547.740,29 uniforme em 12 meses (R$ 2.378.978,36/mês), 15% / 15% / 70%, taxa zero.

**Achado crítico:** nenhum dos dois cenários trazia base contratada nem curva de absorção — sem
elas a fixture dourada de **#220**, que é o portão da Rodada 5 inteira, não era construível. Os
inputs verificados entraram no Anexo G do padrão funcional e na §11 da inteligência EVI.

**Sobre a `Venda Casas`:** ela é **1 de 53 lotes** (1,8868%) e tem regra própria — 240 parcelas com
30% de sinal — que **não aparece nas colunas de receita do fluxo**. As três modalidades
representadas somam **98,1132%**, não 100%. A fixture precisa isolar a base ou modelar a quarta
regra; não force fechamento artificial. Calliandra, note-se, é um **loteamento**: o que se importa
dele é a mecânica de recebíveis, não produto nem custo.

### Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `docs/viabilidade/inteligencia-evi-incorporacao.md` | Substituído pela versão revisada + inputs dos cenários, origem da referência e detalhe da `Venda Casas` |
| `docs/viabilidade/padrao-incorporacao.md` | Substituído pela versão revisada + as mesmas correções, âncora do Anexo F, ponteiro EVI-015/#235 e restauração do detalhe do comportamento vigente em §11.6.1 |
| `docs/revisao-recebiveis-calliandra-2026-07-31.md` | **Novo.** Nota de revisão com a reconciliação completa e as emendas que a spec precisaria receber |
| `docs/rodada-5-evi-2026-07-31.md` | Auditoria original **preservada**; nova §2.1 com 8 linhas de divergência e correção dos ponteiros de seção que a renumeração do Doc 2 invalidou |
| `docs/issues-evi-propostas-2026-07-31.md` | Corpos originais **intactos** + nova seção *Emendas pendentes de aprovação* |
| `docs/viabilidade/modelo-de-dados.md` | Seção consultiva *Evolução de domínio prevista para recebíveis* |
| `docs/viabilidade/formulas.md` | Aviso de onde vivem as fórmulas do fluxo por safras + proibição de copiar carteira do Urbitá |
| `docs/viabilidade/exportacao.md` | Linhas previstas como evolução dependente de #241 |
| `docs/viabilidade/visao-geral.md` | Nível Avançado deixou de ser descrito como "v2"; ponteiro para o modelo de referência |
| `CLAUDE.md` | Nota das 12 issues que exigem emenda; anexos A–G; nota de ambiente sobre PR via MCP |

### ⚠️ Doze issues precisam de emenda antes de serem implementadas

**#220, #227, #229, #230, #231, #232, #233, #234, #236, #237, #240 e #241.** Os corpos publicados
no GitHub **não foram tocados** — a instrução da sessão proíbe abrir, fechar, editar ou comentar
issue, e o autor confirmou essa escolha. As emendas propostas estão em
`docs/issues-evi-propostas-2026-07-31.md`, seção *Emendas pendentes de aprovação*, **pendentes de
aprovação do autor**.

A pior é a **#233**: seu critério de aceite afirma *"a 1ª parcela ocorre no mês da venda"*.
Implementá-la pelo corpo atual produz a regra errada **com aparência de aderência ao documento**.

A Rodada 5 continua com **22 issues, todas abertas, 0 implementadas**. A ordem dos portões não
mudou.

### Nada de runtime mudou

Nenhuma linha de `frontend/`, `backend/`, `schema.json`, `migracoes/` ou `manifesto.json`. O modelo
por safras **não está implementado** e nenhum documento afirma que esteja. A decisão do autor
sobre #190/#191 (Anexo F) continua vigente como comportamento do runtime: a mudança de
entendimento **não autoriza refatoração antecipada**.

---

## Alinhamento documental EVI + backlog preparado (2026-07-31)

Branch `claude/viabilidade-incorporacao-padroes-vksjs7`, a partir de `8ff6679`. Sessão
**documental e diagnóstica**, conforme instrução de sessão recebida do autor.
**Diff só em `.md`** — `git diff --stat 8ff6679 -- ':!*.md'` volta vazio. Sem schema, sem migração,
`versao` **não muda**; `validar-backend.sh` não se aplica.

### O que entrou

O commit `8ff6679` tinha largado dois documentos grandes **na raiz do repo**, fora do framework de
documentação. Esta sessão os colocou no lugar:

1. **Documento 1** → `docs/viabilidade/inteligencia-evi-incorporacao.md`. Regra de **mínima
   intervenção**: só frontmatter, comentário do framework, aviso de status consultivo e
   `Veja também`. **Nenhuma linha do conteúdo econômico foi alterada** — nenhum erro inequívoco foi
   encontrado para corrigir.
2. **Documento 2** → **integrado** em `docs/viabilidade/padrao-incorporacao.md`, que agora tem a
   espinha de 27 seções do padrão funcional. O material específico do app foi **preservado nos
   anexos A–E** (convenções de cálculo, dicionário de campos reais, modelo de dados, armadilhas
   conhecidas, API), não descartado. Cada divergência entre documento e código está rotulada como
   **Comportamento vigente** / **Modelo funcional de referência** / **Evolução dependente de
   issue** — 21 blocos ao todo. O texto usa **Grupo** e **Após-chaves**; a nomenclatura legada da
   tela está registrada, e **nada foi renomeado no código**.
3. `docs/rodada-5-evi-2026-07-31.md` — matriz de aderência, com status e classe de impacto
   (D0/U1/M2/P3/I4) por conceito e evidência em `arquivo:linha`.
4. `docs/issues-evi-propostas-2026-07-31.md` — **21 corpos de issue prontos**.

### ⚠️ As issues NÃO foram abertas

A instrução exige aprovação explícita do autor antes da abertura, e receber o documento não
equivale a aprovar. **Nenhuma issue existe no GitHub** — a consulta confirmou 0 abertas. O
`CLAUDE.md` foi atualizado na mesma alteração para registrar que existe lista preparada aguardando
decisão, justamente para não repetir o caso #165–#169.

### Achados que mudaram a lista original

- **EVI-005 encolheu**: a #165 já ancorou o Pré-lançamento ao fim do Planejamento. Sobra a **Obra**,
  cujo `inicio_mes` continua livre em `recalcularTravados`.
- **`receitaBrutaVgv` mede outra coisa**: `vgvTotal − vgvPermutaFisica` é o VGV vendável, não a soma
  dos recebimentos que o nome promete (#188). Vira EVI-009 + EVI-017.
- **Corretagem sobre base errada**: `ctxCusto.receitaTotal` parte de `vgvLinha` (VGV bruto), então
  comissão e RET incidem sobre unidade permutada fisicamente, que nunca gera caixa — enquanto a
  receita usa `vgvVendavelLinha`. Vira EVI-008.
- **Horizonte empilha sobra**: `saida[saida.length - 1] += valor` deposita no último mês tudo que
  não cabe, e o prazo derivado ignora parcelas. Vira EVI-011, **portão** para EVI-012/013.
- **Financiamento à produção é feature invisível**: os 5 campos `financiamento_*` existem no
  `schema.json` e têm controle em `tela-financeiro.ts`, mas o motor **nunca os lê**. Viola "UI e API
  andam sempre juntas" — EVI-019 tem de **decidir** entre integrar ou remover as duas pontas.
- **Não há fixture dourada** em nenhum dos 11 arquivos de teste → EVI-001 confirmada como portão.

### Validação

`bash scripts/validar-frontend.sh` verde (guard de aspas curvas + typecheck + **124 testes** +
build). `git diff --check` limpo. Links relativos de `docs/viabilidade/` todos resolvem; nenhum
`.md` sobrando em link de slug; `ordem:` removido dos dois docs tocados (o campo foi retirado do
framework).

### Limpeza dos mapas mestres antigos

A pedido do autor, os quatro mapas de backlog fechado foram **apagados**:
`docs/lotes-bugs-2026-07-20.md`, `docs/etapas-bugs-2026-07-22.md`,
`docs/sessoes-bugs-2026-07-25.md` e `docs/rodada-4-planilha-2026-07-27.md`.

Auditoria feita antes de apagar: **nenhum código, workflow, `manifesto.json`, script ou teste os
referencia** — o acoplamento era só documental (`CLAUDE.md` e entradas datadas deste arquivo). Todas
as issues das quatro rodadas estão mergeadas, então os mapas não disparavam mais trabalho.

O que **ainda valia** foi migrado antes: as decisões do autor que não se relitigam (#185 sobre a
limitação de `SerieGrafico`, #190/#191 sobre as parcelas ancoradas no cronograma da Obra, #192 sobre
a linha `Projetado`) viraram o **Anexo F** de `docs/viabilidade/padrao-incorporacao.md`, e o
detalhamento das parcelas "ao longo da obra" virou a §11.6.1. As causas raiz que a Rodada 4
descrevia já haviam sido corrigidas pelas próprias issues.

> ⚠️ **As entradas antigas deste arquivo continuam citando os quatro caminhos apagados.** Isso é
> proposital: elas são registro datado do que existia à época e não foram reescritas. Quem
> encontrar um `docs/<rodada>.md` numa entrada anterior a 2026-07-31 deve procurar no `git log`, não
> no working tree.

### 2ª auditoria: conferir cada corpo contra o código

O autor pediu a verificação dos 21 corpos contra o app real. **Quatro tinham premissa factualmente
errada** e foram reescritos; cinco tinham lacuna de dependência. Achados:

- **O recebível do Avançado já é líquido.** `receitaMensalLinha` aplica
  `fator = vglLinha(vgv, fp) / vgv`, e `vglLinha` subtrai comissão destacada e RET. Logo
  `receitaMensal` **não é** "recebimento do cliente", e o invariante da Receita Bruta não fecharia
  nem com taxa zero. Quebrava EVI-017, EVI-018 e EVI-019 de uma vez → virou **EVI-022**, a issue
  raiz da Onda 2.
- **`pos_obra` tem dois papéis.** É janela comercial **e** âncora de linha de custo, e
  `ancorarLinhaCusto` copia início **e duração**. Travar a duração em 12 travaria a manutenção
  junto. EVI-007 foi reescrita para **desacoplar** a janela do evento, o que resolve sem migração.
- **A aba Financeiro inteira é inerte** — não são 5 campos, é o Bloco G (financiamento, estrutura de
  capital, investidor, regime tributário, correção). EVI-019 foi ampliada e o eixo fiscal migrou
  para EVI-022.
- **Corretagem pode dobrar:** existe em `fluxo_pagamento.comissao` e como linha de custo obrigatória
  `pct_vgv` (#121). Com "Destacada" é contada duas vezes.
- **`cronogramaPadrao()` viola a regra da EVI-005** — cria `obra` no mês 17.
- **Lançamento pode terminar depois da Obra**, e nenhuma issue tratava o caso.

### Rodada 5 aberta — #220 a #241

Com autorização do autor, as **22 issues foram abertas**. Correspondência `EVI-0NN → #NNN` no mapa
mestre; o `CLAUDE.md` foi atualizado **na mesma alteração**, como a regra exige.

As pendências antigas (#199, #200) seguem inalteradas.

---

## #201 — Sinais de risco e insights + ENCERRAMENTO DA RODADA 4 (2026-07-29)

Branch `claude/r4-201-riscos-insights`. Não é portão. Pré-requisitos #199 e #200 já na `main`.
**Só frontend** (+ um ajuste de prompt) — sem schema, sem migração, `versao` **não muda** (o guard
do `validar-backend.sh` confirma: "0 migrações novas, versao coerente").

### A issue

Reordena e completa a tela conforme a referência visual, e fecha o requisito que o #200 deixou
gravado mas não exibido: **procedência por indicador**.

1. `frontend/analise-mercado.ts` — `lerIndicador(analise, campo)` (pura, 6 testes novos): o #200
   grava o valor em coluna própria E o bloco de procedência em `resultado.indicadores`; a tela
   precisa dos dois. Devolve `valor: null` quando falta origem — **número sem procedência é
   tratado como ausente**, que é o critério de aceite. Snapshot legado (sem o bloco) não quebra.
2. `frontend/tela-analise-mercado.ts`:
   - **cabeçalho** com a localidade da análise + data de referência + data da geração, e o aviso
     de isenção (obrigatório, não decorativo);
   - **sinais de risco subiram para o topo**, logo abaixo do cabeçalho — antes ficavam depois dos
     indicadores, contrariando a referência;
   - **limitação explícita** como cidadã de primeira classe: "Sem dado no nível da cidade —
     análise limitada a `<abrangência>`" + o texto de `limitacoes` da IA, em vez de a seção
     simplesmente sumir;
   - cada card mostra **origem + badge de confiança**, e o **insight da IA junto do indicador que
     ele explica** (`observacao`), não num bloco solto no rodapé;
   - **macro passou pelo mesmo crivo**: indicador sem fonte identificada não aparece; se nenhum
     tiver, a seção mostra estado vazio explicando, em vez de sumir.
3. `backend/mercado-ia.ts` — o prompt passa a dizer que `observacao` é o insight **daquele**
   indicador (o campo já existia no schema e já era normalizado; faltava pedir).

### Encerramento da Rodada 4

Com a #201 mergeada, **as 35 issues (#165–#169 + #172–#201) estão na `main`**. O `CLAUDE.md`
obriga quem encerra uma rodada a atualizar a seção de backlog **na mesma alteração** — feito:

- § Estado do backlog: Rodada 4 marcada como concluída, sem backlog ativo, com o aviso de que
  quem abrir/encerrar uma rodada atualiza a seção (foi a falha que originou a própria Rodada 4);
- § Merge: a autorização de auto-merge de portões **era escopada à Rodada 4 e expirou com ela** —
  não há autorização permanente hoje. Registrada também a nota de que o `gh` CLI não existe neste
  ambiente, para a próxima sessão não redescobrir;
- lista das pendências do autor no UrbiVerso, consolidada.

**Validação:** `validar-frontend.sh` verde (typecheck + **124** testes + build) e
`validar-backend.sh` verde (typecheck + 44 testes + 13 migrações + guard).

**Merge:** não é portão; mergeada a pedido explícito do autor ("resolva a última issue... pode
prosseguir e atualizar tudo no main").

---

## #200 — Rota de IA + coleta diária de mercado (2026-07-29) · PORTÃO

Branch `claude/r4-200-mercado-ia-agenda`. **Portão** (→ #201). Pré-requisito #199 já na `main`.
Traz migração (`013`) e bumpa a `versao` `0.1.11` → `0.1.12`.

Escopo **ampliado pelo autor** além da issue: além da rota de IA, entram os dois frameworks do
UrbiVerso — **IA** e **agenda (rotinas)** — para uma coleta diária de notícias e anúncios das
regiões cadastradas.

### O achado que definiu o desenho

**O framework de IA do UrbiVerso não navega na web.** `ia.consultar()` recebe texto e devolve JSON
estruturado — não há tool-use, busca nem `fetch` para o modelo (conferido em
`node_modules/@urbiverso/sdk/dist/index.d.ts`: `IAHelper` tem só `consultar`, `extrairConteudo` e
as variantes async). Levado ao autor, que escolheu **fonte externa plugável**.

Consequência, e é a decisão mais importante do PR: **sem fonte externa configurada a rotina NÃO
pergunta à IA "o que você sabe sobre a região"** — registra `sem_fonte_externa` e não grava nada.
Conteúdo de memória de modelo entraria no app com cara de notícia apurada e alimentaria a
viabilidade. Há teste garantindo que a IA sequer é chamada nesse caso.

### Frameworks usados (contratos conferidos no `index.d.ts`, não presumidos)

- **IA** — `manifesto.json` já tinha `"ia": true`. `SlotIA` inclui **`'barato'`**, usado na triagem
  diária (volume, todo dia, toda região); a análise do estudo usa o slot padrão.
- **Agenda** — `rotinas.coleta_mercado_diaria` com `frequencia: "diaria"` no manifesto;
  `HandlerRotinaApp = (ctx: ContextoListener) => Promise<ResultadoRotinaApp>` em
  `backend/rotinas.ts`, reexportado por `backend/rotas.ts` (`export { rotinas }`), que é a única
  entrada de backend do build.

### O que entrou

1. `schema.json` — `mercado_regioes` (região + palavras-chave + status da última coleta),
   `mercado_coletas` (itens com procedência), `estudos.regiao_mercado_id` e, em `analise_mercado`,
   `gerado_em` + `modelo`. Migração `013`, aditiva.
2. `backend/mercado-ia.ts` (puro) — schemas de structured output, prompts e **a trava
   anti-invenção**. `EIXOS_RELEVANCIA` reusa os 6 fatores do Apelo Comercial: o app já definiu por
   quais parâmetros se avalia uma região.
3. `backend/rotinas.ts` — a rotina diária, com fonte externa plugável, timeout, corte de payload e
   isolamento por região (uma região quebrada não derruba as outras).
4. `backend/rotas/analise-mercado.ts` — `POST` da análise (editor + `422 IA_INDISPONIVEL`), PATCH da
   região do estudo, CRUD de regiões (admin) e GET de coletas.
5. Frontend — botão "Analisar mercado" (sob demanda), seletor de região, sinais de risco, lista do
   material coletado; nova tela de config `viabilidade-config-mercado`.
6. `docs/viabilidade/analise-mercado.md` §7.

### Dois bugs que os testes pegaram (e um risco evitado)

- **`Number(null)` é `0`, e `0` é finito.** A primeira versão de `normalizarIndicador` aceitaria um
  indicador com `valor: null` como **R$ 0,00/m²** na tela — o número inventado que a camada existe
  para barrar. Corrigido com guarda de tipo explícita.
- **`scripts/validar-backend.sh` só varria `backend/rotas/*.test.ts`**, então os 16 testes novos de
  `backend/mercado-ia.test.ts` passaram batido na primeira rodada. Glob corrigido no script **e** no
  `package.json`, que tinha o mesmo buraco.
- **`urbi-textarea` evitado:** o SDK confirma `urbi:input-change` mas não expõe o nome do evento do
  textarea. Usar o palpite deixaria o campo de palavras-chave mudo sem erro nenhum — o campo de que
  a coleta inteira depende. Ficou `urbi-input` com separador por vírgula (`termosBusca` já aceita
  vírgula, `;` e quebra de linha). Trocar por textarea quando o evento for confirmado no monorepo.

**Validação:** `validar-frontend.sh` verde (typecheck + **118** testes + build) e
`validar-backend.sh` verde (typecheck + **44** testes + 13 migrações + guard "1 migração nova,
versao coerente").

**Fica para o autor no UrbiVerso:** `urbi-empacotar`; sincronização do `schema.json`; execução da
migração; **confirmar que o shell descobre `export { rotinas }` no módulo de entrada do backend**
(o `index.d.ts` documenta `export const rotinas = { nome: fn }` mas não o arquivo); e configurar
`mercado_busca_url`/`mercado_busca_chave` para a coleta sair do modo `sem_fonte_externa`.

**Merge:** portão (`Portão? = SIM` → #201) — mergeado pela sessão após validação verde.

---

## #199 — Análise de Mercado: schema e tela (2026-07-29) · PORTÃO

Branch `claude/r4-199-analise-mercado`. **Portão** (`Portão? = SIM` → destrava #200 e #201). Sem
pré-requisito. **Traz migração e bumpa a `versao`** (`0.1.10` → `0.1.11`).

### Antes: validação de backend passou a rodar aqui

A regra "backend só roda no ambiente autenticado do autor" era conservadora demais. Descoberto
nesta sessão:

- o `@urbiverso/sdk` **já está** em `node_modules/@urbiverso/sdk` com o `dist/index.d.ts`. O que
  toma 401 é *reinstalar* o pacote; o typecheck só precisa dos tipos, que estão no disco;
- só `backend/rotas.ts` importa o SDK (augmentação de tipo do Express). O resto do backend depende
  só do `express`, que é público e está no store do pnpm;
- os testes de backend importam apenas funções puras das rotas — rodam com `tsx`, sem servidor.

Criados `scripts/validar-backend.sh` (typecheck do backend + testes de rota + migrações + guard de
`versao`) e `scripts/migracoes-harness.mjs` (banco em memória: contrato, instalação virgem,
reexecução e cadeia completa). O guard barra os dois erros simétricos: migração nova sem bump e
bump sem migração — o primeiro já aconteceu de verdade na `004_fases_gantt.js`.

No caminho, os **2 únicos erros de typecheck do backend**, pré-existentes na `main`, foram
corrigidos para o portão nascer utilizável: o `PATCH /avancado/parametros` não tratava o `null` de
`atualizar()` e devolvia **500** onde cabia **404** — mesmo tratamento que o PATCH de curvas já
dava no mesmo arquivo. `CLAUDE.md` atualizado com o fluxo novo.

### A issue

**Decisão de navegação (o item crítico):** a aba "Análise de mercado" renderizava o **Apelo
Comercial**, que é outra coisa — o Apelo pontua o *ativo* (localização, infraestrutura, vetor de
crescimento), não compara o projeto com o mercado. Adotada a opção recomendada pela issue: a aba
virou a análise de verdade e o **Apelo ganhou página própria**, mesmo componente e mesmo backend.
Nada foi removido.

1. `schema.json` — tabela **`analise_mercado`** (`acesso_externo: restrito`): preço/custo por m²,
   `vso_pct`, macros (IPCA/Selic/INCC + Focus), `riscos` e `resultado` JSON, `abrangencia`
   (município/UF/nacional), `localidade`, `origem`, `data_referencia`. Guarda **só o lado
   mercado**.
2. `migracoes/012_analise_mercado.js` — aditiva, sem transformação (a entidade nasce aqui); seed
   fora da migração por contrato. `manifesto.json` `0.1.10` → `0.1.11`.
3. `frontend/analise-mercado.ts` (novo, puro) — deriva o lado **projeto**, que **não é digitado nem
   persistido**: preço = VGV ÷ área privativa (ponderado pela área, não média dos `preco_m2`);
   custo de obra = Σ grupo obra ÷ mesma área, usando as linhas **já resolvidas pelo motor** (mesmo
   argumento do #192 — a resolução de unidade mora num lugar só); VSO = absorção lida como
   velocidade, ponderada pelo VGV das fases. Tudo devolve **`null`, nunca `0`**, quando não dá para
   derivar — zero é valor legítimo e diria outra coisa ao usuário.
4. `frontend/analise-mercado.test.ts` — **9 testes** das fórmulas, incluindo os dois casos que
   pegam erro de verdade: ponderação (média aritmética daria 15.000 onde o certo é 14.444) e
   `null` vs `0`.
5. `backend/rotas/analise-mercado.ts` + registro em `rotas.ts`; `buscarAnaliseMercado` na API.
   Só o **GET** — quem preenche é o #200. Ausência de snapshot responde `{ analise: null }`, **não
   404**: o estudo existe, só nunca rodou a análise.
6. `frontend/tela-analise-mercado.ts` — cards projeto × mercado, bloco macro, banner de isenção
   fixo. Três ausências tratadas separadamente: sem snapshot, sem série do município (avisa que a
   abrangência é mais ampla) e sem dado do projeto (`—` isolado, sem derrubar o resto).
7. `frontend/tela-avancado.ts` — página `mercado` → nova tela; página `apelo` nova.
8. `docs/viabilidade/analise-mercado.md` (novo) + `visao-geral.md` e `modelo-de-dados.md`.

> **Props conferidas no `dist/index.d.ts` antes de usar:** `urbi-kpi` declara só
> `rotulo/valor/variante/formato` — **não** tem slot nem subtítulo, então os cards de comparação
> são markup próprio com tokens do design system, em vez de passar prop inexistente (que ficaria
> inerte, sem erro).

**Validação:** `scripts/validar-frontend.sh` verde (typecheck + **118** testes + build) e
`scripts/validar-backend.sh` verde (typecheck do backend + 22 testes de rota + 12 migrações + guard
confirmando "1 migração nova, versao coerente").

**Fica para o autor no UrbiVerso:** `urbi-empacotar`, sincronização do `schema.json` (materialização
da tabela nova) e execução da migração no Postgres.

**Merge:** portão (`Portão? = SIM` → #200, #201) — mergeado pela sessão após validação verde.

---

## #191 — Nº de parcelas Trimestral/Semestral/Anual "Ao longo da obra" (2026-07-29)

Branch `claude/r4-191-parcelas-periodicidade`. Não é portão — mergeada nesta sessão a pedido
explícito do autor. Pré-requisito **#190 já na `main`** (commit `d4a8d33`, merge `b30fe7d`).
Sem schema/migração; `versao` do manifesto não muda.

⚠️ **Muda números de estudos existentes** que usem Parcelamento com "Ao longo da obra" em
Trimestral, Semestral ou Anual (§10.4 do mapa mestre) — antes essas linhas pagavam **todo mês**.

**Causa:** o ramo `ao_longo_obra` do motor ignorava a periodicidade por completo — Trimestral,
Semestral e Anual espalhavam o valor mensalmente. O #190 arrumou só o caso Mensal e deixou o ramo
herdado no lugar, explicitamente marcado como escopo desta issue.

1. `frontend/fluxo-caixa-motor.ts` — as duas funções criadas no #190 foram **generalizadas** para
   receber a periodicidade, em vez de ganharem uma segunda implementação ao lado:
   - `parcelasAoLongoObra(cronograma, periodicidade?)` = `max(1, floor(duração / intervalo))`,
     intervalo 1/3/6/12. Em Mensal reproduz exatamente o #190 (`floor(dur/1) = dur`).
   - `vencimentosAoLongoObra(cronograma, mesVenda, periodicidade?)` — 1º vencimento no
     `inicio_mes` da obra, os demais a cada `intervalo`.
   O **resto da divisão não vira parcela** (obra de 10 meses em Trimestral = 3 parcelas nos meses
   0/3/6, sobra 1 mês sem vencimento) — é a regra da issue, não arredondamento acidental. Duração
   menor que um intervalo cai no piso de 1 parcela. Com isso o ramo herdado (`fimObra > mesVenda`,
   mensal forçado) **saiu do motor**: "ao longo da obra" tem agora um caminho só.
2. `frontend/tela-fluxo-receitas.ts` — `_parcelasExibidas` passa a periodicidade da linha. Trocar a
   periodicidade recalcula o campo na hora (obra de 24 meses: Mensal 24, Trimestral 8, Semestral 4,
   Anual 2). Continua **derivado, não persistido**, pelo mesmo motivo do #190 — evitar uma segunda
   fonte de verdade que envelheceria a cada mudança de duração ou de periodicidade.
3. `frontend/fluxo-caixa-motor.test.ts` — 3 testes novos: contagem/vencimentos nas 4
   periodicidades, o caso do resto da divisão (10 meses trimestral = 3 parcelas) + piso de 1
   parcela, e um fluxo Semestral completo verificando conservação da receita e os meses exatos
   (17/23/29/35, zero nos meses do meio). Nenhum teste existente precisou mudar — os do #190 já
   passavam a periodicidade Mensal e o caso geral os reproduz.
4. `docs/viabilidade/padrao-incorporacao.md` — motor de receita descreve a regra geral.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + **109** testes + build). Nada
de backend/schema/migração — não há pendência para o ambiente autenticado do autor.

**Merge:** não é portão; mergeada por pedido explícito do autor nesta sessão. **Encerra a cadeia
#190 → #191.**

---

## #184, #192, #190 — Resumo, avanço da obra e parcelas ao longo da obra (2026-07-29)

Branch `claude/r4-184-192-190`. **#190 é portão** (`Portão? = SIM` → destrava #191); #184 e #192 não
são, mas o autor pediu explicitamente o merge do lote nesta sessão. Nenhuma toca schema/migração —
`versao` do manifesto **não** muda.

### #184 — Resumo: composição de custos vazia + filtro

Fecha a trinca #182/#183/#184: a pizza montava 12 fatias a partir de `calcularProforma`, que só lê
colunas estáticas de `estudos` (as Premissas, removidas do Avançado no #88) — num estudo criado
direto como Avançado as 12 eram zero e a pizza saía **sempre vazia**.

1. `frontend/fluxo-tabela.ts` — `GRUPO_CUSTO_LABEL` e `GRUPOS_CUSTO` (ordem das 5 abas) agora
   **exportados**, para a pizza usar exatamente os mesmos rótulos/ordem da tabela do Fluxo de Caixa.
   `tabelaFluxo` passou a consumir a constante em vez do array literal repetido.
2. `frontend/tela-resumo.ts` — a pizza vem de `c.linhasCusto`, o mesmo array que soma em
   `custoMensal`; a pizza **fecha com o Custo Total do Fluxo de Caixa por construção**, não por
   coincidência. Novo `urbi-select`: **macro** (uma fatia por grupo, padrão) ou um grupo específico
   (uma fatia por linha, agregando linhas de mesmo nome). Grupo selecionado que fica sem custo cai
   de volta no macro sozinho. Estado vazio preservado.
3. Com isso `tela-resumo.ts` **deixa de importar `proforma.ts`** (e `buscarConfig`/`aliquotaRet`,
   que só existiam para alimentá-lo). O Proforma segue sendo a fonte do **Preliminar**
   (`tela-proforma`, `tela-graficos`), onde aquelas colunas existem e são editáveis.

### #192 — Custos → Obras: gráficos de avanço (só Projetado)

Escopo conforme decisão do autor (§8 do mapa mestre): a referência visual traz
Projetado/Realizado/Desvio/Forecast, mas "Realizado" não existe em schema/backend/motor — **só o
Projetado**, sem migração.

O requisito duro da issue é que os valores batam **exatamente** com a linha Construção do Fluxo de
Caixa. Em vez de redistribuir por conta (que divergiria na primeira mudança de regra), o
`tela-fluxo-custos.ts` roda o **próprio motor** (`calcularFluxo`) com os insumos que já carregava, e
lê `c.linhasCusto` — curva, âncora de cronograma e unidade de orçamento saem de graça e não podem
divergir. Foram guardados `linhasReceita` e `taxa_desconto_aa`, que a tela lia e descartava.

Abaixo da tabela de Obra: `urbi-grafico-colunas` (custo mensal, `empilhado` quando a Gestão entra),
`urbi-grafico-area` (desembolso acumulado), `urbi-checkbox` "Incluir Gestão da obra" (desabilitado
quando o estudo não tem essa linha) e a tabela mensal Projetado + Projetado acumulado. Estado vazio
quando falta Cronograma ou a linha Construção. Só tokens do design system.

> Props conferidas no `dist/index.d.ts` do SDK antes de usar (`categorias`, `series`, `formato`,
> `legenda`, `empilhado`, `altura`, `clicavel`; `SerieGrafico = { rotulo, valores, cor? }`) —
> `urbi-grafico-area` **existe**. Atributo inexistente não dá erro, só não faz nada (§10.2).

### #190 — Nº de parcelas "Ao longo da obra" + Mensal (PORTÃO → #191)

⚠️ **Muda números de estudos existentes** que usem Parcelamento com "Ao longo da obra" (§10.4 do
mapa mestre).

**Causa:** o motor distribuía `fimObra − mesVenda` parcelas a partir do mês SEGUINTE à venda — cada
mês de venda gerava um número diferente de parcelas, então não existia um "nº de parcelas" único
para preencher o campo (que ficava travado e **vazio**). A periodicidade era ignorada nesse ramo.

1. `frontend/fluxo-caixa-motor.ts` — duas funções novas exportadas:
   `parcelasAoLongoObra(cronograma)` (= duração da obra, mínimo 1) e
   `vencimentosAoLongoObra(cronograma, mesVenda)`, que devolve os **meses da obra** como
   vencimentos. Venda depois do início da obra: parcelas já vencidas não são recuperadas — a 1ª cai
   no 1º vencimento **≥ mês da venda** e o total se reparte entre os restantes (a parcela sobe, a
   receita **se conserva**). Obra sem duração/sem evento, ou venda após o fim da obra: 1 parcela no
   mês da venda. `receitaMensalLinha` usa isso quando `ao_longo_obra` **e** periodicidade Mensal;
   Trimestral/Semestral/Anual seguem no comportamento herdado — é o escopo do **#191**.
2. `frontend/tela-fluxo-receitas.ts` — `_parcelasExibidas` mostra o nº derivado do Cronograma no
   campo travado. **Derivado, não persistido**: gravar o número criaria uma segunda fonte de verdade
   que envelheceria assim que a duração da obra mudasse — e o motor ignora o `parcelas` salvo nesse
   ramo. Assim o campo é reativo à duração, como pede o aceite.
3. `frontend/fluxo-caixa-motor.test.ts` — 3 testes novos (nº fixo pela duração; venda no meio da
   obra com 1º vencimento ≥ venda + conservação; fallback de obra sem duração). Os testes 4 e 4b
   afirmavam as 28 parcelas do comportamento antigo e foram **atualizados para as 24 novas** — a
   mudança numérica é a correção pretendida, não regressão.
4. `docs/viabilidade/padrao-incorporacao.md` — motor de receita descreve a nova ancoragem.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + **106** testes + build), rodado
a cada issue e de novo no fim do lote. Nada de backend/schema/migração neste lote — não há pendência
para o ambiente autenticado do autor.

**Merge:** #190 é portão (mergeia por regra); #184 e #192 mergeadas junto por pedido explícito do
autor nesta sessão.

---

## #179, #189, #177, #185, #186, #187 — lote de 6 issues Médio (2026-07-29)

Branch `claude/r4-lote-medio`. Nenhuma é portão — lote implementado e **mergeado nesta sessão a
pedido explícito do autor** (pedido pontual, não altera a regra geral de merge do `CLAUDE.md`).
Nenhuma toca schema/migração; puramente frontend.

- **#179 — Diretos: Corretagem obrigatória sem duplicar.** A idempotência do backend/migração já
  existia desde o #178 (`obrigatoria` decidida no servidor, migração 006 já desatava duplicatas
  legadas para edição/remoção). O gap real era só o seletor de categoria em
  `tela-fluxo-custos.ts`, que oferecia "Corretagem de vendas" (e as demais categorias obrigatórias:
  Preço/Construção) para QUALQUER linha — permitindo criar uma 2ª linha manualmente, somada em
  dobro pelo motor. Filtrado: categorias obrigatórias somem do seletor de outras linhas.
- **#189 — Fluxo de Caixa: coluna % sobre VGV.** Nova coluna `c6` (sticky) logo após o VPL em
  `fluxo-tabela.ts`, `linha.total / c.receitaBrutaVgv × 100` via `fmtPct` (1 casa). Vazia na própria
  linha "Receita Bruta (VGV)" e nas linhas de Fluxo Mensal/Acumulado; presente em receita e custo
  (grupo/subgrupo/item), inclusive Custo Total. Refletida em `exportar.ts` (CSV e PDF).
- **#177 — % sempre com 2 casas decimais.** `viab-num.ts` ganha `casas-minimas` (piso de casas
  exibidas, inclusive com foco — `1,2` sempre aparece `1,20`). Aplicado a todo campo `sufixo="%"`
  (`tela-fluxo-receitas.ts`, `viabilidade-config-curvas.ts`) e ao Orçamento de Custos quando a
  unidade é `pct_*` (`tela-fluxo-custos.ts`). Campos de mês (`casas-decimais="0"`) não usam a prop
  nova — default `0` preserva o comportamento anterior.
- **#185 — Cenários: gráfico migrado para `urbi-grafico-linha`.** `graficoCenarioAcumulado` (SVG
  customizado) removido de `fluxo-graficos.ts`; `tela-cenarios.ts` usa o primitivo com 2 séries
  (Cenário real + cenário simulado, cores de alto contraste, `legenda="sempre"`). Trade-off aceito
  (`CLAUDE.md`): sem linha tracejada nem marcadores verticais — mitigado com lista textual de
  marcos (Lançamento/Início/Fim de Obra + Payback + Exposição máxima) abaixo do gráfico.
- **#186 — Cenários: controles do Fluxo de Caixa.** `controlesFluxo` (Recolher tudo, Mensal/Anual,
  filtro Global/por fase) extraído de `tela-fluxo-ver.ts` para `fluxo-tabela.ts` (CSS `.controles`
  junto) e reusado em `tela-cenarios.ts`, entre os KPIs e a tabela. Opera sobre o `FluxoCalc` do
  cenário SIMULADO; a chave do cache (`cacheCalc`) passou a incluir o filtro de fase, senão trocar
  de fase reaproveitaria do cache um cálculo da fase anterior. Mensal/Anual só reagrupa colunas do
  gráfico/tabela — KPIs continuam no cálculo mensal (mesma convenção de Fluxo de Caixa).
- **#187 — Cenários: colunas de variação % próprias.** "Preço venda"/"Custo obra" estreitas (84px,
  tabela deixou de esticar a 100%); os badges de variação de VPL/TIR/Exposição máxima saíram de
  dentro da célula do valor para 3 colunas próprias (`.cen-var`, cabeçalho vazio + `aria-label`). A
  linha travada "Cenário real" preenche essas colunas vazias (sem variação contra si mesma).

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 103 testes + build), rodado a
cada issue e novamente no final do lote.

**Merge:** nenhuma é portão, mas o autor autorizou mergear o lote nesta sessão.

---

## #197 — Cronograma: stepper com mês inline (2026-07-29)

Branch `claude/r4-197-cronograma-stepper`. Não é portão. Pré-requisitos #165, #166 (já mergeados).

**O que é:** referência visual "View cronograma" da planilha de bugs — campos de Início e Duração
do Cronograma (fases fixas e customizadas) ganham setas ▲▼ de incremento/decremento e o mês
correspondente inline, no formato "6 meses · jan/27".

1. `frontend/viab-num.ts` — duas props novas, opcionais (comportamento anterior preservado quando
   ausentes): `passo` (>0 mostra as setas; oculta quando `desabilitado`, cobrindo "campo travado não
   recebe seta") e `sufixo-mes` (rótulo textual inline, após o `sufixo` existente). Clique na seta
   atualiza `valor` na hora (feedback visual) mas o evento `urbi:input-numero-change` (que dispara o
   PATCH no consumidor) sai com debounce de 400ms — cliques em sequência colapsam numa chamada só.
2. `frontend/tela-fluxo-cronograma.ts` — `passo="1"` e `sufixo-mes` nos 4 campos (Início/Duração ×
   evento fixo/fase customizada), usando `rotuloMesRelativo` já existente: Início mostra o mês do
   próprio `inicio_mes`; Duração mostra o mês final (`inicio_mes + duracao_meses - 1`). Sem
   `data_inicio_projeto`, `sufixo-mes` fica vazio — sem rótulo de mês, mas os campos continuam
   funcionais (aceite do issue).

Sem schema/migração — mudança de UI/UX, nenhum dado é alterado.

**Validação:** `bash scripts/validar-frontend.sh` verde na branch (103 testes, à época) e de novo na
`main` após o merge (109 testes — a suíte cresceu com #190/#191 no intervalo).

**Merge:** não é portão; ficou aberta enquanto o autor revisava e foi mergeada em 2026-07-29 a
pedido dele, depois do #191. O merge do `viab-num.ts` juntou as props desta issue (`passo`,
`sufixo-mes`) com a `casas-minimas` do #177, que entrou na `main` no intervalo — as três convivem
sem interferência (campos com seta usam `casas-decimais="0"` e não pedem piso de casas).

---

## #181 — Financeiro alinhado às outras abas (2026-07-28)

Branch `claude/r4-181-financeiro-unidades`. Não é portão — PR aberto, merge fica com o autor.
Pré-requisitos #173, #174, #175 e #198 (todos já mergeados — PR #216, #214, #214 e #217).

**O que é:** `UNIDADES_CAT` (mapa de unidades de orçamento permitidas por grupo+categoria) tinha
entrada para `terreno`/`obra`/`diretos`/`indireto`, mas **não para `financeiro`** — sem entrada,
`_unidsPerm` caía no fallback "todas as unidades" e oferecia badges sem sentido nenhum para custo
financeiro (`R$/m² terreno`, `% Obra`, `R$/m² priv`) em vez da lista curada que as outras 4 abas já
tinham.

`frontend/tela-fluxo-custos.ts` — `UNIDADES_CAT.financeiro` adicionado, mesmo padrão de Indiretos
(cada categoria aceita `rs` ou `pct_vgv`): `Juros de financiamento`, `Taxas bancárias`,
`Estruturação de dívida`, `Investidores`, `Outro`.

Sem schema/migração — restrição de opções de UI, nenhum dado é alterado (uma linha já persistida
numa unidade fora dessa lista continua sendo lida e calculada normalmente pelo motor; só a criação
de novas linhas fica restrita à lista curada).

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 103 testes + build).

**Merge:** não é portão — PR #218 aberto em 2026-07-28, mergeado nesta sessão a pedido do autor
(2026-07-29) após revisão e validação verde.

---

## #183 — Resumo: medidores zerados + renome do rótulo (2026-07-28)

Branch `claude/r4-183-resumo-medidores-zerados`. Não é portão — PR aberto, merge fica com o autor.
Pré-requisito #182 (já mergeado — PR #206).

**Medidores zerados:** mesma causa raiz do #182 (§9.1) — `_renderMedidores` de `tela-resumo.ts`
lia `p.custoObrasVgvPct`/`p.margemLiquidaPct` do Proforma (`calcularProforma(estudo)`), zerado num
estudo Avançado puro. Extraí `_kpisAvancado(c)` (a partir do `FluxoCalc`) reunindo os 5 números que
`_renderKpis` (#182) e `_renderMedidores` precisam — evita duplicar a conta de `margemLiquidaPct`
entre os dois métodos. `custoObrasVgvPct` novo: soma de `c.linhasCusto` do grupo `obra` sobre
`c.vgvTotal`.

**tela-graficos.ts e tela-proforma.ts** são telas do **Preliminar** — usam `calcularProforma(estudo)`
corretamente (os campos existem lá) e não tinham o bug de zerar; entraram no escopo só pelo rename.

**Renome do rótulo:** "Custo obra / VGV" (singular) → "Custo obras / VGV" (plural), alinhando com
`exportar.ts`, `tela-premissas.ts` e `tela-proforma.ts:189`, que já usavam o plural — havia
inconsistência dentro do próprio `tela-proforma.ts` (linha 189 plural, linha 421 singular). Corrigido
em `tela-resumo.ts`, `tela-graficos.ts` e `tela-proforma.ts` (rótulo + comentários).

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 98 testes + build).

**Merge:** não é portão — PR #207 aberto em 2026-07-28, mergeado nesta sessão a pedido do autor
(2026-07-29) após revisão e validação verde.

---

## #198 — Linha de totais destacada nas tabelas (2026-07-28)

Branch `claude/r4-198-total-destacado`. Issue portão (§3 do mapa mestre), sem pré-requisito. Última
das quatro pré-condições do #181 (#173/#174/#175 já prontas) — destrava o #181.

**O que é:** referência visual "Referência para Tabelas" da planilha de bugs: "linha de totais ao
final deve ter uma separação do restante das linhas". A linha "Total <grupo>" de cada seção de
Custos (`.rodape-custo`) tinha só `margin-top`, sem nenhuma separação visual da tabela acima.

`frontend/tela-fluxo-custos.ts` — `.rodape-custo` ganha `border-top: 2px solid` + fundo levemente
destacado (`--cor-superficie-hover`) + padding, mesmo tratamento que `fluxo-tabela.ts`/
`tela-proforma.ts` já dão às linhas de resultado/total (border-top 2px). `.total-valor` fica maior e
mais peso (700, 1.05rem) para reforçar que é o número final da seção. Só tokens do design system —
nenhuma cor literal.

Sem schema/migração — mudança puramente visual.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 103 testes + build).

**Merge:** portão (`Portão? = SIM`, junto com #173/#174/#175 → #181) — mergeado pela sessão após
validação verde.

---

## #173 — Remover coluna Subcategoria (exceto Terreno) (2026-07-28)

Branch `claude/r4-173-subcategoria-so-terreno`. Issue portão (§3 do mapa mestre), sem pré-requisito.
Destrava (junto com #174 ✅, #175 ✅, #198) o #181.

**O que é:** Terreno é o único grupo com uma lista real de subcategorias (Preço:
`Valor à vista`/`Permuta`/`Parcelado`/`Outro`); nos demais grupos a coluna só mostrava "—" ou, na
categoria "Outro", um campo de texto livre sem função clara. A coluna some de Obra/Diretos/
Indiretos/Financeiro.

1. `frontend/tela-fluxo-custos.ts` — `_colunas(g)` filtra a coluna `subcategoria` fora de
   `g.id === 'terreno'`.
2. `frontend/fluxo-caixa-motor.ts` — `nomeLinhaCusto(c)` (nova, local): o nome de exibição só
   concatena subcategoria quando `grupo === 'terreno'` — dado legado de subcategoria em outro grupo
   (a categoria "Outro" aceitava texto livre em todo grupo antes desta issue) não aparece mais
   pendurado no nome da linha, já que não tem mais editor na UI para corrigi-lo.
3. Teste novo em `fluxo-caixa-motor.test.ts` cobrindo os dois casos (Terreno inclui subcategoria;
   outro grupo não).

Sem schema/migração — mudança de exibição, nenhum dado é apagado ou reescrito.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 103 testes + build).

**Merge:** portão (`Portão? = SIM`, junto com #174/#175/#198 → #181) — mergeado pela sessão após
validação verde.

---

## #165 + #166 — Pré-lançamento derivado do Planejamento; duração do Lançamento livre (2026-07-28)

Branch `claude/r4-165-166-cronograma-travados`. Duas issues portão (§3 do mapa mestre), sem
pré-requisito, ambas destravando #197 — resolvidas juntas porque são a mesma correção em
`recalcularTravados`/`cronogramaPadrao` (backend) e no mesmo componente de tela.

**Causa raiz (§6 do mapa mestre, achado da auditoria 2026-07-27):** `avancado.ts` nunca derivava
`pre_lancamento.inicio_mes` do fim do Planejamento (só Lançamento← Pré-lançamento e Pós-obra←Obra
eram recalculados) — `cronogramaPadrao()` nascia com `travado_inicio: false` para Pré-lançamento
enquanto a TELA já mostrava o campo travado (🔒) com um hack por nome de evento; o valor "acertava"
por coincidência porque o default (`0+6=6`) batia com o hardcode. Ao mesmo tempo, o backend forçava
`lancamento.duracao_meses = 1` (com `travado_duracao: true`) enquanto a tela já tinha liberado o
campo — o usuário digitava, o PATCH devolvia 422 CAMPO_TRAVADO, e o valor voltava.

**Fix:**
1. `backend/rotas/avancado.ts` — `recalcularTravados` ganha a derivação de `pre_lancamento.inicio_mes`
   (fim do Planejamento, #165) e `lancamento` perde `travado_duracao` (agora livre, #166) —
   continua travado só o início (fim do Pré-lançamento). `cronogramaPadrao()` atualizado para
   `pre_lancamento: travado_inicio: true` / `lancamento: travado_duracao: false`. Mensagem de erro
   do `CAMPO_TRAVADO` de duração generalizada (não é mais sempre "fixa em 1 mês").
2. `frontend/tela-fluxo-cronograma.ts` — removidos os dois hacks por nome de evento
   (`ev.evento === 'pre_lancamento' ? true : ...` / `ev.evento === 'lancamento' ? false : ...`): a
   tela agora confia direto em `ev.travado_inicio`/`ev.travado_duracao`, que o backend já calcula
   certo. Removido também o reancoramento manual client-side do Pré-lançamento
   (`inicio_mes + 1`, ignorava `duracao_meses`) — redundante agora que o backend recalcula em cadeia
   a cada PATCH, e passaria a tomar 422 (Pré-lançamento sempre travado).
3. `backend/rotas/avancado.test.ts` — testes atualizados para a nova coerência (`pre_lancamento`
   derivado do Planejamento; `lancamento.duracao_meses` preservado, não forçado a 1) + teste novo
   cobrindo a propagação Planejamento → Pré-lançamento → Lançamento.
4. `docs/viabilidade/padrao-incorporacao.md` — nota sobre o encadeamento de início travado.

Sem schema/migração — `travado_inicio`/`travado_duracao` já existiam; só a lógica de cálculo mudou.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 102 testes + build). Backend
(typecheck, `pnpm test` do `avancado.test.ts`, `urbi-empacotar`) fica para o ambiente autenticado do
autor.

**Merge:** ambas portão (`Portão? = SIM` → #197) — mergeadas pela sessão após validação verde.

---

## #174, #175, #169, #172, #176 — lote de correções pequenas de Custos/Receitas/UI (2026-07-28)

Branch `claude/r4-lote-ui-menores`. Nenhuma é portão — PR único aberto e mergeado nesta sessão a
pedido do autor. Nenhuma toca schema/backend/migração; puramente frontend.

- **#174 — Largura dos campos de Duração/Início:** `.campo-mes` (Custos) tinha duas regras
  conflitantes (ambas 80px) e esse tamanho cortava o número + sufixo ("º mês"/"meses") do
  `viab-num`, que fica dentro do mesmo span que o emoji. Unificado numa regra só, 140px.
- **#175 — Coluna Resultado sempre preenchida:** a coluna Resultado de Custos escondia o total em
  `rs` (`orcamento_unidade`), mostrando "—" na maioria das linhas — o total resolvido em R$ é útil
  independente da unidade de entrada. Removida a condição, sempre mostra `resolverCustoTotal`.
- **#169 — Cor do botão "Absorção de Vendas":** usava `variante="primario"`, a mesma cor do botão
  "Salvar" do nome da fase — ficava indistinguível dele e inconsistente com o botão irmão "Fluxo de
  Pagamento" (`variante="secundario"`). Alinhado para `secundario`.
- **#172 — Botão de remover só com lixeira:** 13 botões de remover/excluir em 11 telas
  (`tela-apelo`, `tela-cenarios`, `tela-dashboard`, `tela-empreendimento-info`,
  `tela-empreendimento-tipologias`, `tela-estudo`, `tela-fluxo-cronograma`, `tela-fluxo-custos`,
  `tela-fluxo-receitas` ×2, `viab-imagem-principal`, `viabilidade-config-benchmarks`,
  `viabilidade-config-curvas`) tinham texto "Remover"/"Excluir" ao lado do ícone de lixeira,
  inconsistentes com os botões de remover linha de Entrada/Parcelas (já só ícone). Texto removido
  de todos, com `title` preenchido para manter o tooltip/nome acessível.
- **#176 — urbi-kpis sobrepostos:** `.kpis`/`.fx-kpis` (Resumo e Fluxo de Caixa) são grids
  `auto-fit`, mas os itens (urbi-kpi direto em `tela-resumo.ts`; `.kpi-cel` em `fluxo-tabela.ts`)
  não tinham `min-width: 0` — o default `min-width: auto` de item de grid segue o min-content do
  valor (R$ com muitos dígitos), empurrando o card por cima do vizinho. `min-width: 0` +
  `width: 100%` no urbi-kpi interno corrige nos dois arquivos.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 102 testes + build).

**Merge:** nenhuma é portão, mas o autor autorizou mergear o lote nesta sessão.

---

## #167 — Fases do Cronograma como âncora de Custos (2026-07-28)

Branch `claude/r4-167-fase-ancora-custos`. Não é portão — pré-requisito #168 (já mergeado — PR
#212). Só foi seguro implementar depois do #168 separar as fases de Cronograma das de Receitas — a
lista de fases hoje é limpa (`tipo='cronograma'` vs `'receita'`).

**O que é:** a coluna Distribuição de uma linha de Custos ganha, além dos 5 eventos fixos do
Cronograma (`EVENTOS_ANCORA`), a opção de ancorar numa **fase do Cronograma** (tipo `cronograma`,
criada em "Fases comerciais") — início/duração passam a vir dessa fase, do mesmo jeito que já
funcionava para os eventos fixos.

1. `schema.json` — nova coluna `fase_ancora_id` (referência a `avancado_fases`, `ao_deletar:
   anular`) em `avancado_linhas_custo`. Mutuamente exclusiva com `cronograma_evento`.
2. `backend/rotas/avancado.ts` — `ancorarLinhaCustoEmFase` (valida que a fase pertence ao estudo e é
   `tipo='cronograma'`) espelha `ancorarLinhaCusto`. POST/PATCH de custos: `fase_ancora_id` tem
   prioridade sobre `cronograma_evento` quando presente; a mesma trava de "início calculado quando
   ancorado" (`CAMPO_TRAVADO`) se aplica à âncora de fase. Duplicar estudo (`duplicarDadosAvancado`)
   remapeia `fase_ancora_id` para a fase **nova** via `mapaFase` — copiar o id antigo apontaria para
   uma fase de outro estudo.
3. `frontend/tela-fluxo-custos.ts` — carrega `listarFasesAvancado(estudoId, 'cronograma')`; a coluna
   Cronograma oferece as fases junto dos 5 eventos fixos (`valor: 'fase:<id>'`); a coluna Início
   trava (🔒) quando `fase_ancora_id` está setado, mostrando o nome da fase.
4. `migracoes/011_fase_ancora_id.js` — coluna aditiva, sem transformação de dado. `versao` `0.1.9` →
   `0.1.10`.
5. `docs/viabilidade/padrao-incorporacao.md` — seção de Linhas de custo atualizada.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 102 testes + build). Backend
(typecheck, execução da migração, `urbi-empacotar`) fica para o ambiente autenticado do autor.

**Merge:** não é portão, mas o autor autorizou mergear nesta sessão.

---

## #168 — Separar fases Cronograma × Receitas (2026-07-28)

Branch `claude/r4-168-fases-tipo`. Issue portão (§3 do mapa mestre), sem pré-requisito. Destrava
#167.

**Causa raiz (§6 do mapa mestre):** Cronograma e Receitas faziam CRUD na MESMA lista de
`avancado_fases`, pelas mesmas funções (`tela-fluxo-cronograma.ts`/`tela-fluxo-receitas.ts`), sem
nenhum discriminador no schema. Uma fase criada em qualquer uma das duas telas aparecia — e podia
ser editada/removida — na outra: uma fase de gantt sem alocações virava uma "linha de receita" vazia
no motor; uma fase de receita com Absorção/Fluxo de Pagamento aparecia no Cronograma como se fosse
um marcador simples.

**Fix:**
1. `schema.json` — nova coluna `tipo` (opções `cronograma`/`receita`, obrigatória, padrão `receita`)
   em `avancado_fases`.
2. `backend/rotas/avancado.ts` — `GET /avancado/fases` aceita `?tipo=` (filtra); `POST` aceita `tipo`
   no corpo (default `receita`, mantém compat com chamadas legadas), numeração/`ordem` de "Fase N"
   passam a contar só dentro do próprio tipo; Absorção/Fluxo de Pagamento só são inicializados para
   `tipo='receita'` (o Cronograma nunca os lê). `GET /avancado/receitas` (o endpoint que alimenta o
   motor) filtra `tipo='receita'` — fases do Cronograma não viram mais linhas de receita vazias.
   `CAMPOS_FASE_COPIA` (duplicar estudo) ganhou `tipo`, para a cópia preservar a classificação.
3. `frontend/viabilidade-api.ts` — `listarFasesAvancado(estudoId, tipo?)` repassa o filtro.
4. `frontend/tela-fluxo-cronograma.ts` e `frontend/tela-fluxo-receitas.ts` — cada tela lista e cria
   só o seu próprio tipo (`cronograma`/`receita`).
5. `migracoes/010_fases_tipo.js` — backfill: fase com pelo menos uma `avancado_alocacoes` →
   `receita` (só Receitas cria alocações); sem nenhuma → `cronograma` (o caso mais comum de "Fase N"
   criada só para marcar o gantt). Nenhuma linha é apagada. `versao` `0.1.8` → `0.1.9`.
6. `docs/viabilidade/padrao-incorporacao.md` — seção de Fases atualizada para descrever a separação
   por `tipo`.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 102 testes + build). Backend
(typecheck, execução da migração, `urbi-empacotar`) fica para o ambiente autenticado do autor.

**Merge:** portão (`Portão? = SIM` → #167) — mergeado pela sessão após validação verde.

---

## #196 — Permuta financeira como dedução da receita (2026-07-28)

Branch `claude/r4-196-permuta-financeira-deducao`. Não é portão — pré-requisitos #193 e #194 (ambos
já mergeados — PR #208 e #209). Fecha a cadeia da Terreno (#178→#180→#188→#193→#194→#195→#196).

⚠️ **Muda números de estudos existentes** que usam a subcategoria "Permuta" na linha de Preço do
Terreno: o valor sai de "Custos do Terreno" e passa a reduzir a Receita — mesmo Resultado final,
mas a composição por seção muda (correção pretendida, conforme o contrato C5 de
`padrao-incorporacao.md`: "permuta financeira é dedução da receita").

**O que é:** a linha de Preço do Terreno com subcategoria **"Permuta"** (já existente desde o #193)
deixa de ser tratada como custo e passa a ser uma **dedução da receita** — mesmo tratamento que o
Preliminar (`proforma.ts`) já dá à permuta financeira, e distinto da permuta física (#195, que reduz
o VGV vendável, não gera linha separada).

1. `frontend/fluxo-caixa-motor.ts` — `ePermutaFinanceira(custo)` (local, não exportada — grupo
   `terreno` + categoria `Preço` + subcategoria `Permuta`). `linhasCusto` é dividida em duas antes do
   loop de custos: as demais linhas seguem o caminho normal (`calcCustos`); as de Permuta financeira
   viram `calcDeducoesReceita` — mesmo mecanismo de distribuição do #194
   (`fixo`/`unit_delivery`/`sales_revenue`, via `distribuirProporcional`/`distribuirLinha`), mas com
   o `mensal` **negado**. O resultado entra em `linhasReceita` (não `linhasCusto`) e é somado em
   `receitaMensal` (não `custoMensal`).
2. `vgvTotal`/`vgvPermutaFisica`/`receitaBrutaVgv` (KPIs informativos do #188) não mudam — a permuta
   financeira não é permuta física, não afeta o VGV vendável.
3. Comentário desatualizado no topo do arquivo e perto do `return` (dizia "permuta física continua
   fora do cálculo de caixa", já não era mais verdade desde o #195) corrigido no mesmo PR.
4. Teste novo em `fluxo-caixa-motor.test.ts`: a linha de Permuta financeira some de `linhasCusto`,
   aparece negativa em `linhasReceita`, `custoMensal` fica zerado e o Resultado final bate com
   receita menos a dedução.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 102 testes + build).

**Merge:** não é portão, mas o autor autorizou mergear nesta sessão.

---

## #195 — Permuta física reduz VGV/unidades/Resultado (2026-07-28)

Branch `claude/r4-195-permuta-fisica-reduz-vgv`. Não é portão — pré-requisitos #193 e #188 (ambos já
mergeados — PR #208 e #204).

⚠️ **Muda números de estudos existentes** (§10.4 do mapa mestre): qualquer estudo com
`unidades_permutadas > 0` numa tipologia passa a receber MENOS receita em caixa do que antes — o
resultado final cai. Isso é a correção pretendida, não uma regressão.

**Causa raiz (§9.3):** o motor somava a tipologia inteira (`vgvTipologia = quantidade × área ×
preço`) na absorção de vendas, ignorando `unidades_permutadas` — a decisão documentada no topo de
`fluxo-caixa-motor.ts` dizia "permuta física não entra no fluxo" mas a base de cálculo continuava
contando as unidades permutadas como se fossem vendidas por caixa. O #188 só expôs o valor da fatia
(`vgvPermutaFisica`/`receitaBrutaVgv`); o #195 faz o fluxo de caixa respeitar essa fatia.

**Fix — escopo restrito à RECEITA EM CAIXA, não ao "VGV" informativo:**
1. `frontend/fluxo-shared.ts` — `vgvVendavelTipologia`/`vgvVendavelLinha` = `vgvTipologia` menos a
   fatia de permuta física (`vgvPermutaFisicaTipologia`).
2. `frontend/fluxo-caixa-motor.ts` — `receitaMensalLinha` passa a repartir a absorção de vendas
   sobre o VGV VENDÁVEL, não o bruto; o rateio por tipologia (`itens` de cada linha de receita)
   idem. Uma tipologia 100% permutada não gera receita nem "puxa" fatia do caixa da linha.
   `ctxCusto.vgvTotal`/`receitaTotal` (base de custos `pct_vgv`/`pct_receita`) e o `vgvTotal`/
   `vgvPermutaFisica`/`receitaBrutaVgv` do `FluxoCalc` (KPIs informativos, #188) **não mudam** —
   continuam brutos, fora do escopo desta issue.
3. Testes atualizados/novos em `fluxo-caixa-motor.test.ts`: o teste do #188 passou a esperar
   `receitaMensal` líquido de permuta (334M em vez de 340M no fixture); teste novo cobre tipologia
   100% permutada (receita zero, `vgvTotal` bruto inalterado).
4. `docs/viabilidade/padrao-incorporacao.md:243` já descrevia esse comportamento (aspiracional) —
   nenhuma mudança de doc necessária, o código é que alcançou o doc.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 101 testes + build).

**Merge:** não é portão, mas o autor autorizou mergear nesta sessão.

---

## #194 — Terreno: modos `Unit Delivery` e `Sales Revenue` (2026-07-28)

Branch `claude/r4-194-preco-modos-distribuicao`. Issue portão (§3 do mapa mestre), pré-requisito
#193 (já mergeado — PR #208). Destrava #196.

**O que é:** a linha de Preço do Terreno (`grupo='terreno'`, `categoria='Preço'`) ganha um seletor de
**modo de distribuição**, substituindo (quando ativo) o cronograma fixo por um rateio proporcional:
- **`fixo`** (padrão) — comportamento atual, inalterado: cronograma_evento + curva, igual às demais
  linhas de Terreno.
- **`sales_revenue`** — rateia proporcionalmente ao **VGV vendido** (mesmo mecanismo já usado pela
  Corretagem de vendas, #121: `vgvVendidoMensal`).
- **`unit_delivery`** — rateia proporcionalmente à **receita em caixa** (entrada + parcelas +
  repasse na entrega das unidades) — difere de `sales_revenue` sempre que há parcelamento/repasse
  pós-venda: a venda acontece num mês, o caixa entra em outro(s).

1. `frontend/fluxo-shared.ts` — `ePrecoTerreno`/`CATEGORIA_PRECO_TERRENO`, mesmo padrão de
   `eCorretagem`/`CATEGORIA_CORRETAGEM`.
2. `frontend/fluxo-caixa-motor.ts` — `distribuirProporcional` (generaliza o rateio já usado por
   `corretagemMensal`); `receitaMensal` (caixa agregado) passou a ser calculada ANTES do loop de
   custos, para servir de peso ao modo `unit_delivery`. Branch novo em `calcCustos` para
   `ePrecoTerreno(c) && distribuicao_modo !== 'fixo'`.
3. `frontend/tela-fluxo-custos.ts` — coluna Distribuição da linha de Preço ganha o seletor de modo
   (+ a curva normal, quando `fixo`); colunas Cronograma/Início/Duração ficam travadas (`—`) nos
   modos especiais, mesmo tratamento dado à Corretagem.
4. `schema.json` + `backend/rotas/avancado.ts` — nova coluna `distribuicao_modo` (opções
   `fixo`/`unit_delivery`/`sales_revenue`, padrão `fixo`) em `avancado_linhas_custo`, validada no
   POST/PATCH (`MODOS_DISTRIBUICAO`).
5. `migracoes/009_distribuicao_modo.js` — coluna aditiva com DEFAULT, sem transformação de dado
   (mesmo padrão de `004_fases_gantt.js`). `versao` `0.1.7` → `0.1.8`.
6. Testes novos em `fluxo-caixa-motor.test.ts` cobrindo os dois modos, com o caso que os distingue
   (venda concentrada + repasse pós-venda).

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 100 testes + build). Backend
(typecheck, execução da migração, `urbi-empacotar`) fica para o ambiente autenticado do autor.

**Merge:** portão (`Portão? = SIM` → #196) — mergeado pela sessão após validação verde.

---

## #193 — Terreno: `Compra` → `Preço` + subcategorias (2026-07-28)

Branch `claude/r4-193-terreno-preco`. Issue portão (§3 do mapa mestre), pré-requisito #180 (já
mergeado — PR #205). Destrava #194, #195, #196.

**Escopo:** rename puro da categoria "Compra" → "Preço" em `terreno` (alinha com a referência
visual "View Custos Terreno" da planilha de bugs) — mesma linha obrigatória do #180, mesmas
subcategorias (`Valor à vista`/`Permuta`/`Parcelado`/`Outro`, já existentes). Os modos `Unit
Delivery`/`Sales Revenue` citados na mesma referência visual são o #194 (motor+backend, issue
separada, `Dif. = D`); #193 só prepara o nome/estrutura.

1. `frontend/tela-fluxo-custos.ts` — `CATEGORIAS.terreno`, `UNIDADES_CAT.terreno` e
   `LINHAS_OBRIGATORIAS.terreno` trocam `'Compra'` por `'Preço'`.
2. `backend/rotas/avancado.ts` — `LINHAS_OBRIGATORIAS_CUSTO.terreno` acompanha o rename.
3. `migracoes/008_terreno_preco.js` — renomeia `categoria` das linhas existentes (`grupo='terreno'`,
   `categoria='Compra'` → `'Preço'`); nenhuma linha é apagada. `versao` `0.1.6` → `0.1.7`.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 98 testes + build). Backend
(typecheck, execução da migração, `urbi-empacotar`) fica para o ambiente autenticado do autor.

**Merge:** portão (`Portão? = SIM` → #194, #195, #196) — mergeado pela sessão após validação verde.

---

## #182 — Resumo: KPIs zerados (2026-07-28)

Branch `claude/r4-182-resumo-kpis-zerados`. Issue portão (§3 do mapa mestre), pré-requisito #188
(já mergeado — PR #204). Destrava #183, #184.

**Causa raiz (§9.1 do mapa mestre):** `tela-resumo.ts` chamava `calcularProforma({ ...this.estudo })`
para os 4 KPIs "de negócio" (VGV, Resultado, Margem líquida, ROI) — mas essa função só lê colunas
estáticas de `estudos` (Premissas), removidas da UI do Avançado no #88 (`tela-avancado.ts` já
documentava: "proforma.ts ainda os lê para os KPIs do Resumo — mas sem superfície de edição aqui").
Num estudo criado direto como Avançado essas colunas são `NULL` → os 4 KPIs saíam zerados mesmo com
receitas/custos preenchidos nas outras abas. Os 4 KPIs de fluxo (VPL/TIR/Payback/Exposição), no
mesmo card, sempre estiveram corretos porque vêm do `FluxoCalc` do motor — daí a inconsistência
visível (uns zerados, outros não).

**Fix:** `_renderKpis` (`tela-resumo.ts`) passa a calcular os 4 KPIs a partir do `FluxoCalc` já
carregado, mesma fonte dos KPIs de fluxo — sem chamar Proforma para eles:
- **VGV** = `c.vgvTotal` (motor).
- **Resultado** = último ponto de `c.fluxoAcumulado` (mesma definição de `resultadoDe` em
  `fluxo-tabela.ts`).
- **Margem líquida (%)** = Resultado / VGV × 100.
- **ROI (%)** = Resultado / custo total das linhas de custo (`c.linhasCusto`).

Escopo é só os 4 KPIs — a pizza de composição de custos e os medidores continuam usando o Proforma
(zerados/errados) até #184 e #183, que dependem deste PR.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 98 testes + build). Sem tela de
teste dedicada (componente Lit; padrão do projeto é testar só as funções puras).

**Merge:** portão (`Portão? = SIM` → #183, #184) — mergeado pela sessão após validação verde.

---

## #180 — Terreno: obrigatórias; Outorga → Obras (2026-07-28)

Branch `claude/r4-180-terreno-obrigatoria-outorga`. Issue portão (§3 do mapa mestre), pré-requisito
#178 (já mergeado — PR #203). Destrava #193.

Mesmo padrão do #178, aplicado à aba Terreno:
1. `frontend/tela-fluxo-custos.ts` — "Compra" vira a linha obrigatória de `terreno` (mirror de
   "Construção" em `obra` e "Corretagem de vendas" em `diretos`, `LINHAS_OBRIGATORIAS`).
2. "Outorga" sai da lista de categorias de `terreno` e entra em `obra` — é contrapartida pelo
   potencial construtivo, custo de desenvolvimento da obra, não de aquisição do terreno (a Proforma
   já trata Outorga separado de Terreno no custo direto). Movida em `CATEGORIAS` e `UNIDADES_CAT`.
3. `backend/rotas/avancado.ts` — `LINHAS_OBRIGATORIAS_CUSTO` ganha `terreno: ['Compra']` (mesma
   lógica server-authoritative do #178).
4. `migracoes/007_terreno_obrigatoria_outorga.js` — move linhas existentes de `terreno`/`Outorga`
   para `obra`, e faz o backfill de `obrigatoria=true` na linha "Compra" de menor id por estudo.
   `versao` `0.1.5` → `0.1.6`.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 98 testes + build). Backend
(typecheck, execução da migração, `urbi-empacotar`) fica para o ambiente autenticado do autor.

**Merge:** portão (`Portão? = SIM` → #193) — mergeado pela sessão após validação verde.

---

## #188 — VGV Total / VGV Permuta Física / Receita Bruta (2026-07-28)

Branch `claude/r4-188-vgv-permuta-fisica`. Issue portão (§3 do mapa mestre), sem pré-requisito.
Destrava #182, #183, #184, #189, #195.

**Causa raiz (§9.3 do mapa mestre):** o motor do Avançado (`vgvTipologia`, `fluxo-shared.ts`) conta
`quantidade` inteira de cada tipologia no VGV, sem descontar `unidades_permutadas` — o campo existe
no schema e na tela de Tipologias, mas nunca chegava ao motor. Isso deixa VGV Total, Receita Bruta e
tudo que depende de VGV (Resumo, coluna %VGV, #195) sem uma definição consistente do que é "VGV
líquido de permuta".

**Fix — só expõe as grandezas novas, não muda o fluxo de caixa existente** (permuta física continua
fora do cálculo de caixa, decisão documentada no topo de `fluxo-caixa-motor.ts`; mudar isso é o
escopo do #195, que tem #188 como pré-requisito):
1. `frontend/fluxo-shared.ts` — `vgvPermutaFisicaTipologia`/`vgvPermutaFisicaLinha`: VGV atribuído às
   unidades permutadas (`Math.min(unidades_permutadas, quantidade)` × área × preço — permutadas são
   subconjunto de quantidade, não somam além dela).
2. `frontend/fluxo-caixa-motor.ts` — `FluxoCalc` ganha `vgvPermutaFisica` e `receitaBrutaVgv`
   (`vgvTotal − vgvPermutaFisica`), calculados em `calcularFluxo` e preservados (inalterados) por
   `agregarFluxoPorPeriodos` (view Anual), igual aos demais indicadores.
3. `frontend/fluxo-tabela.ts` — 6º KPI "Receita Bruta (VGV)" no card do Fluxo de Caixa, com tooltip
   nativo (`title`) mostrando o breakdown VGV Total / VGV Permuta Física.
4. Teste novo em `fluxo-caixa-motor.test.ts` cobrindo a separação Total/Permuta/Bruta.

Sem schema, sem migração, sem bump de `versao` (`Ver. = não` no mapa mestre) — são grandezas
derivadas, nada persistido.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 98 testes + build).

**Merge:** portão (`Portão? = SIM`) — mergeado pela sessão após validação verde.

---

## #178 — Obras: obrigatórias + fim da duplicação (2026-07-28)

Branch `claude/r4-178-linhas-obrigatorias`. Issue portão (§3 do
`docs/rodada-4-planilha-2026-07-27.md`), sem pré-requisito. Destrava #179, #180, #192.

**Causa raiz (§9.2 do mapa mestre):** a migração `002_grupos_custo.js` moveu "Gestão da obra" de
`obra` para `diretos`, mas `LINHAS_OBRIGATORIAS.obra` (frontend) continuava exigindo essa categoria
em `obra` — a cada carga da tela, `_garantirLinhasObrigatorias` recriava a linha em `obra` porque a
checagem de existência (por grupo+categoria) sempre falhava. A duplicata resultante era indeletável
porque `eObrigatoria()` casava por **categoria**, então as duas cópias (a movida e a recriada)
perdiam o botão Remover.

**Fix:**
1. `frontend/tela-fluxo-custos.ts` — removida "Gestão da obra" de `LINHAS_OBRIGATORIAS.obra` (só
   "Construção" continua obrigatória em Obra; Corretagem de vendas segue obrigatória em Diretos).
   Fim da causa da recriação.
2. `schema.json` — nova coluna `obrigatoria` (lógico, padrão `false`) em `avancado_linhas_custo`.
   `eObrigatoria()` e `ordenarLinhas()` passam a identificar a linha oficial por **essa flag**, não
   por categoria — uma 2ª linha com o mesmo nome (dado legado ou reclassificação futura de grupo)
   fica editável/removível.
3. `backend/rotas/avancado.ts` — `POST /avancado/custos` decide `obrigatoria` no servidor
   (`LINHAS_OBRIGATORIAS_CUSTO`, espelha o mapa do frontend): marca `true` só na 1ª linha do estudo
   que bate grupo+categoria com a exigência. Campo não é client-writable (fora de `CAMPOS_CUSTO`).
4. `migracoes/006_linhas_custo_obrigatoria.js` — backfill: para cada estudo+grupo, a linha de menor
   `id` cuja categoria bate com a exigência atual (Construção/obra, Corretagem de vendas/diretos)
   recebe `obrigatoria=true`. Nenhuma linha é apagada — inclusive a "Gestão da obra" órfã criada em
   `obra` pelo bug some da trava e vira uma linha normal, removível pelo usuário. `manifesto.json`
   `versao` `0.1.4` → `0.1.5`.

**Validação:** `bash scripts/validar-frontend.sh` verde (typecheck + 97 testes + build). Backend
(typecheck, migração, `urbi-empacotar`) fica para o ambiente autenticado do autor, conforme
`CLAUDE.md` — o `@urbiverso/sdk` não está disponível aqui.

**Merge:** portão (`Portão? = SIM`) — mergeado pela sessão após validação verde, conforme §3 do
mapa mestre.

---

## Rodada 4 — planejamento e abertura das issues (2026-07-27)

Branch `claude/viability-issues-planning-678j2c`. **Sessão de planejamento — zero código.** Saída:
`docs/rodada-4-planilha-2026-07-27.md` (mapa mestre), atualização do `CLAUDE.md` e **30 issues
novas** (#172–#201) a partir da planilha `lista_bugs.xlsx` enviada pelo autor.

### O achado: a premissa de que "os itens até o #7 já estavam implementados" era falsa

O autor pediu, junto com o planejamento, a verificação dos itens 1–7 da planilha. Conferido contra
o HEAD `7c9d59f`: das seis issues abertas a partir dessa mesma planilha na sessão anterior
(PR #171), **só a #170 foi implementada**. As outras cinco — #165, #166, #167, #168, #169 —
seguiam abertas, com diagnóstico pronto e **nenhuma linha de código**.

O caso mais incômodo é a **#166** (item 2, duração do Lançamento): está numa **meia-implementação
quebrada**. O frontend liberou o campo (`tela-fluxo-cronograma.ts:169-170`), mas
`recalcularTravados` ainda força `duracao_meses = 1` (`avancado.ts:56-61`) e o PATCH devolve **422
CAMPO_TRAVADO** (`:377-378`). O usuário digita, toma erro e o valor volta — pior do que se o campo
estivesse visivelmente travado. Os testes de backend ainda **afirmam a trava**
(`avancado.test.ts:26-27,41`) e vão falhar quando a issue for corrigida; é o esperado.

O `CLAUDE.md` agravou o problema: continuava afirmando **"Não há issue aberta"** desde o
encerramento da rodada 3, mesmo com as #165–#169 abertas. Corrigido nesta sessão, com a lição
registrada lá: *"fechou a issue" não é evidência de entrega — nem "abriu a issue" é evidência de
que alguém vai pegá-la. O diff é.*

### Escopo que a tabela `bugs` não mostrava

A planilha tem 28 itens na aba `bugs` (`Item` 1–4 e 6–29 — **o 5 não existe**, a numeração pula),
mas **três abas de referência carregam pedidos sem linha na tabela principal**: `View cronograma`
(stepper com o mês inline), `Referência para Tabelas` (linha de totais destacada) e
`Análise de Mercado` (tela nova alimentada por IA). Viraram #197, #198 e #199–#201 — sem issue
própria eles se perderiam, que foi exatamente como a #91 sumiu na rodada 3.

### Três causas raiz que atravessam a rodada

1. **O Resumo morreu junto com a aba Premissas** (#182, #183, #184). `tela-resumo.ts:105` chama
   `calcularProforma({ ...this.estudo })`, que só lê colunas estáticas de `estudos`. O commit
   `301396a` (#88) removeu a aba Premissas do Avançado e deixou o consumidor para trás — o próprio
   `tela-avancado.ts:63-70` documenta isso. Num estudo Avançado esses campos são `NULL` → VGV,
   Resultado, Margem, ROI, medidores e as 12 fatias da pizza, tudo zero. Os dados certos
   (`c.vgvTotal`, `resultadoDe(c)`, `c.linhasCusto`) **já estão carregados no componente e não são
   usados**.
2. **A duplicação de linhas de custo tem três causas somadas** (#178, #179): conflito entre a
   `migracoes/002_grupos_custo.js` (que moveu `Gestão da obra` para `diretos`) e
   `LINHAS_OBRIGATORIAS.obra` (que continua exigindo a linha em `obra`); ausência de `unicos` no
   `schema.json` e de guarda no backend, com POST fire-and-forget a cada carga; e `eObrigatoria`
   casando por categoria em vez de identidade, o que deixa **as duas** cópias travadas e sem botão
   de remover — a duplicata nasce indeletável.
3. **VGV tem duas definições no app.** O motor do Avançado **não** desconta permuta física
   (`fluxo-caixa-motor.ts:10-12`; `unidades_permutadas` nunca chega ao motor), a Proforma do
   Preliminar desconta (`proforma.ts:119-145`). Por isso a #188 (linhas `VGV Total` /
   `VGV Permuta Física` / `Receita Bruta`) vem **antes** de #189, #182 e #195 no sequenciamento.

### Decisões do autor registradas

- **#185 (item 16):** migrar o gráfico de Cenários para `urbi-grafico-linha`. ⚠️ Trade-off aceito e
  escrito na issue: **perde a linha tracejada** (que o texto do item pede) **e os marcos rotulados**
  da imagem de referência — `SerieGrafico` declara só `{ rotulo, valores, cor }` e nenhum gráfico do
  `ui/src` tem `dasharray` ou anotação. Alternativa conhecida: estender o primitivo no monorepo.
- **#190/#191 (itens 23/24):** o **motor muda** — nº de parcelas fixo, ancorado no cronograma da
  obra. **Estudos existentes mudam de números.**
- **#192 (item 22):** só a linha `Projetado`; Realizado/Desvio/Forecast fora de escopo (o app não
  tem nenhum conceito de custo realizado).
- **#199–#201 (E3):** Análise de Mercado com IA **entra na rodada**, como sessão R4-S14.

### Sequenciamento — **uma issue por sessão**

O autor pediu (na mesma conversa) que o roteiro fosse **individual, não por etapas ou
agrupamentos**: ele abre uma sessão por issue. O mapa mestre foi reescrito nesse formato —
disparo `Resolva a issue #NNN`, com um catálogo de uma linha por issue trazendo pré-requisitos,
portão de merge, arquivo quente e bump de versão.

**A decisão de merge virou regra automática.** Issue cujo código outras precisam ter na `main` para
poderem ser implementadas é **portão**: a sessão mergeia o PR sozinha depois da validação verde.
São **16 dos 35**: #165 #166 #168 #173 #174 #175 #178 #180 #182 #188 #190 #193 #194 #198 #199 #200.
As outras 19 param no PR aberto, e o merge é do autor. Autorização registrada no `CLAUDE.md` como
exceção **delimitada à Rodada 4** — a regra geral ("merge é decisão do autor") continua valendo
fora dela.

**Correção do grafo na reverificação:** o planejamento inicial punha as issues de parcelas
(#190, #191) como dependentes das de Cronograma. **Não dependem** — elas usam a duração do evento
`obra`, e `recalcularTravados` (`backend/rotas/avancado.ts:50-69`) só deriva `lancamento` de
`pre_lancamento` e `pos_obra` de `obra`, sem tocar em `obra`. Podem ser feitas a qualquer momento.

O agrupamento por sessão (`R4-S1`…`R4-S14`) foi **descartado** — não sobreviveu ao pedido do autor
nem à reverificação: ele criava dependências falsas (como a acima) e escondia as reais dentro de
uma mesma sessão.

### Validação

`bash scripts/validar-frontend.sh` **verde** (a sessão não tocou código — só `docs/`, `CLAUDE.md` e
este arquivo). As 30 issues conferidas por `list_issues` após a criação. Seis issues receberam
comentário de correção de referência cruzada (#178, #179, #180, #182, #183, #188), porque citavam
números que ainda não existiam no momento da abertura e apontavam para issues antigas das rodadas
1–3. As #165–#170 receberam comentário ligando-as à Rodada 4.

---

## #170 — saldo de tipologias cascateando pelas Fases da Receita (2026-07-26)

Branch `claude/viabilidade-issues-receita-xbdqy4`. **100% frontend** — sem backend, sem schema,
sem migração. `versao` do `manifesto.json` **intacta**.

Rodada nova de issues (#165–#170), abertas a partir da planilha `lista_bugs.xlsx` do autor. Esta
sessão implementou só a **#170** (item 7 da planilha); as outras cinco (#165, #166, #167, #168,
#169) ficaram abertas com causa raiz já mapeada na descrição.

**O bug.** A tabela de alocações de cada fase (Viabilidade → Receitas) tinha as colunas `Total` e
`Saldo` deslocadas em relação à spec da planilha (aba `#7`, com as fórmulas):

- `Total` exibia `tip.quantidade` — o total bruto do catálogo, **igual em todas as fases**, sem
  descontar o que as fases anteriores já venderam;
- `Saldo` exibia `_saldoAntes(...)`, que calcula o balanço cumulativo **antes** da linha e nunca
  subtrai as `unidades` da própria linha. Ou seja: a coluna rotulada `Saldo` mostrava, na verdade,
  o `Total` que a planilha define. A última fase nunca zerava.

O `_saldoAntes` veio da S10/#107 e a cascata dele estava certa — errado era **onde** o valor
aparecia e o fato de faltar o segundo passo.

**A correção.** A cascata virou função pura em `fluxo-shared.ts` com o nome do que ela calcula:
`totalAntesAlocacao(fases, tipologias, alocId, tipologiaId)` → coluna `Total`. O `Saldo` passou a
ser `total − unidades` da própria linha (e é ele que ganha a classe `.zero`, vermelha ao esgotar).
`_saldoAntes` foi removido de `tela-fluxo-receitas.ts`.

**O que NÃO mudou, de propósito:** `_saldo()` (saldo agregado do estudo, usado só para filtrar o
dropdown de tipologias disponíveis) é outro conceito e continua correto para o seu propósito. A
trava do backend (`saldoTipologiaNoEstudo`) já impede que a soma das alocações passe da
`quantidade` do catálogo, então o novo `Saldo` por linha nunca fica negativo — nenhuma validação
nova foi necessária.

**Contrato de ordem.** A cascata depende da ordem `fases → fase.alocacoes` que o backend devolve
(fases por `ordem`). Isso está agora escrito no docblock da função pura: mudar a ordem muda o
resultado de cada linha.

**Testes.** `fluxo-shared.test.ts` ganhou a fixture da aba `#7` inteira (4 tipologias × 3 fases,
os mesmos números da planilha) conferida linha a linha, mais os casos de borda (alocação
inexistente, tipologia fora do catálogo, `unidades` nulo). Suíte de frontend: **97 testes, 97
passando** via `bash scripts/validar-frontend.sh` (guard de aspas + typecheck + testes + build).

**Doc corrigido junto.** `docs/viabilidade/padrao-incorporacao.md` descrevia a trava de saldo como
"por fase" em dois pontos, quando `saldoTipologiaNoEstudo` (`backend/rotas/avancado.ts:750`)
agrega **todas as fases** do estudo. Divergiu do código → quem se corrige é o doc (CLAUDE.md).

---

## Auditoria da rodada 3 — issues #160, #161, #162 (2026-07-26)

Branch `claude/analyze-unimplemented-prs-79s2to-f0axc2`. Três consertos, **100% frontend/infra**
— sem backend, sem schema, sem migração. `versao` do `manifesto.json` **intacta** (regra do
CLAUDE.md: `z` só bumpa quando entra migração nova).

A auditoria das 62 issues da rodada 3 (#71–#132) achou 3 coisas dadas como entregues sem terem
sido. Um commit por issue, nesta ordem (#160 antes de #162 de propósito: o guard que o #162
adiciona nasce verde porque as aspas já foram corrigidas).

- **#160 — aspas curvas em posição de atributo (reabre #71).** `tela-premissas.ts:466,469`
  tinham `variante=”alerta”` e `class=”form-acoes”` com `”` (U+201D). O parser inclui as aspas
  no valor (`”alerta”`), o valor não casa com nada e o atributo fica **inerte**: o banner de
  "alterações não salvas" renderizava sem cor e a regra `.form-acoes` não aplicava, desalinhando
  o botão "Salvar premissas". Trocado por aspas retas. As aspas curvas em **conteúdo de texto**
  (linha 467, `“Salvar premissas”`) são tipografia legítima e ficaram intactas.
- **#161 — variante inerte no botão "Fluxo de Pagamento" (reabre #91).**
  `tela-fluxo-receitas.ts:275` usava `variante="info"`. Conferido na fonte de verdade
  (`ui/src/urbi-botao.ts` no monorepo): `urbi-botao` declara só
  `primario | secundario | perigo | sucesso | fantasma`. `info` é de `urbi-banner`, outro
  primitivo; `texto`, que a spec cita, **também não existe**. O `render()` joga o valor cru em
  `class`, então saía `class="info"`, sem regra CSS → botão só com o estilo base, sem fundo.
  Trocado por **`secundario`** — e não `primario` — porque o gradiente de `.primario` começa em
  `#2AA9E0`, idêntico ao `--cor-info` da bola de status "ok" que o próprio botão contém (a bola
  sumiria no fundo), e porque o botão irmão "Absorção de Vendas" já é `primario`.
- **#162 — guards contra reincidência.** Guard de aspas curvas como etapa **1/5** de
  `scripts/validar-frontend.sh` (etapas renumeradas) + workflow novo `.github/workflows/
  pr-guards.yml`, que barra PR com **diff vazio** que declara fechar issue, e replica o guard de
  aspas no CI. O workflow é só `git` + `grep`: **não** roda `pnpm install` nem a suíte completa,
  porque o `@urbiverso/sdk` é privado e o `GITHUB_TOKEN` deste repo toma 401 (só o `release.yml`
  tem o PAT). Assim o guard nunca fica vermelho por falta de credencial.

### A lição — o que passou por typecheck/teste/build e mesmo assim estava quebrado

Os dois bugs de UI (#160 e #161) são a **mesma classe de falha**: um valor inválido dentro de um
template literal do `lit`. Nada nessa cadeia enxerga isso —

- `tsc --noEmit` trata o interior de `` html`...` `` como string, não como HTML;
- o `variante` de um primitivo é `@property()`, então em runtime aceita **qualquer** string: o
  tipo TS é só compile-time e o app nem importa o primitivo (usa o global `window.urbiVerso`);
- os testes cobrem funções puras (motor, conversões), não render;
- o esbuild empacota, não valida markup.

O sintoma comum é o do CLAUDE.md: **atributo inexistente não dá erro, só não faz nada** — falha
silenciosa. Foi por isso que uma sessão inteira fechou #71 "validado ✓": leu a string `alerta` no
código e não viu as aspas ao redor. Daí o guard 1 ser um `grep`, não um linter: é a única coisa
que olha o *texto* do template.

O terceiro (#162) é de processo: o PR #142 (`e19d691`) foi mergeado com diff **literalmente
vazio** — zero arquivos — enquanto a mensagem descrevia 12 mudanças item a item e afirmava
`typecheck ✓ · testes 77/77 ✓ · build ✓`, com `Closes #91…#102`. O GitHub fechou as 12 sozinho.
Nove foram recuperadas depois; **a #91 ficou perdida** até esta auditoria. Nenhuma validação de
código pega isso, porque não havia código: o guard tem que ser no PR. Verificado localmente que
o `pr-guards.yml` bloqueia exatamente esse cenário e deixa passar PR com mudança real.

Corolário para as próximas sessões: **"fechou a issue" não é evidência de entrega — o diff é.**

### Varredura complementar (aproveitando o monorepo conectado)

Conferidos **todos** os atributos usados nos 24 primitivos `urbi-*` deste app contra o que cada
um declara em `ui/src/`, seguindo herança de classe-base. **Nenhum outro atributo inerte.** Os 10
candidatos que a varredura levantou são todos legítimos: `categorias`/`series`/`formato`/
`legenda`/`empilhado` dos gráficos vêm de `UrbiGraficoBase`, e `expandir` (`urbi-abas`,
`urbi-tabela`) é convenção de atributo lida no `connectedCallback()` de `UrbiPrimitivoDeLayout` e
usada como `:host([expandir])` em `UrbiPrimitivoDeConteudo` — não é `@property`, mas é suportado.
Os 3 casos conhecidos (`urbi-badge ?desabilitado`, `urbi-input estilo="compacto"` e este `#161`)
já estão todos corrigidos.

### Adendo — sessão paralela e o doc que faltou

Uma **segunda sessão** atacou as mesmas três issues em paralelo, na branch
`claude/viabilidade-app-repo-s6x7mf` (commit `b6ba53a`, ~2 min antes do PR #163). As correções de
frontend saíram **idênticas** nos dois lados — mesmos dois arquivos, mesmas linhas, e ambas
escolheram `secundario` para o #161 de forma independente. Boa corroboração da análise.

O resto era redundante: o `guard-pr.yml` dela é equivalente ao `pr-guards.yml` já mergeado (mergear
os dois daria **dois workflows duplicados** rodando o mesmo check em todo PR), e o grep dela usa a
classe `'=[”“’‘]'` — justamente a forma que dá falso positivo em `=—`/`=→` sem locale UTF-8.

Mas ela pegou uma coisa que o PR #163 **deixou passar**: o `CLAUDE.md` continuava descrevendo o
`validar-frontend.sh` como 3 etapas, sem o guard nem o workflow novo. Doc e código andam juntos —
a regra existe e o PR #163 a violou. Corrigido aqui, com o nome real do arquivo mergeado
(`pr-guards.yml`). Lição colateral: **duas sessões na mesma tarefa desperdiçam trabalho** — o
`CLAUDE.md` já manda uma branch por sessão; vale confirmar escopo antes de começar.

### Validação

`bash scripts/validar-frontend.sh` verde nos três commits (typecheck + 94/94 testes + build).
O guard novo foi testado nos **dois** sentidos: passa na árvore limpa e falha com exit 1
apontando `arquivo:linha` quando a aspa curva é reintroduzida. **Não exercido aqui** (exige o SDK,
fica para o ambiente autenticado do autor): typecheck de backend, `pnpm test` completo e
`urbi-empacotar`. Nenhuma das três mudanças toca backend ou schema.

---

## Lotes de bugs 2026-07-20 (sessões por lote — `docs/lotes-bugs-2026-07-20.md`)

### Lote 1 — Trivial Preliminar — ✅ CONCLUÍDO (issues #9, #10, #11, #12, #13)
Branch `claude/issues-lote-1-76fyc5`. Todas as mudanças **100% frontend** — sem schema,
sem backend, sem migração; `versao` intacta em 0.1.0.

- **#9 (R$/m² sem notação contábil):** novo `_fmtContabilM2(r, p)` em `tela-proforma.ts`,
  análogo a `_fmtContabil` mas com sufixo `/m²` e **sem prefixo "R$"** (antes usava `fmtR$`,
  que injeta "R$"): custos/deduções entre parênteses, receita plana, resultado pelo sinal
  real; `—` quando área vendável ≤ 0. Aplicado na 3ª coluna da tabela, agora com a mesma
  classe de sinal (`pos`/`neg`) do resultado. Método antigo `_rsM2` removido.
- **#10 (Receita Bruta sem destaque):** CSS de `.pf tr.receita td` igualado ao `resultado`
  em peso/tamanho/destaque (`font-weight: 800; font-size: 1.05rem;` + fundo
  `var(--cor-primaria-fundo)`), **mantendo a cor azul primária** que distingue Receita de
  Resultado. Aplica-se a todas as linhas-receita (VGV bruto, Receita bruta, líquida,
  operacional) — a mais proeminente delas é a Receita Bruta (VGV).
- **#11 (sensibilidade sem distinção receita×despesa):** cada linha da análise de
  sensibilidade ganhou `natureza: 'receita' | 'despesa'`; a `<tr>` recebe classe
  `nat-receita`/`nat-despesa`. CSS **só com tokens** (color-mix preserva o token, zero cor
  literal): 1ª coluna colorida por `var(--cor-sucesso)` (receita) / `var(--cor-erro)`
  (despesa) e fundo da linha com `color-mix(... 8%, transparent)`. Classificação: VGV,
  Receita bruta/líquida/operacional, Resultado e Margem líquida = receita; Custo direto
  total, Custo indireto total e Custo obra/VGV = despesa.
- **#12 (badge Preliminar amarelo):** `cor="padrao"` → `cor="alerta"` (token amarelo já
  usado no app e presente em `CorBadge` de `viab-shared.ts`) nos dois pontos:
  `tela-dashboard.ts` (coluna Nível) e `tela-estudo.ts` (cabeçalho do estudo). Avançado
  segue `info` (azul).
- **#13 (remover botão "Criar indicadores padrão" + auto-seed):** removido o botão do topo
  e o método `_semear` de `viabilidade-config-benchmarks.ts`. **Auto-seed silencioso** no 1º
  acesso dentro de `_carregar`: se a lista vier vazia, não for `somenteLeitura` e o seed ainda
  não tiver sido tentado (flag `_semeadoTentado`), chama `semearBenchmarks()` (idempotente,
  admin-only no backend) e recarrega. Guarda evita re-semear ao alternar de tipo. Mensagens
  de tabela vazia que citavam o botão foram neutralizadas.
- **#24 — permanece BLOQUEADA (aguarda print).** `taxa_desconto_aa` só é renderizado em
  `tela-fluxo.ts` (exclusivo do Avançado); o bug não se reproduz no código atual. Sem print,
  não há o que corrigir — issue mantida aberta.
- **Validação neste ambiente:** o `@urbiverso/sdk` é gated por GitHub Packages (auth
  indisponível → 401), então backend/typecheck-completo/`urbi-empacotar` não rodam aqui. Como
  as mudanças são 100% frontend (que **não** importa o SDK, usa o global `window.urbiVerso`),
  validei o frontend isolado com as deps públicas do store pnpm: **typecheck frontend ✓
  (exit 0)** · **testes frontend 70/70 ✓** · **build do bundle frontend (esbuild) ✓**.
  Empacotamento/backend a validar no ambiente do autor (autenticado).

### Lote 2 — Bug de sobreposição no Fluxo de Caixa — ✅ CONCLUÍDO (issue #14)
Branch `claude/issues-lote-2-iy51q4`. Mudança **100% frontend** (só CSS), sem schema/backend/
motor; `versao` intacta.

- **#14 (sobreposição ao rolar a tabela horizontalmente — `tela-fluxo-ver.ts`):** as 5 colunas
  sticky (`.c1`–`.c5`) tinham `left` fixos (0 · 220 · 292 · 356 · 476) mas larguras **não
  travadas** — `.c1` com `min-width:180 / max-width:220` e `.c2`–`.c5` só com `min-width`. Duas
  falhas daí: (a) com nome de linha curto a `.c1` encolhia abaixo do passo de 220px e abria um
  **vão** por onde as colunas de meses vazavam ao rolar (a "sobreposição" reportada — bleed-through,
  não overlap de sticky); (b) valores grandes em Total/VPL faziam `.c4`/`.c5` **crescerem além do
  passo** e invadirem a coluna vizinha (o `left` da seguinte é fixo). **Fix:** travar cada coluna
  com `width = min-width = max-width` + `box-sizing: border-box` + `overflow: hidden`, nos valores
  exatos que os passos de `left` já assumiam (220/72/64/120/120 → cumulativo 0·220·292·356·476, fim
  596). Assim a largura real de cada sticky bate exatamente com o `left` da próxima: sem vão, sem
  crescimento, sem sobreposição. Ellipsis mantido na `.c1` (nomes longos truncam como antes).
- **Nota (armadilha do template):** o comentário CSS vive dentro do tagged template ``css`…` `` —
  um backtick literal no texto fecha o template e quebra o typecheck. Comentário reescrito sem
  backticks (usa aspas).
- **Validação neste ambiente:** frontend isolado (deps públicas do store pnpm) — **typecheck ✓ ·
  testes 70/70 ✓ · build do bundle (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde).
  Empacotamento/backend não se aplicam (mudança puramente de CSS de frontend).

### Lote 3 — Reestruturação de abas do Avançado (FUNDAÇÃO) — ✅ CONCLUÍDO (issue #15)
Branch `claude/issues-lote-3-kz6rmc`. Mudança **100% frontend** (novos componentes + roteamento
de abas), sem schema/backend/motor; `versao` intacta.

- **Decisão de transição (confirmada com o autor):** *preservar tudo no lugar* — as 7 abas de topo
  novas são criadas e cada tela EXISTENTE do Avançado é roteada para a aba correspondente, mantendo
  o Avançado 100% funcional durante a transição. Placeholders só nas sub-abas genuinamente novas
  (Informações, Tipologias), que o Lote 4 (#16) constrói. **O Preliminar fica intocado** (suas 4
  abas de sempre: Premissas · Proforma · Gráficos · Apelo).
- **Novo `frontend/tela-avancado.ts` (`viab-tela-avancado`):** as 7 abas de topo (nível 1) em
  `urbi-abas`, sincronizadas com a URL (`/detalhe/:id/:aba`; emite `viab:aba-topo` → `navegarSub`).
  Navegação de nível 2 por **`urbi-badge` interativo** (mesmo padrão da antiga aba Fluxo — estado
  interno, fora da URL). **Mapa topo → conteúdo:**
  - **Resumo** → `viab-tela-proforma` (o consolidado atual; Lote 8/#23 reconstrói)
  - **Empreendimento** → sub-nav *Informações\* · Cronograma · Tipologias\** (Lote 4/#16)
  - **Viabilidade** → sub-nav *Premissas · Receitas* (Lote 6/#19–21)
  - **Obra** → `viab-fluxo-custos` (Lote 5/#17–18)
  - **Fluxo de Caixa** → `viab-fluxo-ver`
  - **Cenários** → `viab-tela-graficos`
  - **Análise de mercado** → `viab-tela-apelo`
  - (\* = placeholder `urbi-estado-vazio` apontando o Lote 4)
- **Cronograma extraído:** o Cronograma (parâmetros + tabela de eventos + Gantt SVG) vivia embutido
  em `tela-fluxo.ts`. Foi movido **verbatim** para o novo `frontend/tela-fluxo-cronograma.ts`
  (`viab-fluxo-cronograma`), standalone, para ser hospedado em Empreendimento → Cronograma. Os
  demais sub-componentes do fluxo (`viab-fluxo-receitas`/`-custos`/`-ver`) já eram standalone.
- **`tela-fluxo.ts` removido:** era só o wrapper da antiga aba única "Fluxo de Caixa" com sub-nav;
  totalmente superado por `viab-tela-avancado`. Nenhum teste dependia dele (os testes cobrem
  motor/shared). Único import era em `tela-estudo`.
- **`tela-estudo.ts`:** o render passou a ramificar por nível — Avançado renderiza
  `<viab-tela-avancado>` (recebe `estudo` + `podeEditar` + `status` e computa os guards de edição
  como antes: premissas sem checar `arquivado`; cronograma/receitas/custos com `arquivado`; apelo
  só `podeEditar`); Preliminar mantém a `urbi-abas` de 4 abas idêntica. Setter de `aba` agora só
  guarda o valor cru; cada ramo normaliza para o seu conjunto (Avançado normaliza dentro do
  componente; URLs antigas do Preliminar caem em `resumo` no Avançado).
- **Nota de comportamento:** como todos os slots da `urbi-abas` são renderizados (padrão do
  primitivo, já era assim no Preliminar), Custos (Obra) e Ver Fluxo passam a montar junto ao abrir
  o estudo — só marginalmente mais fetches iniciais; cada componente guarda seu próprio carregamento.
  Sem impacto de correção.
- **Escopo do lote:** só a FUNDAÇÃO (a árvore de abas). O conteúdo definitivo de cada sub-aba é dos
  lotes 4–8. `matricula`/`descricao`/anexos, mês 0, tipologias, 5 abas de custo, novo modelo de
  receitas/fases, Financeiro e o Resumo consolidado **não** entram aqui.
- **Validação neste ambiente:** frontend isolado (deps públicas do store pnpm) — **typecheck ✓ ·
  testes 70/70 ✓ · build do bundle (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde).
  Empacotamento/backend não se aplicam (sem schema/backend). ⏳ Render real das abas aninhadas só
  valida no deploy dev.

### Lote 4 — Aba Empreendimento (Informações · Cronograma · Tipologias) — ✅ IMPLEMENTADO (issue #16)
Branch `claude/issues-lote-4-sx0rel`. Toca **schema + backend + frontend**. `versao` **0.1.0 → 0.1.1**
(1ª migração real do app — `migracoes/001_mes_zero_cronograma.js`).

- **Decisões de rota (o autor pediu para prosseguir sem responder às perguntas — registrado):**
  1. **Tipologias: só realocadas, mantidas ACOPLADAS às linhas de receita** (`linha_receita_id`
     segue obrigatório). O modelo de **catálogo desacoplado** é do **Lote 6 (#19)**, que exige spec
     conjunta — não pré-emptado aqui. A sub-aba apresenta as tipologias de todas as linhas numa única
     tabela; adicionar a 1ª cria uma linha de receita padrão ("Vendas") se não houver nenhuma.
  2. **`taxa_desconto_aa`: editor REMOVIDO da tela de Cronograma** (conforme #16). O valor persiste no
     schema e o motor usa o padrão 12% a.a. até a realocação (**Financeiro, Lote 7 — bloqueado**).
  3. **Mês 0 com migração de dados existentes** (forward-only, desloca −1).
- **(2) Cronograma — convenção mês 1 → 0 (mês 0 = início do projeto):** mudança sistemática no motor
  puro (`fluxo-shared.ts`, `fluxo-caixa-motor.ts`) — rótulos e índices 0-based (índice do array =
  número do mês); horizonte derivado com `+1`; `recorte` devolve o índice direto e o gate de exibição
  passou a ser por **duração** (mês 0 é válido, não pode ser falsy). Consumidores ajustados:
  `tela-fluxo-ver.ts` (eixos/marcos/payback `M+`), `tela-fluxo-cronograma.ts` (Gantt, banner, guarda
  `>= 0`), `exportar.ts` (CSV/PDF). Backend: `cronogramaPadrao` 0-based (0·6·12·17·41), validação
  `inicio_mes >= 0`, default de custo `inicio_mes 0`. Schema: `avancado_cronograma.inicio_mes` e
  `avancado_linhas_custo.inicio_mes` padrão → 0. **Migração 001** desloca em −1 os `inicio_mes`
  persistidos (cronograma + custos) e os `absorcao.meses[].mes` (absorção personalizada). NÃO toca
  `duracao_meses`, `absorcao.blocos` (por evento) nem `fluxo_pagamento` (offsets relativos). Os **18
  testes de motor/shared** foram reancorados a 0-based (70/70 verde).
- **(1) Informações:** novos campos `matricula` (texto) e `descricao` (texto_longo) em `estudos`
  (passam pelo PATCH por blocklist); nova tabela **`estudo_documentos`** (espelha
  `apelo_comercial_documentos`, FK `estudo_id` cascata, coluna `categoria` =
  imagem_principal/render/planta, `documento` tipo `arquivo` com mimes imagem+PDF). Backend novo
  `backend/rotas/empreendimento.ts` (GET/POST/DELETE dos anexos, registrado em `rotas.ts`). Frontend
  `frontend/tela-empreendimento-info.ts` (`viab-empreendimento-info`): nome/matrícula/descrição
  editáveis + área do terreno read-only + upload por categoria (mesmo fluxo `__upload` do Apelo).
- **(3) Tipologias:** nova coluna `unidades_permutadas` (inteiro, padrão 0) em `avancado_tipologias`
  (+ `CAMPOS_TIPOLOGIA` no backend). Frontend `frontend/tela-empreendimento-tipologias.ts`
  (`viab-empreendimento-tipologias`): tabela consolidada com colunas **Nome · Tipo · Área privativa ·
  Dormitórios · Vagas · Unidades · Un. permutadas** (loteamento oculta Tipo/Dorm/Vagas) + **linha de
  consolidado** (total de unidades, área total = Σ área×un, total de vagas, total permutadas).
  **Decisão:** `areaPrivativaTotalLinhas` do motor **não** foi alterada (segue Σ área×quantidade, usada
  no custo `rs_m2_priv` e travada por teste); o efeito de `unidades_permutadas` sobre VGV/área líquida
  é do **Lote 6** (rework de Receitas) — aqui a coluna é coletada e somada no consolidado.
- **`tela-avancado.ts`:** os placeholders de Informações e Tipologias foram substituídos pelos novos
  componentes; `_placeholder` removido (sem uso).
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 70/70 ✓ · build (esbuild)
  ✓** (`bash scripts/validar-frontend.sh` verde; bundle 209→223kb). ⏳ **Pendente do autor
  (ambiente autenticado, SDK gated):** typecheck do backend, suíte de backend, `urbi-empacotar` e a
  **execução da migração 001** contra dados reais. Render real dos primitivos de upload/tabela só
  valida no deploy dev.
- **Não copiado no duplicar (nota):** `estudo_documentos` (anexos) não é copiado por
  `duplicarDadosAvancado` (blobs de arquivo); `matricula`/`descricao` viajam com a cópia do estudo
  (não estão no blocklist de cópia). Ajustar se o autor quiser duplicar anexos.

### Lote 5 — Custos em 5 abas + seletor de unidade unificado — ✅ IMPLEMENTADO (issues #17, #18)
Branch `claude/lote-5-issues-msebmq`. Toca **schema + backend + frontend**. `versao` **0.1.1 → 0.1.2**
(migração `migracoes/002_grupos_custo.js`). Pré-requisitos #15 e #16: concluídos.

- **Decisões do autor (perguntadas no início — respostas registradas):**
  1. **Divisão dos grupos ("Obra = tudo de construção"):** o menu de categorias da aba **Obra**
     mantém toda a obra física (Obra · Decoração · Gestão da obra · Contingência · Outro); **Diretos**
     nasce como grupo novo p/ o usuário cadastrar (entrega do produto: Decoração · Gestão da obra ·
     Stand de vendas · Comissão de vendas · Outro); **Financeiro** novo (Juros de financiamento ·
     Taxas bancárias · Estruturação de dívida · Investidores · Outro). Terreno e Indiretos: menus
     intactos.
  2. **Migração dos dados existentes ("Reclassificar por categoria"):** linhas em `obra` com categoria
     **Decoração** ou **Gestão da obra** → `diretos`; o resto de `obra` fica em `obra`; `terreno` e
     `indireto` ficam onde estão. `financeiro` sem dado legado.
  - **Reconciliação das duas respostas (nota):** a resposta 1 deixa o menu da aba Obra permissivo
    (oferece Decoração/Gestão) enquanto a 2 migra as linhas *já cadastradas* dessas categorias p/
    Diretos. Coerente: o menu é a oferta futura; a migração pré-classifica o dado existente. Para as
    linhas migradas renderizarem certo, o menu de **Diretos** também inclui Decoração/Gestão da obra.
- **#17 (5 grupos + seletor por badge):**
  - **Schema:** `avancado_linhas_custo.grupo.opcoes` 3→5 (`terreno`/`obra`/**`diretos`**/`indireto`/
    **`financeiro`** — mantido o valor legado `indireto` p/ não migrar linhas de indireto). Backend
    `GRUPOS_CUSTO` idem (valida POST/PATCH). **Migração 002** forward-only (obra+categoria → diretos).
  - **Seletor de unidade unificado com o Preliminar:** a coluna Orçamento trocou o `urbi-select` por
    **`urbi-badge` interativos** (5 unidades: R$ · R$/m² priv · R$/m² terreno · % VGV · % Receita) com
    **conversão automática de valor** ao trocar (mesmo padrão de `_custoUnidade` do Preliminar). Como a
    linha de custo guarda **um só par** `orcamento_valor`/`orcamento_unidade` (≠ Preliminar, que tem
    coluna por unidade), a troca converte o valor e persiste unidade+valor num só PATCH. Descritores
    `CONV_UNIDADE` batem com o motor (`resolverCustoTotal`): identidade / por_area(areaPrivativa) /
    por_area(areaTerreno) / pct(vgv) / pct(receita←fallback vgv). Reusa `converterUnidade` de
    `premissas-conversao.ts`, agora com as chaves `areaTerreno`/`receita` no `LinkKey` (e
    `CtxConversao` virou `Partial` — chave ausente = não converte).
- **#18 (formato de tabela + 5 abas):** os 5 grupos viraram **5 sub-abas** da aba de topo **Obra**
  (nível-2 `urbi-badge`, declaradas em `tela-avancado.ts` `SUBABAS.obra`), cada uma renderizando
  `viab-fluxo-custos` com a prop nova **`grupo`** (filtra p/ 1 grupo; vazio = todos, fallback). Colunas
  já batem com a spec (Categoria single-select por aba · Orçamento · Distribuição · Cronograma · Início ·
  Duração) + **subcategoria mantida** (aditiva, útil) + **consolidado por aba** (rodapé já existente).
  Regra 🔒 do Cronograma (evento trava Início/Duração) preservada.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 73/73 ✓** (+3 de conversão
  areaTerreno/receita) **· build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde; bundle
  ~225kb). ⏳ **Pendente do autor (SDK gated):** typecheck do backend, suíte de backend, `urbi-empacotar`
  e a **execução da migração 002** contra dados reais. Render real dos badges/sub-abas só no deploy dev.
- **Pré-existente não tocado (fora do escopo):** em `tela-fluxo-custos.ts` o campo Início customizado usa
  `Number(c.inicio_mes) || 1`, que exibe 1 quando o valor é o mês 0 (convenção do Lote 4). Bug latente de
  exibição do default, não do dado salvo; deixado para uma varredura própria.

### Lote 6 — Receitas + Fases + Absorção/Fluxo (spec conjunta) — ✅ IMPLEMENTADO (issues #19, #20, #21)
Branch `claude/lote-6-issues-b21wlr`. Toca **schema + backend + frontend + motor**. `versao` **0.1.2 → 0.1.3**
(migração `migracoes/003_receitas_fases_alocacoes.js`). Pré-requisitos #15 e #16: concluídos.

- **Decisões do autor (perguntadas no início — respostas registradas):**
  1. **Modelo de dados:** **Fase nova + Alocações** — `avancado_fases` (nome, ordem, `absorcao`, `fluxo_pagamento`)
     e `avancado_alocacoes` (fase_id, tipologia_id→catálogo, unidades, preco_m2). `avancado_tipologias` virou
     **catálogo do estudo** (desacoplado — `linha_receita_id` removido). `avancado_linhas_receita` **aposentada**
     (migrada p/ fases+alocações; preservada vestigial no schema para não exigir drop de tabela).
  2. **Integridade tipologia (#19):** **bloquear exclusão** de tipologia com alocações (422 `TIPOLOGIA_EM_USO`);
     a alocação guarda só unidades+preço e lê nome/área do catálogo **ao vivo** (edição reflete).
  3. **Trava de saldo:** **por fase** — saldo = `quantidade` da tipologia − Σ unidades alocadas **naquela fase**
     (a mesma tipologia pode ser realocada por inteiro noutra fase).
- **#19 (novo modelo de Receitas):** a aba **Viabilidade → Receitas** virou **1 card por Fase**; dentro, uma tabela
  de **alocações** (tipologia do catálogo · unidades · preço/m² · área read-only · preço unit/total · saldo). O
  `urbi-select` de tipologia só oferece as com **saldo > 0 na fase** (trava). Empreendimento → Tipologias virou o
  **cadastro do catálogo** (`tela-empreendimento-tipologias.ts` reescrita, endpoints estudo-level).
- **#20 (Absorção + Fluxo):** **Absorção** só **Distribuído** em 3 períodos — P1 = **Pré-lançamento+Lançamento**,
  P2 = Obra, **P3 = Pós-obra derivado** (`100 − p1 − p2`, período do Cronograma). Removidos `linear`/`personalizado`
  da UI, o campo **VGL** e a validação de soma=100%. **Fluxo de Pagamento** com **múltiplas linhas** de Entrada e
  Parcelamento; **Repasse derivado** (`100 − Σentrada − Σparcelas`), sem mensagem de soma.
- **#21 (Fases estruturadas):** `fase_label` (texto) virou entidade `avancado_fases`, dona da Absorção e do Fluxo;
  as alocações são organizadas **por fase**.
- **Motor (compat):** `fluxo-shared.ts` — `absorcaoMensal` distribuído reescrito p/ os 3 períodos (novos
  `faixasAbsorcao`/`pctPosObraDerivado`; `periodoAbsorcao` agora começa no Pré-lançamento). `fluxo-caixa-motor.ts`
  — `receitaMensalLinha` aceita Entrada/Parcelas em **lista** com Repasse derivado (`pctRepasseDerivado`,
  `normalizarLinhasPagamento`); **backward-compat** para o shape objeto legado. `GET /avancado/receitas` devolve as
  **fases no formato do motor** (fase = "linha de receita"; alocações joinadas ao catálogo = "tipologias"), então
  `tela-fluxo-ver`/gráficos/`exportar` seguem sem mudança.
- **Backend (`backend/rotas/avancado.ts`):** novas rotas — catálogo de tipologias (estudo-level, DELETE bloqueia se
  em uso), Fases (CRUD com `absorcao`/`fluxo_pagamento` validados sem soma), Alocações (CRUD nested por fase, trava de
  saldo por fase em POST/PATCH). Validadores `validarAbsorcao`/`validarFluxoPagamento` relaxados (sem soma=100).
  `duplicarDadosAvancado` reescrita (catálogo → mapa id, fases + alocações remapeadas). `montarLinhasReceita` exportada.
- **Migração 003 (forward-only):** cada `avancado_linhas_receita` → `avancado_fases` (absorção convertida p/ distribuído,
  fluxo p/ multi-linha); cada `avancado_tipologias` legada → uma `avancado_alocacoes` na fase da sua linha; drop de
  `avancado_tipologias.linha_receita_id` via `remover_colunas`. Numa instância virgem o runner faz baseline (inócua).
  > ⚠️ **Vencido em 2026-08-19 (#422):** o `remover_colunas` saiu. A `003` hoje esvazia a coluna com
  > `dados.limparColuna` e a poda do reconciliador derruba a estrutura vazia no mesmo boot — ver a
  > entrada do topo deste arquivo.
- **Decisão registrada (área p/ custos `rs_m2_priv`):** a área privativa total do motor passa a somar as **alocações**
  (unidades × área do catálogo), mantendo VGV e base de custo consistentes entre si. Se o autor quiser a área do
  **catálogo inteiro** (construído, não só vendido) para custo de obra, ajustar `montarLinhasReceita`/motor num passo próprio.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓** (+ absorção 3-períodos,
  fluxo multi-linha, `montarLinhasReceita`) **· build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde;
  bundle ~224kb). ⏳ **Pendente do autor (SDK gated):** typecheck do backend, suíte de backend (inclui os testes
  novos de `validar*`/`montarLinhasReceita`), `urbi-empacotar` e a **execução da migração 003** contra dados reais.
  Render real dos modais (Absorção 3 períodos, Fluxo multi-linha) e da trava de saldo só valida no deploy dev.

### Lote 7 — Financeiro (sub-abas de Viabilidade) — ✅ IMPLEMENTADO (issue #22)
Branch `claude/lote-7-issues-y8gvh9`. Toca **schema + frontend** (sem motor, sem migração). `versao`
**mantida** — só colunas aditivas em `estudos` (precedente da Etapa 3: adição de coluna não bumpa `versao`
nem exige migração; o sincronizador cria as colunas com seus padrões).

- **Destravamento do lote:** o issue estava 🚫 bloqueado por falta de spec dos campos. O autor forneceu a
  spec via **prints de uma ferramenta profissional de incorporação** (abas Juros/Taxas · Impostos ·
  Financiamento à Produção · Securitização) + 2 ajustes: (a) `taxa_desconto_aa` mora em **Custos Financeiros**;
  (b) a **Correção** tem 2 fatores — índice + taxa (% a.a.) digitada. Proposta rascunhada por mim e aprovada
  "com ajustes".
- **Decisões do autor (registradas):**
  1. **Motor:** "só persistir + realocar existentes" — os campos novos são **gravados/exibidos mas NÃO entram
     em nenhuma fórmula** agora. `proforma.ts`/`fluxo-caixa-motor.ts`/`fluxo-shared.ts` **intocados**. Entrada
     de juros/financiamento no fluxo é passo futuro (spec de motor à parte).
  2. **Layout:** `Financeiro` como **3º badge de Viabilidade** (`Premissas · Receitas · Financeiro`); as 5
     seções são **urbi-card empilhados (seções roláveis)**, não um 3º nível de aba — a alternativa que o
     próprio #22 sugeriu.
  3. **Overlap com Obra→Financeiro:** a seção Custos Financeiros aqui é **paramétrica**; as linhas manuais de
     custo financeiro seguem no grupo **Obra → Financeiro** (Lote 5) — papéis distintos, sem duplicar dado.
- **Avaliação severa dos prints (o que foi CORTADO):** rejeitados por exigirem motor temporal (adiado) ou por
  obsolescência — **CPMF** (extinto desde 2007), IOF adicional, curvas de liberação/amortização,
  financiamentos associativos CEF/MCMV, securitização de recebíveis, e as matrizes por-conta "Encargos sobre
  Incorridos"/"Projeção Inflacionária". Mantidos só os campos-cabeçalho que cabem barato no schema e ficam
  persist-only.
- **Schema (`estudos`, ~29 colunas aditivas):** Estrutura (`estrutura_capital_proprio_pct`,
  `estrutura_financiamento_pct`, `estrutura_investidores_pct`, `taxa_juros_valor_futuro_aa`); Custos Financeiros
  (`tarifas_bancarias_pct`, `taxa_adm_carteira_pct`, `taxa_estruturacao_divida_pct`, `taxa_gerenciamento_obra_pct`
  — + `taxa_desconto_aa` já existente, só realocado); Juros (`juros_financeiros_aa`, `juros_inicio_cobranca_mes`,
  `indice_correcao` [enum], `indice_correcao_taxa_aa`); Taxas e Impostos (`regime_tributario` [enum],
  `aliquota_pis_pct`, `aliquota_cofins_pct`, `aliquota_csll_pct`, `aliquota_irpj_pct`, `aliquota_itbi_pct`,
  `imposto_sobre_permuta_fisica` [bool] — reusando `sujeito_ret`/`imposto_percentual`); Financiamento &
  Investidores (`financiamento_obra_pct`, `financiamento_juros_aa`, `financiamento_sistema_amortizacao` [enum],
  `financiamento_prazo_meses`, `financiamento_carencia_meses`, `investidor_aporte_valor`,
  `investidor_retorno_tipo` [enum], `investidor_juros_aa`, `investidor_carencia_meses`, `investidor_parcelas`).
  Precisão seguindo o precedente local do `estudos`: % → `decimal(5,2)`, R$ → `decimal(12,2)`, meses/parcelas →
  `inteiro`.
- **Frontend:** novo `frontend/tela-financeiro.ts` (`viab-tela-financeiro`) — 5 urbi-card, `viab-num` (com
  `casas-decimais=0` p/ inteiros), `urbi-select` p/ os enums, `urbi-checkbox` p/ RET e permuta física, salvar via
  `atualizarEstudo` (coerção '' → null nos numéricos). `tela-avancado.ts`: `financeiro` adicionado ao `SUBABAS.viabilidade`
  e ao `_renderSubConteudo` (editável = guard de premissas). `taxa_desconto_aa` volta a ter editor (sumira no Lote 4).
- **Realocação sem duplicar dado:** `sujeito_ret`/`imposto_percentual` seguem editáveis também em Premissas
  (componente `viab-tela-premissas` é compartilhado com o Preliminar — **não** mexido para não afetar o Preliminar);
  editar em qualquer tela grava a mesma coluna. Registrado como dupla-superfície consciente.
- **Check de não-regressão (pedido do autor):** confirmado por `git diff` que **nenhum arquivo de motor** foi
  tocado (proforma/fluxo/conversão) → todas as fórmulas seguem idênticas; **typecheck ✓ · testes 76/76 ✓ · build
  (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~234kb). Como os campos são inertes ao cálculo,
  não há fórmula nova para quebrar.
- ⏳ **Pendente do autor (SDK gated):** typecheck do backend, suíte de backend, `urbi-empacotar` e a criação real
  das colunas aditivas (sincronizador) contra dados reais. Render real dos `urbi-select`/acordeões só valida no
  deploy dev.

### Lote 8 — Aba Resumo consolidada (ÚLTIMO) — ✅ IMPLEMENTADO (issue #23)
Branch `claude/lote-8-issues-jp59cw`. Mudança **100% frontend** — sem schema/backend/motor/migração;
`versao` intacta. Pré-requisitos (lotes 1–7): todos concluídos.

- **Seleção de itens (definida com o autor, conforme #23 "definida em conjunto"):**
  - **8 KPIs:** do Fluxo de Caixa → **VPL · TIR · Payback · Exposição máxima**; do Proforma →
    **VGV · Resultado · Margem líquida · ROI**.
  - **4 gráficos-chave:** **Fluxo de Caixa Acumulado** (curva S, com payback + exposição) ·
    **Fluxo de Caixa Mensal** (barras) · **Composição dos custos** (pizza) · **Indicadores vs.
    benchmark** (medidores).
- **Novo `frontend/tela-resumo.ts` (`viab-tela-resumo`):** frontend puro, **sem entrada própria** —
  consome os resultados das outras abas. Carrega os dados do Avançado (receitas, custos, curvas,
  cronograma, parâmetros) + benchmarks + config numa única `_carregar`, computa o **motor de fluxo**
  (`calcularFluxo`) e o **Proforma** (`calcularProforma`, com `aliquota_ret_pct` da config) e renderiza
  os 8 KPIs + os 4 gráficos. `urbi-estado-vazio` quando ainda não há receitas/custos.
- **Reuso, não reinvenção (headline):** os SVGs de fluxo (mensal + acumulado) foram **extraídos** de
  `tela-fluxo-ver.ts` para o novo módulo puro **`frontend/fluxo-graficos.ts`** (`graficoFluxoMensal`/
  `graficoFluxoAcumulado`, + `abrevR$` e os marcos do cronograma). `tela-fluxo-ver` passou a importar
  essas funções (removidas as cópias privadas `_graficoMensal`/`_graficoAcumulado`/`_marcos` e o
  `abrevR$` local; import de `svg` removido). Assim **Resumo e Fluxo de Caixa renderizam gráficos
  idênticos** a partir da mesma fonte. Os medidores reusam `montarMedidor` (`medidor-faixas.ts`) e a
  pizza reusa `urbi-grafico-pizza` com a mesma lista de custos do Proforma que a aba Cenários
  (`tela-graficos`).
- **`tela-avancado.ts`:** a aba **Resumo** deixou de renderizar `viab-tela-proforma` (placeholder do
  Lote 3) e passou a renderizar **`viab-tela-resumo`**; import de `tela-proforma` removido daqui (o
  Preliminar segue registrando-o via `tela-estudo`). Comentário do mapa de abas atualizado.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~239kb). Sem schema/backend → empacotamento não se
  aplica. ⏳ Render real dos `urbi-kpi`/`urbi-grafico-*` só valida no deploy dev.

---

## Rodada 3 — Sessões (2026-07-25) — `docs/sessoes-bugs-2026-07-25.md`

### Sessão S5 — Empreendimento Cronograma: Regras e bug Gantt — ✅ IMPLEMENTADA (issues #84, #85, #86)
Branch `claude/sessao-s5-rx8lrh` (PR #139). Mudança **100% frontend** (`frontend/tela-fluxo-cronograma.ts`) —
sem schema/backend/migração; `versao` intacta. Sem pré-requisitos.

- **#84 (Pré-lançamento derivado de Planejamento):** `pre_lancamento.inicio_mes` agora é sempre
  travado na UI (flag forçado para `true` no frontend, independente do servidor). Ao salvar
  `planejamento.inicio_mes`, o componente faz um segundo PATCH automático para `pre_lancamento` com
  `inicio_mes = planejamento.inicio_mes + 1`. O array `crono` é atualizado com o retorno do segundo PATCH.
- **#85 (Duração do Lançamento editável):** para o evento `lancamento`, `travadoDur` é forçado para
  `false` no frontend — o campo passa a ser editável como as demais fases, removendo a trava que vinha
  do flag do servidor.
- **#86 (Estrela à esquerda da barra):** a estrela ⭐ era renderizada em `x + 4` (em cima do início
  da barra). Corrigida para `x - 4` com `text-anchor="end"` — imediatamente à esquerda. Também
  adicionado suporte à estrela no branch `rect` (duração > 1 mês), já que após #85 o Lançamento pode
  ter qualquer duração.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde). Sem schema/backend → empacotamento não se aplica.
  ⏳ Render real do Gantt e do cascade-save só valida no deploy dev.

### Sessão S6 — Empreendimento: Bugs difíceis — ✅ IMPLEMENTADA (issues #87, #88)
Branch `claude/sessao-s6-votd43`. Mudança **100% frontend** — sem schema/backend/motor/migração;
`versao` intacta. Sem pré-requisitos.

- **#87 (campos de texto apagam ao digitar rápido — race de PATCH stale):** raiz do bug é uma
  resposta de PATCH antigo chegando **depois** e sobrescrevendo o valor atual do campo. Fix nos
  dois arquivos-alvo:
  - `frontend/viabilidade-api.ts`: `atualizarEstudo(id, dados, signal?)` ganhou 3º parâmetro
    **`AbortSignal` opcional** (repassado ao `fetch` via `RequestInit.signal`). Chamadas existentes
    (2 args) seguem idênticas.
  - `frontend/tela-empreendimento-info.ts`: os campos de texto (Nome · Matrícula · Descrição) agora
    fazem **auto-save com debounce (500ms) + AbortController**. Cada disparo **aborta o PATCH
    pendente anterior** antes de iniciar o novo (`_salvarCampos`), então a resposta de um PATCH
    obsoleto nunca volta para clobberar o campo; o componente também **nunca reescreve** o valor a
    partir da resposta da API. O botão "Salvar informações" continua (faz *flush* do debounce e
    grava tudo — texto + terreno/coeficientes — num único PATCH). Auto-save é silencioso; o botão
    mantém o toast de confirmação. `disconnectedCallback` limpa o timer e aborta o controller;
    `_agendarSalvarTexto` só dispara quando `editavel`.
- **#88 (remover todo o conteúdo da aba Premissas no Avançado):** revisita e **supera** a decisão da
  Etapa 7/#54 (que mantivera Premissas no Avançado). Remoção exclusiva do Avançado; Preliminar
  100% intocado.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~266.7kb). Sem schema/backend → empacotamento
  não se aplica.

### Sessão S9 — Receitas: UI & Validação — ✅ IMPLEMENTADA (issues #103, #104, #105, #106)
Branch `claude/sessao-s9-rs5ndx` (PR #143). Mudança **100% frontend** (`frontend/tela-fluxo-receitas.ts`) —
sem schema/backend/motor/migração; `versao` intacta. Pré-requisito S5: concluído.

- **#103–#106:** coluna Total, botões secundario, regras de parcelamento, lixeiras perigo.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓** (~266.7kb).

### Sessão S3 — Preliminar Proforma: Bugs de exibição — ✅ IMPLEMENTADA (issues #77, #78)
Branch `claude/sessao-s3-hcnifg` (PR #136). Mudança **100% frontend** (`frontend/tela-proforma.ts`) —
sem schema/backend/motor/migração; `versao` intacta. Sem pré-requisitos.

- **#77 (receita com notação contábil negativa):** **Receita líquida** e **Receita operacional** são
  consolidados de receita (`tipo: 'consolidado'` + `natureza: 'receita'`), mas o fallback de
  `_fmtContabil`/`_fmtContabilM2` envolvia qualquer não-receita/não-resultado em parênteses, incluindo-os.
  Agora ambos os formatadores testam também `natureza === 'receita'` → exibem valor **plano (absoluto
  positivo)** nas colunas R$ e R$/m². `proforma.ts` **não** foi tocado (os valores já vinham corretos; o
  bug era só de exibição).
- **#78 (títulos da sensibilidade desalinhados):** os números da tabela monetária herdavam
  `text-align: right` da regra global `.num`, enquanto o cabeçalho (badge do cenário) é centralizado via
  `.sens-cab`. Fix: `.pf.sens td.num` agora **centralizado** (casa com o cabeçalho, como já ocorria na
  tabela de indicadores) + **`colgroup` compartilhado** (rótulo 40% + 3 cenários 20%) e
  `table-layout: fixed` para as colunas bear/base/bull terem a mesma geometria nas duas tabelas.
- **Armadilha do template (relembrada):** backtick literal dentro do `` css`…` `` fecha o tagged template
  e quebra o typecheck — comentário reescrito sem backticks (usa aspas). Ver Lote 2.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~265.8kb). Sem schema/backend → empacotamento não se
  aplica. ⏳ Render real do alinhamento só valida no deploy dev.

### Sessão S10 — Saldo de unidades + Absorção 4 períodos — ✅ IMPLEMENTADA (issues #107, #108)
Branch `claude/sessao-s10-fbqwwv`. Mudança **100% frontend** (`frontend/fluxo-shared.ts`,
`frontend/tela-fluxo-receitas.ts`, testes) — sem schema/backend/migração; `versao` intacta.
Pré-requisito: S5 (concluída).

- **#107 (Saldo de unidades: cálculo de cima para baixo):** introduzido `_saldoAntes(alocId, tipologiaId)`
  em `tela-fluxo-receitas.ts` — percorre `this.fases` em ordem e acumula unidades até encontrar a alocação
  alvo, retornando `quantidade - usado_acima`. O `_saldo()` simples (total restante) permanece para o campo
  readonly final. `_renderAlocacao` agora usa `_saldoAntes(a.id, a.tipologia_id)` para exibir o saldo
  disponível no momento daquela alocação específica.
- **#108 (Absorção: separar Pré-lançamento e Lançamento — 4 períodos):** `faixasAbsorcao` em
  `fluxo-shared.ts` agora retorna 4 faixas separadas (`pre_lancamento`, `lancamento`, `obra`, `pos_obra`).
  `pctPosObraDerivado` subtrai os 4 inputs. `absorcaoMensal` modo `distribuido` espalha cada período
  separadamente; faixa vazia (fim < inicio) quando Pré-lançamento ausente do cronograma. Modal de absorção
  em `tela-fluxo-receitas.ts` atualizado para 4 linhas/entradas. Backward-compat: bloco `pos_obra` com
  `pct: 0` se torna derivado de `100 − pré − lanc − obra`.
- **Testes:** `fluxo-shared.test.ts` e `fluxo-caixa-motor.test.ts` atualizados para o novo formato de 4 períodos.
- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde). Sem schema/backend → empacotamento não se aplica.

### Sessão S11 — Custos: Texto, CSS & Layout — ✅ IMPLEMENTADA (issues #109–#114)
Branch `claude/sessao-s11-*` (PR #145). Mudança **100% frontend** — sem schema/backend/migração;
`versao` intacta. Sem pré-requisitos.

- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**.

### Sessão S12 — Custos: Regras & Formatação — ✅ IMPLEMENTADA (issues #115, #116, #117)
Branch `claude/sessao-s12-0jed3r`. Mudança **100% frontend** (`frontend/tela-fluxo-custos.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisito S11: concluído.

- **#115 (Construção obrigatória — 1ª linha travada):** categoria "Obra" renomeada para "Construção"
  em `CATEGORIAS.obra`. Constante `OBRA_OBRIGATORIAS` define as 2 linhas obrigatórias do grupo Obra
  em ordem (`Construção` · `Gestão da obra`). Função `eObrigatoria(c)` identifica essas linhas.
  Ao carregar (modo editável), `_garantirLinhasObra()` cria as linhas faltantes via POST. Na coluna
  Categoria, linhas obrigatórias exibem `<strong>` (texto travado) em vez de `urbi-select`. Botão
  "Remover" omitido para essas linhas. Função `ordenarLinhasObra()` garante que Construção e Gestão
  da obra apareçam sempre nas posições 0 e 1, independente da `ordem` do servidor.
- **#116 (Gestão da obra obrigatória — 2ª linha travada):** implementado em conjunto com #115 via
  o mesmo mecanismo (`OBRA_OBRIGATORIAS`). A lógica é idêntica: categoria travada, posição fixada,
  não removível.
- **#117 (Orçamento em % com 2 casas decimais):** o `viab-num` da coluna Orçamento recebe
  `casas-decimais="2"` quando `modo.startsWith('pct_')`, e `casas-decimais="0"` nas demais unidades.
  Aplica-se a todas as abas de Custos (mesmo componente).
- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~273.3kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das linhas travadas e formatação % só valida no deploy dev.

### Sessão S13 — Custos: Lógica multi-arquivo — ✅ IMPLEMENTADA (issues #118, #119, #120)
Branch `claude/sessao-s13-sfftnq`. Mudança **100% frontend** (`frontend/tela-fluxo-custos.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisito S12: concluído.

- **#118 (coluna Resultado — multiplicação correta por unidade):** a coluna Resultado já usava
  `resolverCustoTotal` (motor puro em `fluxo-shared.ts`), mas o `ContextoCusto` montado na UI **não
  preenchia `receitaTotal`** — então linhas em **`% Receita`** caíam no fallback do motor
  (`ctx.receitaTotal ?? ctx.vgvTotal` → VGV) e **divergiam** do que o Fluxo de Caixa efetivamente
  computa (o motor em `fluxo-caixa-motor.ts` usa a receita líquida real). Fix: `_carregar` passou a
  calcular `receitaTotal` **exatamente como o motor** — Σ `vglLinha(vgvLinha(tipologias), fluxo_pagamento)`
  (VGL líquido de comissão destacada e RET) — e a incluí-lo no `ctxCusto`. Agora as 5 unidades batem
  com o motor: R$ direto · R$/m² priv × área privativa · R$/m² terreno × área do terreno · % VGV × VGV
  · % Receita × VGL · % Obra × total de Obra. `_ctxConversao()` também passou a usar a receita real
  (VGL) na chave `receita`, deixando a conversão por badge coerente com o cálculo do Resultado.
- **#119 (arredondamento de unidade igual ao padrão de Premissas):** a troca de badge já convertia o
  valor via `converterUnidade` (a mesma função das Premissas), mas arredondava só a 2 casas
  independentemente da unidade de destino — deixando **centavos ocultos** numa unidade inteira (R$,
  R$/m²) e desestabilizando o round-trip. Fix: `_trocarUnidade` passou a arredondar o valor convertido
  à **precisão de exibição da unidade de destino** (`_casasUnidade`: % → 2 casas, R$/R$-m² → 0), a
  mesma precisão do `viab-num` daquela unidade (#117). Assim o valor guardado é idêntico ao exibido/
  digitado e a ida-e-volta entre unidades não acumula drift.
- **#120 (Construção: Cronograma fixo em "Obra", Início/Duração derivados e bloqueados):** helper
  `eConstrucao(c)` (grupo obra + categoria Construção). Na coluna **Cronograma**, a linha Construção
  exibe **"Obra" travado** (texto + 🔒, sem `urbi-select`). **Início** e **Duração** passam a ser
  **derivados do evento Obra do cronograma** (getter `_eventoObra` sobre o `crono` já carregado por
  `buscarCronogramaAvancado`) e renderizados **bloqueados** (📅/🕐 + 🔒). Para o motor distribuir o
  custo no mesmo intervalo exibido, `_sincronizarConstrucao()` (chamado no `_carregar`, modo editável,
  idempotente) faz PATCH da linha Construção quando `cronograma_evento`/`inicio_mes`/`duracao_meses`
  divergem do evento Obra. `buscarCronogramaAvancado` já existia e foi reutilizado (sem mudança na API).
- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~274.6kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das colunas travadas, do sync da Construção e do
  Resultado em `% Receita` só valida no deploy dev.

### Sessão S14 — Custos Diretos: Motor de Corretagem — ✅ IMPLEMENTADA (issue #121)
Branch `claude/sessao-s14-svgouc`. Mudança **100% frontend** (`fluxo-shared.ts`, `fluxo-caixa-motor.ts`,
`tela-fluxo-custos.ts` + testes) — sem schema/backend/migração; `versao` intacta.
Pré-requisitos S13 e S10 (#108): concluídos e já na `main`.

- **Regra de negócio (#121):** a **Corretagem de vendas** não é um custo distribuído no tempo como os
  demais — ela é paga **integralmente no mês em que a unidade é vendida**. Logo a linha não tem
  Distribuição, Cronograma, Início nem Duração: quem define o calendário dela é a **absorção das
  vendas** (o mesmo `absorcaoMensal` das 4 faixas do #108).
- **Motor (`fluxo-shared.ts`):** dois primitivos puros novos — `vgvVendidoMensal(linhasReceita, crono,
  prazo)`, que soma o **VGV vendido mês a mês** repartindo o VGV de cada linha de receita pela sua
  própria curva de absorção; e `eCorretagem(custo)` + `CATEGORIA_CORRETAGEM`, que identificam a linha
  (grupo `diretos` + categoria "Corretagem de vendas") — um único predicado compartilhado entre motor
  e UI, sem duplicar a regra.
- **Motor (`fluxo-caixa-motor.ts`):** `corretagemMensal(custo, linhasReceita, crono, prazo, ctx)`
  aplica o **% de corretagem sobre o VGV vendido em cada mês** (unidade `pct_vgv`, a única oferecida
  na UI). Dado legado em outra unidade cai no mesmo calendário: o total resolvido é rateado
  proporcionalmente ao VGV vendido no mês. Sem vendas no horizonte → nenhum desembolso.
  Em `calcularFluxo`, a linha de corretagem **desvia de `distribuirLinha`**: `inicio`/`duracao` vêm do
  **recorte das vendas** (não dos campos persistidos, que passam a ser ignorados) e `total` é a soma do
  próprio mensal — ou seja, o que de fato entra no fluxo de caixa.
- **UI (`tela-fluxo-custos.ts`):** a máquina de "linhas obrigatórias" do grupo Obra (S12/S13) foi
  **generalizada por grupo** (`LINHAS_OBRIGATORIAS`, `obrigatoriasDoGrupo`, `ordenarLinhas`), e o grupo
  **Diretos** ganhou a Corretagem como **1ª linha obrigatória**, em `pct_vgv`: categoria travada
  (texto, sem seletor), **sem botão Remover** e com **Distribuição / Cronograma / Início / Duração
  sem campo** — Distribuição exibe "Mês da venda 🔒" (com tooltip da regra) e as outras três, "—".
  `_garantirLinhasObrigatorias` (ex-`_garantirLinhasObra`) cria a linha que faltar em qualquer grupo,
  já com a unidade fixa; a Corretagem nasce com `cronograma_evento: 'customizado'`, pois não se ancora
  em evento nenhum. `ordenarLinhas` passou a comparar por **identidade**, então uma 2ª linha legada com
  a mesma categoria continua listada em vez de sumir da tabela.
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ (4 novos) · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~275.9kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real da linha travada em Custos Diretos e a conferência da
  corretagem na tabela do Fluxo de Caixa só validam no deploy dev.

### Sessão S15 — Fluxo de Caixa: Visual & Layout — ✅ IMPLEMENTADA (issues #122, #123, #124)
Branch `claude/sessao-s15-096661`. Mudança **100% frontend** (`frontend/fluxo-tabela.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisitos S13/S14: concluídos.

- **#122 (sobreposição de colunas fixas ao rolar horizontalmente):** `--cor-superficie` é
  translúcida no design system (~4% alpha); ao usar `background: var(--cor-superficie)` nas
  células não-fixas, o conteúdo dos meses aparecia por cima das colunas sticky (cujo fundo
  era opaco mas ficava "atrás" visualmente). Fix: alterado `table.fx th, table.fx td` para
  usar `--cor-superficie-elevada` (opaca) em todas as células. As regras de row-color (#123)
  também usam `color-mix` com base opaca, reforçando a correção.
- **#123 (cores de fundo por tipo de linha no Proforma do Fluxo):** função `linhaTabela`
  ganhou classe `receita`/`custo` no `<tr>` (adicionada via template literal). CSS com seis
  regras `color-mix` de especificidade `[0,2,1]` (supera a regra de sticky `.c1`/`.c4`/`.c5`
  `[0,1,0]`), então a cor da linha aparece também nas colunas fixas:
  - Receita grupo (15%) → subgrupo/fase (8%) → subitem/tipologia (4%) em verde sucesso
  - Custo grupo (15%) → subgrupo/agrupamento (8%) → item (4%) em vermelho erro
  Linhas `resultado` e `divisoria` mantêm o fundo padrão.
- **#124 (ocultar colunas Início e Duração):** verificação confirmou que `inicio` e `duracao`
  são exibidos apenas para referência — o motor não os usa para calcular VPL. Fix via CSS:
  `.c2 { display: none }` e `.c3 { display: none }`. Ajustados os `left` das colunas
  subsequentes: `.c4` 356→220 px, `.c5` 476→340 px. Comentário de cumulativo atualizado.
  Células `.c2`/`.c3` permanecem no DOM (estrutura da tabela preservada; conteúdo oculto).
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~276.6kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das cores de linha e do scroll sticky só
  valida no deploy dev.

### Sessão S16 — Fluxo de Caixa: Estrutura & VPL — ✅ IMPLEMENTADA (issues #125, #126)
Branch `claude/sessao-s16-3scr7u`. Mudança **100% frontend** (`fluxo-caixa-motor.ts`,
`fluxo-tabela.ts`, `exportar.ts`) — sem schema/backend/migração; `versao` intacta.
Pré-requisito S15: concluído e na `main`.

- **#125 (renomear "Receita" + acrescentar Obras e Financeiro no Proforma do Fluxo):**
  1. A linha-grupo de receita passou de **"Receita"** para **"Receita Bruta (VGV)"** (mesmo rótulo
     no export CSV/PDF).
  2. O Proforma do Fluxo só listava **3 grupos de custo** (`terreno`/`obra`/`indireto`), mas as abas
     de Custos têm **5** (Terreno · Obra · Diretos · Indiretos · Financeiro, desde o Lote 5). A causa:
     o motor **colapsava** `diretos`/`financeiro` em `indireto` ao montar `LinhaCalc.grupo`. Fix:
     - `fluxo-caixa-motor.ts`: `LinhaCalc.grupo` ampliado para os 5 grupos; o `map` de custos agora
       **preserva o grupo real** (grupo desconhecido/legado ainda cai em `indireto` por segurança).
     - `fluxo-tabela.ts`: `GRUPO_CUSTO_LABEL` e a lista de `grupos` cobrem os 5, **na ordem das abas
       de Custos**. Rótulo de `obra` corrigido de "Custos Diretos" (herança do modelo antigo de 3
       grupos) para **"Custos de Obra"**; `diretos` = "Custos Diretos"; `financeiro` = "Custos
       Financeiros". `chavesColapso` inclui `custo-diretos`/`custo-financeiro`.
     - `exportar.ts` (não estava na lista de alvos, mas **consome `LinhaCalc.grupo`**): mesma expansão
       de rótulos/ordem — senão as linhas de `diretos`/`financeiro` **sumiriam** do CSV/PDF depois que
       o motor parou de remapeá-las para `indireto`.
- **#126 (VPL faltando em algumas linhas do Fluxo de Caixa):** o motor **já** calcula `vpl` por linha
  (receita, tipologia, custo). O que faltava eram as linhas **agregadas/subtotais e de resultado**, que
  a tabela montava sem `vpl` → coluna VPL vinha vazia em: **Receita Bruta (VGV)** (grupo), **Custo
  Total** (grupo), cada **subtotal de grupo de custo**, e **Fluxo de Caixa Mensal/Acumulado**
  (resultado). Fix (VPL é **linear** no fluxo mensal, então VPL do agregado = Σ VPL das linhas):
  - `fluxo-tabela.ts`: helper `somaVpl(linhas)`; passado `vpl` para a linha de Receita Bruta
    (Σ receitas), Custo Total (Σ custos) e cada subtotal de grupo (Σ do grupo). `linhaResultado` ganhou
    parâmetro `vpl` e renderiza o **VPL do projeto** (`c.vpl`) nas duas linhas de resultado (com classe
    `pos`/`neg`). Consistência garantida: VPL(Fluxo Mensal) = VPL(Receita) − VPL(Custo) = `c.vpl`.
  - `exportar.ts`: mesmos agregados ganharam `vpl` (a coluna VPL do CSV/PDF já renderizava quando
    presente), mantendo export e tela idênticos.
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~277.1kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das novas seções (Diretos/Financeiro) e da coluna VPL
  preenchida só valida no deploy dev.

### Sessão S18 — Cenários: Texto & KPI — ✅ IMPLEMENTADA (issues #128, #129)
Branch `claude/sessao-s18-suhtuj` (PR #155). Mudança **100% frontend** (`frontend/tela-cenarios.ts`,
`frontend/fluxo-tabela.ts`) — sem schema/backend/migração; `versao` intacta. Pré-requisito S16:
concluído e na `main`.

- **#128 (remover placeholder do campo Nome):** Removido o atributo `placeholder` do `urbi-input`
  do campo "Nome do cenário" em `tela-cenarios.ts`.
- **#129 (adicionar KPI Resultado):** Adicionado o KPI "Resultado" como primeiro indicador da função
  `kpisFluxo` em `fluxo-tabela.ts`. O valor é calculado como o final do fluxo acumulado
  (`fluxoAcumulado[fluxoAcumulado.length - 1]`), com variante de cor (sucesso se ≥ 0, erro se < 0).
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~277.2kb). Sem schema/backend → empacotamento
  não se aplica.

### Sessão S8 — Receitas: CSS, Layout & Texto — ✅ IMPLEMENTADA (issues #91–#102)
Branch `claude/sessao-s16-3scr7u`. Mudança **100% frontend** (`frontend/tela-fluxo-receitas.ts`) —
sem schema/backend/migração; `versao` intacta. Sem pré-requisitos.

- **Contexto:** auditoria (a pedido do autor) revelou que a S8 nunca fora rodada como sessão — 11 das
  suas issues seguiam abertas e sem entrada no PROGRESSO. #91 já estava fechada; #96 (título "VGV") e
  #98 (texto "4 períodos") já estavam satisfeitas no código por trabalho anterior. As **9 restantes**
  foram implementadas aqui.
- **#92 (cores das bolas de status):** `.stat` (pendente) de `var(--cor-alerta)` → **`var(--cor-erro)`**
  (vermelha) e `.stat.ok` (aplicado) de `var(--cor-sucesso)` → **`var(--cor-info)`** (azul). Só tokens.
- **#93 (largura da coluna Tipologia):** `col.c-tipo` de `width: auto` → **`190px`**.
- **#94 (largura de "Preço / m²"):** `col.c-preco` `110px` → **`140px`** (cabe 5 dígitos + 2 casas + sufixo).
- **#95 (remover prefixo "R$"):** colunas Preço unitário e VGV trocaram `fmtR$` por **`fmtNum`** (mesma
  formatação de milhar, sem "R$"). `fmtNum` adicionado ao import.
- **#96 (título "Preço total" → "VGV"):** já estava no código (header "VGV"). Sem mudança.
- **#97 (botão "Adicionar Alocação" → "Adicionar tipologia"):** label trocado.
- **#98 (texto da Absorção p/ 4 períodos):** refinado para **nomear** os períodos — "Pré-lançamento,
  Lançamento, Obra e Pós-obra (calculado automaticamente)".
- **#99 (remover "(calculado)" do Pós-obra):** removido o `<span>` no label da tabela de Absorção.
- **#100 (reduzir campos % e nº parcelas no Fluxo de Pagamento):** `.pag-linha viab-num` `120px` → **`92px`**.
- **#101 (remover "(calculado)" do Repasse + fórmula):** label "Repasse (calculado)" → "Repasse" e
  removida a linha `<p>Repasse = 100% − entradas − parcelas.</p>`.
- **#102 ("Comissão" → "Corretagem" no modal):** label do `urbi-checkbox` trocado (a chave interna de
  dados `comissao` **não** mudou — só o texto visível).
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~277.1kb). Sem schema/backend → empacotamento não
  se aplica. ⏳ Render real das cores de status, larguras e textos só valida no deploy dev.

### Sessão S17 — Fluxo de Caixa: View Mensal/Anual — ✅ IMPLEMENTADA (issue #127)
Branch `claude/sessao-s17-bus1bk`. Mudança **100% frontend** (`fluxo-shared.ts`, `fluxo-caixa-motor.ts`,
`fluxo-graficos.ts`, `tela-fluxo-ver.ts`, `exportar.ts`) — sem schema/backend/migração; `versao` intacta.
Pré-requisito S16: concluído e na `main`.

- **#127 (badges Mensal/Anual para alternar a view do Fluxo):** dois `urbi-badge` **interativos e
  exclusivos** (`cor="info"`, `?ativo`) ao lado do botão Expandir/Recolher tudo — um deles **sempre**
  ativo, porque o estado é um enum `visao: 'mensal' | 'anual'` (default `mensal`), não dois booleanos.
  Mesmo padrão de chip já usado em `tela-dashboard.ts` (nível de análise) e `tela-fluxo-custos.ts`.
- **Arquitetura — agregação é de EXIBIÇÃO, não recálculo.** O motor continua calculando **mês a mês**;
  a view Anual só reagrupa as colunas do resultado. Duas funções puras novas, ambas testadas:
  - `fluxo-shared.ts` · **`periodosAnuais(dataInicio, prazo)`** → faixas de meses por **ano-calendário**
    (`{ rotulo, inicio, fim }`). O corte segue o calendário real: com início em `abr/2027`, o 1º período é
    2027 e cobre só abr→dez (9 meses); o último é truncado no fim do horizonte. As faixas são **contíguas
    e cobrem exatamente todos os meses** — é o que garante que a soma anual bata com a mensal. Sem
    `data_inicio_projeto` válida degrada para blocos de 12 meses rotulados "Ano 1", "Ano 2"… (mesma
    degradação de `rotuloMesRelativo`).
  - `fluxo-caixa-motor.ts` · **`agregarFluxoPorPeriodos(calc, periodos)`** → novo `FluxoCalc` com
    `prazo`/`meses` por período. **Séries de fluxo** (receita, custo, fluxo, cada linha e cada tipologia):
    **soma** dos meses da faixa → `Σ colunas = Σ meses` em **toda** linha, e cada linha continua batendo
    com a sua coluna "Total". **Acumulado**: **último** mês da faixa (somar acumulados contaria o mesmo
    caixa várias vezes) — é o saldo no fim do ano.
- **O que NÃO muda com a view (decisão de negócio):** `vpl`, `tir`, `paybackMes`/`paybackData`,
  `exposicaoMaxima`, `vgvTotal` e o `total`/`vpl` de cada linha. São grandezas do fluxo **mensal** — o VPL
  desconta mês a mês e a exposição máxima é o pior saldo de um **mês**, não de um fim de ano. Os 4 KPIs do
  topo seguem lendo o `FluxoCalc` mensal. `inicio`/`duracao` das linhas também continuam em **meses**
  (é o calendário real da linha); quem desenha as colunas converte para índice de período.
- **Gráficos:** rótulos do eixo X passaram de `rotuloMesRelativo(dataInicio, i)` para **`c.meses[i]`** —
  no-op na view mensal (é literalmente o mesmo valor) e correto na anual. Marcos do cronograma e a linha
  de payback continuam em meses e são posicionados por um mapeador mês→coluna (`colunaDoMes`), com
  **fração dentro do ano** para não grudarem no início da coluna. O marcador de **exposição máxima** só
  aparece quando o pior saldo cai no fim de um período (`indexOf` em `fluxoAcumulado`) — assim ele nunca
  é desenhado em cima de um ponto que não é o mínimo real.
- **Exportações seguem a view** (CSV e PDF exportam as mesmas colunas da tela). `exportarFluxoPDF` ganhou
  o parâmetro opcional `rotuloColunas` ("Meses"/"Anos") só para o rodapé de paginação; as colunas
  Início/Duração e os KPIs do PDF continuam em meses.
- **Escopo intocado:** a aba **Cenários** (`tela-cenarios.ts`, que reusa `tabelaFluxo`/`kpisFluxo`) e a aba
  **Resumo** seguem 100% mensais — a issue é da tela Fluxo de Caixa. `fluxo-tabela.ts` **não precisou de
  mudança**: recebendo o `FluxoCalc` agregado, a tabela já renderiza uma coluna por período.
- **Doc:** `docs/viabilidade/padrao-incorporacao.md` § 3.2 ganhou o parágrafo das views Mensal/Anual.
- **Validação:** frontend isolado — **typecheck ✓ · testes 88/88 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~278.9kb). **6 testes novos**: 4 de `periodosAnuais`
  (anos parciais, ano cheio, degradação sem data, cobertura sem furo/sobreposição) e 2 de
  `agregarFluxoPorPeriodos` (soma anual = soma mensal em todas as linhas e tipologias; acumulado =
  saldo do último mês do ano + indicadores inalterados). Sem schema/backend → empacotamento não se
  aplica. ⏳ Render real dos badges e das colunas anuais só valida no deploy dev.

### Sessão S19 — Cenários: Tabela de Salvos — ✅ IMPLEMENTADA (issue #130)
Branch `claude/sessao-s19-merge-prs-7q8wuz`. Mudança **100% frontend** (`frontend/tela-cenarios.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisito S16: concluído e na `main`.

- **#130 (linha do Cenário real travada como primeira linha da tabela de Cenários salvos):** nova
  `_linhaReal(base)` renderiza uma `<tr class="linha-real">` sempre em primeiro na tabela `table.cen`,
  usando o `FluxoCalc` **base** (`{ precoVendaPct: 0, custoObraPct: 0 }`) já calculado em `render()` —
  o mesmo cenário sem alterações que alimenta o gráfico "base × cenário". Colunas Preço venda/Custo
  obra mostram `—` (não são deltas aplicáveis à base) e a última coluna (ação) fica vazia — **sem**
  botão Remover, tornando a linha não removível. Ícone `fa-solid fa-lock` + destaque visual
  (`font-weight: 700` + fundo `var(--cor-primaria-fundo)`, tokens já usados em `tela-proforma.ts`).
- **Tabela sempre visível:** antes, `cenarios.length === 0` trocava a tabela inteira por
  `urbi-estado-vazio`; agora a tabela **sempre** renderiza (a linha real é permanente), e o estado
  vazio vira uma mensagem complementar **abaixo** da tabela só quando não há cenários salvos pelo
  usuário ainda.
- **Validação:** frontend isolado — **typecheck ✓ · testes 88/88 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~279.6kb). Sem schema/backend → empacotamento
  não se aplica. ⏳ Render real da linha travada só valida no deploy dev.

### Sessão S20 — Cenários: Gráfico Tracejado & Variação % — ✅ IMPLEMENTADA (issues #131, #132) — **ÚLTIMA DA RODADA 3**
Branch `claude/sessao-s20-issues-finais-9qwt68`. Mudança **100% frontend** (`frontend/tela-cenarios.ts`,
`frontend/fluxo-graficos.ts`, `frontend/fluxo-tabela.ts` + novo módulo puro `frontend/cenario-variacao.ts`
e seu teste) — sem schema/backend/migração; `versao` intacta. Pré-requisitos S16/S19: concluídos e na `main`.

- **#131 (linha tracejada em tempo real ao mover os sliders):** a segunda curva já existia desde a
  Etapa 8/#56 (`graficoCenarioAcumulado` desenhava base cheia + cenário tracejado) e o redesenho já
  era automático (os deltas moram em `@state`, então cada `input` do slider re-renderiza o SVG). O que
  faltava — e é o que S20 entrega — são as **duas falhas que tornavam esse comportamento inútil na
  prática**:
  1. **Tracejada fantasma na base.** Com os sliders em zero a curva do cenário era idêntica à da base e
     desenhada **por cima** dela, escondendo a linha sólida e sugerindo que havia dois cenários quando
     só havia um. Agora `graficoCenarioAcumulado` aceita `cenario: FluxoCalc | null` e o hospedeiro
     passa `null` enquanto `precoPct === 0 && custoPct === 0`: **a tracejada nasce ao mover o primeiro
     slider**, exatamente como o issue descreve. A legenda acompanha (só "Cenário real" na base) e
     ganhou o **rótulo com os deltas vivos** (`Cenário · preço +5% · obra -3%`) via novo parâmetro
     `rotuloCenario`; foi movida para o canto superior **esquerdo** para caber rótulo longo.
  2. **Redesenho não era barato o bastante para ser "tempo real".** Cada quadro do arraste recalculava
     o motor para a base, para o cenário vivo **e para cada cenário salvo** da tabela — N+2 execuções de
     `calcularFluxo` por pixel arrastado. Novo `cacheCalc: Map<string, FluxoCalc>` em `tela-cenarios.ts`
     memoiza por par de deltas (`"preco|custo"`): base e cenários salvos são calculados **uma vez**, e
     arrastar de volta a um valor já visitado é lookup. Cache limitado a `LIMITE_CACHE = 240` entradas
     (esvazia ao estourar) e **zerado em `_carregar`**, já que um `baseConfig` novo invalida tudo.
- **#132 (seta ↑/↓ + variação % nos KPIs e badge na tabela de salvos):** genuinamente novo.
  - **Novo módulo puro `frontend/cenario-variacao.ts`** — `calcularVariacao(novo, base, maiorMelhor)`
    → `{ pct, melhor, texto }` ou `null`. A regra que exigia teste é a **direção**: ela não vem do
    sinal da variação, vem do indicador. Os quatro KPIs afetados são "maior é melhor" — **inclusive a
    Exposição máxima**, que é `min(fluxoAcumulado)` e portanto negativa: ir de −1.000 para −800 é
    **melhora** de +20%. Por isso a variação normaliza pelo **módulo** da base (senão o sinal
    inverteria em indicadores negativos). Devolve `null` — nada é pintado — quando algum valor não é
    finito, quando a base é zero (sem denominador) ou quando |pct| < 0,05 (arredondaria para 0,0%).
    **6 testes novos** cobrem cada um desses ramos.
  - **KPIs:** `kpisFluxo(c, base?)` ganhou 2º parâmetro **opcional**. Com ele, Resultado · TIR · VPL ·
    Exposição máxima exibem `urbi-icone` de seta + o percentual no canto superior direito do próprio
    card, verde se melhor / vermelho se pior. **Payback ficou de fora de propósito**: é uma data, não
    um escalar comparável. Sem o 2º parâmetro o componente renderiza **exatamente como antes** — as
    abas Fluxo de Caixa (`tela-fluxo-ver`) e Resumo seguem intactas.
  - **Tabela de salvos:** `urbi-badge` (`sucesso`/`perigo`) à direita do valor em VPL, TIR e Exposição
    máxima de cada cenário salvo, comparando contra a linha do Cenário real (S19/#130). A própria
    linha real não recebe badge — ela **é** a referência.
- **Decisão registrada (por que não mexer no `urbi-kpi` do shell):** `urbi-kpi` só expõe
  `rotulo`/`valor`/`variante` e **não renderiza slot**, então não há como injetar a seta por dentro do
  primitivo. O caminho "correto" pelo `ui.md` seria estender o primitivo no monorepo — mas isso
  obrigaria a **bumpar `shell_min` (0.50.3)**, que é contrato inegociável do app, por um indicador de
  uma única tela. Os dois issues escopam explicitamente `frontend/tela-cenarios.ts`. Optei por ancorar
  o indicador na **célula do grid** (`.kpi-cel { position: relative }` + `.kpi-var` absoluto), CSS que
  vive no `static styles` do próprio app — mesmo padrão de `.fx-kpis`/`.fx-wrap` já usado aqui. **Se
  o padrão se repetir noutra app, aí sim vale promover `variacao` a prop do `urbi-kpi`.**
- **Faxina de contrato (varredura final):** o único `<i class="fa-solid fa-lock">` do frontend (linha do
  Cenário real, introduzido em S19) virou `<urbi-icone classe="...">` — o `ui.md` do shell proíbe
  `<i class="fa-...">` cru no consumidor. Varredura confirma **zero** ocorrências de `<i class=` e zero
  emoji unicode de status no frontend. As cores literais restantes em `exportar.ts` **não são
  violação**: são o CSS de documentos HTML autônomos de impressão/PDF, abertos fora do escopo das
  variáveis do shell, onde `var(--cor-*)` não resolve.
- **Validação:** frontend isolado — **typecheck ✓ · testes 94/94 ✓** (88 + 6 de `cenario-variacao`)
  **· build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~282.5kb). Sem
  schema/backend/migração → `urbi-empacotar` e suíte de backend não se aplicam a esta sessão.
  ⏳ Render real da tracejada, das setas nos KPIs e dos badges só valida no deploy dev.

---

## 🏁 Rodada 3 (bugs.xlsx) — CONCLUÍDA

As **62 issues #71–#132** das **20 sessões** de `docs/sessoes-bugs-2026-07-25.md` estão todas
implementadas e fechadas. Nenhuma issue aberta resta no repositório ao fim da S20.

**Pendências herdadas que permanecem com o autor (ambiente autenticado, SDK gated) — não são desta
sessão, mas seguem valendo antes de publicar:**
- `pnpm typecheck` completo (backend), suíte de backend e `pnpm exec urbi-empacotar viabilidade`.
- **Execução das migrações 001–005** contra dados reais (`versao` do manifesto está em **0.1.4**).
- Render real no deploy dev de tudo que só se vê no shell: primitivos `urbi-*`, uploads, Gantt,
  modais, tabelas sticky e os gráficos SVG.

### Verificação final de encerramento (2026-07-26)

Varredura estática do repo inteiro antes do release. **Nada quebrado encontrado**; dois atributos
inertes corrigidos e uma dívida histórica documentada.

**Integridade estrutural — tudo verde:**
- **JSON:** `schema.json` (15 tabelas), `manifesto.json`, `package.json`, `tsconfig.json` parseiam.
- **Componentes:** 22 `@customElement` declarados; **36/36 arquivos de frontend alcançáveis a partir
  de `index.ts`** (zero órfãos); zero tags `viab-*` usadas sem definição; zero componente definido em
  arquivo não importado. `telas_config` do manifesto aponta para componentes que existem.
- **Primitivos:** os **24** `urbi-*` usados pela app existem no `ui/` do shell (conferido um a um).
- **Eventos:** todo `@urbi:*` / `@viab:*` ouvido pela app é emitido por alguém — zero handler morto.
- **Rotas:** 40 rotas de backend × 44 chamadas do frontend cruzadas; nenhuma chamada sem rota. As
  únicas rotas não chamadas pela UI são falsos positivos (`Map.get('obra')` etc.) e a
  `POST /manutencao/arquivar-inativos`, que é **de agendador/admin por desenho** (ver pendência
  histórica do arquivamento automático, abaixo).
- **Contratos:** zero `instanceof` no backend · build sem `--packages=external` · `shell_min`
  `0.50.3` · nenhuma rota com o prefixo `/api/viabilidade` hardcoded (só em comentário) · nenhum
  `INSERT`/seed dentro de migração · `.gitignore` cobre `dist/`, `node_modules/`,
  `frontend/index.js` e `backend/rotas.js`, e nenhum output de build está rastreado — o **gate Git
  do `urbi-release`** (que aborta com árvore suja) passa.

**Dois atributos inertes corrigidos** (falha silenciosa: prop inexistente num primitivo não dá erro,
simplesmente não faz nada):
- `tela-fluxo-receitas.ts` — `<urbi-badge ?desabilitado=…>` nos chips de periodicidade. `urbi-badge`
  só declara `cor`/`interativo`/`ativo`, então a periodicidade já usada por outra linha **parecia
  clicável**. O clique já era barrado pelo próprio handler (comportamento estava correto); faltava o
  sinal visual. Trocado por `class="indisponivel"` + CSS local (`opacity`/`cursor`). **Sem** mexer no
  primitivo — `urbi-badge` não tem conceito de desabilitado e criá-lo exigiria bump de `shell_min`.
- `tela-fluxo-cronograma.ts` — `<urbi-input estilo="compacto">`. `urbi-input` não declara `estilo`;
  atributo removido (era no-op).

**Dívida histórica documentada (não corrigida de propósito):** a migração `004_fases_gantt.js` entrou
na Etapa 4 (commit `85a6429`) **sem bump de `z`** — viola "toda migração nova acompanha bump de `z`"
(`docs/shell/distribuicao.md` § Identidade dupla). **Não há dado em risco:** o runner é sequencial
por número e aplica todas as pendentes, então a 004 subiu junto com a 005 no bump 0.1.3 → 0.1.4 da
Etapa 8. Corrigir agora (bumpar para 0.1.5 sem migração nova) só criaria um degrau vazio e seria
*outro* desvio da mesma regra. Fica registrado como precedente a não repetir.

### Prontidão para o release (verificada)

Último release publicado: **`viabilidade-v0.1.4_79cbe46c`** (2026-07-22). **Toda a rodada 3 está
fora dele** — 40 commits desde então.

- **Versão continua 0.1.4, e isso está certo.** `git diff 79cbe46c..main -- migracoes/ schema.json
  manifesto.json` é **vazio**: a rodada 3 foi 100% frontend. A regra é `z` só bumpa com migração —
  não bumpar é o comportamento correto.
- **O upgrade é elegível assim mesmo.** A plataforma instala por versão maior **ou** por mesma
  versão com `build_sha` à frente (ancestralidade git). Verificado: `79cbe46c` **é ancestral** da
  `main` atual → o `compare` do GitHub devolve `ahead` → upgrade do tipo **`build`**.
- **Como publicar:** Actions → `release` → **Run workflow** (`workflow_dispatch`). O workflow deriva
  a tag `viabilidade-v0.1.4_<sha8>` sozinho, **com o sha** — indispensável, porque tag sem sha trava
  o upgrade dentro da mesma versão. Precedente na prática: já houve `0.1.0` e `0.1.4` publicados
  várias vezes com sha8 diferente, e o canal repo reconheceu cada um.

---

## Rodada 2 — Etapas (2026-07-22)

### Etapa 8 — Cenários — ✅ IMPLEMENTADA (issue #56)
Branch `claude/etapa-8-npe1vk`. Toca **schema + backend + frontend + motor**. `versao` **0.1.3 → 0.1.4**
(migração `migracoes/005_cenarios.js` — tabela nova `avancado_cenarios`). Pré-requisitos #39 (Etapa 3) e
motor de fluxo: ambos concluídos. Última etapa da rodada 2.

- **Decisão-chave (não repurposar `viab-tela-graficos`):** `viab-tela-graficos` é **dual-use** — é a aba
  **Gráficos** do **Preliminar** (`tela-estudo.ts`) *e* era a aba **Cenários** do Avançado (`tela-avancado.ts`).
  Reconstruir a Cenários dentro dela quebraria o Preliminar (que não tem fluxo/receitas/custos do Avançado).
  Por isso criei um componente **novo** `frontend/tela-cenarios.ts` (`viab-tela-cenarios`) só para o Avançado
  e reapontei o `case 'cenarios'` de `tela-avancado.ts` para ele. **O Preliminar segue intocado** com
  `viab-tela-graficos` (pizza/barras/áreas/medidores).

- **#56 (reconstrução da página Cenários):**
  - **Motor reparametrizado** (`fluxo-caixa-motor.ts`): nova função pura `aplicarCenario(config, {precoVendaPct,
    custoObraPct})` que devolve uma **nova** `FluxoConfig` escalando o `preco_m2` de **todas** as tipologias
    (preço de venda) e o `orcamento_valor` das linhas `grupo==='obra'` (custo de obra). `calcularFluxo(aplicarCenario(...))`
    dá o fluxo do cenário. Função **não muta** a base (testado). `0/0` = base.
  - **Sliders (esquerda):** `<input type="range">` (não há primitivo `urbi-slider` no shell) com limites vindos
    dos **benchmarks de sensibilidade** — `campo === 'preco'` e `campo === 'custo_obras'`, faixa `[-variacao_negativa_pct,
    +variacao_positiva_pct]` (padrão ±15% sem benchmark). Arrastar recalcula o fluxo em tempo real.
  - **Gráfico de linha (direita):** novo `graficoCenarioAcumulado(base, cenario, …)` em `fluxo-graficos.ts` —
    fluxo acumulado com **base (linha cheia)** + **cenário (linha tracejada roxa, `--cor-primaria`)** na mesma escala,
    com legenda e marcos do cronograma.
  - **Fluxo do cenário (largura inteira):** os **mesmos campos da aba Fluxo de Caixa** — KPIs + tabela mensal sticky.
    Para não duplicar ~150 linhas, extraí a tabela/KPIs para o módulo puro **`frontend/fluxo-tabela.ts`**
    (`estiloFluxoTabela`, `kpisFluxo`, `tabelaFluxo`, `chavesColapso`) e **refatorei `tela-fluxo-ver.ts`** para consumi-lo
    (mesmo padrão do Lote 8, que extraiu `fluxo-graficos.ts`). Fluxo de Caixa e Cenários renderizam tabela idêntica.
  - **Tabela de cenários salvos (fim):** persistem **permanentemente** no estudo (nova tabela `avancado_cenarios`).
    Colunas = indicadores (Preço venda · Custo obra · VPL · TIR · Payback · Exposição máx.), **recomputados** por
    `aplicarCenario` a cada render; cada linha com **botão remover** (modal de confirmação). Salvar + nomear na mesma
    área dos sliders (botão "Salvar cenário"; nome default derivado dos deltas se vazio).

- **Schema/backend (validação no ambiente do autor — SDK gated):**
  - `schema.json`: nova tabela **`avancado_cenarios`** (`estudo_id` FK cascata, `nome`, `preco_venda_pct` decimal(6,2),
    `custo_obra_pct` decimal(6,2), `ordem`).
  - `migracoes/005_cenarios.js`: forward-only, `CREATE TABLE IF NOT EXISTS` (rede de segurança; o sincronizador do SDK
    também materializa a tabela do schema). Tabela nova → não transforma dado existente.
  - `manifesto.json`: `versao` 0.1.3 → **0.1.4**.
  - `backend/rotas/avancado.ts`: CRUD `GET/POST/PATCH/DELETE /estudos/:id/avancado/cenarios` (mesmo padrão de custos;
    `CAMPOS_CENARIO`), + cópia no `duplicarDadosAvancado` (cenários viajam com a duplicação do estudo).
  - `frontend/viabilidade-api.ts`: `listarCenarios`/`criarCenario`/`atualizarCenario`/`removerCenario`.

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 77/77 ✓** (+ `aplicarCenario`:
  escala preço/obra, terreno intacto, pureza, cenário-zero = base) **· build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~263.8kb). ⏳ **Pendente do autor (SDK gated):** typecheck do
  backend, suíte de backend, `urbi-empacotar` e a **execução da migração 005** contra dados reais. Render real dos
  sliders/gráfico de cenário só valida no deploy dev.

### Etapa 7 — Redistribuição de Premissas — ✅ IMPLEMENTADA (issues #53, #55, #54)
Branch `claude/etapa-7-pu7kqg`. Mudança **100% frontend** (sem schema, sem backend, sem migração).
`versao` intacta. Pré-requisitos #39 (Etapa 3) e Etapa 4: ambos concluídos.

- **#53 (Terreno → Empreendimento → Informações, só Avançado):**
  - `frontend/tela-empreendimento-info.ts`: adicionado **card "Dados do terreno"** abaixo do card
    de Informações. Para `origem_terreno === 'nucleo'`, exibe `viab-terreno-nucleo` (componente
    self-contained). Para `manual`, exibe `terreno_manual_nome` (urbi-input) + `terreno_manual_area`
    (viab-num, m²) editáveis. Para Incorporação (qualquer origem), adiciona `coef_aproveitamento_basico`
    e `coef_aproveitamento_maximo` no mesmo card. Botão "Salvar informações" (após o card de Terreno,
    antes dos Anexos) persiste tudo via `atualizarEstudo` incluindo os novos campos de terreno. `form`
    expandido para incluir `terreno_manual_nome`, `terreno_manual_area`, `coef_aproveitamento_basico` e
    `coef_aproveitamento_maximo`; `updated()` os inicializa a partir de `this.estudo`. Importados
    `./tela-terreno-nucleo.js` e `./viab-num.js`. Campo de área lido só (da versão anterior) removido
    do card de Informações (agora está no card de Terreno).
  - `frontend/tela-premissas.ts`: seção `Terreno` (grupo-a completo com nome, área, coeficientes e
    viab-terreno-nucleo) fica **oculta quando `nivel_analise === 'avancado'`** — o Preliminar não é
    afetado (a seção continua aparecendo normalmente).

- **#55 (Taxa de Desconto na aba Financeiro — double-check):**
  - `taxa_desconto_aa` **já estava** na aba Financeiro desde o Lote 7 — card "Custos Financeiros",
    `tela-financeiro.ts` linha 194. Nenhuma alteração de código necessária.
  - Backend: `CAMPOS_SOMENTE_AVANCADO` em `backend/rotas/estudos.ts` **já inclui** `taxa_desconto_aa`
    (linha 28) — ao salvar Premissas de um Preliminar, o campo é ignorado antes da validação do shell.
    Double-check confirmado: o campo não interfere no Preliminar.
  - Issue fechada por confirmação; nenhuma regressão introduzida.

- **#54 (Avaliar e excluir a aba Premissas — só Avançado):**
  - **Avaliação realizada.** Após #53, a aba Premissas em Viabilidade ainda contém: Áreas (pvt R/NR
    fechada/aberta, comum), Produtos (num_unidades, preco_venda_m2), Custos (construção, decoração,
    etc.), Impostos (sujeito_ret), Deduções (corretagem, marketing) e Permuta física R/NR.
  - **Decisão: MANTER a aba Premissas** para o Avançado. Motivo: `tela-resumo.ts` chama
    `calcularProforma({ ...this.estudo, ... })` (linha 105) para os KPIs de VGV, Resultado, Margem
    líquida e ROI e para a pizza de custos e os medidores de benchmark. Remover a aba eliminaria a
    superfície de edição desses campos → o Resumo exibiria zeros ou valores obsoletos nesses 4 KPIs e
    nos gráficos. A remoção completa exigiria refatorar o Resumo para derivar esses números do motor
    de fluxo (`calcularFluxo`), em vez das premissas estáticas — passo futuro a especificar à parte.
  - Issue fechada como "avaliada: manter Premissas até refatorar o Resumo".

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~252.7kb). Sem schema/backend/migração →
  empacotamento não se aplica. ⏳ Render real da nova seção Terreno em Informações só valida no
  deploy dev.

### Etapa 3 — Fundação de navegação — ✅ IMPLEMENTADA (issues #39, #40)
Branch `claude/etapa-3-r86dld`. Mudança **100% frontend** (só o chassi de navegação do
Avançado; sem schema/backend/motor/migração). `versao` intacta. Pré-requisito das Etapas 4–8.

- **#39 (urbi-nav lateral + urbi-abas no topo):** `frontend/tela-avancado.ts` trocou o chassi
  de navegação do Avançado. **Nível 1 (páginas)** deixou de ser `urbi-abas` de topo e virou
  **`urbi-nav` lateral** (lista à esquerda), na ordem pedida: Resumo · Empreendimento ·
  Viabilidade · **Custos** · Fluxo de Caixa · Cenários · Análise de mercado. **Nível 2 (seções)**
  deixou de ser `urbi-badge` de sub-nav e virou **`urbi-abas` no topo da página**, com **nome +
  ícone** (FontAwesome via `icone`) por aba — só nas 3 páginas com múltiplas seções
  (Empreendimento: Informações/Cronograma/Tipologias; Viabilidade: Premissas/Receitas/Financeiro;
  Custos: Terreno/Obra/Diretos/Indiretos/Financeiro). **Nenhuma tela de conteúdo foi reescrita** —
  o roteamento de `_renderSubConteudo` (lotes 4–8) é o mesmo; só o container mudou.
- **Sync de URL preservado:** a página ativa continua vindo da prop `.aba` (URL
  `/detalhe/:id/:aba`) e o `urbi:nav-selecionar` re-emite o **mesmo** evento `viab:aba-topo` que
  `tela-estudo.ts` já escuta → **`tela-estudo.ts` não precisou mudar**. A aba de nível 2 segue
  como estado interno (`subAtiva`), fora da URL, como antes. Layout: flex-row (nav 210px sticky +
  conteúdo `flex:1`), que **empilha** (nav vira barra superior) em telas ≤900px.
- **#40 (renomear "Obra" → "Custos"):** o **rótulo** da página passou a **"Custos"** em `PAGINAS`.
  **Decisão (baixo risco):** o `id`/slug de rota permanece **`obra`** — muda-lo quebraria URLs
  salvas, a chave `SUBABAS.obra` e o roteamento `.grupo` de `viab-fluxo-custos`. Só o texto visível
  mudou, que é o que a issue pede ("renomear a página").
- **Contrato dos primitivos (confirmado nos docs do shell):** `urbi-nav` (`.secoes`
  `UrbiNavSecao[]`, `ativo`, evento `urbi:nav-selecionar {id}`) — `docs/shell/ui-componentes-conteudo.md`;
  `urbi-abas` (`icone` FontAwesome por aba, `urbi:aba-selecionar {id}`) —
  `docs/shell/ui-componentes-layout.md`. Nenhuma mudança no shell. Nota: `UrbiNavItem` não tem
  campo de ícone (só label/descricao/indicador) → a lista lateral é textual; o ícone mora nas abas.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild)
  ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~240.8kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real do `urbi-nav`/`urbi-abas` aninhados só valida no
  deploy dev.

### Etapa 4 — Cronograma + Tipologias — ✅ IMPLEMENTADA (issues #41, #42, #43, #44, #45)
Branch `claude/etapa-4-cronograma-tipologias-0dhw04` (commit `85a6429` mergeado direto na `main`).
Toca **schema + backend + frontend** (migração `migracoes/004_fases_gantt.js` — colunas aditivas
`inicio_mes`/`duracao_meses` em `avancado_fases`). Pré-requisito #39 (Etapa 3): concluído.

- **#41 (5 fases padrão com cores distintas):** `EVENTO_COR` em `fluxo-shared.ts` ganhou 5 tokens
  semânticos distintos — `planejamento` → `--cor-info`, `pre_lancamento` → `--cor-alerta`,
  `lancamento` → `--cor-sucesso`, `obra` → `--cor-primaria-solida`, `pos_obra` → `--cor-erro`. A tabela
  de cronograma exibe `border-left` colorida pelo token de cada fase; o ponto-cor (bolinha) cresceu de
  8px para 10px. `corFaseExtra(idx)` reusa a mesma paleta de 5 tokens ciclicamente para fases extras.

- **#42 (CRUD de fases comerciais no Cronograma):** colunas `inicio_mes` (int, padrão 0) e
  `duracao_meses` (int, padrão 12) adicionadas a `avancado_fases` via **migração 004** (forward-only,
  `ADD COLUMN IF NOT EXISTS`). Backend PATCH atualizado (`CAMPOS_FASE`). Frontend
  `tela-fluxo-cronograma.ts` — seção "Fases comerciais" abaixo das 5 fixas: edição inline de
  nome/início/duração e botão Remover por linha; botão "Adicionar fase" no rodapé; fases aparecem
  como **barras tracejadas** no gantt SVG com paleta de tokens cíclica.

- **#43 (emojis no gantt):** ⭐ posicionado acima da barra do evento `lancamento` (sempre 1 mês —
  renderizado como círculo); 🔑 ao final (`xFim + 4`) da barra do evento `obra`. Ambos renderizados
  como `<text>` no SVG, sem dependência externa.

- **#44 (largura/alinhamento das colunas de Tipologias):** `table-layout: fixed` + `<colgroup>` com
  larguras explícitas (Nome `auto` · Tipo 160px · Área 130px · Dorm/Vagas 90px · Unidades 100px ·
  Permutadas 200px · Ação 90px). Cabeçalho e células alinhados uniformemente; `overflow: hidden` nas
  células.

- **#45 (texto calculado de permutadas):** à direita do campo `unidades_permutadas`, um
  `<div class="perm-calc">` (0.72rem, `--cor-texto-sec`) com **% de unidades permutadas** e **m²
  permutados**, exibidos só quando `perm > 0`. Rodapé de totais também mostra a área total permutada
  (`Σ permutadas × área`).

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~225kb). ⏳ **Pendente do autor (SDK gated):**
  typecheck do backend, suíte de backend, `urbi-empacotar` e a **execução da migração 004** contra dados
  reais (ADD COLUMN IF NOT EXISTS — sem risco para dados existentes). Render real das barras do gantt
  e do alinhamento das tabelas só valida no deploy dev.

### Etapa 5 — Custos (unidade por categoria + coluna de resultado) — ✅ IMPLEMENTADA (issues #46, #47)
Branch `claude/etapa-5-p24nm1`. Toca **schema + frontend + motor** (sem backend, sem migração).
`versao` intacta — só adição de opção ao `orcamento_unidade` (genesis; sincronizador aplica).
Pré-requisitos #39 e #40: concluídos (Etapa 3).

- **#46 (unidade dependente da categoria):** o seletor de unidades por badge passou a ser **filtrado
  por categoria** via o mapa `UNIDADES_CAT` (Partial Record por grupo+categoria). Por aba:
  - **Terreno:** Preço → `R$`/`R$/m² terreno`; Outorga/Outro → `R$`/`% VGV`; Registro → `R$`/`R$/m² priv`.
  - **Obras:** Obra/Decoração → `R$`/`R$/m² priv`; Gestão da obra → `R$`/`% Obra` (nova unidade!);
    Contingência/Outro → `R$`/`% VGV`.
  - **Diretos** (categorias **atualizadas**): Marketing & Publicidade → `R$`/`% VGV`; Comissão de
    vendas → somente `% VGV`; Projetos/Licenças e Aprovações → `R$`/`R$/m² priv`; Outro → `R$`/`% VGV`.
  - **Indiretos** (categorias **atualizadas**): Marketing global/Stand de vendas/Gestão/Outro → `R$`/`% VGV`.
  - **Financeiro:** sem restrição (todas as unidades).
  - Quando a **categoria muda**, a unidade atual é verificada: se não estiver na lista permitida,
    reseta para a primeira da lista (`_salvarCategoria` + `_unidsPerm`). Evita dados incoerentes.
- **Nova unidade `% Obra`:** aplicada a "Gestão da obra" no grupo Obras. O `%` multiplica o
  **total do grupo Obra** (soma das linhas com `grupo=obra` excluindo as próprias linhas `pct_obra`).
  - `schema.json`: `orcamento_unidade.opcoes` += `pct_obra` (genesis aditivo; sem migração).
  - `fluxo-shared.ts`: `ContextoCusto` += campo opcional `totalObra`; `resolverCustoTotal` trata
    `case 'pct_obra'`.
  - `fluxo-caixa-motor.ts`: computa `ctxCusto.totalObra` (2ª passagem sobre linhas de obra
    excluindo `pct_obra`) antes do loop de custos — sem circularidade.
  - `tela-fluxo-custos.ts`: getter `_totalObra` reusa o mesmo cálculo; `_ctx()` injeta no contexto.
  - ⚠️ **Backend**: o validador de `orcamento_unidade` no genesis ainda não inclui `pct_obra`
    explicitamente — o schema.json foi atualizado mas o backend gated precisa rodar
    `urbi-empacotar` para aplicar o genesis. **Validação de backend no ambiente do autor**.
- **#47 (coluna Resultado + ajuste de larguras):**
  - Nova coluna **Resultado** imediatamente após Orçamento: exibe `fmtR$(resolverCustoTotal(c, ctx))`
    quando `orcamento_unidade !== 'rs'`; mostra `—` quando a unidade já é R$.
  - Largura do `viab-num` do Orçamento: 130px → **110px** (coluna mais estreita para caber o Resultado).
  - Largura do `viab-num` da Duração: 100px → **80px** (campo de no máx. 2 dígitos).
- **CATEGORIAS atualizadas — nota de migração:** os registros existentes no DB com as categorias
  antigas de Diretos (Decoração, Gestão da obra, Stand de vendas) e Indiretos (Projetos, Licenças,
  Marketing, Administração) continuarão exibindo seus valores no campo (o DB guarda string livre),
  mas a unidade não será filtrada para eles (UNIDADES_CAT não mapeia os nomes antigos → retorna
  todas as unidades como fallback). Sem perda de dado; só o dropdown de nova entrada muda.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild)
  ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~248.2kb). ⏳ **Pendente do autor (SDK
  gated):** typecheck do backend, suíte de backend (inclui genesis com `pct_obra`) e `urbi-empacotar`.

### Etapa 6 — Receitas (layout, status, cores, save, saldo) — ✅ IMPLEMENTADA (issues #48–#52)
Branch `claude/etapa-6-69jii4`. Toca **frontend + backend** (sem schema, sem migração — a flag
`aplicado` mora dentro das colunas JSON `absorcao`/`fluxo_pagamento` já existentes). `versao` intacta.
Pré-requisito #39 (Etapa 3): concluído. Arquivo-alvo único no frontend: `frontend/tela-fluxo-receitas.ts`.

- **#48 (largura/alinhamento das colunas — mesmo bug do #44):** a tabela de alocações passou a usar
  **`table-layout: fixed` + `<colgroup>`** com larguras por coluna (Tipologia `auto` · Área 120 · Unidades 92 ·
  Saldo 68 · Preço/m² 110 · Preço unit. 120 · Preço total 120 · ação 92) + `overflow: hidden` em th/td,
  exatamente o padrão introduzido no #44 (Tipologias). Os campos (`viab-num`/`urbi-select`) passaram a
  `width: 100%` da célula, então **cabeçalho e campo alinham por coluna** (some o descasamento a partir de
  Unidades) e Área privativa fica encostada à esquerda com respiro em relação à Tipologia.
- **#49 (bola de status amarela→verde em Absorção/Fluxo):** cada botão ganhou um `<span class="stat">`
  (slot do `urbi-botao` herda os estilos deste componente). **Amarelo** (`var(--cor-alerta)`) = pendente,
  **verde** (`var(--cor-sucesso)`) = aplicado. O estado "aplicado" é persistido **dentro do próprio JSON da
  seção**: `_aplicarAbsorcao` grava `absorcao.aplicado = true` e `_aplicarPagamento` grava
  `fluxo_pagamento.aplicado = true`. Numa fase recém-criada os JSONs vêm sem a flag → bola amarela até o
  1º "Aplicar". Sem coluna nova (a flag é um campo aditivo no JSON, inócuo ao motor).
- **#50 (cores dos botões — Absorção roxo, Fluxo azul):** `Absorção de Vendas` → `variante="primario"`
  (roxo, cor primária/brand do UrbiVerso, token `--cor-primaria`); `Fluxo de Pagamento` → `variante="info"`
  (azul, token `--cor-info`). Só variantes do `urbi-botao` — nenhuma cor literal.
- **#51 (letras somem ao digitar + botão Salvar):** a raiz era o `nome` da fase persistir a **cada tecla**
  (`urbi:input-change` → PATCH assíncrono → re-render com `.valor` do servidor sobrescrevendo teclas mais
  novas). Agora o input escreve num **rascunho local** (`draftNome[faseId]`, estado do componente): digitar
  só atualiza o rascunho (sem round-trip), e o `.valor` sempre reflete o que foi digitado — nenhuma tecla se
  perde. Um botão **"Salvar"** (aparece só quando o nome está sujo, padrão dirty do #36) persiste via
  `_salvarFase` e limpa o rascunho. Demais campos são `viab-num`/`urbi-select` (numéricos/enum, sem o problema
  de digitação livre) — mantidos no fluxo de save direto.
- **#52 (saldo deve somar por TODAS as fases):** revê a decisão do Lote 6 ("trava por fase"). `_saldo` no
  frontend agora **agrega as alocações de todas as fases** por tipologia (quantidade do catálogo − Σ unidades
  em qualquer fase); `_tipologiasDisponiveis` e as opções do `urbi-select` seguem o mesmo saldo global.
  **Backend (`backend/rotas/avancado.ts`):** `saldoTipologiaNaFase` → **`saldoTipologiaNoEstudo`** (lista
  `avancado_alocacoes` por `tipologia_id`, que já é único por estudo, e soma tudo); POST/PATCH de alocação
  usam a nova trava, com mensagens de erro ajustadas ("somando todas as fases"). Assim não se aloca, no total,
  mais unidades do que o cadastrado em Tipologias.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~250.3kb). ⏳ **Pendente do autor (SDK gated):** typecheck
  do backend, suíte de backend e `urbi-empacotar` (a mudança de `saldoTipologiaNoEstudo` toca só lógica de
  validação, sem schema/migração). Render real dos botões coloridos/bolas de status só valida no deploy dev.

### Etapa 1 — Correções rápidas de UI (parcial: #34 e #36) — ✅ IMPLEMENTADA (issues #34, #36)
Branch `claude/etapa-1-sensibilidade-dirty-check-nm8x70`. Mudança **100% frontend** (sem
schema/backend/motor/migração). `versao` intacta.

**Nota:** #33, #35 e #37 já estavam implementados no código (commits anteriores da rodada);
apenas #34 e #36 foram o foco desta sessão.

- **#34 (indicadores da sensibilidade em tabela separada):** o código já separava corretamente
  as linhas em `linhasMonetarias` e `linhasIndicadores` e renderizava duas `<table class="pf
  sens">` distintas (a 2ª com `.sens-indicadores { margin-top: 20px }`). Confirmado por
  inspeção — nenhuma alteração necessária. Issue fechada.

- **#36 (dirty check por snapshot em Premissas):** a implementação anterior usava um booleano
  `_dirty = true` em qualquer chamada a `_set()`, mas **não desfazia o dirty** se o usuário
  revertesse o campo ao valor original. Implementado **deep comparison via snapshot**:
  - `_snapshot: Record<string, any>` (campo privado, não reativo) guarda uma cópia do form
    no momento do carregamento/save.
  - `_formDifereSnapshot()`: compara campo a campo (tratando `''`/`null`/`undefined` como
    equivalentes via `String(null)`) — retorna `true` só quando existe diferença real.
  - `_set()` agora atribui `this._dirty = this._formDifereSnapshot()` em vez de `= true` —
    assim reverter um campo ao valor original limpa o dirty automaticamente.
  - Após save bem-sucedido: `this._snapshot = { ...this.form }` atualiza o snapshot para
    refletir o estado recém-persistido → banner some.
  - `_init()` inicializa `_snapshot = { ...this.estudo }` junto com o form.

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build
  (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde). Mudança puramente de frontend
  → empacotamento/backend não se aplicam.

### Etapa 2 — Backend & dados — ✅ IMPLEMENTADA (issues #24, #38)
Branch `claude/etapa-2-pykm15`. Toca **backend + frontend** (sem schema, sem migração).

- **#24 (campos do Avançado validados ao salvar Preliminar):** a raiz do bug é que ao
  salvar Premissas de um estudo Preliminar o frontend envia TODOS os campos do objeto
  estudo (incluindo os da aba Financeiro/Avançado, que chegam como `null`). O shell,
  ao receber `campo_numerico: null` no payload, dispara "deve ser um número". **Fix
  backend (`backend/rotas/estudos.ts`):** nova constante `CAMPOS_SOMENTE_AVANCADO` (28
  campos — `taxa_desconto_aa`, estrutura de capital, juros, impostos, financiamento,
  investidor etc.); no handler `PATCH /estudos/:id`, quando `nivel_analise ===
  'preliminar'`, campos dessa lista são ignorados antes de chegar ao validador do shell.
  Assim, salvar Premissas de um Preliminar nunca mais envia valores `null` para campos
  exclusivos do Avançado.
- **#38 (lista do Núcleo incompleta + paginação):** `listarGlebasNucleo` /
  `listarLotesNucleo` em `viabilidade-api.ts` agora aceitam `pagina` e `porPagina`
  (padrão 100 itens/página) e repassa esses parâmetros ao shell. O componente
  `viab-terreno-nucleo` ganha estado `_pagina` e `_totalItens`; exibe indicador
  "Página X de Y (Z glebas/lotes)" + botões Anterior/Próxima quando há mais de uma
  página. Reset para página 1 ao trocar de estudo.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ ·
  build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde). ⏳ **Pendente do
  autor (SDK gated):** typecheck do backend, suíte de backend e `urbi-empacotar`.

---

## Mapa de repositórios (na máquina)

| Repo | Caminho | Papel |
|---|---|---|
| **viabilidade-real-estate** | `C:\Users\Rafael.gualberto\viabilidade-real-estate` | **Este repo** — a app sendo construída (app na raiz) |
| **urbiverso** (monorepo shell) | `C:\Users\Rafael.gualberto\urbiverso` | Fonte de verdade: `docs/shell/*.md`, `nucleo/`, `shell/`, `apps/` |
| **urbiverso-apps-gestao** | `C:\Users\Rafael.gualberto\urbiverso-apps-gestao` | Apps vivas modelo: `okr/`, `recrutamento/`, `dd/` — **copiar padrão, não reinventar** |

> ⚠️ O `sdk/README.md` citado no README **não existe** localmente no monorepo. O `@urbiverso/sdk` só está disponível via GitHub Packages (`npm.pkg.github.com`). Contratos de `req.*` foram lidos de `docs/shell/*.md` e das apps modelo.

> ℹ️ O monorepo da plataforma mudou de endereço: `UP-Urbita/urbiverso` → **`urbiverso/urbiverso`** (mesma org do SDK e das apps). URLs antigas ainda redirecionam; atualizar remotes/bookmarks. Só o endereço mudou — issues/PRs/branches vieram junto.

---

## Rodada correção 2026-07 — plano (`lista_bugs.csv`)

> Nova rodada de refinamento, guiada pelo documento `prompt-correcao-viabilidade`.
> **Uma etapa por sessão.** Numeração dos itens é a da `lista_bugs.csv` — **independente**
> da rodada "lista bugs.xlsx" (2026-07-15) mais abaixo, cujos `#N` são outra lista.
> 14 itens em escopo; **itens 12 e 16 removidos do escopo pelo autor** — não tocar.

**Baseline Etapa 0 (verde):** typecheck ✓ · build ✓ (frontend 102.7kb · backend 841.2kb) ·
test 25/25 ✓ · empacotar ✓ (via PowerShell; o `tar` do Git Bash falha em paths `C:` —
**usar PowerShell para `urbi-empacotar` neste ambiente**).

| Item | Descrição | Etapa | Área |
|---|---|---|---|
| 1 | Benchmark vira aba de topo (nível de Estudos/Terrenos), fora do detalhe do Estudo | **1** | manifesto/nav + frontend |
| 2 | Separar Indicador de **Benchmark** (meta, `regra_comparacao`) de Indicador de **Sensibilidade** (`variacao_*_pct` → cenários) | **1** | schema/frontend |
| 3 | Botão de Membros com UI errada → seguir contrato `urbi-botao` | **2** | frontend (UI) |
| 4 | Label de campo em 2 linhas desalinha a fileira → alinhar por grid/altura fixa | **2** | frontend (UI) |
| 6 | Padronizar `urbi-input*` em **3 larguras** (%/R$m²/coef · área/moeda · texto/select) | **2** | frontend (UI) |
| 5 | **Troca de unidade por badge interativa** com recálculo correto (CRÍTICA) | **3** | frontend + engine |
| 7 | Detalhar nº e preço médio por unidade **R e NR** em Premissas e Proforma | **4** | frontend + engine |
| 8 | Nova **coluna de descrição** na Proforma (2ª col, texto menor itálico) | **5** | frontend (tabela) |
| 9 | Linhas de consolidação: inverter posições + adicionar **"Deduções sobre VGV"** | **5** | frontend + engine |
| 10 | **Permuta física detalhada** (m² e % área privativa; R e NR em linhas separadas) | **5** | frontend + engine |
| 13 | Remover memo "Permuta física entregue" + renomear "Gestão e outros indiretos" → "…custos indiretos" | **5** | frontend + premissas |
| 11 | Cenários **Bear/Base/Bull** em `urbi-badge` estático colorido | **6** | frontend (UI) |
| 14 | **Pizza de alocação de áreas** (Loteamento e Incorporação; Inc com subgrupo geral+macro) | **7** | frontend (gráficos) |
| 15 | **Medidores de indicadores** por benchmark (Custo obra/VGV invertido) | **7** | frontend (gráficos) |
| ~~12~~ | ~~fora do escopo (decisão do autor)~~ | — | — |
| ~~16~~ | ~~fora do escopo (decisão do autor)~~ | — | — |

**Etapa 8:** fechamento + empacotamento. Não bumpar `versao` salvo migração de schema.

### Etapa 0 — ✅ CONCLUÍDA (reconhecimento + baseline)
Fontes de verdade confirmadas no monorepo `C:\Users\Rafael.gualberto\urbiverso\urbiverso\`
(`docs/shell/ui-componentes-conteudo.md`, `ui-componentes-layout.md`, `nucleo.md`, `ia.md`,
`sdk/src/contrato.ts`) e apps-modelo em `urbiverso-apps-gestao/`. Nenhuma correção feita.

### Etapa 1 — ✅ CONCLUÍDA (itens 1 e 2 — navegação + separação benchmark/sensibilidade)
- **Item 1 (Benchmark como aba de topo):** a aba de topo `/benchmarks` **já existia e
  funcionava** no dashboard (`tela-dashboard.ts` aba `benchmark` → `viabilidade-config-benchmarks`),
  honrando o `nav`/`telas_config.benchmarks` do manifesto. O que sobrava era a **5ª aba
  "Benchmarks" dentro do Estudo** (introduzida como #12 na rodada 2026-07-15). Removida de
  `tela-estudo.ts`: tirado o item de `_abas`, o `<urbi-hospedeiro slot="benchmarks">`, o
  `Aba`='benchmarks', o import e o helper `_ehAdmin` (que só servia àquele slot). Benchmark
  agora é **exclusivamente** aba de topo, no nível de Estudos/Terrenos.
- **Item 2 (separar os dois indicadores):** `viabilidade-config-benchmarks.ts` agora exibe **duas
  seções distintas** sobre as mesmas linhas da tabela `benchmarks` (genesis intacto):
  1. **Indicador de Benchmark** — colunas Indicador · Valor · Regra (`valor` + `regra_comparacao`);
     é a meta que alimenta os avisos verde/vermelho e a comparação de resultado.
  2. **Indicador de Sensibilidade** — colunas Indicador · Var + (%) · Var − (%)
     (`variacao_positiva_pct`/`_negativa_pct`); é a faixa dos cenários Bear/Base/Bull.
  Schema confirmado: a tabela `benchmarks` já suporta os dois papéis na mesma linha. Leitura já
  era separada — comparação de meta lê `valor`; os cenários leem os campos do **estudo**
  (`estudos.sensibilidade_variacao_*_pct`, fallback 10). **Decisão registrada:** não reconectei o
  cálculo dos cenários para consumir `benchmarks.variacao_*_pct` (risco de regressão e fora do
  escopo "UI/leitura" do item 2); as faixas globais servem como referência/padrão por tipo.
- **Nota de rota:** esta etapa **reverte** a decisão #12 da rodada "lista bugs.xlsx" (benchmark
  dentro do estudo). Conforme regra do documento, os itens desta rodada vencem.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 102.7→103.0kb · backend 841.2kb) ·
  test 25/25 ✓ · empacotar ✓ (PowerShell). Sem alteração de schema/migração; `versao` intacta.

### Etapa 2 — ✅ CONCLUÍDA (itens 3, 4, 6 — layout de formulário em Premissas)
- **Item 3 (botão de Membros com UI errada):** o contrato de `urbi-botao`
  (`docs/shell/ui-componentes-conteudo.md` §urbi-botao) só admite `variante` =
  `primario|secundario|perigo|sucesso` — **`fantasma` não existe** no contrato. O botão Membros
  usava `variante="fantasma"`; trocado para **`secundario`** (padrão das apps-modelo: 56 usos de
  `secundario` para ações secundárias). ⚠️ **Observação (não corrigida — fora do escopo do item 3):**
  há outros botões `fantasma` espalhados (tela-estudo "Devolver ao rascunho", tela-dashboard,
  config-benchmarks). Se forem inválidos em runtime, tratar numa varredura própria.
- **Item 4 (label de 2 linhas desalinha a fileira):** `viab-num` e o campo composto (`.cu-rotulo`)
  agora reservam **altura fixa de 2 linhas** no rótulo (`min-height: 2.4em; line-height: 1.2`),
  ancorado ao rodapé (`align-items: flex-end`) — o espaço de reserva fica acima do texto, mantendo
  o gap rótulo→campo constante e alinhando todos os campos da fileira, com label de 1 ou 2 linhas.
  Só afeta `viab-num` **com label** (exclusivo de Premissas); células de tabela/`cu-valor` não têm
  label. Nota: `urbi-input` (texto) tem label interno do primitivo, fora do nosso alcance — na
  prática os poucos labels de texto (p3) são de 1 linha, então o alinhamento se mantém.
- **Item 6 (três larguras de campo):** o `.grid` de Premissas deixou de ser `grid auto-fill 1fr`
  (largura uniforme) e virou **flex-wrap com 3 larguras fixas** por classe: **p1 (165px)** para
  `%`/`R$/m²`/coeficientes; **p2 (210px, default)** para área (`m²`)/moeda (`R$`) e numéricos sem
  sufixo; **p3 (330px)** para texto livre e o campo composto com select. Classe derivada em
  `larguraClasse(campo)` a partir do sufixo/tipo (coef marcados com `w:'p1'`). `max-width:100%`
  evita overflow em telas estreitas. `urbi-input`/`urbi-input-numero` não têm prop de largura — o
  controle é do container (confirmado no contrato).
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 103.0kb estável · backend 841.2kb) ·
  test 25/25 ✓ · empacotar ✓ (PowerShell). Frontend puro (CSS/tokens); sem cálculo, schema ou
  migração; `versao` intacta.

### Etapa 3 — ✅ CONCLUÍDA (item 5 — troca de unidade por badge interativa) — ETAPA CRÍTICA
- **Mecanismo de badge (headline):** `_custoUnidade` (tela-premissas) trocou o `urbi-select` de
  unidade por **`urbi-badge` interativos com seleção mútua** — só uma `?ativo` por vez; clicar troca
  o `<modoKey>` e recalcula ao vivo. Contrato confirmado (`ui-componentes-conteudo.md` §urbi-badge):
  `interativo` dá cursor/chip/cinza-quando-inativo e Enter/Espaço já disparam o mesmo `click` (sem
  `keydown` manual). Aplicado a: infra, construção, projetos e permuta física.
- **Infra do loteamento com 3 unidades (#5):** era `%VGV`/`R$/m²`; agora `%VGV` / **`R$` (fixo)** /
  `R$/m²`. Schema: `infra_modo` opcoes += `valor_fixo` e nova coluna `infra_valor_fixo` (aditivo, o
  sincronizador cria; sem migração). Motor: `infra_modo==='valor_fixo' → infra_valor_fixo`; `valor_m2
  → custo_infra_m2 × área vendável (= privativa dos lotes)`.
- **Permuta financeira R e NR como badge (#5):** as duas saíram das Deduções-plain-% e viraram
  campos com toggle **`% VGV` ↔ `R$`**. Schema aditivo: `permuta_financeira_{residencial,
  nao_residencial}_{modo,valor}`. Motor: `modo==='valor_fixo' → valor absoluto`, senão `pct × VGV do
  tipo`. **Correção de borda:** a permuta financeira NR fica oculta no **loteamento** (não há produto
  NR; no modo % era inócua ×0, mas no modo R$ deduziria valor espúrio).
- **Cálculo R$/m² travado por teste:** construção `R$/m² × área privativa TOTAL` (R+NR, fechada+aberta);
  infra `R$/m² × área vendável`. +5 testes (infra 3 modos, permuta financeira R$, construção total).
- **Memos da Proforma cientes do modo** (tela-proforma): `infra`/permuta financeira mostram
  "valor fixo" no modo R$ em vez de "% do VGV" enganoso. (Tabela completa é da Etapa 5.)
- **DECISÃO DE ROTA (reportada):** o **split R/NR da permuta física** (2 campos separados) foi
  **adiado para a Etapa 5 / item 10**, dona das "linhas separadas R e NR" na Proforma — evita
  duplicar schema/engine e mantém a etapa crítica isolada. Permuta física segue como campo único
  com badge (m²/% área venda) por ora.
- **Schema:** +5 colunas aditivas em `estudos` (`infra_valor_fixo`,
  `permuta_financeira_{residencial,nao_residencial}_{modo,valor}`) + 1 opção nova em `infra_modo`.
  Backend PATCH usa **blocklist** (não allowlist) → colunas passam e são validadas contra o genesis;
  sem alteração no backend. **`versao` mantida em 0.1.0** (só adição de coluna, sem migração — segue
  o precedente da rodada anterior).
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 103.0→105.3kb · backend 841.2kb) ·
  **test 28/28 ✓** (+3) · empacotar ✓ (PowerShell).

### Etapa 4 — ✅ CONCLUÍDA (item 7 — separação Residencial / Não Residencial)
- **Estado de partida:** Premissas **já coletava** os 4 campos R/NR (`num_unidades_{res,nao_res}`,
  `preco_venda_m2_{res,nao_res}` em `PRODUTOS_INC`) e a Proforma **já exibia** o card "Unidades e
  preço médio por tipo" (`_renderUnidadesTipo`, herança do #11). A engine já somava R+NR no VGV
  (`vgv = vgvResidencial + vgvNaoResidencial`). O gap real: a **Premissas** só mostrava totais no
  resumo, e as métricas por tipo eram calculadas ad-hoc na Proforma (não no motor).
- **Motor (fonte única):** `proforma.ts` passou a expor `numUnidades{Residencial,NaoResidencial}` e
  `precoMedioUnidade{Residencial,NaoResidencial}` (preço médio = VGV do tipo, já líquido de permuta
  física, ÷ nº de unidades do tipo). Loteamento não separa R/NR → ficam 0.
- **Proforma:** `_renderUnidadesTipo` refatorado para ler as métricas do motor (antes calculava
  `vgvResidencial/qR` inline). Comportamento idêntico, fonte única.
- **Premissas:** novo bloco `_unidadesTipo(p)` no resumo (só Incorporação, quando há unidades R/NR)
  espelhando a Proforma — "Residencial: N un · R$ x/un" / "Não residencial: …". Totais seguem no
  grid de KPIs.
- **Testes ampliados:** +2 casos (#7) — detalhe R/NR de nº e preço médio (VGV soma R+NR) e
  loteamento com métricas por tipo zeradas.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 105.3→106.7kb · backend 841.2kb) ·
  **test 30/30 ✓** (+2) · empacotar ✓ (PowerShell). Sem schema/migração; `versao` intacta.

### Etapa 5 — ✅ CONCLUÍDA (itens 8, 9, 10, 13 — tabela da Proforma)
- **Item 8 (coluna de descrição):** a tabela da Proforma passou de 4 para **5 colunas** —
  Linha · **Descrição** · R$ · R$/m² · % VGV. A descrição (antes um `(memo)` inline no título) virou
  **2ª coluna** própria (`td.desc`: texto menor `0.72rem` + itálico + cinza; respiro pelo padding da
  célula, não colado no título).
- **Item 9 (consolidação invertida + "Deduções sobre VGV"):** as linhas-total agora são o **header**
  do grupo colapsável (antes eram o rodapé): `= Custo direto total` logo abaixo de Receita líquida,
  `= Custo indireto total` logo abaixo do último custo direto. Nova linha **`= Deduções sobre VGV`**
  logo abaixo da Receita bruta, consolidando imposto + corretagem + marketing + permuta financeira
  (R+NR), também colapsável. Estado `colapso` ganhou a chave `deducoes`.
- **Item 10 (permuta física detalhada R/NR):** quando há permuta física, entre "VGV sem permuta" e
  "Receita bruta (VGV)" entram linhas **(-) Permuta física residencial** e **(-) …não residencial**
  (loteamento: uma só "(-) Permuta física"), com descrição **"X m² · Y% da área privativa total"**.
  Aqui entrou o **split R/NR adiado da Etapa 3**: schema aditivo `permuta_fisica_nr_{modo,area_m2,pct}`
  (o par legado `permuta_fisica_*` passou a ser o **Residencial** / e o único do loteamento — sem perda
  de dados). Premissas mostra 2 campos-badge (R e NR) na incorporação; motor reduz `vgvResidencial`
  por `permuta_fisica_*` e `vgvNaoResidencial` por `permuta_fisica_nr_*` (novas saídas
  `areaPermuta{R,NR}`, `vgvPermuta{R,NR}`). Loteamento inalterado (usa o campo legado, NR = 0).
- **Item 13 (remover memo + rename):** removida a linha "(memo) Permuta física entregue"; o Resultado
  ganhou `border-top` + `padding-top` para manter o espaçamento. "Gestão e outros indiretos" →
  **"Gestão e outros custos indiretos"** na Proforma **e** na Premissas (label do campo
  `gestao_indiretos_pct`).
- **exportar.ts:** `linhasProforma` espelha a nova estrutura (Deduções sobre VGV, permuta física R/NR,
  rename, sem o memo) — PDF e Excel seguem consistentes com a tela.
- **Testes ampliados:** +2 casos (#10) — permuta física R/NR separada reduz cada VGV; loteamento usa
  o campo legado com NR zerado.
- **Schema:** +3 colunas aditivas (`permuta_fisica_nr_{modo,area_m2,pct}`). Backend PATCH por blocklist
  → passam e validam no genesis; sem mudança de backend. **`versao` mantida em 0.1.0.**
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 106.7→109.0kb · backend 841.2kb) ·
  **test 32/32 ✓** (+2) · empacotar ✓ (PowerShell).

### Etapa 6 — ✅ CONCLUÍDA (item 11 — cenários Bear/Base/Bull em urbi-badge)
- Os títulos das colunas da análise de sensibilidade (📉 Bear, 📊 Base, 🚀 Bull) deixaram de ser
  `<span>` coloridos e viraram **`urbi-badge` estáticos** (sem `interativo` — badge estática aplica a
  `cor` direto, ver contrato §urbi-badge), cada um com a cor convencionada: **Bear=`perigo`** (vermelho),
  **Base=`sucesso`** (verde), **Bull=`info`** (azul). O emoji segue na frente, dentro do badge.
- **Ajuste de convenção:** a cor de `Base`/`Bull` estava divergente (Base=neutro, Bull=verde na versão
  anterior). O documento vence e fixa Base=verde/sucesso, Bull=azul/info — alinhado.
- **Valores neutros:** a tinta por cenário saiu das células de valor (antes coloridas). A identidade
  da coluna vem do badge no cabeçalho; evita interpretar número verde como "bom" (a cor agora é
  categoria, não semântica de bom/ruim).
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 109.0→108.9kb · backend 841.2kb) ·
  test 32/32 ✓ · empacotar ✓ (PowerShell). Frontend puro; sem schema/cálculo; `versao` intacta.

### Etapa 7 — ✅ CONCLUÍDA (itens 14 e 15 — gráficos nativos)
- **Item 14 (pizza de alocação de áreas):** novo bloco em `tela-graficos` com `urbi-grafico-pizza`
  (formato `numero`, m²). **Loteamento:** uma pizza da composição da gleba (APP, faixas não
  edificáveis, sistema viário, ELUP, EPC, EPU, priv. não vendáveis + área vendável dos lotes — soma =
  gleba). **Incorporação:** **dois** subgrupos — "geral" (5 áreas detalhadas: priv. R/NR fechada/aberta
  + comuns) e "macro" (privativa residencial + privativa não residencial + áreas comuns = 100%).
  Fatias zeradas são filtradas; sem áreas → `urbi-estado-vazio`.
- **Item 15 (medidores de indicadores):** novo card "Indicadores vs. benchmark" com
  `urbi-grafico-medidor` por benchmark do estudo. Mapa benchmark→valor atual do motor
  (`resultado_final`/`margem_liquida`→margem líquida, `margem_bruta`, `roi`, `custo_obras_vgv`,
  `eficiencia_aproveitamento`). Faixas de status derivadas da **`regra_comparacao`**:
  `atingir_ou_superar` → vermelho abaixo da meta / verde acima; **`nao_exceder` (Custo obra/VGV) →
  verde ABAIXO da meta / vermelho acima** (a inversão pedida). `min=0`, `max=máx(meta×2, valor×1,2,
  meta+10)` (garante faixas válidas: ascendentes, última `ate`===`max`, e a agulha não estoura),
  `formato="porcentagem"`, cores por token `var(--cor-sucesso|erro)`. `tela-graficos` passou a buscar
  benchmarks + config (alíquota RET) por estudo, como a Proforma.
- **Contratos confirmados no doc** (`ui-componentes-conteudo.md`): pizza usa `categorias`/`series`
  (1ª série, cor por categoria); medidor tem API própria (`min`/`max`/`valor`/`faixas`/`formato`/
  `rotulo`), faixas ascendentes cobrindo `[min,max]`.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 108.9→112.4kb · backend 841.2kb) ·
  test 32/32 ✓ · empacotar ✓ (PowerShell). Sem schema/cálculo novo (só leitura); `versao` intacta.
  ⏳ Render real dos primitivos `urbi-grafico-*` só valida no deploy dev.

### Etapa 8 — ✅ CONCLUÍDA (fechamento e empacotamento)
**Suíte completa verde:** typecheck ✓ · build ✓ (frontend **112.4kb**, backend **841.2kb**) ·
**test 32/32 ✓** · empacotar ✓ → `dist/viabilidade-0.1.0.urbiapp.tgz` (342 KB) + `.sha256`.

**Itens fechados (14/14):** 1, 2 (Etapa 1) · 3, 4, 6 (Etapa 2) · 5 (Etapa 3) · 7 (Etapa 4) ·
8, 9, 10, 13 (Etapa 5) · 11 (Etapa 6) · 14, 15 (Etapa 7).
**Fora do escopo por decisão do autor — não tocados:** **itens 12 e 16**.

**Versão:** mantida em **0.1.0**. Nenhuma migração criada (`migracoes/` só tem `.gitkeep`) — todas as
mudanças de schema foram **colunas/opções aditivas no genesis** (auto-criadas pelo sincronizador, sem
transformar dado de instância): `infra_valor_fixo`, `permuta_financeira_{res,nao_res}_{modo,valor}`,
`permuta_fisica_nr_{modo,area_m2,pct}`, e a opção `valor_fixo` em `infra_modo`. Backend inalterado
(PATCH por blocklist valida contra o genesis).

**Decisões de rota registradas (os itens desta rodada vencem a spec/rodadas anteriores):**
1. Benchmark voltou a ser **aba de topo** — reverte o #12 da rodada "lista bugs.xlsx" (Etapa 1).
2. Sensibilidade continua lendo `estudos.sensibilidade_variacao_*_pct` (as `variacao_*_pct` do
   benchmark são referência/padrão por tipo; **não** reconectei o cálculo dos cenários) (Etapa 1).
3. Botão de Membros: `fantasma`→`secundario`. Outros botões `fantasma` no app **não** foram tocados
   (fora do escopo do item 3) — varredura própria pendente se `fantasma` for inválido em runtime (Etapa 2).
4. Permuta física R/NR: par legado `permuta_fisica_*` virou o **Residencial** (e o único do
   loteamento); só a NR ganhou colunas novas — sem perda de dados (Etapas 3/5).
5. Permuta financeira NR **oculta no loteamento** (não há produto NR) (Etapa 3).
6. Cenários Bear/Base/Bull: cor de convenção corrigida para Base=verde/sucesso, Bull=azul/info; valores
   das células ficaram **neutros** (cor = categoria, não semântica de bom/ruim) (Etapa 6).

**Pendente para o deploy dev (validação visual real — nunca rodou contra shell real):**
- Render/ajuste fino dos primitivos migrados nesta rodada: `urbi-badge` interativo (troca de unidade),
  `urbi-badge` estático (cenários), `urbi-grafico-pizza` (alocação de áreas) e `urbi-grafico-medidor`
  (indicadores + faixas).
- Alinhamento de labels de 2 linhas e as 3 larguras de campo em Premissas (CSS conferido offline).
- `urbi-empacotar` neste ambiente **só roda via PowerShell** (o `tar` do Git Bash falha em paths `C:`).

**Fluxo:** code → commit → push. Release/deploy é responsabilidade do autor (não criei release nem
acionei workflows).

## Rodada pós-fechamento — campos obrigatórios + conversão de unidades

### Parte 1 — Campos obrigatórios em Premissas ✅
- **Contrato de UI:** obrigatório = `obrigatorio` (asterisco `*` no label) + `erro` (mensagem vermelha
  abaixo). Adicionado suporte a `viab-num` (não tinha), espelhando `urbi-input-numero`.
- **Regra (por tipo, decisão do autor — sem campo de classificação de uso):**
  - **Ambos:** Área do terreno (manual; via Núcleo já vem preenchida — valida a área somada) +
    **obras** (Infraestrutura no Loteamento / Custo de construção na Incorporação — sempre o campo da
    **unidade ativa**, ex.: `infra_pct` no modo %VGV, `custo_infra_m2` no R$/m²).
  - **Incorporação, por lado:** cada lado (R/NR) com **Nº de unidades > 0** exige a sua **Área PVT
    fechada** e o seu **Preço**. Exige **ao menos um lado**. Um estudo só residencial não exige dados
    de NR (e vice-versa).
  - "Preenchido" = ≠ vazio **e** ≠ 0.
- **Comportamento:** ao **Salvar**, se faltar obrigatório, bloqueia o PATCH, marca os campos (borda +
  "Obrigatório") e mostra `urbi-banner` de erro listando o que falta. Editar um campo limpa o erro
  dele. Asteriscos aparecem dinamicamente (ex.: preencher Nº un. R faz Área/Preço R ganharem `*`).
- **Regra pura e testável:** `frontend/premissas-validacao.ts` (`camposObrigatorios` / `validarObrigatorios`
  / `campoObrasAtivo`), coberta por **10 testes** nos dois tipos (loteamento, incorporação só-R, só-NR,
  misto, Núcleo, zero-não-conta). Frontend puro; sem schema/engine; `versao` intacta.
- **Validado:** typecheck ✓ · build ✓ (112.4→115.6kb) · **test 42/42 ✓** · empacotar ✓.

### Parte 2 — Conversão automática de unidades ✅
- **Comportamento:** ao trocar a unidade de um campo (badge), o valor é convertido para a unidade
  nova (equivalente) e o modo muda. Ex. (permuta física): 2.000 m² com área de venda 40.000 → clica
  "% área venda" → **5%**; muda para 10% e volta pra m² → **4.000 m²**.
- **Regra geral:** cada unidade representa a MESMA quantidade base — R$ (custos/permuta financeira) ou
  m² (permuta física) — e converte `unidade atual → base → unidade nova` via uma **grandeza de ligação**
  do motor (VGV, área de venda, área privativa), que **não depende do próprio campo** (sem
  circularidade). Descritor `conv` por opção: `identidade` / `pct` (link) / `por_area` (link).
- **Cobertura por campo** (confere com o motor nos dois tipos): permuta física m²↔% (link área de
  venda R/NR; loteamento usa a vendável total); infra %VGV↔R$↔R$/m² (VGV / área vendável); construção
  R$/m²↔R$ total (área privativa); projetos %VGV↔R$ (VGV); permuta financeira R/NR %VGV↔R$ (VGV do tipo).
- **Sem base definida** (grandeza de ligação = 0, ex.: áreas/preços ainda não preenchidos) → **não
  converte** (mantém o valor do destino); campo de origem vazio → só troca o modo. Arredonda a 2 casas.
- **Módulo puro e testado:** `frontend/premissas-conversao.ts` (`converterUnidade`/`paraBase`/`daBase`),
  **7 testes** (exemplo do autor, infra 3-modos, construção, permuta financeira R/NR, base zero, NaN,
  arredondamento). `_ctxConversao()` monta as grandezas do motor; `_trocarUnidade()` faz a troca.
- **Frontend puro; sem schema/engine.** Validado: typecheck ✓ · build ✓ (115.6→117.1kb) ·
  **test 49/49 ✓** · empacotar ✓. `versao` intacta.

## Rodada Proforma (ajustes visuais)

### Etapa 1 — Tabela da Proforma ✅
- **Notação contábil na coluna R$:** `_fmtContabil(linha)` — sem "R$"; custos/deduções (itens e
  consolidados) entre parênteses (ex.: `(1.546.210)`); receita plana; resultado pelo sinal real
  (negativo entre parênteses). Reusa `fmtNum` (pt-BR, 0 casas). Colunas R$/m² e % VGV inalteradas.
- **Cabeçalhos:** maiores (0.7→0.85rem) e **centralizados** nas colunas de valor; **Descrição à
  esquerda**; **1ª coluna sem o título "Linha"** (cabeçalho vazio). Valores seguem à direita.
- Validado: typecheck ✓ · build ✓ (117.1→117.4kb) · test 49/49 ✓ · empacotar ✓.

### Etapa 2 — Análise de sensibilidade ✅
- Convertida de `urbi-tabela` para **tabela HTML própria** (`table.pf.sens`, reusa os estilos da
  Proforma) para controlar cabeçalho, cores e divisória.
- **Cabeçalho da 1ª coluna vazio** (sem "Linha"); títulos Bear/Base/Bull seguem em `urbi-badge`.
- **Números na cor do cenário:** Bear=`--cor-erro` (vermelho), Base=`--cor-sucesso` (verde),
  Bull=`--cor-info` (azul) — antes eram neutros.
- **Novo indicador "Custo obra / VGV"** (`custoObrasVgvPct`).
- **Dois grupos:** 4 monetárias (VGV, Receita líquida, Custo direto total, Resultado) em cima; os 2
  indicadores em % (Custo obra/VGV, Margem líquida) embaixo, com **`border-top` de divisória** (linha
  `.div-top`).
- Validado: typecheck ✓ · build ✓ (117.4→118.0kb) · test 49/49 ✓ · empacotar ✓.

## Rodada Benchmark/Sensibilidade + Medidores

### Etapa A — Indicadores de Sensibilidade = as 4 variáveis da Proforma ✅
- **Problema:** a seção "Indicador de Sensibilidade" mostrava os mesmos campos das metas e não
  alimentava os cenários (a Proforma usava um par único `estudos.sensibilidade_variacao_*_pct`).
- **Backend seed:** +4 indicadores de sensibilidade (`preco`, `permuta_fisica`, `permuta_financeira`,
  `custo_obras`) com var+/var− (10/10); `valor`=0 (metas não se aplicam). Export `CAMPOS_SENSIBILIDADE`.
- **Config de benchmark:** a seção "Benchmark" lista só as **metas** (`_itensMeta`); a seção
  "Sensibilidade" lista só os **4 de sensibilidade** (`_itensSensibilidade`) com rótulos amigáveis
  (Preço R$/m², Permuta física, Permuta financeira, Custo de obras).
- **Proforma:** a Análise de Sensibilidade passou a ler a variação **por variável** do benchmark
  (`_campoSensibilidade(VarSens)`→`campo`; `custo_infra`/`custo_obras`→`custo_obras`), fallback 10%.
  Inversão Bull/Bear mantida na versão econômica (só Preço "subir = melhor"; Custo, Permuta física e
  Permuta financeira "subir = pior") — confirmada pelo autor.
- **Schema intacto** (a tabela `benchmarks` já tinha `variacao_*_pct`). `estudos.sensibilidade_*` ficou
  sem uso no cálculo (mantido no schema). Testes do seed atualizados. **test 50/50 ✓**.

### Etapa B — Medidores configuráveis por indicador (aba Benchmark) ✅
- **Confirmação de viabilidade:** `urbi-grafico-medidor` aceita `min`/`max`/`faixas` como **props** e
  `faixas` é um **array** (N bandas) — tudo API pública do primitivo. Customização é **100% no app**,
  sem tocar no urbiverso.
- **Schema (aditivo):** `benchmarks` += `medidor_min`, `medidor_max`, `medidor_faixa1_ate`,
  `medidor_faixa2_ate`. Backend PATCH liberou os 4 campos. Sem migração; `versao` intacta.
- **Config (aba Benchmark):** nova seção **"Faixas do medidor"** sobre os indicadores de meta —
  campos editáveis Mín · Faixa 1 até · Faixa 2 até · Máx. (A edição fica **só** aqui, nunca na aba
  Gráficos.)
- **Gráficos:** `montarMedidor(b, val)` (módulo puro `medidor-faixas.ts`) monta min/máx + faixas:
  **configurado** → **3 faixas** cor fixa **vermelho/amarelo/verde** (invertidas p/ `nao_exceder`);
  **em branco/ inválido** → fallback automático de 2 faixas em torno da meta (comportamento anterior).
  A tela de Gráficos só consome; não edita.
- **+5 testes** (`medidor-faixas.test.ts`): 3 faixas, inversão, fallback, config inválida, sem meta.
- Validado: typecheck ✓ · build ✓ (118.6→120.3kb · backend 841.5kb) · **test 55/55 ✓** · empacotar ✓.

### Pós-fechamento — nota
- **KPI R/NR na Proforma (revertido a pedido do autor).** Chegou a existir um commit dividindo o KPI
  do topo em "Nº un. residencial/não residencial/total" + preço médio R/NR (`4bef233`), mas o autor
  pediu para ignorar por ora — **revertido**. A separação R/NR do item 7 segue como estava (card
  "Unidades e preço médio por tipo" na Proforma + bloco no resumo da Premissas). Pode voltar depois.

---

## Rodada de correções — "lista bugs.xlsx" (2026-07-15)

Round de refinamento sobre o MVP (22 itens da planilha do autor). Branch `fix/lista-bugs`.
Validação: typecheck ✓ · build ✓ · 25 testes ✓ · empacotar ✓ (offline, sem runtime real).

- **Formatação (#5):** `fmtPct` calculado "xx,x%" (vírgula, 1 casa); `fmtPctEntrada` "xx,xx%".
  Números já agrupam milhar via Intl pt-BR. Novo `parseNumeroBR` (testado).
- **Input mascarado (#1):** `viab-num` (app-local) exibe separador de milhar nos campos
  preenchíveis — o `urbi-input-numero` é `<input type=number>` e não agrupa. Usado em
  Premissas e na config de Benchmarks. Flag `atenuado` = marcador cinza de dado não usado (#15).
- **Proforma:** removida a ação "Salvar cenário"/comparação transiente (#8); sensibilidade
  sempre visível (#10); cores Bear=vermelho/Base=verde/Bull=azul (#11); botões de exportar à
  direita (#9).
- **Sensibilidade — sinal do custo (#13):** Bull é otimista de verdade. Preço: otimista = maior;
  custo/permuta: otimista = menor (conta invertida em `_renderSensibilidade`).
- **Live Premissas→Proforma (#6):** `_set` emite `viab:premissas-change`; a tela do estudo funde
  no objeto e as abas recalculam na hora. Fetch de benchmarks guardado por id (não reroda por tecla).
- **Unidades de custo (#3/#4):** seletor de unidade + 1 campo por custo. Projetos %VGV/R$ fixo;
  Infra %VGV/R$/m²; Construção R$/m²/R$ total (novos `construcao_modo`/`construcao_valor_total`).
- **Campo único com unidade embutida (UI):** o par "seletor de unidade — campo de valor" (que antes
  eram duas células separadas no grid) virou **um só campo** — rótulo em cima e `[tag de unidade][valor]`
  lado a lado (`_custoUnidade` em `tela-premissas.ts`), replicando o padrão do orçamento de obra: troca a
  tag → muda a unidade inserida no mesmo campo. A **permuta física** foi trazida para esse mesmo padrão
  (`PERMUTA_UNIDADE`: m² / % área de venda), aposentando o `_modo` + dois inputs atenuados. Cada unidade
  guarda seu próprio valor nas colunas já existentes — **mudança 100% de UI, sem schema/proforma/migração**.
- **Permutas (#14 — decisão do autor):** permuta física reduz a área vendável e o VGV nos DOIS
  tipos (antes só no Loteamento); permuta financeira segue deduzida da receita. Ambas reduzem o
  **Resultado final** — removidas as linhas "Resultado + permutas" que somavam de volta;
  `valorPermutaFisica` vira memo.
- **Unidades R/NR (#2 — decisão do autor: só contagem):** dois campos de nº de unidades
  (Residencial/Não Residencial) na Incorporação; `numUnidades = R + NR` (fallback ao legado
  `num_unidades`). VGV segue por área × preço.
- **Benchmarks dentro do estudo (#12 — decisão do autor):** nova aba "Benchmarks" no estudo reusa
  `viabilidade-config-benchmarks` com `tipoFixo` (trava o tipo) e `somenteLeitura` (não-admin só lê;
  backend segue admin-only na escrita).
- **URL por guia (#7):** rota `/detalhe/:id/:aba` (premissas|proforma|graficos|apelo|benchmarks).
- **Telas/tabelas:** largura total `urbi-shell-page[dashboard]` (#16); gráfico de custos empilhado e
  colorido por custo com legenda (#17); nome real + formato do arquivo no Apelo, nova coluna
  `nome_arquivo` (#18); filtros de Estudos em barra acima da tabela (#19); filtro Glebas/Lotes em
  Terrenos (#20); grids de KPI mais largos p/ reduzir overflow (#21 — fix completo exige ajustar o
  primitivo `urbi-kpi` na plataforma).
- **Loteamento (#22):** coberto — física reduz VGV no Lot (já era) e agora no Inc; toggle de infra é
  do Lot; unidades R/NR são exclusivas do Inc por natureza.

**Colunas novas no schema** (auto-criadas pelo sincronizador, sem migração destrutiva):
`apelo_comercial_documentos.nome_arquivo`, `estudos.construcao_modo`,
`estudos.construcao_valor_total`, `estudos.num_unidades_residencial`,
`estudos.num_unidades_nao_residencial`. Versão mantida em 0.1.0 (só adição de coluna).

---

## Manutenção pós-MVP — alinhamento ao contrato do framework

- **Soft-delete: campos reservados no PATCH/duplicação.** Com `estudos` marcado `soft_delete: true`, o framework passou a gerir `removido_em`/`removido_por_id` (colunas auto-criadas, ver `docs/shell/banco-de-dados.md` §Soft-delete). Como o GET de estudo agora devolve esses dois campos, o frontend os ecoava de volta ao salvar premissas → `422 DADOS_CAMPO_RESERVADO` ("use PATCH /:tabela/:id/remover ou /restaurar"), quebrando o registro dos dados de um estudo recém-criado. Corrigido em 3 pontos: `tela-premissas.ts` (`_salvar` não reenvia os campos), `estudos.ts` PATCH (`bloqueados` inclui os dois) e `estudos.ts` `CAMPOS_NAO_COPIAVEIS` (nomes obsoletos `removido_por`/`removido` → `removido_por_id`, senão a duplicação recopiaria e falharia).
- **`urbi-shell-page preencher` removido.** Atributo extinto na fase 2 do contrato de slots (aceito mas inerte; breaking após 2026-08-15 — issue up-urbita/urbiverso#1687). Removido de `tela-dashboard.ts` e `tela-estudo.ts`; o filho `<urbi-abas expandir>` (primitivo de layout) já preenche a altura sozinho, então nenhum `[expandir]` novo foi necessário.
- **Integração com o Núcleo reativada (terreno via glebas/lotes).** O §6.6 tinha ficado como modo manual (`dependencias_nucleo: []`) porque a instância não expunha glebas/lotes. Reintroduzido no contrato padrão do Núcleo:
  - **Manifesto:** `dependencias_nucleo: ["imoveis"]` + `permissoes_nucleo: { "imoveis": ["ler"] }` (só leitura; o admin liga o toggle em Admin → Apps → viabilidade → Núcleo).
  - **Backend:** removido o stub `backend/rotas/nucleo.ts` (respondia "indisponível" e **sombreava** o proxy do shell — o router do app é montado antes de `/api/{appId}/nucleo`, ver `shell/backend/src/carregador-rotas.ts`). Sem o stub, o shell provê `/api/viabilidade/nucleo/*` sozinho. O vínculo `estudo_imoveis` (rotas `imoveis-estudo.ts`) já valida subtipo × tipo (gleba↔loteamento, lote↔incorporação) e mantém gleba única no loteamento.
  - **Frontend:** `urbiVerso.nucleo(...)` (lança em não-2xx → try/catch com banner de degradação). Novo componente `tela-terreno-nucleo.ts` (seleção gleba single / lote multi, só em Rascunho) usado na aba Premissas; aba **Terrenos** do dashboard passou a listar glebas+lotes do Núcleo. Novo campo `estudos.area_terreno_nucleo` guarda a área somada, e a Proforma (`proforma.ts`) usa essa área quando `origem_terreno === 'nucleo'` — assim todas as telas (premissas/proforma/gráficos/tabela do dashboard) calculam certo sobre o objeto estudo.
  - **Pendência mantida:** filtro de exclusão (Fazenda Paranoazinho / lotes em parcelamento) segue não implementado — degrada mostrando todos os imóveis do subtipo (comportamento previsto no §6.6).

---

## Estado atual: Etapa 7 (FINAL) — ✅ CONCLUÍDA — MVP completo

### Feito (Etapa 7 — IA Apelo Comercial + exportação + arquivamento + docs)
- **IA de Apelo Comercial (§6.7):**
  - `backend/apelo-comercial.ts` — 6 fatores × 4 perguntas-guia, `SCHEMA_RESPOSTA` (JSON), `instrucoesSistema()` (prompt contextualizado por tipo), `calcularScores()` (score por fator + geral).
  - `backend/rotas/apelo-comercial.ts` — GET resultado+documentos; POST/DELETE documentos (associa `upload_id` → coluna `documento`); **POST dispara a IA** (`req.ia.extrairConteudo` nos arquivos + `req.ia.consultar` com schema), salva `resultado`+scores e publica `apelo_comercial_concluido`. Guarda `IA_INDISPONIVEL` se `req.ia` ausente.
  - `frontend/tela-apelo.ts` — 4ª aba: upload de PDF/Word/Excel + texto, disparo da análise, exibição de scores, fatores (notas/justificativas) e relatório (vantagens/desvantagens/ganhos/riscos).
- **Exportação (§6.3):** `frontend/exportar.ts` — **PDF** via janela formatada com os estilos do app + `print()`; **Excel** via CSV (UTF-8/BOM, `;`, vírgula decimal). Reusa a engine e os valores da tela. Botões ligados na aba Proforma.
- **Arquivamento automático (§3):** `backend/rotas/manutencao.ts` — `POST /manutencao/arquivar-inativos` (admin, idempotente): arquiva estudos parados > `prazo_arquivamento_dias` (exceto Aprovado) e publica evento. ⚠️ **Disparo automático** ainda depende do agendador/rotina da instância (sem hook de boot na app) — documentado.
- **Docs do app (§6.10):** `docs/viabilidade/` — `visao-geral`, `modelo-de-dados`, `formulas`, `benchmarks`, `apelo-comercial`, `permissoes`, `exportacao` (frontmatter `tipo: app`, seguindo `documentacao.md`).
- **Demo:** mock da IA (resultado canned) + rotas de apelo/manutenção; bundle atualizado.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 75→86KB, backend 832→841KB) · test 15/15 ✓ · build:demo ✓ (99→114KB) · empacotar ✓ (inclui `docs/`).

### Pendências remanescentes (pós-MVP / bloqueios de ambiente)
- **Disparo automático do arquivamento** — a regra existe como endpoint; falta o agendador da instância chamá-la (contrato de rotina do shell não documentado para apps).
- **Filtro Núcleo** (Fazenda Paranoazinho / lotes em parcelamento) — bloqueado: esta instância do Núcleo não expõe glebas/lotes. Ver [[nucleo-imoveis-nao-existe-usar-manual]].
- **v2** (fora do MVP): Projeto Avançado (fluxo de caixa, TIR/VPL), curvas/índices, unidades ligadas ao Núcleo, busca web no Apelo, layout gráfico avançado dos relatórios.

---

## Estado anterior: Etapa 6 — ✅ CONCLUÍDA

### Feito (Etapa 6 — aba Proforma + cenários + sensibilidade + Gráficos)
- **`frontend/tela-proforma.ts`** — `<viab-tela-proforma>`: KPI grid do topo (§5.2, área permutada condicional, custo obras/VGV e margem com cor por benchmark); **tabela Proforma linha a linha** (§6.2, colunas R$ e % VGV, subtotais e resultado destacados, linhas exclusivas por tipo e ocultação de zeros); **comparação de cenários** transiente (máx. 2 snapshots + coluna Δ%); **análise de sensibilidade** Bear/Base/Bull por variável estressada (preço, permuta física/financeira, custo infra/obras) com faixas do estudo/benchmark; botões de exportação (placeholder → Etapa 7). Tudo reusa `proforma.ts`.
- **`frontend/tela-graficos.ts`** — `<viab-tela-graficos>`: pizza de composição de custos em **SVG autocontido** (com flag para excluir terreno) + barras Receita×Custos. Sem dependência de `urbi-grafico-*`.
- **`frontend/viab-format.ts`** — formatadores compartilhados (R$, número, %).
- **`tela-estudo`**: abas agora **preservam o DOM** (toggle por `?hidden`, não recriação) — atende §6.4 (estado transiente dos cenários sobrevive à troca de aba). Proforma/Gráficos recebem `.estudo`.
- **Demo**: seed enriquecido com defaults de premissas para a Proforma exibir números realistas.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 60→75KB) · test 15/15 ✓ · build:demo ✓ (81→99KB) · empacotar ✓.

---

## Estado anterior: Etapa 5 — ✅ CONCLUÍDA

### Feito (Etapa 5 — engine de Proforma + Premissas + KPIs + Preço Sugerido)
- **`frontend/proforma.ts`** — engine pura `calcularProforma(estudo)` para Loteamento e Incorporação (§6.2): áreas, VGV (áreas fechadas na Inc; área vendável líquida no Lot), deduções (imposto/RET, corretagem, marketing, permutas financeiras), custos diretos (terreno, infra/construção/decoração/gestão, projetos, outorga, registro, manutenção, contingências) e indiretos, resultado + margem, KPIs (eficiência, custo obras/VGV, ROI, margem bruta, nº unidades, preço médio). `precoSugeridoM2()` por bisseção sobre o piso de resultado final (§1).
- **`frontend/proforma.test.ts`** — 7 testes com números conferidos à mão (Lot completo, RET, terreno desconsiderado, Inc VGV, preço sugerido). **Total 15/15 verdes** (script `test` agora varre `frontend/` também).
- **`frontend/tela-premissas.ts`** — `<viab-tela-premissas>`: formulário completo por tipo (terreno, produto/áreas, custos com toggles infra/projetos, impostos+RET, permuta física com toggle), **KPI grid ao vivo** (§5.2, com cor verde/vermelho por benchmark) e **Preço Sugerido/m²** recalculados a cada digitação; Salvar via PATCH (conversão numérica). Integrado na `tela-estudo` (substitui o mini-form da Etapa 4).
- **Interpretações documentadas** no topo de `proforma.ts** (onde §4.4/§6.2 se contradizem): custo do terreno × área do terreno; obras = infra (Lot) / construção+decoração+gestão (Inc); projetos/licenciamento % sobre VGV.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 47→60KB) · test 15/15 ✓ · build:demo ✓ (66→81KB) · empacotar ✓.

---

## Estado anterior: Etapa 4 — ✅ CONCLUÍDA

### Feito (Etapa 4 — frontend: dashboard + detalhe + config)
- **`frontend/viabilidade-api.ts`** — wrapper sobre `window.urbiVerso.api` (APP `/viabilidade`) com todas as chamadas: estudos (CRUD/duplicar/status), membros, imóveis, benchmarks, config, glebas/lotes, `listarUsuarios` (via `/shell/apps/viabilidade/roles/usuarios`).
- **`frontend/viab-shared.ts`** — estilos base (tema escuro por tokens `var(--cor-*)`), labels de status/tipo, badges, botões, tabela, modal, `formatarData`.
- **`frontend/index.ts`** — `<app-viabilidade>` com roteamento por sub-rota (`/`, `/terrenos`, `/detalhe/{id}`) via `urbiVerso.subRota()`/`escutarRota`.
- **`frontend/tela-dashboard.ts`** — abas Estudos/Terrenos, tabela filtrável (tipo/status), criar (modal), duplicar, remover. Aba Terrenos avisa que o Núcleo está indisponível → usar modo manual.
- **`frontend/tela-estudo.ts`** — detalhe com abas Premissas/Proforma/Gráficos; botões de transição de status conforme `_permissao` (submeter/aprovar/reprovar/devolver/reabrir); painel de membros (add/mudar função/remover); formulário de Premissas inicial (subconjunto editável com Salvar via PATCH). Proforma/Gráficos são placeholders (Etapas 5/6).
- **`frontend/viabilidade-config-benchmarks.ts`** — `<viabilidade-config-benchmarks>` (manifesto `telas_config`): tabela editável por tipo, criar/remover/semear indicadores padrão.
- **Decisão de robustez:** componentes **autocontidos** (HTML puro + CSS por tokens), sem depender das APIs dos componentes `urbi-*` (não verificáveis offline). Adotar `urbi-tabela`/`urbi-kpi`/`urbi-abas` etc. quando houver instância rodando.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 17→47KB) · test 8/8 ✓ · empacotar ✓.
- ⏳ **Verificação em runtime pendente** — a UI não foi exercitada contra uma instância UrbiVerso real (o "teste na interface"). Offline validei por typecheck+build+empacotamento.

---

## Estado anterior: Etapa 3 — ✅ CONCLUÍDA

### Feito (Etapa 3 — benchmarks + config + Núcleo stub)
- **`backend/rotas/benchmarks.ts`** — CRUD admin-only (`nivelApp === 'admin'` = role aprovador): `GET /benchmarks` (leitura liberada a qualquer usuário da app), `POST`/`PATCH /:id`/`DELETE /:id` (admin), `POST /benchmarks/semear` (idempotente, cria os indicadores padrão §4.6 que faltam). Unicidade `[tipo_empreendimento, campo]` tratada (409). Indicadores padrão: `resultado_final`(piso), `margem_bruta`, `margem_liquida`, `roi`, `custo_obras_vgv`(teto); `eficiencia_aproveitamento` só Loteamento.
- **`backend/rotas/config.ts`** — `GET /config` expõe os 6 parâmetros da app (§6.5) via `req.parametros.obter` para o frontend pré-preencher defaults.
- **`backend/rotas/nucleo.ts`** — proxy `GET /nucleo/glebas|lotes|imoveis/:id` com **degradação graciosa** (`disponivel: false`). Motivo: este Núcleo **não tem** glebas/lotes (nem rota REST nem `req.nucleo.listar` — confirmado por grep em `nucleo/`; SDK v0.50.3 declara essas entidades como futuras). Frontend cai no modo manual. `permissoes_nucleo` segue vazio (install seguro).
- **Testes:** `benchmarks.test.ts` (3) + `estudos.test.ts` (5) = **8/8 verdes**.
- **Validado (verde):** typecheck ✓ · build ✓ (827→832KB) · test 8/8 ✓ · empacotar ✓.
- ⚠️ **Discrepância da spec:** §2 diz "editor edita benchmarks", mas §6.8 + schema `acesso_externo: restrito` dizem admin-only. Segui **admin-only** (aprovador). Revisar com o autor se necessário.

---

## Estado anterior: Etapa 2 — ✅ CONCLUÍDA

### Feito (Etapa 2 — permissão por estudo + rotas customizadas)
- **`backend/permissoes-estudo.ts`** — 4ª camada (membership) espelhando `permissoes-ciclo.ts` do OKR. `resolverPermissaoEstudo` lê `estudo_membros`; gates `exigirMembro`/`exigirEditor`/`exigirAprovador` (aprovador ⊇ editor ⊇ leitor; admin de app age como aprovador; estudo sem membros → escrita+ assume editor); `garantirMembro` idempotente.
- **`backend/eventos-viabilidade.ts`** — `publicarEvento` (best-effort, chave nua; shell prefixa `app.viabilidade.`), `inscreverMembroEstudo`/`desinscreverMembroEstudo` (inscrição **forte** filtrada por `estudo_id`; editores/aprovadores também seguem `apelo_comercial_concluido`), payload builders batendo exatamente com os `campos` do manifesto §6.9.
- **`backend/identificacao.ts`** — `id_legivel`/`nome_exibicao`/`sequencia` (§6.1). Template `{SIGLA} - {nome} - {UF} - {seq}`; sequência incrementa por `tipo_empreendimento` (conta removidos p/ não reusar); slug sem acentos/espaços.
- **`backend/rotas/estudos.ts`** — `POST /estudos` (cria + criador vira editor + evento `estudo_criado`), `GET /estudos` (filtrado por membership; admin vê tudo; leitor não vê rascunho/arquivado), `GET /estudos/:id` (detalhe + membros + imóveis + flags `_permissao`), `PATCH /estudos/:id` (editor+; travado em aprovado/reprovado/arquivado → só aprovador; `tipo_empreendimento` só em rascunho), `DELETE` (soft delete via `remover`), `POST /:id/duplicar` (copia campos+imóveis, novo id_legivel, evento), `POST /:id/status` (matriz de transição `gateTransicao` + evento `estudo_status_alterado`).
- **`backend/rotas/membros-estudo.ts`** — GET/POST/PATCH função/PATCH remover (editor+; reconcilia inscrições).
- **`backend/rotas/imoveis-estudo.ts`** — GET/POST/DELETE vínculo imóvel↔estudo; **editável só em Rascunho**; consistência tipo (loteamento→1 gleba, incorporação→N lotes).
- **`backend/rotas/estudos.test.ts`** — 5 testes da matriz de transição de status (todos passam).
- **Validado (verde):** `pnpm typecheck` ✓ · `pnpm build` ✓ (backend 812→827KB) · `pnpm test` ✓ (5/5) · `pnpm run empacotar` ✓.
- ⏳ **Verificação em runtime contra o shell fica pendente** — exige o app instalado numa instância UrbiVerso (o teste na interface que o usuário mencionará). Offline validei por typecheck+build+testes+empacotamento.

---

## Estado anterior: Etapa 1 — ✅ CONCLUÍDA

### Feito (Etapa 1 — schema.json + manifesto.json reais)
- **`schema.json` completo** com as 6 tabelas da spec §6.1, todas `acesso_externo: "restrito"`:
  - `estudos` (`soft_delete: true`) — meta/identidade (`id_legivel` único, `nome_exibicao`, `nome`, `tipo_empreendimento`, `uf`, `sequencia`, `nivel_analise`, `status`, `autor_id`), terreno (`origem_terreno` nucleo/manual + `terreno_manual_nome`/`terreno_manual_area`), produto (preços/m², coeficientes, áreas PVT R/NR aberta/fechada, %s da gleba), custos diretos/indiretos com toggles de modo (`infra_modo`, `projetos_modo`, `licenciamento_modo`, `permuta_fisica_modo`), impostos/RET, permutas e overrides de sensibilidade.
  - `estudo_imoveis` (junção N:M, `imovel_nucleo_id` inteiro = ref. lógica; `tipo_imovel` gleba/lote; único `[estudo_id, imovel_nucleo_id]`), `estudo_membros` (funcao leitor/editor/aprovador; único `[estudo_id, usuario_id]`), `benchmarks` (único `[tipo_empreendimento, campo]`), `apelo_comercial` (6 scores + `score_geral` + `resultado` json), `apelo_comercial_documentos` (`arquivo` com mimes PDF/DOCX/XLSX).
- **`manifesto.json` completo**: roles (leitor/editor/aprovador com stickers), `nav` (Estudos, Terrenos), `ia: true`, `telas_config.benchmarks`, `parametros` (§6.5 — impostos/RET/corretagem/marketing/indiretos/prazo arquivamento), `eventos` (§6.9 — `estudo_criado`, `estudo_status_alterado`, `apelo_comercial_concluido`).
- **Validado (verde):** JSON parse ✓ · `pnpm typecheck` ✓ · `pnpm build` ✓ · `pnpm run empacotar` ✓ → `dist/viabilidade-0.1.0.urbiapp.tgz` (schema+manifesto aceitos pelo empacotador).

### Decisões da Etapa 1 (reconciliação com a realidade)
- **Núcleo declarado vazio no MVP:** `dependencias_nucleo: []`, `permissoes_nucleo: {}`. Motivo: o módulo `imoveis`/`gleba`/`lote` da spec §6.6 **não existe** na instância real (só há `empreendimentos` e `unidades`); declarar dependência de módulo inexistente arriscaria travar o registro/instalação do app na interface. **Decisão do usuário:** o app aceita terreno do Núcleo **e** manual; no MVP tudo funciona pelo modo `manual` (nome+área digitados) e o schema já está preparado (`origem_terreno`, `estudo_imoveis.imovel_nucleo_id`) para quando houver conexão real — bastará adicionar dependência + rotas-proxy, **sem migração de schema**. Ver `[[nucleo-imoveis-nao-existe-usar-manual]]`.
- **`permissoes_nucleo` usa string** (`"leitura"`), não array `["ler"]` como na spec — corrigido conforme apps reais (`visualizador`, `fabrica`).
- **Percentuais de input unificados em `decimal(5,2)`** (não `inteiro` como diz §6.1). Motivo: vários defaults da spec são fracionários (imposto 6,73% arredondado p/ 7, projetos 1,6%, incorporação/registro 0,25%, gestão indiretos 1,25%); `inteiro` zeraria/corromperia esses valores. Monetários e áreas em `decimal(12,2)`, scores do apelo em `decimal(3,1)`, conforme spec.
- **`nivel_analise` usa `"avancado"` sem acento** (slug seguro para filtros de API), em vez de `"avançado"`.

---

## Estado anterior: Etapa 0 — ✅ CONCLUÍDA

### Feito
- **Reconhecimento** das docs do shell: `overview`, `banco-de-dados`, `permissoes`, `ui`, `barramento` (eventos), `agentes` (IA/usuários), `documentacao`. Apps modelo lidas: `okr` (membership `ciclo_membros`, status, rotas modulares, web component Lit) e `recrutamento` (bloco `ia` no manifesto).
- **Scaffold** criado na estrutura-alvo do README:
  - `manifesto.json` (placeholder mínimo válido — roles leitor/editor/aprovador), `schema.json` (`{ "tabelas": {} }`)
  - `backend/rotas.ts` (Router vazio + `import '@urbiverso/sdk/express'`), `frontend/index.ts` (`<app-viabilidade>` esqueleto Lit)
  - `package.json` (build canônico esbuild + `@urbiverso/sdk@0.50.3` + `@types/express`/`@types/node`), `tsconfig.json` (Lit decorators), `.npmrc`, `.gitignore`, `pnpm-workspace.yaml`
  - `migracoes/` (vazio — schema.json é o genesis), `docs/spec/estudo-de-viabilidade-spec.md` (spec movida), `docs/viabilidade/` (docs do app na Etapa 7)
  - `.github/workflows/release.yml` (adaptado para repo de app única, tag `viabilidade-v<x.y.z>_<sha8>`)
- **Ambiente resolvido e toolchain validado (tudo verde):**
  - `pnpm` 11.11 instalado (`npm i -g pnpm`); PAT `read:packages` em `~/.npmrc` → `@urbiverso/sdk@0.50.3` resolve.
  - `pnpm install` ✓ · `pnpm run typecheck` (`tsc --noEmit`) ✓ · `pnpm build` (esbuild) ✓ → `frontend/index.js` (17KB) + `backend/rotas.js` (812KB, self-contained).
  - `pnpm exec urbi-empacotar` ✓ → `dist/viabilidade-0.1.0.urbiapp.tgz` + `.sha256` (scaffold aceito pelo empacotador).

### ⚙️ Notas de ambiente (importante para próximas sessões)
- **`onlyBuiltDependencies` do pnpm 11 mora no `pnpm-workspace.yaml`** (o campo `pnpm` do `package.json` foi ignorado). Usei `allowBuilds: { esbuild: true }` (pnpm 11) + `onlyBuiltDependencies: [esbuild]` (pnpm 10/CI) para o esbuild baixar o binário nativo.
- **`urbi-empacotar` no Windows: rodar pelo PowerShell, não pelo Git Bash.** O GNU tar 1.35 do Git Bash trata `C:\...` como host remoto e quebra (`Cannot connect to C:`); o PowerShell resolve `tar` para o **bsdtar** do System32, que funciona. Na CI (Linux) não há problema.
- PAT do GitHub foi exposto no chat — **usuário deve rotacioná-lo** após concluir.

---

## Descobertas importantes (reconciliar nas próximas etapas)

- **Núcleo diverge da spec/plano.** O plano assume supertipo `imoveis` (subtipos `gleba`/`lote`/`unidade`), campo `area`, relação `lote→parcelamento`, leitura via permissão `imoveis:["ler"]`. Mas em `urbiverso/nucleo/backend/src/rotas/` **não existe** rota `imoveis`/`gleba`/`lote` — há `empreendimentos`, `unidades`, `pessoas`, `entidades`, `perfis-sociais`, `tarefas`, `tipos-tarefa`. E `nucleo/docs` está **vazio** (não há `nucleo.md`). → **Antes das Etapas 2/3, ler `nucleo/backend/src/rotas/*.ts` e validar o contrato real contra a instância dev.** Risco #2 do plano confirmado.
- **Já existe um protótipo `apps/analise_viabilidade` no monorepo** (v0.1.0): usa tabela própria `terrenos` (não consome o Núcleo, `dependencias_nucleo: []`), com `estudos`, `cenarios`, `benchmarks`, workflow rascunho→pendente→aprovado/rejeitado e ~30 campos `res_*` de proforma no schema. É uma **referência de fórmulas/campos de proforma** muito útil para as Etapas 5/6, embora o desenho-alvo (membership por estudo, consumo do Núcleo, IA de apelo comercial) seja diferente/mais amplo.
- **Permissão por estudo** (Leitor/Editor/Aprovador por estudo) deve espelhar `ciclo_membros`/`permissoes-ciclo.ts` do `okr` (Etapa 2).

---

## Demonstração estática (GitHub Pages)
- **`index.html`** (raiz) + **`demo/demo.ts`→`demo/demo.js`** (bundle versionado) + **`demo/mock.ts`** (mock de `window.urbiVerso` com backend fake em memória: estudos/membros/imóveis/benchmarks seed, roteamento por hash, toasts). Reusa os componentes reais do frontend.
- **`.nojekyll`** na raiz; script `pnpm run build:demo` (esbuild bundla lit inline, self-contained).
- Permite navegar todo o frontend sem shell/backend. Habilitar Pages: Settings → Pages → Deploy from branch → `main` / root.
- ⚠️ Não substitui teste real: dados fictícios, sem cálculo de Proforma (Etapas 5/6), sem `urbi-*` reais.

## Próximos passos
- **Spec anotada como documento vivo:** `docs/spec/estudo-de-viabilidade-spec.md` ganhou a seção **“0. Status de Implementação (MVP v0.1.0)”** (cobertura por seção, decisões/ajustes de rota, pendências de ambiente) e o **backlog técnico** foi consolidado no §8. Base para encadear as próximas versões.
- **MVP completo (Etapas 0–7).** O app empacota e roda (backend + frontend + docs). Falta apenas **teste em runtime numa instância UrbiVerso real** — nada foi exercitado contra o shell; validação offline foi typecheck + build + 15 testes de unidade + empacotamento + demo estático no Pages.
- Ao instalar numa instância: validar fluxo ponta a ponta (criar/membros/status/proforma/benchmarks/IA), habilitar o framework de IA para a app (slot), e ligar o arquivamento a uma rotina/agendador.
- Considerar bump de versão (`0.1.0` → release) e rotação do PAT exposto na Etapa 0.

## Pendências de etapas anteriores (rastreadas)
- **Arquivamento automático 30 dias (§3)** — regra de backend não implementada; exige contrato de agendamento do shell (`req.eventos.agendar`/rotina). Fazer na Etapa 7.
- **Filtro Núcleo** (excluir Fazenda Paranoazinho / lotes em parcelamento) — bloqueado (Núcleo desta instância sem glebas/lotes). Ver [[nucleo-imoveis-nao-existe-usar-manual]].

### Descoberta (Etapa 2) — glebas/lotes existem no Núcleo via `req.nucleo`
Os tipos do SDK (`node_modules/@urbiverso/sdk/dist/express.d.ts`, `type EntidadeBatch`) listam `glebas`, `lotes`, `parcelamentos`, `unidades` como entidades do Núcleo acessíveis por `req.nucleo` (`batch`, `chamarSubrecurso`, `buscarPorChave`). Ou seja: **glebas/lotes existem** como entidades — só não há supertipo `imoveis` nem rota REST dedicada em `nucleo/backend/src/rotas/`. Isso **refina** (não invalida) a decisão da Etapa 1: MVP segue manual; a integração "Buscar terreno" usará `req.nucleo` e `permissoes_nucleo: { glebas: "leitura", lotes: "leitura" }`. Ver `[[nucleo-imoveis-nao-existe-usar-manual]]`.

## Pendências v2 (fora do MVP)
- Nível "Avançado" do estudo (dimensão temporal). MVP é só "Preliminar".
- Layout definitivo dos relatórios PDF/Excel (referência visual do autor ainda não fornecida).
