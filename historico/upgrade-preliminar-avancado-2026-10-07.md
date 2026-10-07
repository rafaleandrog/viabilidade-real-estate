# Upgrade Preliminar → Avançado — estudo do cenário (2026-10-07)

> Fotografia datada, escrita contra a `main` em `c8fcbbb`. Responde ao pedido do autor: *"estuda o
> cenário para tornar possível a evolução do estudo Preliminar para Avançado… hoje vejo que o melhor é
> que haja um botão que gere uma cópia já previamente preenchida"*. Não muda código, schema nem
> migração. O que decide é o autor; o que este documento faz é confrontar a ideia com o código e com o
> histórico de issues e PRs, apontar onde a issue #833 já está certa, onde está incompleta ou errada,
> e propor a fila de PRs.

## 1. O que o histórico já decidiu, e por que o botão é o caminho certo

Três decisões anteriores fecham as alternativas e deixam só uma em pé.

| Alternativa | Estado | Evidência |
|---|---|---|
| **Promover no lugar** (trocar `nivel_analise` do mesmo estudo) | **Fechada.** `nivel_analise` é imutável por desenho: `422 NIVEL_IMUTAVEL` em `montarPatchEstudo` (`backend/rotas/estudos.ts`), com teste de regressão (PR 519, #486). A razão de fundo é que os dois níveis têm estruturas de dados diferentes (Premissas em colunas de `estudos` × catálogo/alocações/custos em tabelas filhas), e trocar o nível deixaria o mesmo registro com duas camadas descrevendo projetos diferentes — exatamente o incidente da #441 (Δ de R$ 17–23 MM entre abas do mesmo estudo). | #441, #486, PR 519 |
| **Compartilhar premissas** (o Avançado deriva do Preliminar ao vivo, §4.3 de `referencia/padrao-incorporacao.md`) | **Fechada na prática.** A #88 removeu a aba Premissas do Avançado; a #441 decidiu "derivar, não persistir" e a #832 mostra que a última invariante que ainda compara as duas camadas é um falso positivo garantido. O Avançado hoje não lê nenhum campo de premissa do Preliminar além de terreno, coeficientes e RET. | #88, #441 (comentário de 2026-08-24), #832 |
| **Duplicar preservando o nível** (`POST /estudos/:id/duplicar`) | **Existe e é robusto**, mas copia o nível. É a infraestrutura certa para reaproveitar: `montarCopiaEstudo`, `FILHAS_SIMPLES`, `montarCopiasFilhas`, compensação por remoção quando uma filha falha, coerção numérica na fronteira (PRs 626, 714; #609, #634). | #609, #634, #714 |
| **Gerar um Avançado NOVO, pré-preenchido** | **É a #833**, aberta hoje pelo autor com mapeamento campo a campo levantado na Pinguim (estudos 19–22). | #833 |

Conclusão: **o botão que gera uma cópia Avançada pré-preenchida é a única alternativa coerente com
as decisões já tomadas**, e a #833 já é o lugar certo para ela. O que falta não é convencimento, é
fechar o desenho — o mapeamento tem lacunas que o código revela e que a issue não cobre.

## 2. O que a #833 acerta

- Dois estudos distintos, Preliminar intacto. Coerente com #441/#486.
- Não copiar as 12 colunas `permuta_fisica_*` / `permuta_fisica_nr_*`. Coerente com a Decisão 1 da
  #441 e necessário para não disparar `CAMADAS_DIVERGEM_PERMUTA_FISICA` (#832).
- Criar as três linhas obrigatórias no próprio upgrade (#813).
- Sem transação: compensar removendo o estudo novo, como o `duplicar`.
- A tabela de unidades aceitas por categoria está certa: confere com `UNIDADES_CAT` em
  `frontend/tela-fluxo-custos.ts` (Construção só `rs`/`rs_m2_priv`; Registro só `rs`/`rs_m2_priv`;
  Projetos `rs`/`rs_m2_priv`/`pct_constr`; Gestão da obra `rs`/`pct_obra`; Corretagem só `pct_vgv`).

## 3. O que a #833 erra ou não cobre — achados desta leitura

Cada item abaixo muda o número do estudo gerado ou o desenho da rota. Estão em ordem de impacto.

### 3.1 A base do "% do VGV" é diferente nos dois níveis

No Preliminar, `vgv` em `calcularProforma` (`frontend/proforma.ts`) é o VGV **líquido de permuta
física** (`vgvResidencial + vgvNaoResidencial`, cada um já menos a permuta capada). Corretagem,
marketing, manutenção, contingência, gestão de indiretos, incorporação/registro e imposto incidem
sobre ele. No Avançado, `ctx.vgvTotal` em `fluxo-caixa-motor.ts` é `Σ vgvLinha(tipologias)`, o VGV
**bruto, com a permuta física dentro**. Copiar "5% do VGV" como `pct_vgv` muda o valor em todo
estudo com permuta física.

Duas saídas, e são decisão do autor (é a mesma classe da decisão 1 da #833):

- **(a) manter o percentual** — a premissa continua viva e editável; o número muda pela convenção
  do Avançado, e o relatório do upgrade declara a diferença;
- **(b) congelar em R$** (`orcamento_valor_canonico`) — o número é preservado, a premissa vira
  valor absoluto.

Para a **Corretagem** há um terceiro caminho, e ele é o único sem perda: `corretagem_sobre_permuta_fisica = false`
(#473) faz o motor usar `vgvVendidoVendavelMensal`, a mesma base líquida do Preliminar. **O upgrade
deve gravar `false`** nessa coluna — o default do schema é `true`, que reproduz a base bruta.

### 3.2 Área aberta na Incorporação: ratear nas tipologias quebra o critério 2 da issue

A #833 manda ratear `area_pvt_*_aberta` entre as tipologias da família. Mas:

- no Preliminar a área aberta **fica fora do VGV**: a base dos produtos é só a fechada
  (`baseProdutosM2` → `areaPrivativaFechadaIncorporacao`), e `vgvProduto` = área média × preço ×
  unidades, com a área média derivada dessa base;
- no Avançado `vgvUnitarioTipologia` (`fluxo-shared.ts`) soma `area_privativa_m2 × preço +
  area_privativa_aberta_m2 × preço` — **a aberta vende a preço cheio** (decisão #584).

Logo, ratear a aberta em `area_privativa_aberta_m2` faz o VGV do Avançado exceder o do Preliminar
em Σ aberta × preço, e o critério de aceite 2 ("VGV igual, tolerância de arredondamento") fica
falso por construção. Não ratear preserva o VGV mas perde a área aberta — e aí o custo de
construção em `rs_m2_priv` (base `areaPrivativaTotalLinhas`, fechada + aberta) sai menor que o do
Preliminar, que multiplica `custo_construcao_m2` pela área privativa total (fechada + aberta).

Não há mapeamento que preserve VGV **e** construção ao mesmo tempo. Recomendação: **ratear a aberta
(proporcional à fechada, dentro da família) e reescrever o critério 2** — "VGV igual quando não há
área aberta; com área aberta, a diferença é exatamente Σ aberta × preço e é declarada no relatório
do upgrade" — porque esconder a área aberta para fazer um número bater seria inventar uma convenção
que nenhum dos dois níveis tem. Decisão do autor.

### 3.3 `estudo_documentos` não é copiado pelo `duplicar`

A linha "Imagem (`estudo_documentos`) … direto (como no `duplicar`)" está errada: o `duplicar`
**não copia** `estudo_documentos` nem `apelo_comercial_documentos` (`FILHAS_SIMPLES` e
`docs/modelo-de-dados.md`, § "O que a duplicação de estudo copia"). O binário é do shell; duas
linhas sobre o mesmo arquivo deixam a exclusão de uma levar o arquivo da outra. A decisão está
pendente desde o PR 626. O upgrade deve seguir o `duplicar` — **sem** documentos — até o autor
decidir, ou a issue precisa de um verbo do SDK para duplicar o binário (conferir no bundle
`node_modules/@urbiverso/sdk/docs/`, nunca no monorepo).

### 3.4 O plano de pagamento do grupo nasce "não migrado" se for criado no servidor

O grupo de receita padrão que o upgrade cria recebe `fluxoPagamentoPadrao()` (legado: `entrada`,
`parcelas`, `repasse`). Quem o converte para o contrato canônico `componentes` é
`planoDeNascimento` (`frontend/fluxo-pagamento-editor.ts`), chamado **só pela tela**, em
`_adicionarFase`. Um grupo criado pelo servidor fica com o badge **Plano não migrado** até o
usuário aplicar o Fluxo de Pagamento, e o atalho "À vista, mês único" fica indisponível
(`docs/avancado.md`). Duas saídas: o upgrade chama `planoDeNascimento` no servidor (o backend já
importa módulos do frontend — `fluxo-shared.js`, `fluxo-pagamento-contrato.js`, `proforma.js`),
ou a issue declara o estado "não migrado" como esperado. A primeira é a certa: o estudo nasce no
contrato vigente.

### 3.5 Permuta financeira: R e NR com percentuais diferentes não cabem numa linha

No Preliminar a permuta financeira é por tipo (`permuta_financeira_residencial_pct` sobre o VGV
residencial, `_nao_residencial_pct` sobre o NR). No Avançado é uma linha `terreno / Preço /
Permuta financeira` em `pct_vgv` sobre o VGV total. Quando os dois percentuais são iguais (ou um é
zero), uma linha em `%` basta; quando diferem, ou se congela em R$ (soma dos dois canônicos) ou se
criam duas linhas com a mesma subcategoria — o que `validarCustosDuplicados`
(`fluxo-invariantes.ts`) acusa como alerta na Reconciliação. Recomendação: **uma linha; `pct_vgv`
se os percentuais coincidem, R$ canônico se diferem**, declarado no relatório.

### 3.6 Gestão da obra em `pct_obra` muda de base de verdade

`taxa_gestao_pct` no Preliminar incide sobre construção + decoração. `pct_obra` no Avançado incide
sobre o grupo Obras inteiro menos as linhas em `pct_obra` — inclui **Outorga e Contingência**
quando estão nesse grupo. Como a Contingência do Preliminar (% do VGV) migra para `obra /
Contingência` em `pct_vgv`, a gestão passa a incidir também sobre ela. É a decisão 3 da #833;
a leitura do código diz que a diferença não é teórica. Recomendação: **manter `pct_obra`** (a
premissa fica viva) e declarar a diferença — a alternativa em R$ congela um custo que o usuário
vai querer ver escalar quando ajustar a construção no Avançado.

### 3.7 Imposto fora do RET depende da #834 — ordem da fila

Estudo Preliminar com `sujeito_ret = false` usa `imposto_percentual` (padrão 7%). O Avançado só
tem `considerar_ret` + `ret_pct`. Sem a #834, o upgrade de um estudo fora do RET gera um Avançado
**sem imposto**, resultado superestimado em ~7% da receita, e nada acusa. Marcar RET com a
alíquota do presumido faz o rótulo mentir (é o caso do estudo 22 da Pinguim). **A #834 vem antes
da #833 na fila**, ou o upgrade de estudo fora do RET grava um alerta e deixa o imposto por
preencher — pior, porque é o caminho silencioso que a #834 descreve.

### 3.8 Loteamento: `tipo_unidade` e a base da infraestrutura

- `avancado_tipologias.tipo_unidade` tem `padrao: 'apartamento'`; a tela de Tipologias do
  Loteamento esconde o seletor. O upgrade de Loteamento deve gravar **`lote`** (existe nas `opcoes`
  do schema, não na lista `TIPOS_UNIDADE_INC` da tela — e não precisa estar).
- Infraestrutura em `valor_m2` (R$/m² da ALV) mapeia **direto** para `obra / Construção` em
  `rs_m2_priv`: no Avançado `areaPrivativaTotalLinhas` do Loteamento é Σ área × unidades das
  tipologias = ALV quando os produtos somam 100%. Só `pct_vgv` precisa congelar em R$ (decisão 1 da
  #833). `valor_fixo` é `rs` direto.
- Estudo Preliminar de Loteamento não tem construção, decoração, gestão da obra nem registro
  (`lot ? 0 : …` em `calcularProforma`): essas linhas não são criadas, e a linha obrigatória
  **Construção** recebe a infraestrutura.

### 3.9 Permuta física m² → unidades: regra proposta

Por família (R → tipologias cuja origem é produto `residencial`; NR → `nao_residencial`; no
Loteamento tudo é residencial), a área canônica (`permuta_fisica_area_canonica`, ou o derivado
legado quando nula — a mesma leitura de `calcularProforma`) é dividida pela área média da
tipologia **de maior quantidade** da família, arredondada **para o inteiro mais próximo**, com teto
nas unidades alocadas (a regra do Avançado desde a #792: permutadas ⊆ alocadas). O resíduo em m²
vai para o relatório do upgrade. Com mais de uma tipologia na família, a escolha é "maior
quantidade" porque minimiza o resíduo relativo; alternativa (distribuir proporcionalmente) cria
várias linhas de permuta e fragmenta. Decisão 2 da #833 — recomendo esta regra.

### 3.10 Rastreabilidade sem coluna nova

Não há coluna para "estudo de origem". Acrescentar `estudo_origem_id` é mudança de schema
(migração + bump de `versao`, § Versão do manifesto do `CLAUDE.md`). Para a primeira versão,
recomendo registrar a origem e o relatório de conversões em texto — `notas` do estudo novo, com
cabeçalho datado — e deixar a coluna para uma issue própria se a necessidade aparecer. É a mesma
economia que o `duplicar` faz.

## 4. Mapeamento consolidado (corrige e completa a tabela da #833)

| Preliminar | Avançado | Regra | Nota |
|---|---|---|---|
| Colunas de identidade, terreno, coeficientes, `notas`, `descricao`, `matricula`, `regiao_mercado_id`, `tem_pre_lancamento` | mesmas colunas | `montarCopiaEstudo` menos as 12 colunas de permuta física; `nivel_analise = 'avancado'`, `status = 'rascunho'` | as colunas de custo do Preliminar viajam juntas e ficam inertes — é o que o `duplicar` já faz, e é rastreabilidade de graça |
| `estudo_imoveis`, `preliminar_produtos`, `analise_mercado`, `apelo_comercial` | mesmas tabelas | como o `duplicar` (`FILHAS_SIMPLES`) | `preliminar_produtos` copiado **e** convertido: a cópia é a trilha do que gerou o catálogo; o Avançado não a lê (`produtosDoEstudo` devolve cru) |
| Produto (`tipo`, `pct_alv`, `unidades`, `preco_venda_m2`) | `avancado_tipologias` + uma alocação no grupo padrão | área fechada = base × pct ÷ unidades (`produtosComAreaDerivada`); `preco_m2` na tipologia e na alocação; `tipo_unidade`: `residencial` → `apartamento`, `nao_residencial` → `loja`, Loteamento → `lote` | § 3.2 para a aberta; só produtos que compõem catálogo (`produtoCompoeCatalogo`) |
| Grupo de receita | `avancado_fases` tipo `receita`, nome por `proximoNumeroFase`, `absorcaoPadrao`, plano canônico via `planoDeNascimento` | 100% do catálogo alocado | § 3.4 |
| Cronograma | nada a gravar | `lerCronograma` cai em `cronogramaPadrao()` | o usuário completa |
| `custo_terreno_m2` (se `considerar_custo_terreno`) | `terreno / Preço / Valor à vista`, `rs_m2_terreno` | direto | base: `terreno_manual_area` ou `area_terreno_nucleo` nos dois níveis |
| `custo_construcao_m2` / `construcao_valor_total` | `obra / Construção`, `rs_m2_priv` / `rs`, evento `obra` | direto | § 3.2 |
| `infra_*` (Loteamento) | `obra / Construção` | `valor_m2` → `rs_m2_priv`; `valor_fixo` → `rs`; `pct_vgv` → R$ congelado | § 3.8 |
| `custo_decoracao_m2` | `obra / Decoração`, `rs_m2_priv` | direto | |
| `taxa_gestao_pct` | `obra / Gestão da obra`, `pct_obra` | manter % | § 3.6 |
| `contingencias_pct` (se `considerar_contingencias`) | `obra / Contingência`, `pct_vgv` | decisão § 3.1 | |
| `projetos_*` | `diretos / Projetos` | `pct_constr` direto; `valor_fixo` → `rs`; `pct_vgv` → R$ congelado | |
| `incorporacao_registro_pct` | `terreno / Registro`, R$ congelado | só `rs`/`rs_m2_priv` | |
| `manutencao_pct` | `diretos / Manutenção pós-obra`, `pct_vgv` | decisão § 3.1 | nasce ancorada em `pos_obra` |
| `marketing_percentual` | `diretos / Marketing & Publicidade`, `pct_vgv` | decisão § 3.1 | |
| `corretagem_percentual` | linha obrigatória `diretos / Corretagem de vendas`, `pct_vgv` + `corretagem_sobre_permuta_fisica = false` | direto | § 3.1 |
| `stand_vendas_valor` (Loteamento) | `indireto / Stand de vendas`, `rs` | direto | |
| `gestao_indiretos_pct` (se `considerar_gestao_indiretos`) | `indireto / Gestão`, `pct_vgv` | decisão § 3.1 | |
| `sujeito_ret = true` | `considerar_ret = true`, `ret_pct = aliquota_ret_pct` da instância (`req.parametros.obter`) | direto | |
| `sujeito_ret = false` + `imposto_percentual` | depende da #834 | § 3.7 | |
| Permuta física R/NR | `terreno / Preço / Permuta física` (`permuta_tipologia_id` + `permuta_quantidade`), uma por família | § 3.9 | as 12 colunas de origem **não** viajam |
| Permuta financeira R/NR | `terreno / Preço / Permuta financeira` | § 3.5 | |
| Cascata de áreas do Loteamento, `sensibilidade_*`, benchmarks | sem correspondente | ficam só no Preliminar | |
| `estudo_documentos`, `apelo_comercial_documentos`, `estudo_membros` | não | como o `duplicar` | § 3.3 |

## 5. Desenho proposto

**Rota.** `POST /estudos/:id/derivar-avancado` (nome a confirmar; "promover" sugere troca no lugar,
que é o que não acontece). Pré-condições: estudo origem `nivel_analise !== 'avancado'`;
`exigirEditor` na origem e `nivelApp` `escrita`/`admin`, como o `duplicar`. Resposta `201` com o
estudo novo **e** um `relatorio: [{ origem, destino, regra, nota }]` — é ele que a tela mostra e que
vai para `notas`.

**Módulo próprio**, `backend/rotas/derivar-avancado.ts`, importando de `estudos.ts` e `avancado.ts`
(a direção inversa fecharia o ciclo que `duplicar-utils.ts` existe para evitar). Duas camadas:

1. **função pura** `planejarDerivacao(estudo, produtos, { aliquotaRet, cronograma })` → `{ copiaEstudo,
   tipologias, grupo, alocacoes, custos, relatorio }`, sem I/O. É onde moram os testes de número
   (VGV, área, as três obrigatórias, nenhuma coluna de permuta, `corretagem_sobre_permuta_fisica`);
2. **executor** que grava na ordem tipologias → grupo → alocações → custos (a permuta física
   precisa dos ids das tipologias e das alocações), reusando `coagirNumericosOuLancar`,
   `omitirValoresNulos`, `ancorarLinhaCusto` + `lerCronograma` (ancoragem das linhas, a mesma do
   `POST /custos`), `garantirMembro`, `inscreverMembroEstudo`, `publicarEvento`, dentro do
   `try/catch` compensatório do `duplicar`.

**Fiação.** Teste que lê o fonte da rota e exige a forma de chamada (`planejarDerivacao(`,
`corretagem_sobre_permuta_fisica`), no molde do PR 626 — apagar a chamada deixa os testes puros
verdes, e é a classe de defeito nº 1 do `CLAUDE.md`.

**Tela.** Um botão no cabeçalho do estudo Preliminar (`frontend/tela-estudo.ts`, ao lado de
Renomear e Membros), visível só com `nivel_analise !== 'avancado'` e permissão de editor:
**"Criar estudo Avançado a partir deste"**. Modal de confirmação listando o que vai e o que fica
por completar (cronograma, absorção, plano de pagamento, juros de tabela, funding, cenários); ao
confirmar, navega para o estudo novo em Empreendimento › Cronograma, com o relatório num banner.
Não entra na fila de ações do Painel — ela já foi espremida pela #680, e a ação é de um estudo
aberto, não de uma lista.

**Documentação no mesmo PR.** `docs/preliminar.md` (hoje diz "para levar um Preliminar adiante,
crie um estudo Avançado" — passa a descrever o botão), `docs/avancado.md` (§ Instruções para não
humanos: a rota e o relatório), `docs/modelo-de-dados.md` (uma seção irmã de "O que a duplicação
copia"). `referencia/padrao-incorporacao.md` § 4.3 tem a nota "NÃO EXISTE promoção de nível" com a
advertência *"se um caminho de promoção for criado…"* — ela é reescrita como comportamento vigente.

**Schema.** Nenhuma coluna nova, nenhuma migração, `versao` fica em `0.1.40`.

## 6. Fila de PRs proposta

Estritamente serial onde há arquivo compartilhado; um assunto por PR (R3).

| # | Issue | Escopo | Por que nesta posição |
|---|---|---|---|
| 1 | **#813 (a)** | semear as três linhas obrigatórias no servidor ao criar estudo Avançado, extraindo de `POST /custos` um `criarLinhaCusto(req, estudo, dados)` reusável | é o helper que o upgrade precisa; sozinho, fecha um bug P3 que a #833 cita como restrição |
| 2 | **#832** | aposentar (a) ou condicionar (b) `CAMADAS_DIVERGEM_PERMUTA_FISICA` | independente do upgrade, mas o critério 6 da #833 depende dela; e sem ela todo estudo gerado com permuta física nasce com alerta falso |
| 3 | **#834** | regime e alíquota fora do RET no Avançado | § 3.7: sem ela o upgrade de estudo fora do RET nasce sem imposto |
| 4 | **#833, backend** | `planejarDerivacao` + executor + rota + testes puros e de fiação + docs | depende de 1 e 3; toca `backend/`, então `validar-backend.sh` |
| 5 | **#833, tela** | botão, modal, banner do relatório, caso de render | depende de 4; pode ser o mesmo PR se o autor preferir um só |

Decisões que o autor precisa dar antes do PR 4, em comentário na #833 (as três dela mais quatro
desta leitura): (1) `% VGV` não aceito → R$ congelado [recomendo sim]; (2) permuta física → regra da
§ 3.9 [recomendo]; (3) gestão da obra → `pct_obra` [recomendo]; (4) base do `% VGV` para as linhas
que o Avançado aceita em % → manter % e declarar, com `corretagem_sobre_permuta_fisica = false`
[recomendo]; (5) área aberta → ratear e reescrever o critério 2 [recomendo]; (6) permuta financeira
R ≠ NR → R$ canônico numa linha [recomendo]; (7) rastreabilidade → `notas`, sem coluna nova
[recomendo].

## 7. Riscos e o que não dá para medir daqui

- **Pinguim é inalcançável deste ambiente** (403 no proxy): o critério 6 da #833
  (`conferir-estudo.ts` sobre o estudo gerado) e a comparação com os estudos 19–22 são do autor ou
  da skill `qa`, que não está configurada nesta sessão.
- **Produto legado sem `pct_alv`** segue com `area_media_m2` própria (`produtosComAreaDerivada`);
  o upgrade lê o catálogo por `produtosDoEstudo`, nunca o campo cru, e o teste precisa de um caso
  com linha legada.
- **Catálogo que não soma 100%** não barra o upgrade (só barra submeter), mas a área das tipologias
  então não fecha com a base — o relatório deve dizer.
- **`juros_tabela_aa_padrao` nulo** no estudo novo significa 0% de juros de tabela até o usuário
  preencher; o Preliminar não tem a grandeza. Declarar no modal.
