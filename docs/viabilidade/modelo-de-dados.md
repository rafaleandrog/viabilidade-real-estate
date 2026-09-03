---
titulo: Modelo de Dados
descricao: Tabelas, relações e regras de precisão do app de viabilidade.
tipo: app
ordem: 2
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Modelo de Dados

Todas as tabelas usam `acesso_externo: "restrito"` — a escrita passa pelas rotas customizadas (regras de negócio e permissão por estudo).

## Tabelas

| Tabela | Papel |
|---|---|
| `estudos` | Registro central (`soft_delete`). Identidade (`id_legivel`, `nome_exibicao`, `sequencia` por tipo), status, origem do terreno, área do terreno (`terreno_manual_area` quando manual; `area_terreno_nucleo` = soma das áreas dos imóveis do Núcleo), e todos os campos de premissas (produto, áreas, custos, impostos, permutas). |
| `preliminar_produtos` | Catálogo de Produtos do Preliminar (#315) — a **única fonte do VGV**: os campos legados de área × preço da linha `estudos` não têm mais campo em tela e deixaram de ser fallback. Só compõe catálogo a linha com `area_media_m2`, `preco_venda_m2` **e** `unidades` maiores que zero; sem nenhuma, o estudo está em estado vazio (`semProdutos`) e a Proforma não mostra número. `GET /estudos` devolve a lista em `produtos` de cada estudo porque, sem ela no payload, TODO estudo do Preliminar calcularia `vgv = 0` (#407). `tipo` (`residencial`/`nao_residencial`, padrão `residencial`, migração `035`, #565) classifica a linha no grid, entre Nome e Área média, e **governa o cálculo** desde a #570: VGV, área total, preço médio ponderado e nº de unidades saem separados por categoria (`totaisPorTipoProdutos`, `frontend/proforma.ts`), e é sobre o total da categoria que as permutas Física e Financeira daquele tipo incidem. Linha sem `tipo` (gravada antes da `035`) conta como residencial. |
| `estudo_imoveis` | Junção N:M com imóveis do Núcleo (`imovel_nucleo_id` como referência lógica; `tipo_imovel` gleba/lote). Único `[estudo_id, imovel_nucleo_id]`. |
| `estudo_membros` | Permissão por estudo (`funcao` leitor/editor/aprovador). Único `[estudo_id, usuario_id]`. |
| `benchmarks` | Valores de referência por tipo de empreendimento. Único `[tipo_empreendimento, campo]`. |
| `apelo_comercial` | Resultado da IA (`resultado` JSON + 6 scores por fator + `score_geral`). |
| `apelo_comercial_documentos` | Fontes anexadas (`documento` arquivo, `tipo_dado`, `texto_adicional`). |
| `estudo_documentos` | Anexos do Empreendimento (imagem principal, renders, plantas). |
| `analise_mercado` | **Snapshot de MERCADO** do estudo (#199) — preço e custo por m², VSO, macros (IPCA/Selic/INCC + Focus), `riscos` JSON, `abrangencia` (município/UF/nacional), `origem` e `data_referencia`. Guarda **só o lado mercado**: o lado "projeto" é derivado do estudo em tempo de render, nunca persistido. Ver [Análise de Mercado](analise-mercado). |

### Avançado — fluxo de caixa (nível `avancado`)

| Tabela | Papel |
|---|---|
| `avancado_cronograma` | 5 eventos por estudo (planejamento, pré-lançamento, lançamento, obra, pós-obra) com `inicio_mes` 0-based e `duracao_meses`. Único `[estudo_id, evento]`. |
| `avancado_curvas` | Curvas de distribuição globais da instância (Curva S padrão + customizadas). |
| `avancado_tipologias` | **Catálogo de tipologias do estudo** (Lote 6 · #19) — nome, tipo, área privativa, dormitórios, vagas, `quantidade` (total de unidades), `unidades_permutadas`. Cadastrado em Empreendimento → Tipologias, **desacoplado** da receita. |
| `avancado_fases` | **Fase** (Lote 6 · #21) — entidade dona da **Absorção** (`absorcao` JSON) e do **Fluxo de Pagamento** (`fluxo_pagamento` JSON). Substitui o antigo `fase_label` de texto. |
| `avancado_alocacoes` | **Alocação de venda** (Lote 6 · #19) — vende `unidades` de uma `tipologia_id` (catálogo) numa `fase_id`, a um `preco_m2`. Várias alocações por tipologia (preços diferentes). Trava de saldo **no estudo inteiro** (#52 — agregada por todas as fases, não por fase): Σ unidades alocadas da tipologia em qualquer fase + Σ unidades em permuta física ≤ `quantidade` do catálogo. |
| `avancado_linhas_receita` | **Vestigial** — modelo antigo (linha de receita com tipologias filhas). Preservada no schema, mas o app não a lê/escreve após a migração 003 (fases + alocações). |
| `avancado_linhas_custo` | Linhas de custo em 5 grupos (terreno/obra/diretos/indireto/financeiro) com unidade de orçamento e ancoragem ao cronograma. |

**Absorção (`avancado_fases.absorcao`)** — modo **Distribuído** em até 4 períodos (Lote 6 · #20,
depois #330/#347): `blocos: [{evento:'pre_lancamento',pct}, {evento:'lancamento',pct},
{evento:'obra',pct}, {evento:'pos_obra',pct}]` (`pre_lancamento` só existe quando o Cronograma tem
essa fase). **Pós-chaves é sempre derivado** — `100 − Σpre_lancamento − Σlancamento − Σobra`
(`pctPosChavesDerivado`, `frontend/fluxo-shared.ts`) — e seu período vem do Cronograma, não do
bloco. ⚠️ **Campo derivado espelhado, não fonte** (#452): desde a issue #452, `pos_obra.pct` grava
o **valor efetivo** que o motor usa (a saída de `pctPosChavesDerivado` sobre os três primeiros
blocos), com precisão plena (C7 — derivado não monetário, não arredonda ao persistir). Antes disso
o campo era gravado como `0` sempre, e nenhum leitor da API tinha como saber a % real de Pós-chaves.
Nada no app **relê** este bloco — é espelho de compatibilidade, o canônico é o cálculo sobre os três
primeiros.

**Fluxo de Pagamento (`avancado_fases.fluxo_pagamento`)** — o JSON legado mantém `comissao`,
**`entrada` e `parcelas` como LISTAS** de linhas (Lote 6 · #20), e `repasse: { apos_entrega_meses }`;
nele, o `%` do Repasse é **derivado** (`100 − Σentrada − Σparcelas`, `pctRepasseDerivado`,
`frontend/fluxo-caixa-motor.ts`) e **não é persistido** — quem ler `entrada`/`parcelas` pela API e
somar os dois **não** vai fechar 100%, por construção; o resto é o Repasse. ⚠️ O sub-objeto por
linha `ret` (RET) **saiu** deste blob (#452): desde a #346 a RET é global do estudo
(`estudos.considerar_ret`/`estudos.ret_pct`), e o legado continuava regravando `ret` morto em toda
escrita — um consumidor da API lia `ret.ativo: false` numa linha de estudo com RET ligada. Desde a
#230, o mesmo campo também aceita o contrato canônico opt-in `componentes`: lista não vazia dos
tipos `imediato`, `prazo_fixo`, `ate_marco` ou `concentrado`, cujas `participacaoPct` fecham 100%. A
leitura legada segue preservada por adaptador até o motor por safras passar a consumir os
componentes (#283).

Integridade (Lote 6 · #19): excluir uma tipologia do catálogo com alocações é **bloqueado** (422 `TIPOLOGIA_EM_USO`); editar nome/área reflete ao vivo nas alocações (a alocação guarda só unidades + preço). E, desde a #433, **reduzir a `quantidade` do catálogo abaixo do que já está comprometido** — alocações de venda **mais** permuta física — é recusado com 422 `SALDO_EXCEDIDO`: era a quarta porta do saldo, e a única que não validava nada. `PATCH` parcial sem o campo `quantidade` não é assunto da regra.

## O que a duplicação de estudo copia (#609)

`POST /estudos/:id/duplicar` cria o estudo novo com `montarCopiaEstudo` (colunas de `estudos`,
menos as geradas pelo shell) e depois copia as **estruturas filhas**. Tudo dentro de um
`try`/`catch` que **remove o estudo recém-criado** se qualquer filha falhar — não há transação em
`req.dados`, e um clone pela metade é pior que nenhum.

| Estrutura | Copiada | Como |
|---|---|---|
| `estudo_imoveis` | ✅ | vínculo com o imóvel do Núcleo |
| `preliminar_produtos` | ✅ | `FILHAS_SIMPLES` — **a única fonte de VGV** desde a #563 |
| `analise_mercado` | ✅ | `FILHAS_SIMPLES` |
| `apelo_comercial` | ✅ | `FILHAS_SIMPLES` (os scores e o laudo; ver a ressalva abaixo) |
| `avancado_cronograma`, `avancado_tipologias`, `avancado_fases`, `avancado_alocacoes`, `avancado_linhas_custo`, `avancado_cenarios` | ✅ | `duplicarDadosAvancado`, só quando `nivel_analise === 'avancado'` |
| `avancado_funding_operacoes` | ✅ | idem — entrou na #609 |
| `estudo_documentos`, `apelo_comercial_documentos` | ❌ | **decisão pendente** — ver abaixo |
| `estudo_membros` | ❌ | **decisão pendente** — o criador da cópia entra como editor |
| `avancado_linhas_receita`, `avancado_capital_instrumentos` | ❌ | tabelas de modelos **apagados**; copiá-las propagaria dado morto |

**Nenhuma referência VIVA aponta para o original.** Toda referência interna com leitor é
reapontada para a linha correspondente da cópia: `fase_ancora_id` (custos e operações de funding),
`tipologia_id` das alocações, `permuta_tipologia_id` das linhas de custo e a lista
`custo_linha_ids` das operações de funding (`remapearCustoLinhaIds`). Id sem correspondência é
**descartado** enquanto sobrar id vivo — manter faria a cópia somar linhas de outro estudo, e o
motor leria isso sem erro nenhum. A exceção é a lista **toda** órfã: ela volta como veio, porque
devolver `[]` ativaria a base padrão do motor (`frontend/funding-motor.ts:927` exige `length` para
usar a seleção) e a cópia financiaria o que o original não financia; ids órfãos são sempre de
linhas **apagadas** (o mapa cobre toda linha existente), então mantê-los não alcança estudo nenhum. Duas exceções declaradas: `curva_id` copia direto porque curvas são
**globais da instância**, não do estudo; e `estudos.permuta_fisica_produto_id` /
`permuta_fisica_nr_produto_id` **viajam cru** — são colunas **inertes** desde a #566 (a permuta
por unidade saiu do app; nenhum leitor fora de `schema.json` e migrações), então o id do produto
original que sobreviver nelas não alimenta cálculo nenhum. Se um dia essas colunas voltarem a ter
leitor, o remapeamento delas entra junto.

> ⚠️ **Duas ausências que esperam decisão do autor, e o motivo de cada uma.**
>
> · **Arquivos** (`estudo_documentos`, `apelo_comercial_documentos`): a coluna `documento` é do
> tipo `arquivo`, e o binário pertence ao **shell**. Copiar a linha com o mesmo id deixa dois
> registros sobre o mesmo arquivo — apagar uma das cópias pode levar o arquivo da outra junto —, e
> duplicar o binário de verdade exige um verbo do SDK que a sessão de nuvem **não consegue
> conferir** (pacote privado, 401). Consequência hoje: a cópia leva o **apelo comercial** (scores e
> laudo) sem os documentos que o geraram.
>
> · **Membros** (`estudo_membros`): é ACL, não dado do estudo. Copiar a lista concederia acesso a
> terceiros a um estudo que eles não sabem que existe, e dispara notificação.

## Referências lógicas — colunas de id sem FK

Três colunas guardam id de outra linha **sem** chave estrangeira no banco. Não é descuido; cada
uma tem motivo próprio, e nenhuma delas deve ser "corrigida" para `referencia`.

| Coluna | Por quê |
|---|---|
| `estudo_imoveis.imovel_nucleo_id` | o alvo vive no Núcleo, fora do schema `viabilidade` — cross-schema não é expressável aqui |
| `estudos.permuta_fisica_produto_id` | quebra do ciclo com `preliminar_produtos` (abaixo) |
| `estudos.permuta_fisica_nr_produto_id` | idem |

### O ciclo `estudos` ↔ `preliminar_produtos`

`preliminar_produtos.estudo_id` aponta para `estudos` (obrigatório, `cascata`) e, até a correção
de 2026-08-18, os dois `permuta_fisica_*_produto_id` de `estudos` apontavam de volta para
`preliminar_produtos`. Isso é um **ciclo**, e ciclo quebra a instalação numa instância **virgem**:
o sincronizador do shell emite a FK **inline no `CREATE TABLE`**, e num ciclo não existe ordem de
criação que satisfaça as duas pontas. Ele não reprova nem adia a FK — só desiste da aresta e cria
as tabelas fora de ordem, o que estoura com

```
[dry_run_schema] relation "viabilidade.estudos" does not exist
```

**Por que ninguém viu antes:** `preliminar_produtos` chegou na migração `021` e os
`permuta_fisica_*_produto_id` na `022` — em instância que já tinha a app, as colunas nasceram por
`ALTER TABLE ADD COLUMN`, onde o alvo já existe. A instalação virgem **pula as migrações** e
materializa tudo pelo `schema.json`: é o único caminho que exercita a ordem de criação. A app
nunca foi instalável do zero, e o defeito só apareceu na primeira instância nova.

**A saída** foi soltar o lado **fraco**: os dois `*_produto_id` viraram `inteiro`. O lado forte
(`preliminar_produtos.estudo_id`, obrigatório e `cascata`) ficou como estava — é ele que garante
que produto não sobreviva ao estudo.

**Custo real: nenhum.** Os dois campos eram memória da seleção da UI, não fonte de cálculo — o
motor sempre consumiu o canônico em m² (`permuta_fisica_area_canonica`/`_nr_area_canonica`), nunca
o `produto_id`. **Desde a #566 a própria unidade "seleção de produto" saiu da tela** — só m² e %
área de venda sobrevivem em `frontend/tela-premissas.ts` (`PERMUTA_UNIDADE`/`PERMUTA_FIS_NR`) — e os
dois `*_produto_id` (com o par `_quantidade`) ficam **inertes** no schema: sem leitor, sem escritor.
A migração `036_fim_permuta_unidade.js` converte todo estudo que ainda tinha
`permuta_fisica_modo`/`permuta_fisica_nr_modo` = `'unidade'` para `'area_m2'`, usando o mesmo
canônico que já era a fonte de cálculo — nenhum estudo muda de resultado.

O guard `scripts/guard-schema-ciclos.mjs` (etapa 1/5 do `validar-frontend.sh` e job
`schema-ciclos` no `pr-guards.yml`) impede a volta do ciclo. Ele existe porque esta falha é
**silenciosa** no repo inteiro: typecheck, testes, esbuild e o harness de migrações ficam verdes.

## Evolução de domínio prevista para recebíveis

> ⚠️ **Seção consultiva.** Nada aqui existe no `schema.json`, em migração ou em runtime. Ela
> registra os conceitos que o modelo de dados precisará representar quando as issues de recebíveis
> da Rodada 5 forem aprovadas e implementadas. **Nenhuma tabela ou coluna deve ser criada a partir
> deste texto** — só a partir de issue aprovada.

A revisão de recebíveis Calliandra (`docs/revisao-recebiveis-calliandra-2026-07-31.md`) concluiu que
a unidade financeira elementar do fluxo avançado **não é o mês**, e sim a **safra**.

| Conceito | O que precisa ser representado |
|---|---|
| **Safra** | Contratos originados no mesmo `mês × Grupo × alocação × componente`. É a chave econômica mínima; hoje não existe entidade equivalente |
| **Componente de pagamento** | Regra que converte parte do contrato em recebimentos. Quatro tipos: **imediato**, **prazo fixo**, **até marco**, **concentrado em marco**. O contrato já pode ser persistido em `fluxo_pagamento.componentes`; o motor por safras ainda será conectado na #283 |
| **Bruto / desconto / líquido** | Três séries mensais separadas por Grupo e tipologia. Hoje existe uma única série derivada do VGV, e o desconto comercial não existe |
| **Primeiro vencimento** | Defasagem configurável, com padrão `s + 1`. Hoje não há campo — as parcelas partem do mês da venda ou do cronograma da Obra |
| **Prazo fixo** | `N` fixo por componente, contado a partir de cada safra (36, 120, outros) |
| **Marco** | Mês comum de encerramento; o prazo da safra passa a ser `N_s = M − s` |
| **Saldo** | Saldo por safra e componente, com `saldo_s,s = principal_s` e `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t`. A carteira total é a soma desses saldos, nunca uma recorrência agregada |

Duas restrições que a evolução precisa respeitar: **compatibilidade de leitura** dos estudos já
gravados (via adapter do JSON legado, EVI-010 / #230) e o inventário de dados legados
(EVI-002 / #221), que é portão da rodada.

## Evolução de domínio prevista para Terreno, valores e funding

> ⚠️ **Seção consultiva, acrescentada em 2026-08-01.** Como a de cima: **nada aqui existe** no
> `schema.json`, em migração ou em runtime. Ela registra o que o modelo de dados precisará
> representar quando as issues da lista de bugs forem aprovadas e implementadas. **Nenhuma tabela
> ou coluna deve ser criada a partir deste texto.**

| Conceito | O que precisa ser representado | Issue |
|---|---|---|
| **Linha Preço canônica** | Identidade `obrigatoria` garantida em **todo** estudo, inclusive nos que o backfill da `007` não alcançou — a migração cobre só `terreno/Compra` de menor id por estudo | #256 |
| **Subcategoria de Preço** | Quatro valores exatos: `Valor à vista`, `Parcelado`, `Permuta física`, `Permuta financeira`. Hoje há uma única `Permuta`, que o motor trata como **financeira** (`frontend/fluxo-caixa-motor.ts:385`). Migração aprovada: toda `Permuta` legada → `Permuta financeira`, preservando o resultado de todo estudo | #257 |
| **Permuta física por tipologia** | Referência de tipologia + quantidade **na linha de custo do Terreno**, substituindo `avancado_tipologias.unidades_permutadas` como fonte de verdade. Exige base de valoração declarada quando a tipologia tem `preco_m2` diferente por Grupo | #258 · #266–#269 |
| **Valor canônico multiunidade** | Quantidade econômica com precisão suficiente, independente da unidade exibida. Hoje o valor **exibido é o persistido**, em duas arquiteturas distintas: um campo por unidade nas Premissas, um único `orcamento_valor` + `orcamento_unidade` em Custos | #259 · #260 |
| ~~**Instrumento de capital**~~ | 🔴 **Evolução CANCELADA pela #355 (2026-08-12)** — ver o bloco abaixo | ~~#239 · #271~~ |

Duas restrições valem para todas: nenhum estudo **aprovado, reprovado ou arquivado** pode mudar de
resultado por migração, e toda migração nova exige **bump da `versao`** do manifesto.

### 🔴 "Instrumento de capital" — a evolução que foi cancelada, e o que existe no lugar

> **Registro histórico, não previsão.** Preservado com o motivo, seguindo o precedente de
> [Funding, Capital Stack e Retorno do Capital](funding-capital-stack): a memória de por que o
> waterfall foi projetado tem valor, e apagá-la faria a próxima sessão reinventá-lo.

A linha acima descrevia uma entidade de camada do **Capital Stack** — tipo, compromisso, prioridade
de utilização, prioridade de pagamento, calendário de aporte/liberação e status — que substituiria
`financiamento_*`, `investidor_*` e `estrutura_*_pct` como entrada. **Ela nunca foi implementada, e
deixou de ser o caminho.** A **#355** apagou o modelo de 4 instrumentos com waterfall em 2026-08-12;
a epic #239 e as sub-issues #270–#279 não existem mais como plano.

⚠️ **Por que isto era enganoso mesmo estando numa seção consultiva.** A seção inteira avisa que
"nada aqui existe" — mas ela promete o que **vai** existir, e esta linha prometia um futuro
cancelado. Quem a lesse sairia procurando (ou pior, recriando) uma competição por caixa que a
Rodada 7 eliminou de propósito.

**O que existe hoje**, e é a entidade vigente do domínio de funding:

| Entidade vigente | Onde mora | Spec |
|---|---|---|
| **Operação de funding** — três tipos independentes, **sem waterfall, sem prioridades, sem competição por caixa**: `financiamento_producao` (única por estudo), `divida` e `equity` (quantas quiser, nomeáveis) | tabela `avancado_funding_operacoes` (migração `029`); motor `frontend/funding-motor.ts`; tela `frontend/tela-funding.ts`; rotas `backend/rotas/funding.ts` | [Fluxo do Investidor](fluxo-investidor-formulas) para `divida` e `equity` |

⚠️ **`financiamento_producao` é a exceção, e ela continua vigente.** A **§4.3** de
[Funding, Capital Stack e Retorno do Capital](funding-capital-stack) — gatilho de exposição mínima,
catch-up retroativo e cash sweep — foi **preservada de propósito** pela #355 e aprovada pela #405. É
o único produto que **não** segue a planilha do Fluxo do Investidor. Rebaixar aquele documento
inteiro a histórico seria erro: só o resto dele é ADR.

Detalhe completo em `docs/lista-bugs-planejamento-2026-07-31.md` e, para o Capital Stack, em
[Funding, Capital Stack e Retorno do Capital](funding-capital-stack).

## Regras de precisão

**Precisão de persistência** — o que a coluna guarda:

- Monetários (R$) e áreas (m²): `decimal(12,2)`.
- Percentuais de entrada: `decimal(5,2)` (comporta defaults fracionários como 6,73% / 1,6% / 0,25%).
- Scores do apelo: `decimal(3,1)`.

**Precisão de resultado** — o que o cálculo produz (contrato de 2026-08-01):

> **Todo valor monetário que é resultado de fórmula tem 2 casas decimais**, na apresentação, na
> entrada e no motor.

São duas regras diferentes e é fácil confundi-las. `decimal(12,2)` já permite centavos desde o
início; o que faltava era dizer que **o cálculo também é quantizado a 2 casas**. Consequências:

- o **valor canônico** de uma premissa multiunidade é o **monetário**, a 2 casas;
- `% do VGV` e `R$/m²` são **representações derivadas**: carregam precisão plena internamente e
  arredondam **só para exibir**. Persistir a representação arredondada é o defeito que a #259
  corrige — foi assim que R$ 10.000.000 virou R$ 9.999.998,76 ao passar por 12,09%;
- áreas (m²) seguem `decimal(12,2)` na persistência; a regra de resultado acima é declarada para
  **valor monetário**.

> ⚠️ **Divergência viva hoje:** a tela formata R$ com **zero** casas (`frontend/viab-format.ts:8`,
> `maximumFractionDigits: 0`) e a exportação com **duas** (`frontend/exportar.ts:9`, `toFixed(2)`) —
> o mesmo estudo mostra números diferentes em CSV e em tela. Correção rastreada pela **#281**.

## id_legivel

Template `{SIGLA} - {nome} - {UF} - {sequência}` (ex.: `INC - Pátio Urbitá 1 - DF - 002`). Na base, sem espaços/acentos: `inc_patiourbita1_df_002`. A sequência incrementa por `tipo_empreendimento`.

## Núcleo

O app declara `dependencias_nucleo: ["imoveis"]` e `permissoes_nucleo: { "imoveis": ["ler"] }` no manifesto — só leitura de glebas/lotes (o supertipo `imoveis` cobre ambos os subtipos). O consumo segue o contrato padrão do Núcleo (`docs/shell/nucleo.md`): o shell provê as rotas `/api/viabilidade/nucleo/*` e o frontend chama via `urbiVerso.nucleo('/glebas' | '/lotes' | '/imoveis/:id')`. O gate real (por entidade/flag) é ligado pelo admin da instância; sem isso, os endpoints retornam 403 e a UI degrada com aviso (sem quebrar).

O app consome apenas a **área** (e o `id_legivel` para exibição) do imóvel. Ao vincular/desvincular imóveis (só em Rascunho, via `estudo_imoveis`), a área somada é persistida em `estudos.area_terreno_nucleo` para a Proforma calcular sobre o objeto estudo em todas as telas. Coeficientes, áreas dedutíveis e demais parâmetros continuam inputs do estudo. Ver [Visão Geral](visao-geral) para origem manual vs. Núcleo.
