---
titulo: Análise de Mercado
descricao: Como a página Análise de mercado do estudo Avançado compara os números do projeto com os do mercado da região monitorada, de onde vem cada lado, o que a rotina diária coleta e o que a IA pode e não pode fazer.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Análise de Mercado

> Uma página do estudo Avançado que põe lado a lado o preço, o custo de obra e a velocidade de vendas do projeto e os do mercado da região monitorada — o lado projeto derivado do próprio estudo, o lado mercado gerado por IA sobre o que a rotina diária coletou.

## O que é

A análise de mercado responde "como este projeto se posiciona em relação ao mercado da região?".
Ela **não** é o [Apelo Comercial (IA)](apelo-comercial), que pontua o ativo em seis fatores
qualitativos: aqui a comparação é numérica. Os dois lados têm origens diferentes, e isso explica
quase tudo o que a página faz:

| Lado | De onde vem | Persistido? |
|---|---|---|
| **Projeto** | derivado do próprio estudo ao renderizar | não |
| **Mercado** | um retrato por estudo, gerado pela IA sob demanda e guardado em `analise_mercado` | sim |

O lado projeto não é digitado nem salvo porque todos esses números já existem no estudo (preço nas
tipologias e alocações, custo de obra nas linhas de custo, velocidade na absorção). Uma segunda
cópia envelheceria no instante em que qualquer outra página fosse editada.

## Para usuários

A página **Análise de mercado** do estudo Avançado mostra:

- **Região monitorada** — o vínculo do estudo com uma das regiões cadastradas pelo administrador
  (**Não vinculada** enquanto não houver); as regiões estão descritas em
  [Administração](administracao).
- **Projeto × mercado** — três indicadores, cada um com o valor do projeto, o do mercado e a
  posição (acima, abaixo ou alinhado, com a magnitude): **Preço de venda (R$/m²)**, **Custo de
  obra (R$/m²)** e **Velocidade de vendas (%/mês)**. A página não diz se estar acima é bom ou
  ruim: preço acima pode ser produto premium ou preço irreal; quem interpreta é você.
- **Sinais de risco** — os riscos que a IA apontou para a região, classificados nos mesmos seis
  fatores do Apelo Comercial.
- **Coletado sobre a região** — o material que a rotina diária guardou.
- **Indicadores macro** — IPCA (12 meses), Selic, INCC (12 meses) e as projeções Focus para IPCA e
  Selic, do retrato de mercado.

**Analisar mercado** gera o retrato (e **Refazer análise** o substitui). A análise é sempre sob
demanda, nunca ao abrir a página, porque custa IA. Um aviso fixo lembra que a página não é
recomendação de investimento.

Como o lado projeto é derivado:

| Indicador | Fórmula | Observação |
|---|---|---|
| **Preço de venda (R$/m²)** | `VGV total ÷ área privativa total` | média ponderada pela área, não a média aritmética dos preços por tipologia |
| **Custo de obra (R$/m²)** | `Σ das linhas do grupo Obras ÷ área privativa total` | usa as linhas já resolvidas pelo motor do fluxo, na unidade certa |
| **Velocidade de vendas (%/mês)** | média de `100 ÷ meses com venda`, ponderada pelo VGV de cada fase | lê a absorção como velocidade de vendas |

Sem dado para derivar (sem tipologia, sem linha de obra, sem cronograma) o indicador sai como `—`,
nunca como zero — zero é um valor, e diria outra coisa.

Três ausências são tratadas separadamente: **sem retrato de mercado**, a página mostra o lado
projeto e avisa que a comparação aparece quando a análise for gerada; **sem série do município**,
a coluna `abrangencia` do retrato (município, UF ou nacional) diz o alcance real do dado e a
página avisa que a referência é mais ampla; **sem dado do projeto**, o indicador isolado sai como
`—` sem derrubar os outros.

## Para administradores

As **Regiões monitoradas** (nome, UF, palavras-chave e o interruptor de coleta) ficam na aba do
Painel e em *Admin → Apps → viabilidade → Regiões monitoradas*; o botão **Ver coletas** mostra o
que a rotina guardou para cada uma. Ver [Administração](administracao).

**A rotina diária.** O manifesto declara a rotina **Coleta diária de mercado**, que o shell dispara
uma vez por dia; o app não agenda nada por conta própria. Para cada região ativa ela monta os termos
de busca (nome, UF e palavras-chave), consulta uma fonte externa de busca, manda o bruto para a IA
no slot barato — que classifica cada item num dos seis fatores, resume e pontua a relevância — e
grava o resultado em `mercado_coletas`, registrando o estado da última coleta na própria região.

**O limite que define o desenho: a IA do UrbiVerso não navega na web.** Ela recebe texto e devolve
JSON estruturado. Por isso, sem fonte externa configurada, a rotina **não** pergunta à IA o que ela
sabe sobre a região: registra `sem_fonte_externa` e não grava item nenhum. Conteúdo vindo da
memória do modelo entraria no app com aparência de notícia apurada. Hoje o manifesto não declara os
parâmetros da fonte de busca, então a rotina roda nesse modo em toda instância.

**A trava contra número inventado.** O prompt pede que a IA não invente valores; o que vincula é a
normalização no servidor, que descarta o indicador — vira "sem dado" — quando o valor não é número
finito ou é negativo, quando vem sem origem, ou quando vem com confiança "sem dado" e valor
preenchido. Número sem procedência não chega à tela.

## Instruções para não humanos

| Rota | O que faz |
|---|---|
| `GET /estudos/:id/analise-mercado` | devolve `{ analise, regiao, coletas }`; `analise` é `null` (não 404) enquanto o retrato não existir |
| `PATCH /estudos/:id/analise-mercado/regiao` | vincula ou desvincula a região monitorada (função de `editor`) |
| `POST /estudos/:id/analise-mercado` | gera o retrato pela IA (função de `editor`); `422 IA_INDISPONIVEL` quando o framework de IA não está habilitado para o app na instância |
| `GET`/`POST /mercado/regioes` · `PATCH`/`DELETE /mercado/regioes/:rid` | as regiões monitoradas (escrita só `admin`) |
| `GET /mercado/regioes/:rid/coletas` | o que a rotina guardou para a região |

O retrato (`analise_mercado`) guarda `abrangencia`, `localidade`, `preco_medio_m2`,
`custo_obra_m2`, `vso_pct`, `ipca_pct`, `selic_pct`, `incc_pct`, `focus_ipca_pct`,
`focus_selic_pct`, `riscos` (JSON), `resultado` (o payload bruto da IA), `origem` e
`data_referencia`. A relevância das coletas e a classificação dos riscos usam os mesmos seis
fatores do Apelo Comercial — um único vocabulário para "região boa".

## Veja também

- [Apelo Comercial (IA)](apelo-comercial) · [Administração](administracao) · [Estudo Avançado](avancado)
- [Modelo de Dados](modelo-de-dados)
