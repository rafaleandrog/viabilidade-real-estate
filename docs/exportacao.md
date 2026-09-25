---
titulo: Exportação
descricao: O que sai em PDF, Excel e CSV — a Proforma do Preliminar e o Fluxo de Caixa do Avançado —, com a mesma notação de sinal da tela.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Exportação

> A exportação é gerada no navegador, a partir dos valores já calculados na tela: o arquivo mostra exatamente o que você vê, com a mesma notação de sinal e a mesma célula.

## O que é

Dois blocos são exportáveis: a **Proforma** do estudo Preliminar (PDF e Excel) e o **Fluxo de
Caixa** do estudo Avançado (CSV e PDF). Como a Proforma e o fluxo são calculados no frontend, a
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

A coluna **R$** do CSV e do PDF usa a mesma célula da tabela da tela: receita e resultado com o
sinal real (negativo entre parênteses, positivo sem marca) e custo ou dedução sempre entre
parênteses, porque o app grava custo como valor positivo; a coluna R$ sai em inteiros, como na
tela. A coluna **% VGV** segue a regra da tela: no Resultado a fração leva o sinal (é a margem);
nas demais é a magnitude. Nenhuma célula traz o símbolo "R$" — o cabeçalho da coluna já o diz; os
KPIs do topo do PDF mantêm o símbolo porque ali não há cabeçalho.

Um efeito no CSV, deliberado: a notação contábil grava custo como `(1.234,56)`, e o Excel em
português importa parêntese como número negativo. Não há risco de parsing (o separador é `;` e
nenhum valor contém `;`, aspas ou quebra de linha); o que muda é o sinal que uma fórmula sua
enxerga.

Os Cenários (tornado, margem de segurança e sensibilidade) são visualizados na tela e não têm
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

## Instruções para não humanos

Não há rota de exportação: os arquivos são montados no cliente a partir dos mesmos dados que a
tela lê (`GET /estudos/:id` e as rotas do Avançado). Um cliente que queira reproduzir um arquivo
precisa reproduzir o motor de cálculo, descrito em [Fórmulas da Proforma](formulas).

## Veja também

- [Fórmulas da Proforma](formulas) · [Estudo Preliminar](preliminar) · [Estudo Avançado](avancado)
