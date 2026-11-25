---
titulo: Exportação
descricao: O que sai em PDF, Excel e CSV — a Proforma do Preliminar, o Fluxo de Caixa do Avançado e o Dossiê do projeto para investidor —, com a mesma notação de sinal e os mesmos números da tela.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Exportação

> A exportação é gerada no navegador, a partir dos valores já calculados na tela: o arquivo mostra exatamente o que você vê, com a mesma notação de sinal e a mesma célula.

## O que é

Três saídas são exportáveis: a **Proforma** do estudo Preliminar (PDF e Excel), o **Fluxo de
Caixa** do estudo Avançado (CSV e PDF) e o **Dossiê do projeto** (PDF, nos dois níveis), que
apresenta o estudo a quem vai investir. Como a Proforma e o fluxo são calculados no frontend, a
exportação também é: nada é recalculado na hora de exportar, o que garante fidelidade ao que está
na tela.

## Para usuários

### Proforma do Preliminar

Na sub-aba **Proforma** de **Resultado**, os botões **Exportar Excel** e **Exportar PDF**.

- **PDF** — abre uma página com o cabeçalho do estudo, os KPIs e a Proforma linha a linha, com os
  estilos do app, e aciona a impressão do navegador ("Salvar como PDF"). Permita pop-ups para
  exportar em PDF.
- **Excel** — gera um CSV (UTF-8 com BOM, separador `;`, decimais em vírgula) que o Excel abre
  diretamente, com todas as linhas da Proforma e o percentual sobre o VGV.

O tipo de empreendimento sai no CSV e no cabeçalho dos dois PDFs, e o status no cabeçalho do PDF
da Proforma, com os mesmos rótulos da tela ("Incorporação", "Em análise"), e não com o valor
interno.

A coluna **R$** do CSV e do PDF usa a mesma célula da tabela da tela: receita e resultado com o
sinal real (negativo entre parênteses, positivo sem marca) e custo ou dedução sempre entre
parênteses, porque o app grava custo como valor positivo; a coluna R$ sai em inteiros, como na
tela. A coluna **% VGV** segue a regra da tela: no Resultado a fração leva o sinal (é a margem);
nas demais é a magnitude. Nenhuma célula traz o símbolo "R$" — o cabeçalho da coluna já o diz; os
KPIs do topo do PDF mantêm o símbolo porque ali não há cabeçalho.

Um efeito no CSV, deliberado: a notação contábil grava custo como `(1.234,56)`, e o Excel em
português importa parêntese como número negativo; o que muda é o sinal que uma fórmula sua
enxerga.

O texto digitado no app — nome do estudo, nome de linha, tipologia, mensagem de divergência — sai
protegido no CSV: a célula que contém `;`, aspas ou quebra de linha vem entre aspas (com as aspas
internas dobradas), e o texto que começa com `=`, `+`, `-`, `@`, tabulação ou retorno de carro
ganha um apóstrofo na frente, para a planilha o ler como texto e não como fórmula. Isso vale para todo texto,
inclusive os rótulos de totais (`= Resultado` sai como `'= Resultado`) e a nota de permuta
limitada; na tela o rótulo continua sem o apóstrofo. Números não recebem o apóstrofo.

Os Cenários (a análise de sensibilidade) são visualizados na tela e não têm
exportação própria.

### Fluxo de Caixa do Avançado

Na sub-aba **Fluxo de Caixa** de **Resultados**, os botões **CSV** e **PDF** exportam a tabela na
visão selecionada — mensal ou anual — com a mesma hierarquia da tela: a Receita Bruta (VGV) com as
divisões por grupo de receitas, os cinco grupos de custos, as operações de funding e o fluxo, mais
os indicadores (TIR, VPL, payback, exposição máxima, venda bruta, desconto comercial e venda
líquida contratadas, receita bruta, juros de clientes e carteira máxima) e o relatório de
reconciliação. No CSV os indicadores vêm ao fim, com o mês da carteira máxima; no PDF vão como
cartões no topo de cada página. Quando o estudo tem permuta física declarada, a tabela por
tipologia (quantidade permutada, quantidade total do catálogo e área permutada) sai junto, da mesma
fonte da tela. As células monetárias saem em duas casas, com o mesmo limiar de célula vazia da
tela.

A Proforma do Avançado não tem exportação própria.

### Dossiê do projeto

Um PDF para apresentar o projeto a um investidor, montado do que o estudo já tem, sem redigitar. O
botão **Dossiê do projeto** fica ao lado de **Exportar PDF** na sub-aba **Proforma** de
**Resultado** (Preliminar) e ao lado de **CSV** e **PDF** nas sub-abas **Fluxo de Caixa** e
**Análise Financeira** de **Resultados** (Avançado). Como nos outros PDFs, a janela de impressão
abre ao clicar e o navegador oferece "Salvar como PDF"; permita pop-ups.

Cada nível leva as seções que tem, e **seção sem dado não aparece** — nem o título:

| Seção | Preliminar | Avançado |
|---|---|---|
| **Identificação do empreendimento** — UF, matrícula, terreno, áreas, número de unidades e a tabela de tipologias | do catálogo de Produtos | a área privativa e as unidades das linhas de receita, e a tabela do catálogo de tipologias, com as unidades do catálogo (que podem incluir unidades ainda sem linha de receita) |
| **Indicadores principais** | os da Proforma: VGV, receita líquida, resultado, margem sobre VGV, custo de obras sobre VGV, ROI, investimento e a área permutada | os do Fluxo de Caixa: VGV potencial, receita bruta, resultado, margem de caixa, TIR, VPL, payback, exposição máxima, juros de clientes, carteira máxima e ROI do projeto, mais, quando existirem, Equity Multiple, Yield e LTV de cada dívida |
| **Cenários** | a sensibilidade ao preço de venda (Bear, Base e Bull), com a variação do benchmark | os cenários salvos, ao lado do cenário real: alavancas, VGV potencial, resultado, margem de caixa, VPL, TIR, payback e exposição |
| **Estrutura de funding** | — | as operações, o Fluxo de Caixa Livre contra o Fluxo de Caixa e, havendo dívida ou equity, o retorno por parte |
| **Análise de mercado** | — | projeto contra mercado e indicadores macro, só onde o dado tem origem informada |
| **Apelo Comercial** | só com análise rodada (aparece como "Análise de Mercado do Imóvel (IA)") | só com análise rodada |

Os números são os da tela, pelos mesmos formatadores: o dossiê não recalcula nada que a tela não
calcule. O Avançado sai sempre do **projeto inteiro** — o filtro de fase e a visão mensal ou anual
da tabela não o alteram, como nos cards de ROI do projeto e Visão do investidor. Os valores em R$
saem com duas casas, como nos KPIs do PDF da Proforma, e não nos inteiros da coluna R$ da Proforma.
Na visão do investidor (Equity Multiple, Yield e LTV), o que a tela mostraria como "—" sai sem a
linha; nos demais indicadores e nas tabelas sai "—".

Se a leitura do Apelo, dos cenários salvos ou da análise de mercado falhar, a seção correspondente
deixa de sair, e o resto do dossiê é gerado.

### Cores do PDF

Os três PDFs saem sempre nas cores do **tema claro** da instância (papel claro, texto escuro),
qualquer que seja o tema escolhido na tela: escuro, sépia ou cyberpunk não mudam o documento
impresso. As barras positivas e negativas do gráfico do fluxo e as linhas de erro e de alerta do
relatório de reconciliação usam as cores de sucesso, erro e alerta desse tema. Se o navegador não
deixar o app ler o tema, o PDF sai em preto e branco, com o mesmo conteúdo.

## Instruções para não humanos

Não há rota de exportação: os arquivos são montados no cliente a partir dos mesmos dados que a
tela lê (`GET /estudos/:id` e as rotas do Avançado). Um cliente que queira reproduzir um arquivo
precisa reproduzir o motor de cálculo, descrito em [Fórmulas da Proforma](formulas).

O dossiê não tem rota própria: além dos dados que a tela já carregou, ele lê o Apelo Comercial
(`GET /estudos/:id/apelo-comercial`), e, no Avançado, os cenários salvos
(`GET /estudos/:id/avancado/cenarios`) e a análise de mercado (`GET /estudos/:id/analise-mercado`).

No PDF, todo texto vindo de dado (nome do estudo, tipologia, linha de custo, nome de cenário ou de
operação de funding, texto de mercado e de Apelo, mensagem de reconciliação, rótulo de mês) sai como texto literal: caracteres como `<` e `&` aparecem na página
como estão, nunca interpretados como marcação.

## Veja também

- [Fórmulas da Proforma](formulas) · [Estudo Preliminar](preliminar) · [Estudo Avançado](avancado) · [Funding](funding) · [Análise de mercado](analise-mercado) · [Apelo comercial](apelo-comercial)
