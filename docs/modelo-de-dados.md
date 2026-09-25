---
titulo: Modelo de Dados
descricao: As tabelas do app, o que cada uma guarda, as relações entre elas, o que a duplicação de estudo copia, as referências sem chave estrangeira e as regras de precisão.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Modelo de Dados

> Todas as tabelas têm `acesso_externo: "restrito"`: a escrita passa pelas rotas do app, que aplicam as regras de negócio e a permissão por estudo. Esta página descreve o que existe no banco hoje.

## Tabelas do estudo

| Tabela | O que guarda |
|---|---|
| `estudos` | O registro central (com `soft_delete`): identidade (`id_legivel`, `nome_exibicao`, `sequencia` por tipo), status, origem do terreno, área do terreno (`terreno_manual_area` quando manual; `area_terreno_nucleo` como soma das áreas dos imóveis do Núcleo) e todas as premissas do Preliminar (áreas, custos, impostos, permutas). Sete colunas antigas de "% da gleba" (`app_pct`, `faixas_nao_edificaveis_pct`, `sistema_viario_pct`, `elup_pct`, `epc_pct`, `epu_pct`, `areas_privativas_nao_vendaveis_pct`) continuam no schema sem escritor em tela nem leitor em fórmula — a cascata de áreas as substituiu; não as leia. |
| `preliminar_produtos` | O catálogo de Produtos do Preliminar — a única fonte do VGV. Só compõe catálogo a linha com `area_media_m2`, `preco_venda_m2` e `unidades` maiores que zero. `tipo` (`residencial` ou `nao_residencial`; sem valor conta como residencial) separa o cálculo por categoria na Incorporação. `GET /estudos` devolve a lista em `produtos` de cada estudo, para a listagem calcular VGV, resultado e margem. |
| `estudo_imoveis` | A junção N:M com os imóveis do Núcleo (`imovel_nucleo_id` como referência lógica; `tipo_imovel` gleba ou lote). Único por `[estudo_id, imovel_nucleo_id]`. |
| `estudo_membros` | A permissão por estudo (`funcao`: leitor, editor ou aprovador). Único por `[estudo_id, usuario_id]`. |
| `estudo_documentos` | Os anexos do Empreendimento (imagem principal, renders, plantas). |
| `apelo_comercial` | O resultado da avaliação por IA: `resultado` JSON, seis scores por fator e `score_geral`. |
| `apelo_comercial_documentos` | As fontes anexadas à avaliação (`documento`, `tipo_dado`, `texto_adicional`). |
| `analise_mercado` | O retrato de **mercado** do estudo: preço e custo por m², velocidade de vendas, macros (IPCA, Selic, INCC e Focus), `riscos` JSON, `abrangencia` (município, UF ou nacional), `origem` e `data_referencia`. Guarda só o lado mercado; o lado projeto é derivado do estudo ao renderizar, nunca persistido. Ver [Análise de Mercado](analise-mercado). |

**Colunas aposentadas de `estudos`:** `licenciamento_modo`, `licenciamento_pct` e
`licenciamento_valor_fixo` estão declaradas no schema desde a primeira versão, mas nenhuma tela as
oferece e o motor da Proforma nunca as leu — um valor gravado nelas pela API não entra em custo,
resultado ou indicador nenhum. Continuam no schema porque removê-las é mudança de schema
(migração e `versao`); não as use.

## Tabelas do Avançado

| Tabela | O que guarda |
|---|---|
| `avancado_cronograma` | Os eventos do cronograma por estudo (planejamento, pré-lançamento, lançamento, obra, pós-obra) com `inicio_mes` a partir de zero e `duracao_meses`. Único por `[estudo_id, evento]`. |
| `avancado_tipologias` | O catálogo de tipologias do estudo: nome, tipo de unidade, área privativa (fechada e aberta), dormitórios, vagas, `quantidade` (total de unidades) e `preco_m2` de referência. Desacoplado da receita. A coluna `unidades_permutadas` continua no schema, mas o app não a lê nem a escreve: a fonte da permuta física do Avançado é a linha de custo Preço / Permuta física. |
| `avancado_fases` | A fase de vendas, dona da **absorção** (`absorcao` JSON) e do **fluxo de pagamento** (`fluxo_pagamento` JSON). |
| `avancado_alocacoes` | A alocação de venda: `unidades` de uma `tipologia_id` numa `fase_id`, a um `preco_m2`. Pode haver várias por tipologia. A trava de saldo vale no estudo inteiro: Σ unidades alocadas da tipologia em todas as fases + Σ unidades em permuta física ≤ `quantidade` do catálogo. |
| `avancado_linhas_custo` | As linhas de custo, nos cinco grupos (terreno, obra, diretos, indireto, financeiro), com unidade de orçamento, valor canônico e ancoragem ao cronograma. |
| `avancado_funding_operacoes` | As operações de funding: `financiamento_producao` (uma por estudo), `divida` e `equity` (quantas quiser). Ver [Funding](funding). |
| `avancado_cenarios` | Os cenários simulados sobre o estudo (`nome`, `preco_venda_pct`, `custo_obra_pct`, `ordem`). |
| `avancado_linhas_receita`, `avancado_capital_instrumentos` | Tabelas de modelos anteriores, mantidas no schema sem leitor nem escritor no app. Não copie nem alimente. |

**Absorção** (`avancado_fases.absorcao`): modo distribuído em até quatro períodos —
`blocos: [{evento, pct}]` para `pre_lancamento` (só quando o Cronograma tem essa fase),
`lancamento`, `obra` e `pos_obra`. O percentual de pós-chaves é sempre derivado
(`100 − Σ dos três primeiros`), e o bloco `pos_obra` gravado é um espelho do valor efetivo, com
precisão plena; nada o relê.

**Fluxo de pagamento** (`avancado_fases.fluxo_pagamento`): o JSON legado mantém `comissao`,
`entrada` e `parcelas` como listas de linhas e `repasse: { apos_entrega_meses }`; o percentual do
repasse é derivado (`100 − Σ entrada − Σ parcelas`) e não é persistido — quem somar `entrada` e
`parcelas` pela API não fecha 100 % por construção. O mesmo campo aceita o contrato canônico
`componentes`: lista não vazia dos tipos `imediato`, `prazo_fixo`, `ate_marco` ou `concentrado`,
cujas `participacaoPct` fecham 100 %, com `taxaMensal` e `sinalPct` por componente. A tela grava os
componentes em toda escrita e preserva taxa e sinal que o espelho legado não sabe representar. Um
sub-objeto `ret` por linha pode existir em JSON antigo e está morto: a RET é global do estudo
(`estudos.considerar_ret` e `estudos.ret_pct`), e nada lê o `ret` do blob.

Integridade: excluir uma tipologia com alocações é recusado (`422 TIPOLOGIA_EM_USO`); reduzir a
`quantidade` do catálogo abaixo do já comprometido (alocações mais permuta física) é recusado
(`422 SALDO_EXCEDIDO`); editar nome ou área da tipologia reflete ao vivo nas alocações, que guardam
só unidades e preço.

## Tabelas da instância

| Tabela | O que guarda |
|---|---|
| `benchmarks` | Os valores de referência por tipo de empreendimento (`campo`, `valor`, `regra_comparacao`, `variacao_positiva_pct`, `variacao_negativa_pct`, `medidor_min`, `medidor_max`, `medidor_faixa1_ate`, `medidor_faixa2_ate`). Único por `[tipo_empreendimento, campo]`. Ver [Benchmarks](benchmarks). |
| `avancado_curvas` | As curvas de distribuição, globais da instância (a Curva S padrão e as criadas pelo administrador). |
| `mercado_regioes` | As regiões monitoradas (`nome`, `uf`, `palavras_chave`, `ativa`) e o estado da última coleta (`ultima_coleta_em`, `_status`, `_itens`, `_msg`). |
| `mercado_coletas` | O que a rotina diária guardou por região (`tipo`, `titulo`, `resumo`, `url`, `fonte`, `publicado_em`, `relevancia`, `bruto`). |

## O que a duplicação de estudo copia

`POST /estudos/:id/duplicar` cria o estudo novo com as colunas de `estudos` (menos as geradas pelo
shell) e depois copia as estruturas filhas. Se qualquer filha falhar, o estudo recém-criado é
removido — não há transação, e um clone pela metade é pior que nenhum.

| Estrutura | Copiada | Como |
|---|---|---|
| `estudo_imoveis` | sim | o vínculo com o imóvel do Núcleo |
| `preliminar_produtos`, `analise_mercado`, `apelo_comercial` | sim | linha a linha (o apelo leva scores e laudo, sem os documentos) |
| `avancado_cronograma`, `avancado_tipologias`, `avancado_fases`, `avancado_alocacoes`, `avancado_linhas_custo`, `avancado_cenarios`, `avancado_funding_operacoes` | sim | só quando o estudo é Avançado |
| `estudo_documentos`, `apelo_comercial_documentos` | não | o binário pertence ao shell; duas linhas sobre o mesmo arquivo deixariam a exclusão de uma levar o arquivo da outra |
| `estudo_membros` | não | é controle de acesso, não dado do estudo — o criador da cópia entra como `editor` |
| `avancado_linhas_receita`, `avancado_capital_instrumentos` | não | tabelas de modelos anteriores |

Nenhuma referência viva aponta para o original: `fase_ancora_id` (custos e operações de funding),
`tipologia_id` das alocações, `permuta_tipologia_id` das linhas de custo e a lista
`custo_linha_ids` das operações de funding são reapontados para a linha correspondente da cópia. Um
id sem correspondência é descartado enquanto sobrar id vivo na lista; uma lista inteira órfã volta
como veio, porque uma lista vazia ativaria a base financiável padrão e a cópia financiaria o que o
original não financia. `curva_id` copia direto, porque curvas são globais da instância.

## Referências lógicas — colunas de id sem chave estrangeira

Três colunas guardam id de outra linha sem FK no banco, cada uma por um motivo, e nenhuma deve ser
"corrigida" para `referencia`:

| Coluna | Por quê |
|---|---|
| `estudo_imoveis.imovel_nucleo_id` | o alvo vive no Núcleo, fora do schema do app |
| `estudos.permuta_fisica_produto_id` | quebra do ciclo com `preliminar_produtos` (abaixo) |
| `estudos.permuta_fisica_nr_produto_id` | idem |

`preliminar_produtos.estudo_id` aponta para `estudos` (obrigatório, em cascata). Se os dois
`permuta_fisica_*_produto_id` apontassem de volta, haveria um ciclo — e ciclo quebra a instalação
numa instância virgem: o sincronizador do shell emite a FK inline no `CREATE TABLE`, e num ciclo
não existe ordem de criação que satisfaça as duas pontas. A instalação virgem não roda migrações;
materializa tudo pelo `schema.json`, e é o único caminho que exercita essa ordem. A saída foi
soltar o lado fraco: os dois `*_produto_id` são inteiros. Eles são inertes hoje — a seleção de
produto saiu da sub-aba **Permutas**, que só aceita m² e % da área de venda, e o motor sempre consumiu
o canônico em m². Um guard no repositório impede a volta do ciclo.

## Regras de precisão

**Persistência** — o que a coluna guarda: R$ e m² em `decimal(12,2)` (o orçamento das linhas de
custo do Avançado e o valor das operações de funding em `decimal(15,2)`); percentuais de entrada em
`decimal(5,2)`; scores do apelo comercial em `decimal(3,1)`.

**Resultado** — o que o cálculo produz: todo valor monetário resultado de fórmula tem duas casas
decimais. `decimal(12,2)` já permitia centavos; a regra diz que o cálculo também é quantizado a
duas casas. O valor canônico de uma premissa multiunidade é o monetário; `% do VGV` e `R$/m²` são
representações derivadas, com precisão plena internamente e arredondamento só na exibição, nunca
persistidas arredondadas. As três exceções de exibição estão em
[Fórmulas da Proforma](formulas), na seção Estado de conformidade.

## Identificador legível

`id_legivel` segue `{SIGLA} - {nome} - {UF} - {sequência}` (por exemplo `INC - Pátio Urbitá 1 - DF
- 002`); na base, sem espaços nem acentos (`inc_patiourbita1_df_002`). A sequência incrementa por
tipo de empreendimento e o identificador não muda quando o estudo é renomeado.

## Núcleo

O app declara `dependencias_nucleo: ["imoveis", "parcelamentos"]` e `permissoes_nucleo` de leitura
para os dois: glebas e lotes vêm de `imoveis`, e `parcelamentos` serve só para excluir do seletor
de terreno da Incorporação os lotes de parcelamento em regularização fundiária ou vinculado a um
setor habitacional. O consumo segue o contrato
padrão do Núcleo: o shell provê as rotas `nucleo/*` do app e o frontend as chama pelo cliente do
Núcleo. A permissão é ligada pelo administrador da instância; sem ela os endpoints respondem 403 e
a interface degrada com aviso, sem quebrar — ver [Administração](administracao).

O app consome apenas a área do imóvel (e o `id_legivel`, para exibir). Ao vincular ou desvincular
imóveis (só em Rascunho), a área somada é persistida em `estudos.area_terreno_nucleo`, para a
Proforma calcular sobre o próprio estudo em todas as telas. Coeficientes, áreas dedutíveis e demais
parâmetros continuam premissas do estudo.

## Instruções para não humanos

As rotas estão descritas por recurso em [Estudo de Viabilidade](readme) e por página em
[Estudo Avançado](avancado), [Funding](funding) e [Administração](administracao). Três regras
transversais: um `PATCH /estudos/:id` que tente mudar `tipo_empreendimento` fora de Rascunho recebe
`422 TIPO_TRAVADO`, e `nivel_analise` nunca muda (`422 NIVEL_IMUTAVEL`); campos exclusivos do
Avançado são ignorados num Preliminar; e todo valor monetário e de área é gravado com duas casas.

## Veja também

- [Fórmulas da Proforma](formulas) · [Funding](funding) · [Benchmarks](benchmarks)
- [Estudo Preliminar](preliminar) · [Estudo Avançado](avancado) · [Administração](administracao)
